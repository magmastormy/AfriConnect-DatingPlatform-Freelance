import 'dart:math' as math;
import 'dart:ui' as ui;

import 'package:flutter/material.dart';

import '../theme/app_theme.dart';
import './nia_kit.dart';

/// Nia interaction kit — the eleven motion-led micro-interactions from the
/// design brief, plus two small data-display primitives (ring + trend) that the
/// dashboard styles lean on.
///
/// Every widget here reads [context.palette], honours [NiaMotion.reduced] (the
/// single gate that disables motion), and keeps a >=44px touch target. Brand
/// colour comes from [AppColors] and is never redefined locally — same house
/// rules as [nia_kit].
///
/// Where each maps in AfriConnect is noted on the public class so the mapping
/// travels with the code, not just the docs.

// ─────────────────────────────────────────────────────────────────────────────
// Data-display primitives
// ─────────────────────────────────────────────────────────────────────────────

/// A circular progress ring. Used by the personal dashboard (prompt 2) and as a
/// compact completeness indicator. [value] is clamped to 0..1.
class NiaRingProgress extends StatelessWidget {
  const NiaRingProgress({
    super.key,
    required this.value,
    this.size = 96,
    this.stroke = 10,
    this.label,
    this.sublabel,
  });

  final double value;
  final double size;
  final double stroke;
  final String? label;
  final String? sublabel;

  @override
  Widget build(BuildContext context) {
    final palette = context.palette;
    return SizedBox(
      width: size,
      height: size,
      child: Stack(
        alignment: Alignment.center,
        children: [
          CustomPaint(
            size: Size(size, size),
            painter: _RingPainter(
              value: value,
              stroke: stroke,
              track: palette.line,
              progress: AppColors.clay,
            ),
          ),
          if (label != null)
            Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(label!, style: numeral(size * 0.24, weight: FontWeight.w700)),
                if (sublabel != null)
                  Text(sublabel!,
                      style: niaLabel(9.5, weight: FontWeight.w600)
                          .copyWith(color: palette.muted)),
              ],
            ),
        ],
      ),
    );
  }
}

class _RingPainter extends CustomPainter {
  const _RingPainter({
    required this.value,
    required this.stroke,
    required this.track,
    required this.progress,
  });

  final double value;
  final double stroke;
  final Color track;
  final Color progress;

  @override
  void paint(Canvas canvas, Size size) {
    final c = size.center(Offset.zero);
    final r = (size.width - stroke) / 2;
    final trackPaint = Paint()
      ..color = track
      ..style = PaintingStyle.stroke
      ..strokeWidth = stroke
      ..strokeCap = StrokeCap.round;
    canvas.drawCircle(c, r, trackPaint);
    final progPaint = Paint()
      ..color = progress
      ..style = PaintingStyle.stroke
      ..strokeWidth = stroke
      ..strokeCap = StrokeCap.round;
    canvas.drawArc(Rect.fromCircle(center: c, radius: r), -math.pi / 2,
        2 * math.pi * value.clamp(0, 1), false, progPaint);
  }

  @override
  bool shouldRepaint(covariant _RingPainter old) =>
      old.value != value || old.track != track || old.progress != progress;
}

/// A lightweight trend line with a soft area fill. Used by the enterprise
/// dashboard (prompt 1). [points] are normalised internally.
class NiaTrendLine extends StatelessWidget {
  const NiaTrendLine({
    super.key,
    required this.points,
    this.height = 120,
    this.color,
  });

  final List<double> points;
  final double height;
  final Color? color;

  @override
  Widget build(BuildContext context) {
    final palette = context.palette;
    return SizedBox(
      height: height,
      child: LayoutBuilder(
        builder: (_, constraints) => CustomPaint(
          size: Size(constraints.maxWidth, height),
          painter: _TrendPainter(
            points: points,
            color: color ?? AppColors.clay,
            grid: palette.line,
          ),
        ),
      ),
    );
  }
}

class _TrendPainter extends CustomPainter {
  const _TrendPainter({
    required this.points,
    required this.color,
    required this.grid,
  });

  final List<double> points;
  final Color color;
  final Color grid;

