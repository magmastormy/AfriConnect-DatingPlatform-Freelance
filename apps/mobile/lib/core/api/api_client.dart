import 'dart:async';
import 'dart:convert';
import 'dart:math';

import 'package:http/http.dart' as http;
import 'package:http_parser/http_parser.dart';

import '../storage/platform_storage.dart';

class ApiFailure implements Exception {
  const ApiFailure(this.message,
      {this.code, this.status, this.field, this.details});

  final String message;
  final String? code;
  final int? status;
  final String? field;
  final dynamic details;

  @override
  String toString() => message;
}

class ApiClient {
  ApiClient({
    http.Client? client,
    String? baseUrl,
    PlatformStorage? secureStorage,
  })  : _client = client ?? http.Client(),
        baseUrl = baseUrl ?? _defaultBaseUrl(),
        _storage = secureStorage ?? SecureStorage();

  static const _apiMount =
      String.fromEnvironment('API_MOUNT_PATH', defaultValue: 'api');

  static String _defaultBaseUrl() {
    const origin = String.fromEnvironment(
      'API_ORIGIN',
      defaultValue: 'http://localhost:4000',
    );
    final root =
        origin.endsWith('/') ? origin.substring(0, origin.length - 1) : origin;
    final mount = _apiMount.replaceAll(RegExp(r'^/+|/+$'), '');
    final prefix = mount.isEmpty ? '' : '$mount/';
    // ignore: unnecessary_brace_in_string_interps
    return '${root}/${prefix}v1';
  }

  final http.Client _client;
  final String baseUrl;
  final PlatformStorage _storage;

  static const requestTimeout = Duration(seconds: 20);
  static const _tokenKey = 'africonnect.accessToken';
  static const _refreshKey = 'africonnect.refreshToken';
  static const _deviceKey = 'africonnect.deviceId';

  String? _memAccess;
  String? _memRefresh;
  String? _memDeviceId;
  Future<String?> Function()? deviceIdProvider;
  Future<bool> Function()? refreshSession;
  Future<void> Function()? onAuthenticationFailure;

  // ── Token persistence ──────────────────────────────────────────────────────

  String? get accessToken => _memAccess;

  set accessToken(String? token) {
    _memAccess = token;
  }

  Future<void> setAccessToken(String token) async {
    _memAccess = token;
    await _storage.write(key: _tokenKey, value: token);
  }

  Future<String?> get refreshToken async {
    if (_memRefresh != null) return _memRefresh;
    _memRefresh = await _storage.read(key: _refreshKey);
    return _memRefresh;
  }

  Future<void> setRefreshToken(String token) async {
    _memRefresh = token;
    await _storage.write(key: _refreshKey, value: token);
  }

  Future<void> setTokens(String access, String refresh) async {
    await Future.wait([setAccessToken(access), setRefreshToken(refresh)]);
  }

  Future<void> clearTokens() async {
    _memAccess = null;
    _memRefresh = null;
    await Future.wait<void>([
      _storage.delete(key: _tokenKey),
      _storage.delete(key: _refreshKey),
    ]);
  }

  // ── Device ID (stable per-device, survives app reinstalls via secure storage) ──
  Future<String> getDeviceId() async {
    if (_memDeviceId != null) return _memDeviceId!;
    _memDeviceId = await _storage.read(key: _deviceKey);
    if (_memDeviceId == null) {
      // 24 random bytes -> base64url, ~32 chars
      final bytes = List<int>.generate(24, (_) => Random.secure().nextInt(256));
      _memDeviceId = base64UrlEncode(bytes).replaceAll(RegExp(r'=+$'), '');
      await _storage.write(key: _deviceKey, value: _memDeviceId!);
    }
    return _memDeviceId!;
  }

  // ── HTTP methods ────────────────────────────────────────────────────────────

  Future<T> get<T>(String path) async => await _request('GET', path) as T;
  Future<T> post<T>(String path, [Map<String, dynamic>? body]) async =>
      await _request('POST', path, body) as T;
  Future<T> put<T>(String path, [Map<String, dynamic>? body]) async =>
      await _request('PUT', path, body) as T;
  Future<T> patch<T>(String path, [Map<String, dynamic>? body]) async =>
      await _request('PATCH', path, body) as T;
  Future<T> delete<T>(String path, [Map<String, dynamic>? body]) async =>
      await _request('DELETE', path, body) as T;

  Future<T> postWithoutRefresh<T>(String path,
          [Map<String, dynamic>? body]) async =>
      await _request('POST', path, body, false) as T;

  // ── Core request with retry, refresh, device ID ────────────────────────────

