import 'package:flutter/cupertino.dart' show CupertinoPageTransitionsBuilder;
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';

abstract final class AppColors {
  // Joyful Connections palette.
  static const bone = Color(0xFFF8F8F8);
  static const boneDeep = Color(0xFFEEEEEE);
  static const ink = Color(0xFF1A237E);
  static const inkSoft = Color(0xFF303F9F);
  static const muted = Color(0xFF5C6BC0);
  static const white = Color(0xFFFFFFFF);
  static const line = Color(0xFFD9DCEF);
  static const lineStrong = Color(0xFFB9C2E2);

  static const clay = Color(0xFF4169E1);
  static const clayDark = Color(0xFF3158C7);
  static const plum = Color(0xFF1A237E);
  static const gold = Color(0xFFFFD700);
  static const hotPink = Color(0xFFFF69B4);

  // Derived brand-on-X colours, named here so the palettes *and* the
  // ColorSchemes can reference a const (field access on a const object is not
  // itself a constant expression).
  /// Wine-700 — text on a pale brand tint, and the hover/deep CTA tone.
  static const brandOnLight = Color(0xFF1A237E);

  /// Wine-300 — the dark-theme counterpart, brightened for legibility.
  static const brandOnDark = Color(0xFFBBDEFB);

  /// Text on a brand-filled surface. White reads on wine in light.
  static const onBrandLight = Color(0xFFFFFFFF);

  /// In dark the fill is the same wine, so near-black holds better contrast
  /// (this is what the web's `--on-brand` does too).
  static const onBrandDark = Color(0xFF1B1410);

  static const success = Color(0xFF2F7D4F);
  static const successBg = Color(0xFFDCF3E4);
  static const warnBg = Color(0xFFFBECCF);
}

@immutable
class AppPalette extends ThemeExtension<AppPalette> {
  const AppPalette({
    required this.background,
    required this.surface,
    required this.surfaceRaised,
    required this.ink,
    required this.inkSoft,
    required this.muted,
    required this.line,
    required this.lineStrong,
    required this.brandSoft,
    required this.brandOn,
    required this.onBrand,
    required this.success,
    required this.successBg,
    required this.warn,
    required this.warnBg,
  });

  final Color background;
  final Color surface;
  final Color surfaceRaised;
  final Color ink;
  final Color inkSoft;
  final Color muted;
  final Color line;
  final Color lineStrong;
  final Color brandSoft;

  /// Text/glyph colour for content sitting on a [brandSoft] tint. Distinct from
  /// [onBrand]: that one sits on a brand-*filled* surface, this one on a pale
  /// brand wash, so it deepens in light and brightens in dark to hold contrast.
  /// Mirrors the web's `--brand-ink` / `--brand-bright`.
  final Color brandOn;

  /// Text/glyph colour drawn on top of a brand-filled surface. Inverts in dark
  /// so filled controls keep their contrast against the same wine fill —
  /// mirrors the web's `--on-brand`.
  final Color onBrand;
  final Color success;
  final Color successBg;
  final Color warn;
  final Color warnBg;

  static const light = AppPalette(
    background: AppColors.bone,
    surface: AppColors.white,
    surfaceRaised: Color(0xFFFAF6EF),
    ink: AppColors.ink,
    inkSoft: AppColors.inkSoft,
    muted: AppColors.muted,
    line: AppColors.line,
    lineStrong: AppColors.lineStrong,
    brandSoft: Color(0xFFDDE6FF),
    brandOn: AppColors.plum,
    onBrand: AppColors.onBrandLight,
    success: AppColors.success,
    successBg: AppColors.successBg,
    warn: Color(0xFF8A5A09),
    warnBg: AppColors.warnBg,
  );

  static const dark = AppPalette(
    background: Color(0xFF121212),
    surface: Color(0xFF212121),
    surfaceRaised: Color(0xFF2B2B2B),
    ink: Color(0xFFBBDEFB),
    inkSoft: Color(0xFF90CAF9),
    muted: Color(0xFF78909C),
    line: Color(0xFF373737),
    lineStrong: Color(0xFF4A4A4A),
    brandSoft: Color(0xFF1E3A78),
    brandOn: Color(0xFFBBDEFB),
    onBrand: Color(0xFFFFFFFF),
    success: Color(0xFF81C784),
    successBg: Color(0xFF1B3320),
    warn: Color(0xFFFFD54F),
    warnBg: Color(0xFF3B3210),
  );

