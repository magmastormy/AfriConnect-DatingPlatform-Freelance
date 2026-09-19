import 'dart:convert';
import 'dart:math';

import '../../../core/storage/platform_storage.dart';

class AuthSessionStore {
  AuthSessionStore({PlatformStorage? storage})
      : _storage = storage ?? SecureStorage();

  static const _accessKey = 'africonnect.accessToken';
  static const _refreshKey = 'africonnect.refreshToken';
  static const _userKey = 'africonnect.userId';
  static const _deviceKey = 'africonnect.deviceId';
  static const _notificationsKey = 'africonnect.notificationsEnabled';
  final PlatformStorage _storage;

  Future<void> save(
      {required String accessToken,
      required String refreshToken,
      String? userId}) async {
    await _storage.write(key: _accessKey, value: accessToken);
    await _storage.write(key: _refreshKey, value: refreshToken);
    if (userId != null && userId.isNotEmpty) {
      await _storage.write(key: _userKey, value: userId);
    }
  }

  Future<String?> readAccessToken() => _storage.read(key: _accessKey);

  Future<String?> readRefreshToken() => _storage.read(key: _refreshKey);

  Future<String?> readUserId() => _storage.read(key: _userKey);

  Future<String> readOrCreateDeviceId() async {
    final existing = await _storage.read(key: _deviceKey);
    if (existing != null && existing.isNotEmpty) return existing;
    final bytes = List<int>.generate(24, (_) => Random.secure().nextInt(256));
    final created = base64Url.encode(bytes).replaceAll('=', '');
    await _storage.write(key: _deviceKey, value: created);
    return created;
  }

  Future<bool> readNotificationsEnabled() async {
    return (await _storage.read(key: _notificationsKey)) != 'false';
  }

  Future<void> saveNotificationsEnabled(bool enabled) async {
    await _storage.write(key: _notificationsKey, value: enabled.toString());
  }

  Future<void> clear() async {
    await _storage.delete(key: _accessKey);
    await _storage.delete(key: _refreshKey);
    await _storage.delete(key: _userKey);
    await _storage.delete(key: _notificationsKey);
  }
}
