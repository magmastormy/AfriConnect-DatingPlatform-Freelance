import 'package:flutter/material.dart';

import '../storage/platform_storage.dart';

/// The member's appearance preference.
///
/// Three settings are offered — `light`, `dark`, and `system` — because
/// "system" must stay reachable: a member who has never chosen explicitly
/// should be able to return to following their operating system. This mirrors
/// the web app's three-way `ThemeToggle`.
///
/// The choice is persisted under the same key the web client uses for its
/// `africonnect.theme` cookie, so the preference is one concept across both
/// clients even though each stores it in its own medium.
class ThemeController extends ChangeNotifier {
  ThemeController._(this._storage, this._mode);

  /// Shared with the web client by convention; do not rename.
  static const storageKey = 'africonnect.theme';

  final PlatformStorage _storage;
  ThemeMode _mode;

  ThemeMode get mode => _mode;

  /// Reads the persisted preference.
  ///
  /// A storage fault or an unrecognised value falls back to
  /// [ThemeMode.system] rather than failing: a preference read must never
  /// block app start.
  static Future<ThemeController> restore({
    required PlatformStorage storage,
  }) async {
    ThemeMode mode = ThemeMode.system;
    try {
      mode = _decode(await storage.read(key: storageKey));
    } catch (_) {
      // Keep the default.
    }
    return ThemeController._(storage, mode);
  }

  /// Applies [next] immediately and persists it in the background.
  ///
  /// The in-memory change is published first so the UI flips on the same
  /// frame as the tap; a persistence failure only costs the preference on
  /// next launch, which is not worth blocking the interaction for.
  Future<void> setMode(ThemeMode next) async {
    if (next == _mode) return;
    _mode = next;
    notifyListeners();
    try {
      await _storage.write(key: storageKey, value: _encode(next));
    } catch (_) {
      // Session-only change.
    }
  }

  static String _encode(ThemeMode mode) => switch (mode) {
        ThemeMode.light => 'light',
        ThemeMode.dark => 'dark',
        ThemeMode.system => 'system',
      };

  static ThemeMode _decode(String? value) => switch (value) {
        'light' => ThemeMode.light,
        'dark' => ThemeMode.dark,
        _ => ThemeMode.system,
      };
}
