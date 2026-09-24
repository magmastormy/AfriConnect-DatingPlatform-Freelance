import 'dart:ui' as ui;

import 'package:flutter/material.dart';

import '../theme/app_theme.dart';

/// Nia component kit.
///
/// The building blocks distilled in `DESIGN_INSPIRATIONS.md` §9. Every widget
/// here is theme-aware (reads `context.palette`), honours reduced-motion, and
/// keeps a ≥44px touch target. Brand colours come from [AppColors] and are
/// never redefined locally.
///
/// House rules these encode:
///  * one accent per screen — prefer [ActionTone.neutral] unless the action is
///    genuinely the primary one
///  * fully-rounded is the default shape for anything selectable
///  * text over a photo always sits on a scrim
///  * on dark, separate with hairlines; on light, separate with soft shadow

// Brand wordmark

/// The serif wordmark that carries the brand in a top bar. The reference
/// pattern is *serif for the brand, sans for everything else* — so this is the
/// only place the display face appears in the chrome.
class BrandWordmark extends StatelessWidget {
  const BrandWordmark({
    super.key,
    this.text = 'Nia',
    this.showAlert = false,
    this.size = 26,
  });

  final String text;
  final bool showAlert;
  final double size;

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(text,
            style: editorial(size, weight: FontWeight.w700),
            semanticsLabel: text),
        if (showAlert) ...[
          const SizedBox(width: 3),
          Container(
            width: 7,
            height: 7,
            margin: const EdgeInsets.only(top: 3),
            decoration: const BoxDecoration(
              color: AppColors.clay,
              shape: BoxShape.circle,
            ),
          ),
        ],
      ],
    );
  }
}

// Segmented pill (single-select)

class SegmentedOption<T> {
  const SegmentedOption({required this.value, required this.label, this.badge});
  final T value;
  final String label;

  /// Optional small count/tick rendered after the label.
  final int? badge;
}

/// A segmented pill group with a **sliding** fill — the reference behaviour for
/// mutually exclusive views. The fill slides rather than cross-fading, which
/// makes the relationship between the two states legible.
class SegmentedPill<T> extends StatelessWidget {
  const SegmentedPill({
    super.key,
    required this.options,
    required this.selected,
    required this.onChanged,
    this.dense = false,
  });

  final List<SegmentedOption<T>> options;
  final T selected;
  final ValueChanged<T> onChanged;

  /// Dense = shorter height, for in-card usage.
  final bool dense;

  @override
  Widget build(BuildContext context) {
    final palette = context.palette;
    final index = options.indexWhere((o) => o.value == selected);
    final height = dense ? 32.0 : 40.0;
    final reduce = NiaMotion.reduced(context);

    return SizedBox(
      height: height,
      child: LayoutBuilder(
        builder: (context, constraints) {
          final segmentWidth = constraints.maxWidth / options.length;
          return Stack(
            children: [
              // The sliding fill.
              AnimatedPositioned(
                duration: reduce ? Duration.zero : NiaMotion.base,
                curve: NiaMotion.easeOut,
                left: segmentWidth * (index < 0 ? 0 : index),
                top: 0,
                bottom: 0,
                width: segmentWidth,
                child: DecoratedBox(
                  decoration: BoxDecoration(
                    color: palette.ink,
                    borderRadius: BorderRadius.circular(NiaRadius.pill),
                  ),
                ),
              ),
              // Labels sit above the fill.
              Row(
                children: [
                  for (final option in options)
                    Expanded(
                      child: _Segment(
                        label: option.label,
                        badge: option.badge,
                        active: option.value == selected,
                        onTap: () => onChanged(option.value),
                      ),
                    ),
                ],
              ),
            ],
          );
        },
      ),
    );
  }
}

class _Segment extends StatelessWidget {
  const _Segment({
    required this.label,
    required this.active,
    required this.onTap,
    this.badge,
  });

  final String label;
  final bool active;
  final VoidCallback onTap;
  final int? badge;