  @override
  void paint(Canvas canvas, Size size) {
    if (points.length < 2) return;
    final max = points.reduce(math.max);
    final min = points.reduce(math.min);
    final range = (max - min) == 0 ? 1.0 : (max - min);
    final dx = size.width / (points.length - 1);
    Offset xy(int i) => Offset(
        dx * i, size.height - ((points[i] - min) / range) * (size.height - 16) - 8);

    final g = Paint()..color = grid..strokeWidth = 1;
    for (var k = 1; k < 4; k++) {
      final y = size.height * k / 4;
      canvas.drawLine(Offset(0, y), Offset(size.width, y), g);
    }

    final path = Path()..moveTo(xy(0).dx, xy(0).dy);
    for (var i = 1; i < points.length; i++) {
      path.lineTo(xy(i).dx, xy(i).dy);
    }

    final fill = Path()
      ..addPath(path, Offset.zero)
      ..lineTo(size.width, size.height)
      ..lineTo(0, size.height)
      ..close();
    canvas.drawPath(
        fill,
        Paint()..color = color.withValues(alpha: 0.1)
          ..style = PaintingStyle.fill);

    canvas.drawPath(
        path,
        Paint()
          ..color = color
          ..strokeWidth = 2.5
          ..style = PaintingStyle.stroke
          ..strokeCap = StrokeCap.round
          ..strokeJoin = StrokeJoin.round);

    canvas.drawCircle(xy(points.length - 1), 4, Paint()..color = color);
  }

  @override
  bool shouldRepaint(covariant _TrendPainter o) => o.points != points;
}

// ─────────────────────────────────────────────────────────────────────────────
// 3 · Overlap Row — elements overlap by a third, tail shows "+N", tap spreads
//    them out and reveals names; tap again retracts.
//    AfriConnect: "who's online" / recent matches avatar stack.
// ─────────────────────────────────────────────────────────────────────────────

class OverlapItem {
  const OverlapItem(this.label, [this.color]);
  final String label;
  final Color? color;
}

class OverlapRow extends StatefulWidget {
  const OverlapRow({
    super.key,
    required this.items,
    this.size = 54,
    this.overlap = 0.34,
  });

  final List<OverlapItem> items;
  final double size;
  final double overlap;

  @override
  State<OverlapRow> createState() => _OverlapRowState();
}

class _OverlapRowState extends State<OverlapRow> {
  bool _expanded = false;

