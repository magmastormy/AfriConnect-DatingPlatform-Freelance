import 'package:flutter/cupertino.dart' show CupertinoPageTransitionsBuilder;
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';

abstract final class AppColors {
  static const bone = Color(0xFFF6F1E9);
  static const boneDeep = Color(0xFFEFE9DD);
  static const ink = Color(0xFF16130F);
  static const inkSoft = Color(0xFF4A443C);
  static const muted = Color(0xFF7A7268);
  static const clay = Color(0xFFC70039);
  static const clayDark = Color(0xFF900C3F);
  static const plum = Color(0xFF581845);
  static const gold = Color(0xFFDA07A6);
  static const white = Color(0xFFFFFDF9);
  static const line = Color(0xFFE6DDCF);
  static const lineStrong = Color(0xFFD8CCB8);
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
    brandSoft: Color(0xFFF7DCE5),
    success: AppColors.success,
    successBg: AppColors.successBg,
    warn: Color(0xFF8A5A09),
    warnBg: AppColors.warnBg,
  );

  static const dark = AppPalette(
    background: Color(0xFF14120F),
    surface: Color(0xFF1C1A16),
    surfaceRaised: Color(0xFF272319),
    ink: Color(0xFFF4EFE6),
    inkSoft: Color(0xFFCFC7BA),
    muted: Color(0xFF9A9186),
    line: Color(0xFF322C24),
    lineStrong: Color(0xFF473E33),
    brandSoft: Color(0xFF51202D),
    success: Color(0xFF62C48D),
    successBg: Color(0xFF17311F),
    warn: Color(0xFFE3A857),
    warnBg: Color(0xFF33260F),
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
          secondary: AppColors.gold,
          surface: AppColors.white,
          onSurface: AppColors.ink),
      extensions: const [AppPalette.light],
      textTheme: base.textTheme.apply(
        fontFamily: 'Inter',
        bodyColor: AppColors.ink,
        displayColor: AppColors.ink,
      ),
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
        primary: Color(0xFFE0314F),
        secondary: AppColors.gold,
        surface: Color(0xFF1C1A16),
        onSurface: Color(0xFFF4EFE6),
      ),
      extensions: const [AppPalette.dark],
      textTheme: base.textTheme.apply(
        fontFamily: 'Inter',
        bodyColor: AppPalette.dark.ink,
        displayColor: AppPalette.dark.ink,
      ),
      appBarTheme: const AppBarTheme(
        backgroundColor: Color(0xFF14120F),
        foregroundColor: Color(0xFFF4EFE6),
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
          borderSide: const BorderSide(color: Color(0xFFE0314F), width: 1.5),
        ),
      ),
    );
  }
}

TextStyle editorial(double size, {FontWeight weight = FontWeight.w400}) {
  return TextStyle(
      fontFamily: 'Fraunces',
      fontSize: size,
      fontWeight: weight,
      height: 1.08,
      letterSpacing: -0.25);
}