  @override
  Widget build(BuildContext context) {
    final palette = context.palette;
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(NiaRadius.pill),
        child: Center(
          child: Row(
            mainAxisAlignment: MainAxisAlignment.center,
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(
                label,
                style: niaLabel(12.5, weight: FontWeight.w600).copyWith(
                  // The active label sits *on* the ink fill, so it takes the
                  // canvas colour — which inverts correctly in dark mode.
                  color: active ? palette.background : palette.muted,
                ),
              ),
              if (badge != null && badge! > 0) ...[
                const SizedBox(width: 5),
                Text('${badge!}',
                    style: niaLabel(11, weight: FontWeight.w700).copyWith(
                      color: active ? palette.background : palette.muted,
                    )),
              ],
            ],
          ),
        ),
      ),
    );
  }
}

// Media card — the photographic hero

/// A full-bleed media card: photograph, scrim, corner badges, and content
/// anchored to the bottom. This is the workhorse of both the Discover deck and
/// the profile sheet.
///
/// Two scrim modes:
///  * [brandScrim] `false` → neutral dark gradient, safe for any photo
///  * [brandScrim] `true`  → wine-tinted gradient, the signature that makes a
///    photo read as ours rather than stock
class MediaCard extends StatelessWidget {
  const MediaCard({
    super.key,
    this.imageUrl,
    this.fallback,
    this.topLeft = const [],
    this.topRight = const [],
    this.content,
    this.height,
    this.radius = NiaRadius.xl,
    this.padding = const EdgeInsets.fromLTRB(18, 16, 18, 20),
    this.brandScrim = false,
    this.scrimStart = 0.30,
    this.elevated = true,
    this.onTap,
  });

  final String? imageUrl;

  /// Painted when [imageUrl] is null or fails to load.
  final Widget? fallback;
  final List<Widget> topLeft;
  final List<Widget> topRight;
  final Widget? content;
  final double? height;
  final double radius;
  final EdgeInsets padding;
  final bool brandScrim;
  final double scrimStart;
  final bool elevated;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    // The scrim is intentionally theme-independent: it always sits over a
    // photograph, so it must darken the image rather than follow the canvas.
    final scrimColors = brandScrim
        ? NiaScrim.brandColors(AppColors.clayDark, AppColors.plum)
        : NiaScrim.mediaColors(const Color(0xFF000000));

    Widget card = ClipRRect(
      borderRadius: BorderRadius.circular(radius),
      child: Stack(
        fit: StackFit.expand,
        children: [
          if (imageUrl != null && imageUrl!.isNotEmpty)
            Image.network(
              imageUrl!,
              fit: BoxFit.cover,
              errorBuilder: (_, __, ___) => fallback ?? _MediaFallback(),
            )
          else
            fallback ?? _MediaFallback(),

          // Scrim — text over a photo is never allowed without this.
          DecoratedBox(
            decoration: BoxDecoration(
              gradient: LinearGradient(
                begin: Alignment.topCenter,
                end: Alignment.bottomCenter,
                stops: [0.0, scrimStart, 1.0],
                colors: scrimColors,
              ),
            ),
          ),

          if (topLeft.isNotEmpty)
            Positioned(
              top: 14,
              left: 14,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  for (final badge in topLeft)
                    Padding(
                      padding: const EdgeInsets.only(bottom: 6),
                      child: badge,
                    ),
                ],
              ),
            ),

          if (topRight.isNotEmpty)
            Positioned(
              top: 14,
              right: 14,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  for (final badge in topRight)
                    Padding(
                      padding: const EdgeInsets.only(bottom: 6),
                      child: badge,
                    ),
                ],
              ),
            ),

          if (content != null)
            Positioned(
              left: 0,
              right: 0,
              bottom: 0,
              child: Padding(padding: padding, child: content!),
            ),
        ],
      ),
    );

    if (elevated) {
      card = DecoratedBox(
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(radius),
          boxShadow: niaShadowMedia(),
        ),
        child: card,
      );
    }

    if (onTap != null) {
      card = GestureDetector(onTap: onTap, child: card);
    }

    return height == null ? card : SizedBox(height: height, child: card);
  }
}

