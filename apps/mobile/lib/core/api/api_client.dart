import 'dart:convert';
import 'dart:async';

import 'package:http/http.dart' as http;

class ApiFailure implements Exception {
  const ApiFailure(this.message, {this.code, this.status});

  final String message;
  final String? code;
  final int? status;

  @override
  String toString() => message;
}

class ApiClient {
  ApiClient({http.Client? client, String? baseUrl})
      : _client = client ?? http.Client(),
        baseUrl = baseUrl ?? _defaultBaseUrl();

  /// The server hides its versioned surface behind an unguessable mount segment
  /// (`API_MOUNT_PATH`), so the mount must be supplied at build time and cannot be
  /// hardcoded. Mirror of `NEXT_PUBLIC_API_MOUNT` used by `apps/web`.
  ///
  /// Defaults to `api` purely so `localhost:4000/api/v1` keeps working for a local
  /// API that has no `API_MOUNT_PATH` set. Any real environment must pass the mount.
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
    // Braces are required here: the prefix is followed by an identifier, so the
    // interpolation must be delimited explicitly.
    // ignore: unnecessary_brace_in_string_interps
    return '${root}/${prefix}v1';
  }

  final http.Client _client;
  final String baseUrl;
  static const requestTimeout = Duration(seconds: 20);
  String? accessToken;
  Future<String?> Function()? deviceIdProvider;
  Future<bool> Function()? refreshSession;
  Future<void> Function()? onAuthenticationFailure;

  Future<T> get<T>(String path) async {
    return await _request('GET', path) as T;
  }

  Future<T> post<T>(String path, [Map<String, dynamic>? body]) async {
    return await _request('POST', path, body) as T;
  }

  Future<T> put<T>(String path, [Map<String, dynamic>? body]) async {
    return await _request('PUT', path, body) as T;
  }

  Future<T> patch<T>(String path, [Map<String, dynamic>? body]) async {
    return await _request('PATCH', path, body) as T;
  }

  Future<T> delete<T>(String path, [Map<String, dynamic>? body]) async {
    return await _request('DELETE', path, body) as T;
  }

  Future<T> postWithoutRefresh<T>(String path,
      [Map<String, dynamic>? body]) async {
    return await _request('POST', path, body, false) as T;
  }

  Future<dynamic> _request(String method, String path,
      [Map<String, dynamic>? body, bool allowRefresh = true]) async {
    final headers = <String, String>{'Content-Type': 'application/json'};
    if (accessToken != null) headers['Authorization'] = 'Bearer $accessToken';
    final deviceId = await deviceIdProvider?.call();
    if (deviceId != null && deviceId.isNotEmpty) {
      headers['X-Device-Id'] = deviceId;
    }
    final uri = _buildUri(path);
    final encodedBody = body == null ? null : jsonEncode(body);
    final response = await _send(method, uri, headers, encodedBody);

    if (response.statusCode == 401 && allowRefresh && refreshSession != null) {
      final refreshed = await refreshSession!();
      if (refreshed) return _request(method, path, body, false);
      await onAuthenticationFailure?.call();
    }

    if (response.statusCode == 204 || response.body.isEmpty) return null;
    dynamic decodedJson;
    try {
      decodedJson = jsonDecode(response.body);
    } on FormatException {
      throw ApiFailure('The server returned an invalid response.',
          status: response.statusCode);
    }
    if (decodedJson is! Map<String, dynamic>) {
      throw ApiFailure('The server returned an invalid response.',
          status: response.statusCode);
    }
    final decoded = decodedJson;
    if (response.statusCode < 200 ||
        response.statusCode >= 300 ||
        decoded['success'] != true) {
      final error = decoded['error'] as Map<String, dynamic>?;
      throw ApiFailure(
        error?['message'] as String? ??
            'Something went wrong. Please try again.',
        code: error?['code'] as String?,
        status: response.statusCode,
      );
    }
    return decoded['data'];
  }

  Uri _buildUri(String path) {
    final root = baseUrl.endsWith('/')
        ? baseUrl.substring(0, baseUrl.length - 1)
        : baseUrl;
    final suffix = path.startsWith('/') ? path : '/$path';
    return Uri.parse('$root$suffix');
  }

  Future<http.Response> _send(
    String method,
    Uri uri,
    Map<String, String> headers,
    String? body,
  ) async {
    try {
      final request = switch (method) {
        'GET' => _client.get(uri, headers: headers),
        'POST' => _client.post(uri, headers: headers, body: body),
        'PUT' => _client.put(uri, headers: headers, body: body),
        'PATCH' => _client.patch(uri, headers: headers, body: body),
        'DELETE' => _client.delete(uri, headers: headers, body: body),
        _ => throw const ApiFailure('Unsupported request method.',
            code: 'CLIENT_METHOD'),
      };
      return await request.timeout(requestTimeout);
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
  }
}
