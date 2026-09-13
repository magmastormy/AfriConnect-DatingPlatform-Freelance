import 'dart:ui';

import 'package:flutter/material.dart';

import '../theme/app_theme.dart';

class SectionHeader extends StatelessWidget {
  const SectionHeader(this.title, {super.key, this.action, this.onAction});
  final String title;
  final String? action;
  final VoidCallback? onAction;

  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.only(bottom: 12),
        child: Row(children: [
          Container(width: 24, height: 2, color: context.palette.brandSoft),
          const SizedBox(width: 8),
          Expanded(
              child:
                  Text(title, style: editorial(22, weight: FontWeight.w700))),
          if (action != null)
            TextButton(onPressed: onAction, child: Text(action!)),
        ]),
      );
}

class StatusPill extends StatelessWidget {
  const StatusPill(this.label, {super.key, this.tone = PillTone.neutral});
  final String label;
  final PillTone tone;

  @override
  Widget build(BuildContext context) {
    final palette = context.palette;
    final colors = switch (tone) {
      PillTone.good => (palette.successBg, palette.success),
      PillTone.brand => (palette.brandSoft, AppColors.clay),
      PillTone.warn => (palette.warnBg, palette.warn),
      PillTone.neutral => (palette.surfaceRaised, palette.inkSoft),
    };
    return AnimatedContainer(
      duration: const Duration(milliseconds: 180),
      curve: Curves.easeOutCubic,
      padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 5),
      decoration: BoxDecoration(
        color: colors.$1,
        borderRadius: BorderRadius.circular(99),
      ),
      child: AnimatedSwitcher(
        duration: const Duration(milliseconds: 150),
        child: Text(
          label,
          key: ValueKey(label),
          style: TextStyle(
            color: colors.$2,
            fontSize: 11,
            fontWeight: FontWeight.w700,
          ),
        ),
      ),
    );
  }
}

enum PillTone { neutral, good, brand, warn }

class InitialAvatar extends StatelessWidget {
  const InitialAvatar(this.initial,
      {super.key, this.size = 52, this.color = AppColors.plum});
  final String initial;
  final double size;
  final Color color;
  @override
  Widget build(BuildContext context) => Container(
      width: size,
      height: size,
      decoration: BoxDecoration(color: color, shape: BoxShape.circle),
      alignment: Alignment.center,
      child: Text(initial,
          style: TextStyle(
              color: AppColors.bone,
              fontFamily: 'Fraunces',
              fontSize: size * .42,
              fontWeight: FontWeight.w700)));
}

class SurfaceCard extends StatelessWidget {
  const SurfaceCard(
      {required this.child,
      super.key,
      this.padding = const EdgeInsets.all(16)});
  final Widget child;
  final EdgeInsets padding;
  @override
  Widget build(BuildContext context) => Container(
      padding: padding,
      decoration: BoxDecoration(
          color: context.palette.surface,
          border: Border.all(color: context.palette.line),
          borderRadius: BorderRadius.circular(16),
          boxShadow: [
            BoxShadow(
                color: context.palette.ink.withValues(alpha: .08),
                blurRadius: 18,
                offset: const Offset(0, 7))
          ]),
      child: child);
}

class GlassSheet extends StatelessWidget {
  const GlassSheet({required this.child, super.key});

  final Widget child;

  @override
  Widget build(BuildContext context) {
    return ClipRRect(
      borderRadius: BorderRadius.circular(28),
      child: BackdropFilter(
        filter: ImageFilter.blur(sigmaX: 22, sigmaY: 22),
        child: DecoratedBox(
          decoration: BoxDecoration(
            color: context.palette.surface.withValues(alpha: 0.86),
            border: Border.all(
                color: context.palette.lineStrong.withValues(alpha: 0.7)),
            borderRadius: BorderRadius.circular(28),
            boxShadow: [
              BoxShadow(
                  color: context.palette.ink.withValues(alpha: .12),
                  blurRadius: 28,
                  offset: const Offset(0, 12))
            ],
          ),
          child: child,
        ),
      ),
    );
  }
}

class ShimmerBlock extends StatefulWidget {
  const ShimmerBlock({super.key, this.height = 72, this.radius = 16});

  final double height;
  final double radius;

  @override
  State<ShimmerBlock> createState() => _ShimmerBlockState();
}

class _ShimmerBlockState extends State<ShimmerBlock>
    with SingleTickerProviderStateMixin {
  late final AnimationController controller;

  @override
  void initState() {
    super.initState();
    controller = AnimationController(
        vsync: this, duration: const Duration(milliseconds: 1200))
      ..repeat();
  }

  @override
  void dispose() {
    controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (MediaQuery.disableAnimationsOf(context)) {
      controller.stop();
    } else if (!controller.isAnimating) {
      controller.repeat();
    }
    return AnimatedBuilder(
      animation: controller,
      builder: (_, __) => Container(
        height: widget.height,
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(widget.radius),
          gradient: LinearGradient(
            begin: Alignment(-1.2 + controller.value * 2.4, 0),
            end: Alignment(-0.2 + controller.value * 2.4, 0),
            colors: [
              context.palette.surfaceRaised,
              context.palette.surface,
              context.palette.surfaceRaised
            ],
          ),
          border: Border.all(color: context.palette.line),
        ),
      ),
    );
  }
}

class PressScale extends StatefulWidget {
  const PressScale({required this.child, required this.onTap, super.key});

  final Widget child;
  final VoidCallback? onTap;

  @override
  State<PressScale> createState() => _PressScaleState();
}

class _PressScaleState extends State<PressScale> {
  bool pressed = false;

  @override
  Widget build(BuildContext context) {
    final disabled = widget.onTap == null;
    final scale = disabled || MediaQuery.disableAnimationsOf(context)
        ? 1.0
        : pressed
            ? 0.98
            : 1.0;
    return GestureDetector(
      onTap: widget.onTap,
      onTapDown: disabled ? null : (_) => setState(() => pressed = true),
      onTapCancel: disabled ? null : () => setState(() => pressed = false),
      onTapUp: disabled ? null : (_) => setState(() => pressed = false),
      child: AnimatedScale(
          scale: scale,
          duration: const Duration(milliseconds: 120),
          curve: Curves.easeOutCubic,
          child: widget.child),
    );
  }
}

class Reveal extends StatelessWidget {
  const Reveal({required this.child, super.key});

  final Widget child;

  @override
  Widget build(BuildContext context) {
    final reducedMotion = MediaQuery.disableAnimationsOf(context);
    return TweenAnimationBuilder<double>(
      tween: Tween(begin: 0, end: 1),
      duration:
          reducedMotion ? Duration.zero : const Duration(milliseconds: 360),
      curve: Curves.easeOutCubic,
      child: child,
      builder: (context, value, child) => Opacity(
        opacity: value,
        child: Transform.translate(
          offset: Offset(0, 10 * (1 - value)),
          child: child,
        ),
      ),
    );
  }
}