/// Placeholder shown when a member has no photo. Deliberately a soft brand
/// gradient rather than a grey box — an empty state should still look designed.
class _MediaFallback extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return DecoratedBox(
      decoration: const BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [AppColors.clayDark, AppColors.plum],
        ),
      ),
      child: Center(
        child: Icon(Icons.person_outline_rounded,
            size: 56, color: Colors.white.withValues(alpha: 0.45)),
      ),
    );
  }
}

// Action bubbles

enum ActionTone {
  /// Neutral / reactive (pass, dismiss) — a plain raised surface.
  neutral,

  /// The primary affirmative action (like). Brand-filled with a gradient.
  brand,

  /// The scarce, high-intent action (superlike). Gold.
  gold,

  /// A bare, uncontained glyph — deliberately quieter than a bubble.
  bare,
}

/// A circular action button. The reference pattern is **large, physical, and
/// unlabelled** — the icon and the shadow carry the meaning, and a text label
/// underneath only adds noise.
class ActionBubble extends StatelessWidget {
  const ActionBubble({
    super.key,
    required this.icon,
    required this.tone,
    this.onTap,
    this.size = 64,
    this.semanticLabel,
    this.busy = false,
  });

  final IconData icon;
  final ActionTone tone;
  final VoidCallback? onTap;
  final double size;
  final String? semanticLabel;
  final bool busy;

  @override
  Widget build(BuildContext context) {
    final palette = context.palette;
    final enabled = onTap != null && !busy;
    final reduce = NiaMotion.reduced(context);

    if (tone == ActionTone.bare) {
      return Semantics(
        button: true,
        label: semanticLabel,
        child: Tooltip(
          message: semanticLabel ?? '',
          preferBelow: false,
          verticalOffset: 10,
          waitDuration: const Duration(milliseconds: 350),
          showDuration: const Duration(seconds: 2),
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
          child: InkResponse(
            onTap: enabled ? onTap : null,
            radius: size * 0.62,
            child: SizedBox(
              width: size,
              height: size,
              child: Icon(icon,
                  size: size * 0.46,
                  color: enabled ? palette.muted : palette.lineStrong),
            ),
          ),
        ),
      );
    }

    final (Color fill, Color glyph, Border? border, Gradient? gradient) =
        switch (tone) {
      ActionTone.brand => (
          AppColors.clay,
          palette.onBrand,
          null,
          const LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: [AppColors.clay, AppColors.clayDark],
          ),
        ),
      ActionTone.gold => (AppColors.gold, AppColors.onBrandLight, null, null),
      _ => (
          palette.surface,
          palette.inkSoft,
          Border.all(color: palette.line, width: 1),
          null,
        ),
    };

    return Semantics(
      button: true,
      label: semanticLabel,
      child: Tooltip(
        message: semanticLabel ?? '',
        preferBelow: false,
        verticalOffset: 10,
        waitDuration: const Duration(milliseconds: 350),
        showDuration: const Duration(seconds: 2),
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
        child: _PressScale(
          enabled: enabled,
          reduceMotion: reduce,
          child: GestureDetector(
          onTap: enabled ? onTap : null,
          child: Container(
            width: size,
            height: size,
            decoration: BoxDecoration(
              // A gradient and a colour are mutually exclusive in a
              // BoxDecoration, so only the non-gradient tones set `color`.
              color: gradient == null ? fill : null,
              shape: BoxShape.circle,
              border: border,
              boxShadow: niaShadowBubble(palette.ink),
              gradient: gradient,
            ),
            child: busy
                ? Center(
                    child: SizedBox(
                      width: size * 0.34,
                      height: size * 0.34,
                      child: CircularProgressIndicator(
                        strokeWidth: 2.4,
                        valueColor: AlwaysStoppedAnimation(glyph),
                      ),
                    ),
                  )
                : Icon(icon,
                    size: size * 0.42,
                    color: glyph,
                    semanticLabel: semanticLabel),
          ),
        ),
      ),
      ),
    );
  }
}

/// Press feedback: a small, fast scale. The physicality *is* the feedback, so
/// this is used by every tappable bubble and pill.
class _PressScale extends StatefulWidget {
  const _PressScale({
    required this.child,
    required this.enabled,
    required this.reduceMotion,
  });