  Future<dynamic> _request(String method, String path,
      [Map<String, dynamic>? body, bool allowRefresh = true]) async {
    const idempotent = <String>{'GET', 'HEAD'};
    final maxAttempts = idempotent.contains(method) ? 3 : 1;
    const retryDelays = [
      Duration(milliseconds: 400),
      Duration(milliseconds: 1200)
    ];

    for (int attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        return await _attemptRequest(method, path, body, allowRefresh);
      } on ApiFailure catch (e) {
        final exhausted = attempt == maxAttempts - 1;
        if (!idempotent.contains(method) || exhausted || !_isRetryable(e)) {
          rethrow;
        }
        await Future.delayed(retryDelays[attempt]);
      }
    }
    throw const ApiFailure('Request failed', code: 'NETWORK');
  }

  Future<dynamic> _attemptRequest(String method, String path,
      [Map<String, dynamic>? body, bool allowRefresh = true]) async {
    final headers = <String, String>{'Content-Type': 'application/json'};
    final token = accessToken;
    if (token != null) headers['Authorization'] = 'Bearer $token';

    final isAuthExchange = path.startsWith('/auth/clerk/exchange') ||
        path.startsWith('/auth/refresh') ||
        path.startsWith('/auth/request-otp') ||
        path.startsWith('/auth/verify-otp');

    if (token != null && !isAuthExchange) {
      headers['Authorization'] = 'Bearer $token';
    }

    final deviceId = await getDeviceId();
    if (deviceId.isNotEmpty) headers['X-Device-Id'] = deviceId;

    final uri = _buildUri(path);
    final encodedBody = body == null ? null : jsonEncode(body);

    late http.Response response;
    try {
      final request = switch (method) {
        'GET' => _client.get(uri, headers: headers),
        'POST' => _client.post(uri, headers: headers, body: encodedBody),
        'PUT' => _client.put(uri, headers: headers, body: encodedBody),
        'PATCH' => _client.patch(uri, headers: headers, body: encodedBody),
        'DELETE' => _client.delete(uri, headers: headers, body: encodedBody),
        _ => throw const ApiFailure('Unsupported request method.',
            code: 'CLIENT_METHOD'),
      };
      response = await request.timeout(requestTimeout);
    } on TimeoutException {
      throw const ApiFailure(
          'The request timed out. Check your connection and try again.',
          code: 'TIMEOUT');
    } on ApiFailure {
      rethrow;
    } catch (_) {
      throw const ApiFailure(
          'Could not reach Nia. Check your connection and try again.',
          code: 'NETWORK');
    }

    // Auto-refresh on 401
    if (response.statusCode == 401 && allowRefresh && refreshSession != null) {
      if (!path.startsWith('/auth/refresh') &&
          !path.startsWith('/auth/logout') &&
          !path.startsWith('/auth/clerk/exchange')) {
        final refreshed = await refreshSession!();
        if (refreshed) return _attemptRequest(method, path, body, false);
        await onAuthenticationFailure?.call();
      }
    }

    if (response.statusCode == 204 || response.body.isEmpty) return null;

    Map<String, dynamic> decoded;
    try {
      decoded = jsonDecode(response.body) as Map<String, dynamic>;
    } on FormatException {
      throw ApiFailure('The server returned an invalid response.',
          status: response.statusCode);
    }

    if (decoded['success'] != true ||
        response.statusCode < 200 ||
        response.statusCode >= 300) {
      final error = decoded['error'] as Map<String, dynamic>?;
      throw ApiFailure(
        error?['message'] as String? ??
            'Something went wrong. Please try again.',
        code: error?['code'] as String?,
        status: response.statusCode,
        field: error?['field'] as String?,
        details: error?['details'],
      );
    }
    return decoded['data'];
  }

  bool _isRetryable(ApiFailure e) =>
      e.code == 'TIMEOUT' ||
      e.code == 'NETWORK' ||
      (e.status != null &&
          {408, 425, 429, 500, 502, 503, 504}.contains(e.status));

  Uri _buildUri(String path) {
    final root = baseUrl.endsWith('/')
        ? baseUrl.substring(0, baseUrl.length - 1)
        : baseUrl;
    final suffix = path.startsWith('/') ? path : '/$path';
    return Uri.parse('$root$suffix');
  }

  // ── File upload (multipart) ────────────────────────────────────────────────

  Future<({String url, String? publicId})> uploadFile(
    List<int> bytes,
    String fileName, {
    String folder = 'vetting',
    String contentType = 'application/octet-stream',
  }) async {
    final token = accessToken;
    final deviceId = await getDeviceId();

    final request = http.MultipartRequest(
        'POST', Uri.parse('$baseUrl/upload?folder=$folder'));
    request.headers['Authorization'] = 'Bearer $token';
    if (deviceId.isNotEmpty) request.headers['X-Device-Id'] = deviceId;
    request.files.add(http.MultipartFile.fromBytes(
      'file',
      bytes,
      filename: fileName,
      contentType: MediaType.parse(contentType),
    ));

    final streamed =
        await _client.send(request).timeout(const Duration(seconds: 30));
    final response = await http.Response.fromStream(streamed);

    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw ApiFailure('Upload failed', status: response.statusCode);
    }

    final json = jsonDecode(response.body) as Map<String, dynamic>;
    if (json['success'] != true) {
      final error = json['error'] as Map<String, dynamic>?;
      throw ApiFailure(error?['message'] as String? ?? 'Upload failed',
          code: error?['code'] as String?);
    }
    final data = json['data'] as Map<String, dynamic>;
    return (url: data['url'] as String, publicId: data['publicId'] as String?);
  }

  // ── Analytics ──────────────────────────────────────────────────────────────

  Future<void> trackProfileView(String viewedUserId) async {
    try {
      await post('/analytics/profile-view', {'viewedUserId': viewedUserId});
    } catch (_) {
      // Best-effort analytics; never fail the UI
    }
  }

  Future<Map<String, dynamic>> getMyAnalytics({int windowDays = 30}) async {
    return await get<Map<String, dynamic>>('/analytics/me?window=$windowDays');
  }
}
