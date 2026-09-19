import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../../../core/theme/app_theme.dart';
import '../../../core/widgets/nia_kit.dart';

/// The mutual-match moment.
///
/// Redesigned against `DESIGN_INSPIRATIONS.md` (ref 3): this is one of only
/// three or four full-screen *moments* in the product, so it no longer borrows
/// the ordinary dialog chrome. It now owns a deep canvas with a single radial
/// glow, an ambient breathing heart with a slow orbit, and a **sequenced**
/// reveal — the object settles first, then the words, then the actions.
///
/// Sequencing matters here specifically because this screen interrupts a swipe:
/// the perceived quality of the interruption depends on it feeling deliberate
/// rather than popping in.
class MatchCelebration extends StatefulWidget {
  const MatchCelebration({
    super.key,
    required this.userId,
    required this.onClose,
    required this.onMessage,
  });

  final String userId;
  final VoidCallback onClose;
  final Future<void> Function(String) onMessage;

  @override
  State<MatchCelebration> createState() => _MatchCelebrationState();
}

class _MatchCelebrationState extends State<MatchCelebration>
    with TickerProviderStateMixin {
  late final AnimationController _entrance;
  late final AnimationController _ambient;
  bool _busy = false;

  @override
  void initState() {
    super.initState();
    _entrance = AnimationController(
      duration: const Duration(milliseconds: 900),
      vsync: this,
    );
    _ambient = AnimationController(
      duration: NiaMotion.ambient,
      vsync: this,
    );
    _entrance.forward();
    _ambient.repeat();
  }

  @override
  void dispose() {
    _entrance.dispose();
    _ambient.dispose();
    super.dispose();
  }

  Future<void> _handleMessage() async {
    if (_busy) return;
    setState(() => _busy = true);
    try {
      await widget.onMessage(widget.userId);
      if (mounted) widget.onClose();
    } catch (_) {
      if (mounted) setState(() => _busy = false);
    }
  }

  /// Each element is revealed in turn by giving it a slice of the single
  /// entrance controller, so the motion reads as one gesture rather than four
  /// independent animations.
  Widget _staged({
    required double start,
    required double end,
    required Widget child,
  }) {
    final curved = CurvedAnimation(
      parent: _entrance,
      curve: Interval(start, end, curve: Curves.easeOutCubic),
    );
    return AnimatedBuilder(
      animation: curved,
      builder: (_, __) => Opacity(
        opacity: curved.value.clamp(0.0, 1.0),
        child: Transform.translate(
          offset: Offset(0, 18 * (1 - curved.value)),
          child: child,
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final reduceMotion = NiaMotion.reduced(context);

    return PopScope(
      canPop: false,
      onPopInvokedWithResult: (didPop, _) {
        if (!didPop) widget.onClose();
      },
      child: DeepCanvas(
        glow: AppColors.clay,
        intensity: 0.34,
        child: SafeArea(
          child: Center(
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                _staged(
                  start: 0.0,
                  end: 0.55,
                  child:
                      _OrbitingHeart(ambient: _ambient, animate: !reduceMotion),
                ),
                const SizedBox(height: 44),
                _staged(
                  start: 0.35,
                  end: 0.8,
                  child: Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 32),
                    child: Text(
                      "It's a match.",
                      // A hard break would be artificial here; this is one short
                      // sentence, so it stays on a single line at display size.
                      style: editorial(38, weight: FontWeight.w700)
                          .copyWith(color: Colors.white),
                      textAlign: TextAlign.center,
                    ),
                  ),
                ),
                const SizedBox(height: 14),
                _staged(
                  start: 0.45,
                  end: 0.9,
                  child: Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 44),
                    child: Text(
                      'You both took the trouble to stop on each other. '
                      'Say hello while it still feels alive.',
                      style: inter(15,
                          weight: FontWeight.w400,
                          color: Colors.white.withValues(alpha: 0.72),
                          height: 1.5),
                      textAlign: TextAlign.center,
                    ),
                  ),
                ),
                const SizedBox(height: 48),
                _staged(
                  start: 0.6,
                  end: 1.0,
                  child: Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 32),
                    child: Column(
                      children: [
                        PillCta(
                          label: _busy ? 'Opening chat…' : 'Send a message',
                          icon:
                              _busy ? null : Icons.chat_bubble_outline_rounded,
                          style: PillCtaStyle.light,
                          expand: true,
                          busy: _busy,
                          onPressed: _busy ? null : _handleMessage,
                        ),
                        const SizedBox(height: 12),
                        GhostButton(
                          label: 'Keep swiping',
                          onDark: true,
                          expand: true,
                          onPressed: widget.onClose,
                        ),
                      ],
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

/// The hero object: a heart resting on a slowly breathing glow, ringed by an
/// orbit line with two sparkles travelling it.
///
/// This is intentionally a single-purpose private widget rather than something
/// promoted into the kit — its whole job is this one screen.
class _OrbitingHeart extends StatelessWidget {
  const _OrbitingHeart({required this.ambient, required this.animate});

  final AnimationController ambient;
  final bool animate;

  @override
  Widget build(BuildContext context) {
    // Reduced motion: render the resting state, no loop.
    if (!animate) return const _HeartMark(size: 132);

    return AnimatedBuilder(
      animation: ambient,
      builder: (context, _) {
        final t = ambient.value;
        // Breathing is deliberately slow and small: scale 1.0 → 1.035. Anything
        // faster reads as anxious rather than premium.
        final breathe = 1.0 + math.sin(t * math.pi * 2) * 0.035;
        return Transform.scale(
          scale: breathe,
          child: Stack(
            alignment: Alignment.center,
            children: [
              _HeartMark(size: 132),
              // Orbiting sparkles.
              Transform.rotate(
                angle: t * math.pi * 2,
                child: const SizedBox(
                  width: 190,
                  height: 190,
                  child: Stack(
                    children: [
                      Align(
                        alignment: Alignment.topCenter,
                        child: _Sparkle(size: 7, alpha: 0.95),
                      ),
                      Align(
                        alignment: Alignment.bottomCenter,
                        child: _Sparkle(size: 5, alpha: 0.6),
                      ),
                    ],
                  ),
                ),
              ),
            ],
          ),
        );
      },
    );
  }
}

class _HeartMark extends StatelessWidget {
  const _HeartMark({required this.size});
  final double size;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: size,
      height: size,
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        // Layered translucent rings rather than shadows — the reference builds
        // glow from overlapping circles, not from blur.
        gradient: RadialGradient(
          colors: [
            AppColors.clay.withValues(alpha: 0.55),
            AppColors.clay.withValues(alpha: 0.16),
            AppColors.clay.withValues(alpha: 0.0),
          ],
          stops: const [0.0, 0.62, 1.0],
        ),
      ),
      child: Center(
        child: Container(
          width: size * 0.52,
          height: size * 0.52,
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            border: Border.all(color: Colors.white.withValues(alpha: 0.34)),
            gradient: LinearGradient(
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
              colors: [
                AppColors.clay,
                AppColors.clayDark,
              ],
            ),
          ),
          child: Icon(
            Icons.favorite_rounded,
            size: size * 0.28,
            color: Colors.white.withValues(alpha: 0.94),
          ),
        ),
      ),
    );
  }
}

class _Sparkle extends StatelessWidget {
  const _Sparkle({required this.size, required this.alpha});
  final double size;
  final double alpha;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: size,
      height: size,
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        color: Colors.white.withValues(alpha: alpha),
        boxShadow: [
          BoxShadow(
            color: Colors.white.withValues(alpha: alpha * 0.6),
            blurRadius: 8,
          ),
        ],
      ),
    );
  }
}