  final Widget child;
  final bool enabled;
  final bool reduceMotion;

  @override
  State<_PressScale> createState() => _PressScaleState();
}

class _PressScaleState extends State<_PressScale> {
  bool _pressed = false;

  @override
  Widget build(BuildContext context) {
    final scale = (!widget.enabled || widget.reduceMotion)
        ? 1.0
        : _pressed
            ? 0.92
            : 1.0;
    return Listener(
      onPointerDown:
          widget.enabled ? (_) => setState(() => _pressed = true) : null,
      onPointerUp:
          widget.enabled ? (_) => setState(() => _pressed = false) : null,
      onPointerCancel:
          widget.enabled ? (_) => setState(() => _pressed = false) : null,
      child: AnimatedScale(
        scale: scale,
        duration: NiaMotion.fast,
        curve: NiaMotion.easeOut,
        child: widget.child,
      ),
    );
  }
}

// Buttons

/// A fully-rounded call to action. `solid`: ink-filled (default) or a light
/// fill for use on a dark/deep canvas.
enum PillCtaStyle { ink, light, brand }

class PillCta extends StatelessWidget {
  const PillCta({
    super.key,
    required this.label,
    required this.onPressed,
    this.style = PillCtaStyle.ink,
    this.icon,
    this.expand = false,
    this.busy = false,
  });

  final String label;
  final VoidCallback? onPressed;
  final PillCtaStyle style;
  final IconData? icon;
  final bool expand;
  final bool busy;

  @override
  Widget build(BuildContext context) {
    final palette = context.palette;
    final (Color fill, Color fg) = switch (style) {
      PillCtaStyle.light => (palette.surface, palette.ink),
      PillCtaStyle.brand => (AppColors.clay, palette.onBrand),
      _ => (palette.ink, palette.background),
    };

    final button = Semantics(
      button: true,
      label: label,
      child: Material(
        color: fill,
        borderRadius: BorderRadius.circular(NiaRadius.pill),
        clipBehavior: Clip.antiAlias,
        child: InkWell(
          onTap: busy ? null : onPressed,
          child: Container(
            constraints: const BoxConstraints(minHeight: 48),
            padding: const EdgeInsets.symmetric(horizontal: 22, vertical: 14),
            child: Row(
              mainAxisSize: expand ? MainAxisSize.max : MainAxisSize.min,
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                if (busy) ...[
                  SizedBox(
                    width: 16,
                    height: 16,
                    child: CircularProgressIndicator(
                        strokeWidth: 2, valueColor: AlwaysStoppedAnimation(fg)),
                  ),
                  const SizedBox(width: 10),
                ] else if (icon != null) ...[
                  Icon(icon, size: 18, color: fg),
                  const SizedBox(width: 8),
                ],
                Text(label,
                    style: inter(14.5,
                        weight: FontWeight.w600,
                        color: fg,
                        letterSpacing: 0.1)),
              ],
            ),
          ),
        ),
      ),
    );

    return expand ? SizedBox(width: double.infinity, child: button) : button;
  }
}

/// A transparent, hairline-bordered pill. The reference uses this for the
/// secondary action on a dark canvas — quieter than an outlined neutral, and it
/// never competes with the accent.
class GhostButton extends StatelessWidget {
  const GhostButton({
    super.key,
    required this.label,
    required this.onPressed,
    this.icon,
    this.onDark = false,
    this.expand = false,
  });

  final String label;
  final VoidCallback? onPressed;
  final IconData? icon;
  final bool onDark;
  final bool expand;

