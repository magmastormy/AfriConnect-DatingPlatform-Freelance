import 'package:flutter/foundation.dart';

import '../../../core/api/api_client.dart';
import 'auth_session_store.dart';

class AuthRepository extends ChangeNotifier {
  AuthRepository(this._api, {AuthSessionStore? sessions})
      : _sessions = sessions ?? AuthSessionStore() {
    _api.refreshSession = refreshAccessToken;
    _api.onAuthenticationFailure = handleAuthenticationFailure;
    _api.deviceIdProvider = _sessions.readOrCreateDeviceId;
  }

  final ApiClient _api;
  final AuthSessionStore _sessions;
  Future<bool>? _refreshInFlight;
  bool requiresLogin = false;

  bool get isAuthenticated => _api.accessToken != null && !requiresLogin;

  Future<void> restoreSession() async {
    await _sessions.readOrCreateDeviceId();
    final accessToken = await _sessions.readAccessToken();
    if (accessToken != null && accessToken.isNotEmpty) {
      _api.accessToken = accessToken;
      requiresLogin = false;
      notifyListeners();
      return;
    }
    final refreshed = await refreshAccessToken();
    requiresLogin = !refreshed;
    notifyListeners();
  }

  Future<void> requestOtp(
      {required String email, required String phone}) async {
    await _api
        .post<dynamic>('/auth/request-otp', {'email': email, 'phone': phone});
  }

  Future<void> exchangeClerkToken(String clerkToken) async {
    final data = await _api.post<Map<String, dynamic>>(
        '/auth/clerk/exchange', {'token': clerkToken});
    final accessToken = data['accessToken'] as String?;
    final refreshToken = data['refreshToken'] as String?;
    if (accessToken == null || refreshToken == null) {
      throw const ApiFailure('The Clerk session response was incomplete.',
          code: 'BAD_CLERK_SESSION');
    }
    await _saveSession(accessToken, refreshToken, data);
  }

  Future<void> verifyOtp({
    required String email,
    required String phone,
    required String code,
  }) async {
    final data = await _api.post<Map<String, dynamic>>('/auth/verify-otp', {
      'email': email,
      'phone': phone,
      'code': code,
    });
    final accessToken = data['accessToken'] as String?;
    final refreshToken = data['refreshToken'] as String?;
    if (accessToken == null || refreshToken == null) {
      throw const ApiFailure('The session response was incomplete.',
          code: 'BAD_SESSION');
    }
    await _saveSession(accessToken, refreshToken, data);
  }

  Future<bool> refreshAccessToken() async {
    if (_refreshInFlight != null) return _refreshInFlight!;
    final refresh = _refreshAccessTokenOnce();
    _refreshInFlight = refresh;
    try {
      return await refresh;
    } finally {
      _refreshInFlight = null;
    }
  }

  Future<bool> _refreshAccessTokenOnce() async {
    final refreshToken = await _sessions.readRefreshToken();
    if (refreshToken == null || refreshToken.isEmpty) return false;
    try {
      final data = await _api.postWithoutRefresh<Map<String, dynamic>>(
        '/auth/refresh',
        {'refreshToken': refreshToken},
      );
      final accessToken = data['accessToken'] as String?;
      final rotatedRefreshToken = data['refreshToken'] as String?;
      if (accessToken == null || rotatedRefreshToken == null) return false;
      await _saveSession(accessToken, rotatedRefreshToken, data);
      return true;
    } catch (_) {
      return false;
    }
  }

  Future<void> signOut() async {
    final refreshToken = await _sessions.readRefreshToken();
    try {
      if (refreshToken != null && refreshToken.isNotEmpty) {
        await _api.postWithoutRefresh<dynamic>(
            '/auth/logout', {'refreshToken': refreshToken});
      }
    } finally {
      await _clearSession();
    }
  }

  Future<void> handleAuthenticationFailure() async {
    await _clearSession();
    requiresLogin = true;
    notifyListeners();
  }

  Future<String> getVettingStage() async {
    try {
      final data = await _api.get<Map<String, dynamic>>('/applications/me');
      return data['status'] as String? ?? 'pending';
    } catch (_) {
      return 'pending';
    }
  }

  Future<void> _saveSession(String accessToken, String refreshToken,
      Map<String, dynamic> data) async {
    _api.accessToken = accessToken;
    requiresLogin = false;
    final user = data['user'] as Map<String, dynamic>?;
    final userId = user?['userId'] as String? ?? await _sessions.readUserId();
    await _sessions.save(
      accessToken: accessToken,
      refreshToken: refreshToken,
      userId: userId,
    );
    notifyListeners();
  }

  Future<void> _clearSession() async {
    _api.accessToken = null;
    await _sessions.clear();
  }
}