  @override
  AppPalette copyWith({
    Color? background,
    Color? surface,
    Color? surfaceRaised,
    Color? ink,
    Color? inkSoft,
    Color? muted,
    Color? line,
    Color? lineStrong,
    Color? brandSoft,
    Color? brandOn,
    Color? onBrand,
    Color? success,
    Color? successBg,
    Color? warn,
    Color? warnBg,
  }) =>
      AppPalette(
        background: background ?? this.background,
        surface: surface ?? this.surface,
        surfaceRaised: surfaceRaised ?? this.surfaceRaised,
        ink: ink ?? this.ink,
        inkSoft: inkSoft ?? this.inkSoft,
        muted: muted ?? this.muted,
        line: line ?? this.line,
        lineStrong: lineStrong ?? this.lineStrong,
        brandSoft: brandSoft ?? this.brandSoft,
        brandOn: brandOn ?? this.brandOn,
        onBrand: onBrand ?? this.onBrand,
        success: success ?? this.success,
        successBg: successBg ?? this.successBg,
        warn: warn ?? this.warn,
        warnBg: warnBg ?? this.warnBg,
      );

  @override
  AppPalette lerp(covariant AppPalette? other, double t) {
    if (other == null) return this;
    return AppPalette(
      background: Color.lerp(background, other.background, t)!,
      surface: Color.lerp(surface, other.surface, t)!,
      surfaceRaised: Color.lerp(surfaceRaised, other.surfaceRaised, t)!,
      ink: Color.lerp(ink, other.ink, t)!,
      inkSoft: Color.lerp(inkSoft, other.inkSoft, t)!,
      muted: Color.lerp(muted, other.muted, t)!,
      line: Color.lerp(line, other.line, t)!,
      lineStrong: Color.lerp(lineStrong, other.lineStrong, t)!,
      brandSoft: Color.lerp(brandSoft, other.brandSoft, t)!,
      brandOn: Color.lerp(brandOn, other.brandOn, t)!,
      onBrand: Color.lerp(onBrand, other.onBrand, t)!,
      success: Color.lerp(success, other.success, t)!,
      successBg: Color.lerp(successBg, other.successBg, t)!,
      warn: Color.lerp(warn, other.warn, t)!,
      warnBg: Color.lerp(warnBg, other.warnBg, t)!,
    );
  }
}

extension AppPaletteContext on BuildContext {
  AppPalette get palette =>
      Theme.of(this).extension<AppPalette>() ?? AppPalette.light;
}