  @override
  Widget build(BuildContext context) {
    final palette = context.palette;
    final Color fg = onDark ? Colors.white : palette.ink;
    final Color edge =
        onDark ? Colors.white.withValues(alpha: 0.34) : palette.lineStrong;

    final button = Material(
      color: Colors.transparent,
      borderRadius: BorderRadius.circular(NiaRadius.pill),
      child: InkWell(
        onTap: onPressed,
        borderRadius: BorderRadius.circular(NiaRadius.pill),
        child: Container(
          constraints: const BoxConstraints(minHeight: 48),
          padding: const EdgeInsets.symmetric(horizontal: 22, vertical: 13),
          decoration: BoxDecoration(
            border: Border.all(color: edge),
            borderRadius: BorderRadius.circular(NiaRadius.pill),
          ),
          child: Row(
            mainAxisSize: expand ? MainAxisSize.max : MainAxisSize.min,
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              if (icon != null) ...[
                Icon(icon, size: 18, color: fg),
                const SizedBox(width: 8),
              ],
              Text(label,
                  style: inter(14.5, weight: FontWeight.w600, color: fg)),
            ],
          ),
        ),
      ),
    );

    return expand ? SizedBox(width: double.infinity, child: button) : button;
  }
}

/// A 44px translucent circular icon button for use as top-bar chrome over
/// media or on a deep canvas. Falls back to a solid raised surface when there
/// is no imagery behind it for the blur to pick up.
class CircleIconButton extends StatelessWidget {
  const CircleIconButton({
    super.key,
    required this.icon,
    required this.onTap,
    this.semanticLabel,
    this.onMedia = true,
    this.size = 44,
    this.badgeCount,
  });

  final IconData icon;
  final VoidCallback? onTap;
  final String? semanticLabel;
  final bool onMedia;
  final double size;
  final int? badgeCount;

  @override
  Widget build(BuildContext context) {
    final palette = context.palette;

    Widget content = Center(
      child: Icon(icon,
          size: size * 0.5, color: onMedia ? Colors.white : palette.inkSoft),
    );

    if (badgeCount != null && badgeCount! > 0) {
      content = Stack(
        alignment: Alignment.center,
        children: [
          content,
          Positioned(
            top: size * 0.16,
            right: size * 0.14,
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 1),
              decoration: BoxDecoration(
                color: AppColors.clay,
                borderRadius: BorderRadius.circular(NiaRadius.pill),
                border: Border.all(
                    color: onMedia ? Colors.transparent : palette.surface,
                    width: 1.5),
              ),
              child: Text('${badgeCount!}',
                  style: niaLabel(10, weight: FontWeight.w700).copyWith(
                      color: onMedia ? Colors.white : palette.onBrand)),
            ),
          ),
        ],
      );
    }

    final shape = DecoratedBox(
      decoration: BoxDecoration(
        color: onMedia
            ? Colors.white.withValues(alpha: 0.14)
            : palette.surfaceRaised,
        shape: BoxShape.circle,
        border: Border.all(
            color:
                onMedia ? Colors.white.withValues(alpha: 0.22) : palette.line),
      ),
      child: SizedBox(width: size, height: size, child: content),
    );

    return Semantics(
      button: true,
      label: semanticLabel,
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          onTap: onTap,
          customBorder: const CircleBorder(),
          child: onMedia
              ? ClipOval(
                  child: BackdropFilter(
                    filter: ui.ImageFilter.blur(sigmaX: 18, sigmaY: 18),
                    child: shape,
                  ),
                )
              : shape,
        ),
      ),
    );
  }
}

// Small indicators

/// `● Online` — a presence indicator that sits directly on a photo.
class PresencePill extends StatelessWidget {
  const PresencePill({
    super.key,
    this.label = 'Online',
    this.color = const Color(0xFF4ADE80),
  });

  final String label;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 4),
      decoration: BoxDecoration(
        color: Colors.black.withValues(alpha: 0.42),
        borderRadius: BorderRadius.circular(NiaRadius.pill),
        border: Border.all(color: Colors.white.withValues(alpha: 0.18)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: 6,
            height: 6,
            decoration: BoxDecoration(color: color, shape: BoxShape.circle),
          ),
          const SizedBox(width: 5),
          Text(label,
              style: inter(11,
                  weight: FontWeight.w600, color: Colors.white, height: 1.2)),
        ],
      ),
    );
  }
}

/// A translucent white pill for facts that belong *on* the photo — distance,
/// photo count, and similar metadata. Reads as part of the image rather than a
/// separate control.
class MediaBadge extends StatelessWidget {
  const MediaBadge({super.key, required this.label, this.icon});