  @override
  Widget build(BuildContext context) {
    final palette = context.palette;
    final reduce = NiaMotion.reduced(context);
    final dur = reduce ? Duration.zero : NiaMotion.base;
    final maxVisible = 5;
    final overflow = widget.items.length > maxVisible
        ? widget.items.length - maxVisible
        : 0;
    final visible = overflow > 0
        ? widget.items.sublist(0, maxVisible)
        : widget.items;
    final collapsedStep = widget.size * (1 - widget.overlap);
    final expandedStep = widget.size + 8;

    return GestureDetector(
      onTap: () => setState(() => _expanded = !_expanded),
      child: SizedBox(
        height: widget.size + 22,
        child: Stack(
          clipBehavior: Clip.none,
          children: [
            for (var i = 0; i < visible.length; i++)
              AnimatedPositioned(
                duration: dur,
                curve: NiaMotion.easeOut,
                left: _expanded ? i * expandedStep : i * collapsedStep,
                top: 0,
                child: Column(
                  children: [
                    _OverlapAvatar(
                      item: visible[i],
                      size: widget.size,
                      dimmed: !_expanded && i > 0,
                    ),
                    AnimatedOpacity(
                      opacity: _expanded ? 1 : 0,
                      duration: dur,
                      child: Padding(
                        padding: const EdgeInsets.only(top: 4),
                        child: SizedBox(
                          width: widget.size,
                          child: Text(
                            visible[i].label,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            textAlign: TextAlign.center,
                            style: niaLabel(9.5, weight: FontWeight.w600)
                                .copyWith(color: palette.muted),
                          ),
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            if (overflow > 0 && !_expanded)
              Positioned(
                left: maxVisible * collapsedStep,
                top: 0,
                child: _OverlapAvatar(
                  item: OverlapItem('+$overflow', AppColors.plum),
                  size: widget.size,
                  isCount: true,
                ),
              ),
          ],
        ),
      ),
    );
  }
}

class _OverlapAvatar extends StatelessWidget {
  const _OverlapAvatar({
    required this.item,
    required this.size,
    this.dimmed = false,
    this.isCount = false,
  });

  final OverlapItem item;
  final double size;
  final bool dimmed;
  final bool isCount;

  @override
  Widget build(BuildContext context) {
    final palette = context.palette;
    final bg = item.color ?? AppColors.plum;
    return Container(
      width: size,
      height: size,
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        color: isCount ? palette.ink : bg,
        border: Border.all(color: palette.background, width: 2.5),
      ),
      child: isCount
          ? Center(
              child: Text(item.label,
                  style: inter(size * 0.3, weight: FontWeight.w700,
                      color: palette.background)),
            )
          : Center(
              child: Text(
                item.label.isNotEmpty ? item.label[0].toUpperCase() : '?',
                style: editorial(size * 0.4, weight: FontWeight.w700)
                    .copyWith(color: AppColors.bone),
              ),
            ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 4 · Magnify Row — icons scale by distance from the finger; neighbours make
//    room; release selects the nearest.
//    AfriConnect: the reaction / "vibe" picker on a profile or message.
// ─────────────────────────────────────────────────────────────────────────────

class MagnifyRow extends StatefulWidget {
  const MagnifyRow({
    super.key,
    required this.items,
    this.size = 52,
  });

  final List<IconData> items;
  final double size;

  @override
  State<MagnifyRow> createState() => _MagnifyRowState();
}

class _MagnifyRowState extends State<MagnifyRow> {
  int _selected = 0;
  double? _pointerX;

  double _scaleFor(int i) {
    if (_pointerX == null) return i == _selected ? 1.32 : 1.0;
    final center = i * widget.size + widget.size / 2;
    final dist = (_pointerX! - center).abs();
    final factor = (1 - dist / (widget.size * 1.7)).clamp(0, 1);
    return 1.0 + 0.55 * factor;
  }

  @override
  Widget build(BuildContext context) {
    final reduce = NiaMotion.reduced(context);
    if (reduce) _pointerX = null;

    return GestureDetector(
      onHorizontalDragUpdate: reduce
          ? null
          : (d) => setState(() => _pointerX = d.localPosition.dx),
      onHorizontalDragEnd: reduce
          ? null
          : (d) {
              if (_pointerX != null) {
                final idx = ((_pointerX! - widget.size / 2) / widget.size)
                    .round()
                    .clamp(0, widget.items.length - 1);
                setState(() {
                  _selected = idx;
                  _pointerX = null;
                });
              }
            },
      onTapUp: reduce
          ? null
          : (d) {
              final idx = ((d.localPosition.dx - widget.size / 2) / widget.size)
                  .round()
                  .clamp(0, widget.items.length - 1);
              setState(() => _selected = idx);
            },
      child: Row(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          for (var i = 0; i < widget.items.length; i++)
            _MagnifyIcon(
              icon: widget.items[i],
              scale: _scaleFor(i),
              selected: i == _selected,
              reduce: reduce,
              onTap: () => setState(() => _selected = i),
            ),
        ],
      ),
    );
  }
}

class _MagnifyIcon extends StatelessWidget {
  const _MagnifyIcon({
    required this.icon,
    required this.scale,
    required this.selected,
    required this.reduce,
    required this.onTap,
  });

  final IconData icon;
  final double scale;
  final bool selected;
  final bool reduce;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final palette = context.palette;
    final dur = reduce ? Duration.zero : NiaMotion.fast;
    // Width grows with scale so neighbours "make room".
    return Semantics(
      button: true,
      child: GesturedDetectorWrapped(
        onTap: onTap,
        child: AnimatedContainer(
          duration: dur,
          curve: NiaMotion.easeOut,
          width: 56 * scale,
          height: 56,
          alignment: Alignment.center,
          child: AnimatedContainer(
            duration: dur,
            curve: NiaMotion.easeOut,
            width: 44 * scale,
            height: 44 * scale,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              color: selected ? AppColors.clay : palette.surfaceRaised,
              border: Border.all(
                color: selected ? AppColors.clay : palette.line,
              ),
            ),
            // On the wine fill, text takes the on-brand colour for contrast.
            child: Icon(icon, size: 22 * scale,
                color: selected ? palette.onBrand : palette.muted),
          ),
        ),
      ),
    );
  }
}

/// Tiny wrapper so the build reads cleanly; a centered tappable icon box.
class GesturedDetectorWrapped extends StatelessWidget {
  const GesturedDetectorWrapped({
    super.key,
    required this.child,
    required this.onTap,
  });

  final Widget child;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) => GestureDetector(onTap: onTap, child: child);
}

// ─────────────────────────────────────────────────────────────────────────────
// 5 · Accordion Card — height, content opacity and arrow angle share one easing
//    curve.
//    AfriConnect: expandable settings / FAQ / "about" rows.
// ─────────────────────────────────────────────────────────────────────────────

class AccordionCard extends StatefulWidget {
  const AccordionCard({
    super.key,
    required this.title,
    required this.child,
    this.leading,
  });

  final String title;
  final Widget child;
  final Widget? leading;

  @override
  State<AccordionCard> createState() => _AccordionCardState();
}

class _AccordionCardState extends State<AccordionCard> {
  bool _open = false;

  @override
  Widget build(BuildContext context) {
    final palette = context.palette;
    final reduce = NiaMotion.reduced(context);
    final dur = reduce ? Duration.zero : NiaMotion.base;

    return Container(
      decoration: BoxDecoration(
        color: palette.surface,
        border: Border.all(color: palette.line),
        borderRadius: BorderRadius.circular(NiaRadius.md),
        boxShadow: niaShadowSoft(palette.ink),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          GestureDetector(
            onTap: () => setState(() => _open = !_open),
            behavior: HitTestBehavior.opaque,
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Row(
                children: [
                  if (widget.leading != null) ...[
                    widget.leading!,
                    const SizedBox(width: 12),
                  ],
                  Expanded(
                    child: Text(widget.title,
                        style:
                            inter(15.5, weight: FontWeight.w700, color: palette.ink)),
                  ),
                  AnimatedRotation(
                    turns: _open ? 0.5 : 0,
                    duration: dur,
                    curve: NiaMotion.easeOut,
                    child: Icon(Icons.keyboard_arrow_down_rounded,
                        color: palette.muted),
                  ),
                ],
              ),
            ),
          ),
          // One curve drives height (AnimatedSize) + opacity (AnimatedOpacity).
          AnimatedSize(
            duration: dur,
            curve: NiaMotion.easeOut,
            alignment: Alignment.topCenter,
            child: AnimatedOpacity(
              opacity: _open ? 1 : 0,
              duration: dur,
              curve: NiaMotion.easeOut,
              child: _open
                  ? Padding(
                      padding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
                      child: widget.child,
                    )
                  : const SizedBox.shrink(),
            ),
          ),
        ],
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 6 · Segment — sliding selected block + synchronised horizontal content swap.
//    AfriConnect: the profile / discovery tab switcher (extends the kit's
//    [SegmentedPill] with the synced content panel).
// ─────────────────────────────────────────────────────────────────────────────

class SegmentedSwitcher<T> extends StatelessWidget {
  const SegmentedSwitcher({
    super.key,
    required this.options,
    required this.selected,
    required this.onChanged,
    required this.contentFor,
  });

  final List<SegmentedOption<T>> options;
  final T selected;
  final ValueChanged<T> onChanged;
  final Widget Function(T) contentFor;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        SegmentedPill(
          options: options,
          selected: selected,
          onChanged: onChanged,
        ),
        const SizedBox(height: 14),
        AnimatedSwitcher(
          duration: NiaMotion.base,
          switchInCurve: NiaMotion.easeOut,
          switchOutCurve: NiaMotion.easeOut,
          transitionBuilder: (child, anim) => SlideTransition(
            position: Tween<Offset>(
              begin: const Offset(0.05, 0),
              end: Offset.zero,
            ).animate(anim),
            child: FadeTransition(opacity: anim, child: child),
          ),
          child: KeyedSubtree(
            key: ValueKey(selected),
            child: contentFor(selected),
          ),
        ),
      ],
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 7 · Accordion Row — horizontal accordion: equal narrow strips, tap expands
//    one to reveal detail while the rest narrow; detail fades in.
//    AfriConnect: the discovery category rail.
// ─────────────────────────────────────────────────────────────────────────────

class AccordionStrip {
  const AccordionStrip({
    required this.title,
    required this.detail,
    this.color,
  });

  final String title;
  final Widget detail;
  final Color? color;
}

class AccordionRow extends StatefulWidget {
  const AccordionRow({
    super.key,
    required this.items,
    this.height = 210,
  });

  final List<AccordionStrip> items;
  final double height;

  @override
  State<AccordionRow> createState() => _AccordionRowState();
}

class _AccordionRowState extends State<AccordionRow> {
  int _active = 0;

  @override
  Widget build(BuildContext context) {
    final palette = context.palette;
    final reduce = NiaMotion.reduced(context);
    final dur = reduce ? Duration.zero : NiaMotion.base;

    return SizedBox(
      height: widget.height,
      child: Row(
        children: [
          for (var i = 0; i < widget.items.length; i++)
            Expanded(
              flex: i == _active ? 4 : 1,
              child: GestureDetector(
                onTap: () => setState(() => _active = i),
                child: AnimatedContainer(
                  duration: dur,
                  curve: NiaMotion.easeOut,
                  margin: const EdgeInsets.symmetric(horizontal: 3),
                  decoration: BoxDecoration(
                    color: i == _active
                        ? (widget.items[i].color ?? AppColors.clay)
                        : palette.surfaceRaised,
                    borderRadius: BorderRadius.circular(NiaRadius.md),
                    border: Border.all(color: palette.line),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Container(
                        padding: const EdgeInsets.all(12),
                        child: Text(
                          widget.items[i].title,
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                          style: inter(13, weight: FontWeight.w700,
                              color: i == _active
                                  ? Colors.white
                                  : palette.inkSoft),
                        ),
                      ),
                      if (i == _active)
                        Expanded(
                          child: AnimatedOpacity(
                            opacity: 1,
                            duration: NiaMotion.enter,
                            curve: NiaMotion.easeOut,
                            child: Padding(
                              padding:
                                  const EdgeInsets.fromLTRB(12, 0, 12, 12),
                              child: widget.items[i].detail,
                            ),
                          ),
                        ),
                    ],
                  ),
                ),
              ),
            ),
        ],
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 8 · Progress Fill — the component's background fill width *is* the progress;
//    ticking an item advances the fill; on completion the whole card brightens.
//    AfriConnect: the profile-completeness bar (the canonical fit).
// ─────────────────────────────────────────────────────────────────────────────

class ProgressFill extends StatefulWidget {
  const ProgressFill({
    super.key,
    required this.items,
    this.title = 'Profile completeness',
  });

  final List<String> items;
  final String title;

  @override
  State<ProgressFill> createState() => _ProgressFillState();
}

class _ProgressFillState extends State<ProgressFill> {
  final Set<int> _done = {};

  @override
  Widget build(BuildContext context) {
    final palette = context.palette;
    final reduce = NiaMotion.reduced(context);
    final dur = reduce ? Duration.zero : NiaMotion.base;
    final total = widget.items.length;
    final filled = _done.length;
    final ratio = total == 0 ? 0 : filled / total;
    final complete = total > 0 && filled == total;

    return AnimatedContainer(
      duration: dur,
      curve: NiaMotion.easeOut,
      decoration: BoxDecoration(
        color: complete ? palette.brandSoft : palette.surface,
        border: Border.all(
          color: complete ? palette.brandOn.withValues(alpha: 0.4) : palette.line,
        ),
        borderRadius: BorderRadius.circular(NiaRadius.md),
        boxShadow: complete ? niaShadowSoft(palette.ink) : null,
      ),
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(widget.title,
                  style: inter(15.5, weight: FontWeight.w700, color: palette.ink)),
              Text('$filled/$total',
                  style: niaLabel(12.5, weight: FontWeight.w700)
                      .copyWith(color: complete ? palette.brandOn : palette.muted)),
            ],
          ),
          const SizedBox(height: 10),
          LayoutBuilder(
            builder: (_, constraints) => Stack(
              children: [
                Container(
                  height: 10,
                  decoration: BoxDecoration(
                    color: palette.surfaceRaised,
                    borderRadius: BorderRadius.circular(NiaRadius.pill),
                  ),
                ),
                AnimatedContainer(
                  duration: dur,
                  curve: NiaMotion.easeOut,
                  width: constraints.maxWidth * ratio,
                  height: 10,
                  decoration: BoxDecoration(
                    color: complete ? palette.success : AppColors.clay,
                    borderRadius: BorderRadius.circular(NiaRadius.pill),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 14),
          for (var i = 0; i < widget.items.length; i++)
            _ProgressItem(
              label: widget.items[i],
              checked: _done.contains(i),
              onToggle: () => setState(() {
                if (_done.contains(i)) {
                  _done.remove(i);
                } else {
                  _done.add(i);
                }
              }),
            ),
        ],
      ),
    );
  }
}

class _ProgressItem extends StatelessWidget {
  const _ProgressItem({
    required this.label,
    required this.checked,
    required this.onToggle,
  });

  final String label;
  final bool checked;
  final VoidCallback onToggle;

  @override
  Widget build(BuildContext context) {
    final palette = context.palette;
    return ConstrainedBox(
      constraints: const BoxConstraints(minHeight: 44),
      child: InkWell(
        onTap: onToggle,
        borderRadius: BorderRadius.circular(NiaRadius.sm),
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: 6),
          child: Row(
            children: [
              AnimatedContainer(
                duration: const Duration(milliseconds: 150),
                width: 22,
                height: 22,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: checked ? AppColors.clay : Colors.transparent,
                  border: Border.all(
                    color: checked ? AppColors.clay : palette.lineStrong,
                    width: 1.5,
                  ),
                ),
                child: checked
                    ? Icon(Icons.check_rounded, size: 15, color: palette.onBrand)
                    : null,
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Text(label,
                    style: inter(14,
                        weight: checked ? FontWeight.w700 : FontWeight.w400,
                        color: checked ? palette.ink : palette.inkSoft)),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 9 · Card Tray — a deep-grey tray under the main component; default reveals one
//    row, tap expands the tray downward (main component stays put).
//    AfriConnect: the media-detail tray under a profile photo.
// ─────────────────────────────────────────────────────────────────────────────

class CardTray extends StatefulWidget {
  const CardTray({
    super.key,
    required this.main,
    required this.details,
    this.handleLabel = 'Details',
  });

  final Widget main;
  final List<Widget> details;
  final String handleLabel;

  @override
  State<CardTray> createState() => _CardTrayState();
}

class _CardTrayState extends State<CardTray> {
  bool _open = false;

  @override
  Widget build(BuildContext context) {
    final palette = context.palette;
    final reduce = NiaMotion.reduced(context);
    final dur = reduce ? Duration.zero : NiaMotion.base;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        widget.main,
        const SizedBox(height: 8),
        GestureDetector(
          onTap: () => setState(() => _open = !_open),
          behavior: HitTestBehavior.opaque,
          child: Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Text(widget.handleLabel,
                  style: niaLabel(11.5, weight: FontWeight.w600)
                      .copyWith(color: palette.muted)),
              const SizedBox(width: 4),
              AnimatedRotation(
                turns: _open ? 0.5 : 0,
                duration: dur,
                curve: NiaMotion.easeOut,
                child: Icon(Icons.keyboard_arrow_down_rounded,
                    size: 16, color: palette.muted),
              ),
            ],
          ),
        ),
        AnimatedSize(
          duration: dur,
          curve: NiaMotion.easeOut,
          alignment: Alignment.topCenter,
          child: _open
              ? Container(
                  margin: const EdgeInsets.only(top: 8),
                  padding: const EdgeInsets.all(14),
                  decoration: BoxDecoration(
                    color: AppColors.ink,
                    borderRadius: BorderRadius.circular(NiaRadius.md),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      for (var i = 0; i < widget.details.length; i++) ...[
                        if (i > 0)
                          Divider(
                              height: 14,
                              thickness: 1,
                              color: Colors.white.withValues(alpha: 0.12)),
                        widget.details[i],
                      ],
                    ],
                  ),
                )
              : const SizedBox.shrink(),
        ),
      ],
    );
  }
}

/// A single light-on-dark row inside a [CardTray].
class TrayRow extends StatelessWidget {
  const TrayRow({
    required this.label,
    required this.value,
    super.key,
  });

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) => Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(label, style: inter(13, color: Colors.white.withValues(alpha: 0.7))),
          Text(value,
              style: inter(13, weight: FontWeight.w700, color: Colors.white)),
        ],
      );
}

// ─────────────────────────────────────────────────────────────────────────────
// 10 · Pull Summary — collapsed = a one-line pill; pull down follows the finger
//     to expand into a full stats panel; content below shifts down and dims.
//     AfriConnect: the collapsible stats header on a profile.
// ─────────────────────────────────────────────────────────────────────────────

class PullSummary extends StatefulWidget {
  const PullSummary({
    super.key,
    required this.collapsedLabel,
    required this.expanded,
    this.child,
    this.collapsedHeight = 56,
    this.openHeight = 220,
  });

  final String collapsedLabel;
  final Widget expanded;
  final Widget? child;
  final double collapsedHeight;
  final double openHeight;

  @override
  State<PullSummary> createState() => _PullSummaryState();
}

class _PullSummaryState extends State<PullSummary>
    with SingleTickerProviderStateMixin {
  late final AnimationController _c;

  @override
  void initState() {
    super.initState();
    _c = AnimationController(vsync: this, value: 0)
      ..addListener(() => setState(() {}));
  }

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  void _animateTo(double target) {
    final reduce = NiaMotion.reduced(context);
    _c.animateTo(target,
        duration: reduce ? Duration.zero : const Duration(milliseconds: 300),
        curve: NiaMotion.easeOut);
  }

  @override
  Widget build(BuildContext context) {
    final palette = context.palette;
    final reduce = NiaMotion.reduced(context);
    final span = widget.openHeight - widget.collapsedHeight;
    final height = widget.collapsedHeight + span * _c.value;
    final dim = (widget.child != null) ? _c.value : 0.0;

    return Column(
      children: [
        GestureDetector(
          onVerticalDragUpdate: reduce
              ? null
              : (d) {
                  _c.stop();
                  _c.value = (_c.value - d.delta.dy / span).clamp(0, 1);
                },
          onVerticalDragEnd: reduce
              ? null
              : (d) {
                  final vel = d.velocity.pixelsPerSecond.dy;
                  _animateTo(vel < -300 || _c.value > 0.5 ? 1 : 0);
                },
          onTap: reduce
              ? () => _animateTo(_c.value < 0.5 ? 1 : 0)
              : null,
          child: Container(
            height: height,
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: palette.surface,
              border: Border.all(color: palette.line),
              borderRadius: BorderRadius.circular(NiaRadius.pill),
              boxShadow: niaShadowSoft(palette.ink),
            ),
            child: AnimatedSwitcher(
              duration: const Duration(milliseconds: 200),
              child: _c.value > 0.5
                  ? Align(
                      alignment: Alignment.topLeft,
                      child: widget.expanded,
                    )
                  : Row(
                      children: [
                        Container(
                          padding: const EdgeInsets.symmetric(
                              horizontal: 12, vertical: 6),
                          decoration: BoxDecoration(
                            color: palette.brandSoft,
                            borderRadius: BorderRadius.circular(NiaRadius.pill),
                          ),
                          child: Text(widget.collapsedLabel,
                              style: niaLabel(12.5, weight: FontWeight.w600)
                                  .copyWith(color: palette.brandOn)),
                        ),
                        const Spacer(),
                        Icon(Icons.keyboard_arrow_down_rounded,
                            color: palette.muted),
                      ],
                    ),
            ),
          ),
        ),
        if (widget.child != null)
          AnimatedContainer(
            duration: reduce ? Duration.zero : const Duration(milliseconds: 300),
            curve: NiaMotion.easeOut,
            transform:
                Matrix4.translationValues(0, _c.value * 8, 0),
            child: Opacity(
              opacity: 1 - dim * 0.6,
              child: widget.child,
            ),
          ),
      ],
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 11 · Fluid Morph — a capsule button morphs into a panel; size + radius use a
//     high-damping fluid curve for a seamless transition.
//     AfriConnect: the FAB → filter panel morph on Discover.
// ─────────────────────────────────────────────────────────────────────────────

class FluidMorph extends StatefulWidget {
  const FluidMorph({
    super.key,
    required this.closedLabel,
    required this.openChild,
    this.openWidth = 300,
    this.openHeight = 240,
  });

  final String closedLabel;
  final Widget openChild;
  final double openWidth;
  final double openHeight;

  @override
  State<FluidMorph> createState() => _FluidMorphState();
}

class _FluidMorphState extends State<FluidMorph>
    with SingleTickerProviderStateMixin {
  late final AnimationController _c;
  late final Animation<double> _t;
  bool _open = false;

  @override
  void initState() {
    super.initState();
    _c = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 520),
    );
    _t = CurvedAnimation(parent: _c, curve: Curves.easeInOutCubic);
  }

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  void _toggle() {
    if (NiaMotion.reduced(context)) {
      setState(() => _open = !_open);
      return;
    }
    if (_open) {
      _c.reverse();
    } else {
      _c.forward();
    }
    setState(() => _open = !_open);
  }

  @override
  Widget build(BuildContext context) {
    final palette = context.palette;
    const closedW = 168.0;
    const closedH = 56.0;
    const closedR = NiaRadius.pill;

    return GestureDetector(
      onTap: _toggle,
      child: AnimatedBuilder(
        animation: _t,
        builder: (_, __) {
          final w = ui.lerpDouble(closedW, widget.openWidth, _t.value)!;
          final h = ui.lerpDouble(closedH, widget.openHeight, _t.value)!;
          final r = ui.lerpDouble(closedR, NiaRadius.lg, _t.value)!;
          return Container(
            width: w,
            height: h,
            decoration: BoxDecoration(
              color: AppColors.clay,
              borderRadius: BorderRadius.circular(r),
              boxShadow: niaShadowBubble(palette.ink),
            ),
            child: Stack(
              children: [
                Opacity(
                  opacity: 1 - _t.value,
                  child: Center(
                    child: Text(widget.closedLabel,
                        style: inter(14.5, weight: FontWeight.w700,
                            color: palette.onBrand)),
                  ),
                ),
                Opacity(
                  opacity: _t.value,
                  child: Padding(
                    padding: const EdgeInsets.all(16),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            Text('Filters',
                                style: inter(16, weight: FontWeight.w700,
                                    color: palette.onBrand)),
                            Icon(Icons.close_rounded,
                                color: palette.onBrand, size: 18),
                          ],
                        ),
                        const SizedBox(height: 10),
                        Expanded(child: widget.openChild),
                      ],
                    ),
                  ),
                ),
              ],
            ),
          );
        },
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 12 · Shared Element — card → detail page hero transition. Flutter's [Hero]
//     gives the continuous scale/background tween for free.
//     AfriConnect: photo card → full photo detail.
// ─────────────────────────────────────────────────────────────────────────────

class SharedElementGrid extends StatelessWidget {
  const SharedElementGrid({
    super.key,
    required this.items,
    this.crossAxisCount = 2,
  });

  /// Each item: (tag, gradient pair, caption).
  final List<SharedPhoto> items;
  final int crossAxisCount;

  @override
  Widget build(BuildContext context) {
    return GridView.count(
      crossAxisCount: crossAxisCount,
      mainAxisSpacing: 12,
      crossAxisSpacing: 12,
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      children: [
        for (final item in items)
          GestureDetector(
            onTap: () => Navigator.of(context).push(
              MaterialPageRoute(
                builder: (_) => _SharedDetail(item: item),
              ),
            ),
            child: Hero(
              tag: item.tag,
              child: Container(
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(NiaRadius.md),
                  gradient: LinearGradient(
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                    colors: item.colors,
                  ),
                ),
                child: Align(
                  alignment: Alignment.bottomLeft,
                  child: Padding(
                    padding: const EdgeInsets.all(12),
                    child: Text(item.caption,
                        style: inter(13, weight: FontWeight.w700,
                            color: Colors.white)),
                  ),
                ),
              ),
            ),
          ),
      ],
    );
  }
}

class SharedPhoto {
  const SharedPhoto(this.tag, this.colors, this.caption);
  final String tag;
  final List<Color> colors;
  final String caption;
}

class _SharedDetail extends StatelessWidget {
  const _SharedDetail({required this.item});
  final SharedPhoto item;

  @override
  Widget build(BuildContext context) => Scaffold(
        backgroundColor: Colors.black,
        appBar: AppBar(
          backgroundColor: Colors.black,
          foregroundColor: Colors.white,
          leading: IconButton(
            icon: const Icon(Icons.arrow_back_rounded),
            onPressed: () => Navigator.of(context).pop(),
          ),
        ),
        body: Center(
          child: Hero(
            tag: item.tag,
            child: Container(
              width: double.infinity,
              height: 420,
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(NiaRadius.md),
                gradient: LinearGradient(
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                  colors: item.colors,
                ),
              ),
              child: Align(
                alignment: Alignment.bottomLeft,
                child: Padding(
                  padding: const EdgeInsets.all(20),
                  child: Text(item.caption,
                      style: editorial(28, weight: FontWeight.w700)
                          .copyWith(color: Colors.white)),
                ),
              ),
            ),
          ),
        ),
      );
}

// ─────────────────────────────────────────────────────────────────────────────
// 13 · Damped Bottom Sheet — rubber-band rebound; release snaps to an anchor
//     computed from gesture velocity.
//     AfriConnect: the filter / vetting sheet.
// ─────────────────────────────────────────────────────────────────────────────

class DampedBottomSheet extends StatefulWidget {
  const DampedBottomSheet({
    super.key,
    required this.child,
    this.snaps = const [0.15, 0.6, 0.92],
    this.handleLabel,
  });

  final Widget child;
  final List<double> snaps;
  final String? handleLabel;

  @override
  State<DampedBottomSheet> createState() => _DampedBottomSheetState();
}

class _DampedBottomSheetState extends State<DampedBottomSheet>
    with SingleTickerProviderStateMixin {
  late final AnimationController _c;
  int _snapIndex = 0;

  @override
  void initState() {
    super.initState();
    _c = AnimationController(vsync: this, value: widget.snaps.first)
      ..addListener(() => setState(() {}));
  }

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  void _snapTo(double frac) {
    final reduce = NiaMotion.reduced(context);
    _c.animateTo(frac,
        duration: reduce ? Duration.zero : const Duration(milliseconds: 420),
        curve: NiaMotion.easeOut);
  }

  void _cycle() {
    _snapIndex = (_snapIndex + 1) % widget.snaps.length;
    _snapTo(widget.snaps[_snapIndex]);
  }

  @override
  Widget build(BuildContext context) {
    final palette = context.palette;
    final reduce = NiaMotion.reduced(context);
    final maxH = MediaQuery.of(context).size.height;

    return GestureDetector(
      onVerticalDragUpdate: reduce
          ? null
          : (d) {
              _c.stop();
              var next = _c.value - d.delta.dy / maxH;
              // Rubber-band: damp movement beyond the first/last snap.
              if (next < widget.snaps.first) {
                next = widget.snaps.first -
                    (widget.snaps.first - next) * 0.3;
              }
              if (next > widget.snaps.last) {
                next = widget.snaps.last +
                    (next - widget.snaps.last) * 0.3;
              }
              _c.value = next.clamp(0, 1);
            },
      onVerticalDragEnd: reduce
          ? null
          : (d) {
              final vel = -d.velocity.pixelsPerSecond.dy / maxH;
              final projected =
                  (_c.value + vel * 0.3).clamp(widget.snaps.first, widget.snaps.last);
              double best = widget.snaps.first;
              var bestD = double.infinity;
              for (final s in widget.snaps) {
                final dd = (s - projected).abs();
                if (dd < bestD) {
                  bestD = dd;
                  best = s;
                }
              }
              _snapTo(best);
            },
      onTap: reduce ? _cycle : null,
      child: Container(
        height: maxH * _c.value,
        decoration: BoxDecoration(
          color: palette.surface,
          borderRadius: const BorderRadius.vertical(
            top: Radius.circular(NiaRadius.xl),
          ),
          boxShadow: niaShadowSheet(),
        ),
        child: Column(
          children: [
            const SizedBox(height: 10),
            Container(
              width: 40,
              height: 4,
              decoration: BoxDecoration(
                color: palette.lineStrong,
                borderRadius: BorderRadius.circular(NiaRadius.pill),
              ),
            ),
            if (widget.handleLabel != null)
              Padding(
                padding: const EdgeInsets.only(top: 8),
                child: Text(widget.handleLabel!,
                    style: niaLabel(12.5, weight: FontWeight.w600)
                        .copyWith(color: palette.muted)),
              ),
            const SizedBox(height: 12),
            Expanded(
              child: SingleChildScrollView(child: widget.child),
            ),
          ],
        ),
      ),
    );
  }
}