abstract final class AppTheme {
  static ThemeData get light {
    final base = ThemeData(useMaterial3: true, brightness: Brightness.light);
    return base.copyWith(
      scaffoldBackgroundColor: AppColors.bone,
      visualDensity: defaultTargetPlatform == TargetPlatform.iOS
          ? VisualDensity.standard
          : VisualDensity.compact,
      colorScheme: const ColorScheme.light(
          primary: AppColors.clay,
          onPrimary: AppColors.onBrandLight,
          secondary: AppColors.gold,
          surface: AppColors.white,
          onSurface: AppColors.ink),
      extensions: const [AppPalette.light],
      textTheme: _variableWeights(base.textTheme.apply(
        fontFamily: 'Inter',
        bodyColor: AppColors.ink,
        displayColor: AppColors.ink,
      )),
      appBarTheme: const AppBarTheme(
        backgroundColor: AppColors.bone,
        foregroundColor: AppColors.ink,
        elevation: 0,
        centerTitle: false,
        surfaceTintColor: Colors.transparent,
      ),
      pageTransitionsTheme: const PageTransitionsTheme(
        builders: {
          TargetPlatform.android: ZoomPageTransitionsBuilder(),
          TargetPlatform.iOS: CupertinoPageTransitionsBuilder(),
        },
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: AppColors.white,
        contentPadding:
            const EdgeInsets.symmetric(horizontal: 16, vertical: 16),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(14),
          borderSide: const BorderSide(color: AppColors.line),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(14),
          borderSide: const BorderSide(color: AppColors.line),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(14),
          borderSide: const BorderSide(color: AppColors.clay, width: 1.5),
        ),
      ),
    );
  }

  static ThemeData get dark {
    final base = ThemeData(useMaterial3: true, brightness: Brightness.dark);
    return base.copyWith(
      scaffoldBackgroundColor: AppPalette.dark.background,
      visualDensity: defaultTargetPlatform == TargetPlatform.iOS
          ? VisualDensity.standard
          : VisualDensity.compact,
      colorScheme: const ColorScheme.dark(
        primary: AppColors.clay,
        onPrimary: AppColors.onBrandDark,
        secondary: AppColors.gold,
        surface: Color(0xFF212121),
        onSurface: Color(0xFFBBDEFB),
      ),
      extensions: const [AppPalette.dark],
      textTheme: _variableWeights(base.textTheme.apply(
        fontFamily: 'Inter',
        bodyColor: AppPalette.dark.ink,
        displayColor: AppPalette.dark.ink,
      )),
      appBarTheme: const AppBarTheme(
        backgroundColor: Color(0xFF121212),
        foregroundColor: Color(0xFFBBDEFB),
        elevation: 0,
        centerTitle: false,
        surfaceTintColor: Colors.transparent,
      ),
      pageTransitionsTheme: const PageTransitionsTheme(
        builders: {
          TargetPlatform.android: ZoomPageTransitionsBuilder(),
          TargetPlatform.iOS: CupertinoPageTransitionsBuilder(),
        },
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: AppPalette.dark.surface,
        contentPadding:
            const EdgeInsets.symmetric(horizontal: 16, vertical: 16),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(14),
          borderSide: BorderSide(color: AppPalette.dark.line),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(14),
          borderSide: BorderSide(color: AppPalette.dark.line),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(14),
          borderSide: const BorderSide(color: AppColors.clay, width: 1.5),
        ),
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Shape / depth / motion / scrim tokens
//
// Derived from DESIGN_INSPIRATIONS.md §8. Before this, the app used ad-hoc radii
// (12/14/16/22/26/28) and one-off shadow literals scattered across screens.
// Brand colours are deliberately NOT redefined here.
// ---------------------------------------------------------------------------

abstract final class NiaRadius {
  /// Any *selectable* control: pills, badges, bubbles, chips.
  static const pill = 999.0;

  /// Inputs and small chips.
  static const sm = 12.0;

  /// Standard cards and list rows.
  static const md = 16.0;

  /// Glass panels and mini-cards.
  static const lg = 20.0;

  /// Media cards and bottom sheets.
  static const xl = 28.0;

  /// Full-bleed heroes and modal sheets.
  static const xxl = 36.0;
}

abstract final class NiaMotion {
  /// Press feedback.
  static const fast = Duration(milliseconds: 120);

  /// Pill fills, state changes.
  static const base = Duration(milliseconds: 180);

  /// Card / sheet entrances.
  static const enter = Duration(milliseconds: 320);

  /// Looping ambient motion (orbit rings, pulses). Slow reads as premium.
  static const ambient = Duration(milliseconds: 20000);

  static const easeOut = Curves.easeOutCubic;
  static const pressScale = 0.97;

  /// Every new animation must consult this before running.
  static bool reduced(BuildContext context) =>
      MediaQuery.disableAnimationsOf(context);
}

abstract final class NiaScrim {
  /// Neutral photo scrim: legible name over any photograph.
  static const mediaStops = <double>[0.0, 0.45, 1.0];

  static List<Color> mediaColors(Color tint) => [
        tint.withValues(alpha: 0.0),
        tint.withValues(alpha: 0.18),
        tint.withValues(alpha: 0.82),
      ];

  /// Brand photo scrim: the wine-tinted variant that makes a photo read as
  /// ours rather than stock.
  static List<Color> brandColors(Color wine900, Color wine950) => [
        wine900.withValues(alpha: 0.0),
        wine900.withValues(alpha: 0.35),
        wine950.withValues(alpha: 0.88),
      ];
}

/// Two-layer soft elevation, mirroring the web `--shadow` token, plus the
/// heavier media shadow the deck card needs.
List<BoxShadow> niaShadowSoft(Color ink) => [
      BoxShadow(
          color: ink.withValues(alpha: .04),
          blurRadius: 2,
          offset: const Offset(0, 1)),
      BoxShadow(
          color: ink.withValues(alpha: .06),
          blurRadius: 40,
          offset: const Offset(0, 14)),
    ];

List<BoxShadow> niaShadowMedia() => [
      BoxShadow(
          color: const Color(0xFF000000).withValues(alpha: .28),
          blurRadius: 40,
          offset: const Offset(0, 18)),
    ];

List<BoxShadow> niaShadowBubble(Color ink) => [
      BoxShadow(
          color: ink.withValues(alpha: .18),
          blurRadius: 20,
          offset: const Offset(0, 8)),
      BoxShadow(
          color: ink.withValues(alpha: .10),
          blurRadius: 4,
          offset: const Offset(0, 2)),
    ];

/// The floating bottom-nav shadow: light from above, so it casts upward.
List<BoxShadow> niaShadowSheet() => [
      BoxShadow(
          color: const Color(0xFF000000).withValues(alpha: .06),
          blurRadius: 24,
          offset: const Offset(0, -8)),
    ];

// ---------------------------------------------------------------------------
// Typography
//
// IMPORTANT: both bundled fonts are *variable* fonts, and the pubspec declares
// only one static weight for each family (Inter) or two byte-identical files
// (Fraunces 400 == 700, MD5 e6d9a08f…). Flutter does NOT drive a variable
// font's `wght` axis from `FontWeight` alone — so:
//
//   * Fraunces' own fvar default is wght **900**, and both declared assets are
//     that same file, so *every* `editorial()` call rendered at Black 900
//     regardless of the `weight` argument. The display/body hierarchy was
//     cosmetic.
//   * Inter declared only `weight: 400`, so every `FontWeight.w600…w900` was
//     **synthetic faux-bold**.
//
// Both are fixed by emitting `fontVariations` explicitly. Axis ranges verified
// from the font binaries: Fraunces wght 100–900 (default 900),
// Inter wght 100–900 (default 400).
// ---------------------------------------------------------------------------

/// Maps a [FontWeight] to the numeric `wght` axis value.
///
/// Deliberately *not* `const`: a const map may not key on a type that overrides
/// `==`/`hashCode`, which `FontWeight` does.
final Map<FontWeight, int> _wghtAxis = {
  FontWeight.w100: 100,
  FontWeight.w200: 200,
  FontWeight.w300: 300,
  FontWeight.w400: 400,
  FontWeight.w500: 500,
  FontWeight.w600: 600,
  FontWeight.w700: 700,
  FontWeight.w800: 800,
  FontWeight.w900: 900,
};

/// Resolves a weight (or null) to its numeric axis value, defaulting to 400.
int wghtValue(FontWeight? weight) => _wghtAxis[weight] ?? 400;

/// Real weight for a variable font — the only way to actually vary weight.
List<FontVariation> wght(FontWeight? weight) =>
    [FontVariation('wght', wghtValue(weight).toDouble())];

/// Display / editorial face (Fraunces). Use for headlines and large numerals.
///
/// `weight` now genuinely drives the variable axis, so the previously flat
/// Black-900 rendering becomes a real hierarchy.
TextStyle editorial(double size, {FontWeight weight = FontWeight.w700}) {
  return TextStyle(
      fontFamily: 'Fraunces',
      fontSize: size,
      fontWeight: weight,
      fontVariations: wght(weight),
      height: 1.08,
      letterSpacing: -0.25);
}

/// Oversized stat numeral — the reference pattern of letting one number carry
/// a screen. Tighter than [editorial] and optically adjusted.
TextStyle numeral(double size, {FontWeight weight = FontWeight.w700}) {
  return TextStyle(
      fontFamily: 'Fraunces',
      fontSize: size,
      fontWeight: weight,
      fontVariations: wght(weight),
      height: 1.0,
      letterSpacing: -1.0);
}

/// Body / UI face (Inter) with a *real* weight instead of synthetic bold.
TextStyle inter(
  double size, {
  FontWeight weight = FontWeight.w400,
  double? height,
  double? letterSpacing,
  Color? color,
}) {
  return TextStyle(
      fontFamily: 'Inter',
      fontSize: size,
      fontWeight: weight,
      fontVariations: wght(weight),
      height: height,
      letterSpacing: letterSpacing,
      color: color);
}

/// The small orientation label used by pills, rails and nav items.
///
/// Named `niaLabel` rather than `label` on purpose: almost every widget in the
/// kit has a `label` field, and a top-level `label()` would be silently shadowed
/// inside any of their build methods.
TextStyle niaLabel(double size, {FontWeight weight = FontWeight.w600}) =>
    inter(size, weight: weight, letterSpacing: 0.02);

/// Re-stamps every slot of a [TextTheme] with an explicit `wght` axis value.
///
/// Material's default text theme (button labels, list titles, input hints, …)
/// carries `FontWeight` only, which for a variable font means synthetic bold.
/// Running the applied theme through here gives those styles the real axis too.
TextTheme _variableWeights(TextTheme t) {
  TextStyle? f(TextStyle? s) => s?.copyWith(fontVariations: wght(s.fontWeight));
  return TextTheme(
    displayLarge: f(t.displayLarge),
    displayMedium: f(t.displayMedium),
    displaySmall: f(t.displaySmall),
    headlineLarge: f(t.headlineLarge),
    headlineMedium: f(t.headlineMedium),
    headlineSmall: f(t.headlineSmall),
    titleLarge: f(t.titleLarge),
    titleMedium: f(t.titleMedium),
    titleSmall: f(t.titleSmall),
    bodyLarge: f(t.bodyLarge),
    bodyMedium: f(t.bodyMedium),
    bodySmall: f(t.bodySmall),
    labelLarge: f(t.labelLarge),
    labelMedium: f(t.labelMedium),
    labelSmall: f(t.labelSmall),
  );
}