  final String label;
  final IconData? icon;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 4),
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: 0.92),
        borderRadius: BorderRadius.circular(NiaRadius.pill),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (icon != null) ...[
            Icon(icon, size: 11, color: AppColors.plum),
            const SizedBox(width: 3),
          ],
          Text(label,
              style: inter(11,
                  weight: FontWeight.w700, color: AppColors.plum, height: 1.2)),
        ],
      ),
    );
  }
}

/// `4.5 ★ · 4 reviews` — one line, low emphasis, disproportionate reassurance.
/// Nia's analogue is the verification / vouch signal.
class TrustRow extends StatelessWidget {
  const TrustRow({
    super.key,
    required this.primary,
    this.secondary,
    this.onMedia = true,
  });

  final String primary;
  final String? secondary;
  final bool onMedia;

  @override
  Widget build(BuildContext context) {
    final color =
        onMedia ? Colors.white.withValues(alpha: 0.85) : context.palette.muted;
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(Icons.verified_rounded, size: 13, color: color),
        const SizedBox(width: 4),
        Text(
          secondary == null ? primary : '$primary · $secondary',
          style: inter(12, weight: FontWeight.w500, color: color, height: 1.3),
        ),
      ],
    );
  }
}

// Rails

/// A slim hairline used to separate rows on dark, where fills are too heavy.
class Hairline extends StatelessWidget {
  const Hairline({super.key, this.indent = 0});
  final double indent;

  @override
  Widget build(BuildContext context) => Container(
        height: 1,
        margin: EdgeInsets.only(left: indent),
        color: context.palette.line,
      );
}

/// A horizontal, clipping rail of filter pills. The final item is allowed to
/// run off the edge — that is the scroll affordance, so do not pad the end.
class FilterRail<T> extends StatelessWidget {
  const FilterRail({
    super.key,
    required this.options,
    required this.selected,
    required this.onChanged,
    this.padding = const EdgeInsets.symmetric(horizontal: 20),
  });

  final List<SegmentedOption<T>> options;
  final T selected;
  final ValueChanged<T> onChanged;
  final EdgeInsets padding;

  @override
  Widget build(BuildContext context) {
    final palette = context.palette;
    return SizedBox(
      height: 36,
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        padding: padding,
        itemCount: options.length,
        separatorBuilder: (_, __) => const SizedBox(width: 8),
        itemBuilder: (context, i) {
          final option = options[i];
          final active = option.value == selected;
          return _PressScale(
            enabled: true,
            reduceMotion: NiaMotion.reduced(context),
            child: GestureDetector(
              onTap: () => onChanged(option.value),
              child: AnimatedContainer(
                duration: NiaMotion.base,
                curve: NiaMotion.easeOut,
                padding: const EdgeInsets.symmetric(horizontal: 15),
                alignment: Alignment.center,
                decoration: BoxDecoration(
                  color: active
                      ? palette.ink
                      : palette.surface.withValues(alpha: 0.7),
                  borderRadius: BorderRadius.circular(NiaRadius.pill),
                  border:
                      Border.all(color: active ? palette.ink : palette.line),
                ),
                child: Text(
                  option.label,
                  style: niaLabel(12.5, weight: FontWeight.w600).copyWith(
                    color: active ? palette.background : palette.inkSoft,
                  ),
                ),
              ),
            ),
          );
        },
      ),
    );
  }
}

/// A horizontally scrolling row of avatars that overlap slightly. Used for
/// "recent matches" and "who's online". Pass [items]; the leading slot can be
/// an action (e.g. a "+" invite).
class AvatarRail extends StatelessWidget {
  const AvatarRail({
    super.key,
    required this.items,
    this.overlap = 12,
    this.size = 48,
    this.onTap,
    this.leading,
  });

  final List<AvatarRailItem> items;
  final double overlap;
  final double size;
  final void Function(int index)? onTap;
  final Widget? leading;

