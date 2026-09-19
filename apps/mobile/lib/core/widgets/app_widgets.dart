import 'dart:ui';

import 'package:flutter/material.dart';

import '../theme/app_theme.dart';

export 'swipe_gesture.dart';
export 'device_frame.dart';

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
      PillTone.brand => (palette.brandSoft, palette.brandOn),
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

/// A single row inside a grouped settings card — the Momo-style "leading
/// outline icon + label + trailing control/chevron" pattern, unified so the
/// navigation rows and the toggle rows share one visual rhythm.
///
/// Tap target is guarded to >=52px (>=48 required). When [onTap] is set and no
/// [trailing] is supplied, a chevron is drawn and the whole row becomes a
/// tappable [InkWell]; otherwise the row is inert and defers interaction to the
/// [trailing] control (e.g. a [Switch] or [ThemeModeSelector]).
class SettingsRow extends StatelessWidget {
  const SettingsRow({
    super.key,
    required this.icon,
    required this.title,
    this.subtitle,
    this.onTap,
    this.trailing,
  });
  final IconData icon;
  final String title;
  final String? subtitle;
  final VoidCallback? onTap;
  final Widget? trailing;

  @override
  Widget build(BuildContext context) {
    final palette = context.palette;
    final hasTrailing = trailing != null;
    final showChevron = !hasTrailing && onTap != null;
    final child = ConstrainedBox(
      constraints: const BoxConstraints(minHeight: 52),
      child: Row(children: [
        Container(
          width: 38,
          height: 38,
          decoration: BoxDecoration(
            color: palette.surfaceRaised,
            shape: BoxShape.circle,
          ),
          child: Icon(icon, size: 19, color: palette.inkSoft),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Text(title,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style:
                      inter(15.5, weight: FontWeight.w700, color: palette.ink)),
              if (subtitle != null) ...[
                const SizedBox(height: 3),
                Text(subtitle!,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: inter(12.5, color: palette.muted)),
              ],
            ],
          ),
        ),
        if (hasTrailing) ...[
          const SizedBox(width: 10),
          trailing!,
        ] else if (showChevron) ...[
          const SizedBox(width: 4),
          Icon(Icons.chevron_right, color: palette.muted),
        ],
      ]),
    );
    if (onTap == null) return child;
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(NiaRadius.md),
      child: child,
    );
  }
}

/// A restrained, honest attribute-chip strip — the Momo profile's
/// height/star-sign/city row, filtered to Nia's palette and data discipline.
///
/// Only real values are shown; an empty or partial profile surfaces a single
/// brand-tinted "add" chip (no fake placeholders, no badge spam). One accent
/// per screen is preserved by reserving the brand tint for that single CTA.
class AttributeChips extends StatelessWidget {
  const AttributeChips({
    super.key,
    required this.chips,
    this.onAdd,
    this.addLabel = 'Add your details',
  });
  final List<String> chips;
  final VoidCallback? onAdd;
  final String addLabel;

  @override
  Widget build(BuildContext context) {
    final palette = context.palette;
    final items = chips.where((c) => c.trim().isNotEmpty).toList();
    final showAdd = onAdd != null && items.length < 3;
    if (items.isEmpty && !showAdd) return const SizedBox.shrink();
    return Wrap(
      spacing: 8,
      runSpacing: 8,
      children: [
        ...items.map((label) => Container(
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 9),
              decoration: BoxDecoration(
                color: palette.surfaceRaised,
                borderRadius: BorderRadius.circular(NiaRadius.pill),
                border: Border.all(color: palette.line),
              ),
              child: Text(label,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: inter(13,
                      weight: FontWeight.w500, color: palette.inkSoft)),
            )),
        if (showAdd)
          GestureDetector(
            onTap: onAdd,
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 9),
              decoration: BoxDecoration(
                color: palette.brandSoft,
                borderRadius: BorderRadius.circular(NiaRadius.pill),
              ),
              child: Text(addLabel,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: inter(13,
                      weight: FontWeight.w600, color: palette.brandOn)),
            ),
          ),
      ],
    );
  }
}

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
            // Matches the web design token --shadow:
            //   0 1px 2px rgba(22,19,15,.04), 0 14px 40px rgba(22,19,15,.06)
            BoxShadow(
                color: context.palette.ink.withValues(alpha: .04),
                blurRadius: 2,
                offset: const Offset(0, 1)),
            BoxShadow(
                color: context.palette.ink.withValues(alpha: .06),
                blurRadius: 40,
                offset: const Offset(0, 14)),
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
