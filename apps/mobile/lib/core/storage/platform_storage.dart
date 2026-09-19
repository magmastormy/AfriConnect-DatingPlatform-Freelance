import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:universal_platform/universal_platform.dart';

abstract class PlatformStorage {
  Future<void> write({required String key, required String value});
  Future<String?> read({required String key});
  Future<void> delete({required String key});
  Future<void> clear();
}

class SecureStorage implements PlatformStorage {
  const SecureStorage({FlutterSecureStorage? storage})
      : _storage = storage ?? const FlutterSecureStorage();

  final FlutterSecureStorage _storage;

  @override
  Future<void> write({required String key, required String value}) {
    return _storage.write(key: key, value: value);
  }

  @override
  Future<String?> read({required String key}) {
    return _storage.read(key: key);
  }

  @override
  Future<void> delete({required String key}) {
    return _storage.delete(key: key);
  }

  @override
  Future<void> clear() {
    return _storage.deleteAll();
  }
}

class WebStorage implements PlatformStorage {
  WebStorage(this._prefs);

  final SharedPreferences _prefs;

  static Future<WebStorage> create() async {
    final prefs = await SharedPreferences.getInstance();
    return WebStorage(prefs);
  }

  @override
  Future<void> write({required String key, required String value}) {
    return _prefs.setString(key, value);
  }

  @override
  Future<String?> read({required String key}) {
    return Future.value(_prefs.getString(key));
  }

  @override
  Future<void> delete({required String key}) {
    return _prefs.remove(key);
  }

  @override
  Future<void> clear() {
    return _prefs.clear();
  }
}

Future<PlatformStorage> createPlatformStorage() async {
  if (UniversalPlatform.isWeb) {
    return await WebStorage.create();
  } else {
    return const SecureStorage();
  }
}