  @override
  Widget build(BuildContext context) {
    final palette = context.palette;
    final step = size - overlap;

    return SizedBox(
      height: size + 24,
      child: ListView(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(horizontal: 20),
        children: [
          if (leading != null) ...[
            SizedBox(width: size, child: leading!),
            SizedBox(width: step),
          ],
          for (var i = 0; i < items.length; i++)
            SizedBox(
              // Overlap is achieved by letting each slot be narrower than the
              // avatar it contains.
              width: i == items.length - 1 ? size : step,
              child: OverflowBox(
                alignment: Alignment.centerLeft,
                maxWidth: size,
                child: GestureDetector(
                  onTap: onTap == null ? null : () => onTap!(i),
                  child: _RailAvatar(
                    item: items[i],
                    size: size,
                    ring: palette.background,
                  ),
                ),
              ),
            ),
        ],
      ),
    );
  }
}

class AvatarRailItem {
  const AvatarRailItem({
    required this.label,
    this.imageUrl,
    this.emphasised = false,
  });
  final String label;
  final String? imageUrl;

  /// Renders larger with an outer ring — the reference emphasises one item.
  final bool emphasised;
}

class _RailAvatar extends StatelessWidget {
  const _RailAvatar(
      {required this.item, required this.size, required this.ring});

  final AvatarRailItem item;
  final double size;
  final Color ring;

  @override
  Widget build(BuildContext context) {
    final outer = item.emphasised ? size + 6 : size;
    final avatar = Container(
      width: outer,
      height: outer,
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        color: AppColors.plum,
        border: Border.all(color: ring, width: 2.5),
      ),
      clipBehavior: Clip.antiAlias,
      child: item.imageUrl != null && item.imageUrl!.isNotEmpty
          ? Image.network(
              item.imageUrl!,
              fit: BoxFit.cover,
              errorBuilder: (_, __, ___) => _initial(),
            )
          : _initial(),
    );

    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        avatar,
        const SizedBox(height: 4),
        SizedBox(
          width: outer,
          child: Text(
            item.label,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            textAlign: TextAlign.center,
            style: niaLabel(9.5, weight: FontWeight.w600)
                .copyWith(color: context.palette.muted),
          ),
        ),
      ],
    );
  }

  Widget _initial() {
    final letter =
        item.label.trim().isEmpty ? '?' : item.label.trim()[0].toUpperCase();
    return Center(
      child: Text(
        letter,
        style: editorial(size * 0.4, weight: FontWeight.w700)
            .copyWith(color: AppColors.bone),
      ),
    );
  }
}

// Inputs

/// A borderless, fully-rounded search / location field. The reference uses a
/// light fill with no border — it reads as a control without adding another
/// outlined box to the screen.
class SearchPill extends StatelessWidget {
  const SearchPill({
    super.key,
    required this.placeholder,
    this.icon = Icons.search_rounded,
    this.onTap,
    this.controller,
    this.onChanged,
  });

  final String placeholder;
  final IconData icon;
  final VoidCallback? onTap;
  final TextEditingController? controller;
  final ValueChanged<String>? onChanged;

  @override
  Widget build(BuildContext context) {
    final palette = context.palette;
    final content = Row(
      children: [
        Icon(icon, size: 18, color: palette.muted),
        const SizedBox(width: 10),
        Expanded(
          child: controller == null
              ? Text(placeholder,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style:
                      inter(14, weight: FontWeight.w500, color: palette.muted))
              : TextField(
                  controller: controller,
                  onChanged: onChanged,
                  style: inter(14, weight: FontWeight.w500, color: palette.ink),
                  decoration: InputDecoration(
                    isDense: true,
                    border: InputBorder.none,
                    hintText: placeholder,
                    hintStyle: inter(14,
                        weight: FontWeight.w500, color: palette.muted),
                  ),
                ),
        ),
      ],
    );

    final body = Container(
      constraints: const BoxConstraints(minHeight: 46),
      padding: const EdgeInsets.symmetric(horizontal: 16),
      decoration: BoxDecoration(
        color: palette.surfaceRaised,
        borderRadius: BorderRadius.circular(NiaRadius.pill),
        border: Border.all(color: palette.line),
      ),
      child: Center(child: content),
    );

    return onTap == null ? body : GestureDetector(onTap: onTap, child: body);
  }
}

