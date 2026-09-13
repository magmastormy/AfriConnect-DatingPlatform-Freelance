import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../core/theme/app_theme.dart';
import '../../../core/services.dart';
import '../../../core/widgets/nia_mark.dart';

class SplashScreen extends StatefulWidget {
  const SplashScreen({super.key});

  @override
  State<SplashScreen> createState() => _SplashScreenState();
}

class _SplashScreenState extends State<SplashScreen>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 2200),
    )..repeat();
    Future<void>.delayed(const Duration(milliseconds: 2450), () {
      if (mounted) {
        context.go(AppServices.auth.isAuthenticated ? '/' : '/login');
      }
    });
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final reduceMotion = MediaQuery.of(context).disableAnimations;
    return Scaffold(
      body: AnimatedBuilder(
        animation: _controller,
        builder: (context, child) => CustomPaint(
          painter: _SplashPainter(
            progress: reduceMotion ? 0.45 : _controller.value,
          ),
          child: child,
        ),
        child: Center(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              TweenAnimationBuilder<double>(
                tween: Tween(begin: 0.72, end: 1),
                duration: const Duration(milliseconds: 850),
                curve: Curves.easeOutBack,
                builder: (context, scale, child) => Transform.scale(
                  scale: scale,
                  child: child,
                ),
                child: const NiaMark(size: 92),
              ),
              const SizedBox(height: 28),
              FadeTransition(
                opacity: CurvedAnimation(
                  parent: _controller,
                  curve: const Interval(0.12, 0.55, curve: Curves.easeOut),
                ),
                child: Text(
                  'Nia',
                  style: editorial(34, weight: FontWeight.w700).copyWith(
                    color: AppColors.white,
                  ),
                ),
              ),
              const SizedBox(height: 8),
              FadeTransition(
                opacity: CurvedAnimation(
                  parent: _controller,
                  curve: const Interval(0.25, 0.7, curve: Curves.easeOut),
                ),
                child: const Text(
                  'Meet with intention.',
                  style: TextStyle(
                    color: Color(0xFFEFD8E0),
                    fontSize: 14,
                    letterSpacing: 0.4,
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _SplashPainter extends CustomPainter {
  const _SplashPainter({required this.progress});

  final double progress;

  @override
  void paint(Canvas canvas, Size size) {
    final center = size.center(Offset.zero);
    final shortest = math.min(size.width, size.height);
    final phase = progress * math.pi * 2;

    canvas.drawRect(
      Offset.zero & size,
      Paint()
        ..shader = const LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [AppColors.plum, AppColors.clay, AppColors.gold],
        ).createShader(Offset.zero & size),
    );

    final glow = Paint()
      ..shader = const RadialGradient(
        colors: [Color(0x66FFFFFF), Color(0x00FFFFFF)],
      ).createShader(Rect.fromCircle(center: center, radius: shortest * .7));
    canvas.drawCircle(center, shortest * .7, glow);

    final ringPaint = Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1.2
      ..color = const Color(0x44FFFFFF);
    for (var i = 0; i < 3; i++) {
      final radius = shortest * (.28 + i * .13) + math.sin(phase + i) * 8;
      canvas.drawCircle(center, radius, ringPaint);
    }

    final particlePaint = Paint()..color = const Color(0x99FFFFFF);
    for (var i = 0; i < 12; i++) {
      final angle = phase * (i.isEven ? 1 : -0.7) + i * .52;
      final radius = shortest * (.19 + (i % 4) * .09);
      final point = center + Offset(math.cos(angle), math.sin(angle)) * radius;
      canvas.drawCircle(point, 1.5 + (i % 3), particlePaint);
    }
  }

  @override
  bool shouldRepaint(covariant _SplashPainter oldDelegate) =>
      oldDelegate.progress != progress;
}