// Suggestion chips

class SuggestionChips extends StatelessWidget {
  const SuggestionChips({
    super.key,
    required this.suggestions,
    required this.onPick,
    this.label,
  });

  final List<String> suggestions;
  final void Function(String) onPick;
  final String? label;

  @override
  Widget build(BuildContext context) {
    final palette = context.palette;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        if (label != null) ...[
          Text(
            label!,
            style: niaLabel(11.5, weight: FontWeight.w600)
                .copyWith(color: palette.muted),
          ),
          const SizedBox(height: 8),
        ],
        SizedBox(
          height: 44,
          child: ListView.separated(
            scrollDirection: Axis.horizontal,
            padding: EdgeInsets.zero,
            itemCount: suggestions.length,
            separatorBuilder: (_, __) => const SizedBox(width: 8),
            itemBuilder: (context, i) {
              final text = suggestions[i];
              return _PressScale(
                enabled: true,
                reduceMotion: NiaMotion.reduced(context),
                child: GestureDetector(
                  onTap: () => onPick(text),
                  child: Container(
                    alignment: Alignment.center,
                    padding: const EdgeInsets.symmetric(horizontal: 14),
                    decoration: BoxDecoration(
                      color: palette.surfaceRaised,
                      borderRadius: BorderRadius.circular(NiaRadius.pill),
                      border: Border.all(color: palette.line),
                    ),
                    child: Text(
                      text,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: inter(13,
                          weight: FontWeight.w500, color: palette.inkSoft),
                    ),
                  ),
                ),
              );
            },
          ),
        ),
      ],
    );
  }
}

// Canvas

/// A deep canvas with a single radial accent glow — the reference treatment for
/// full-screen moments (searching, empty states, match celebrations) and splash
/// screens. One glow, centred low, fading to near-black at the edges.
class DeepCanvas extends StatelessWidget {
  const DeepCanvas({
    super.key,
    required this.child,
    this.glow = AppColors.clay,
    this.intensity = 0.30,
    this.glowAlignment = const Alignment(0, 0.42),
  });

  final Widget child;
  final Color glow;
  final double intensity;
  final Alignment glowAlignment;

  @override
  Widget build(BuildContext context) {
    // A BoxDecoration may not carry both `color` and `gradient`, so the canvas
    // colour is expressed as the gradient's own end stops instead.
    final base = AppPalette.dark.background;
    final core = Color.lerp(base, glow, intensity)!;
    return DecoratedBox(
      decoration: BoxDecoration(
        gradient: RadialGradient(
          center: glowAlignment,
          radius: 1.05,
          colors: [core, Color.lerp(base, core, 0.28)!, base],
          stops: const [0.0, 0.5, 1.0],
        ),
      ),
      child: child,
    );
  }
}

/// A glass sheet — blur, translucent fill, hairline edge. **Only legal over
/// photography or a saturated gradient**; over the light canvas the blur has
/// nothing to pick up and the panel reads as a rendering bug. Use a solid
/// raised surface there instead (see [SurfaceCard]).
class GlassPanel extends StatelessWidget {
  const GlassPanel({
    super.key,
    required this.child,
    this.radius = NiaRadius.xl,
    this.padding = const EdgeInsets.all(16),
    this.onDark = true,
  });

  final Widget child;
  final double radius;
  final EdgeInsets padding;
  final bool onDark;

  @override
  Widget build(BuildContext context) {
    final palette = context.palette;
    return ClipRRect(
      borderRadius: BorderRadius.circular(radius),
      child: BackdropFilter(
        filter: ui.ImageFilter.blur(sigmaX: 22, sigmaY: 22),
        child: Container(
          padding: padding,
          decoration: BoxDecoration(
            color: onDark
                ? Colors.white.withValues(alpha: 0.13)
                : palette.ink.withValues(alpha: 0.06),
            borderRadius: BorderRadius.circular(radius),
            border: Border.all(
                color: onDark
                    ? Colors.white.withValues(alpha: 0.20)
                    : palette.ink.withValues(alpha: 0.08)),
          ),
          child: child,
        ),
      ),
    );
  }
}
