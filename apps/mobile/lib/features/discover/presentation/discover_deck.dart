import 'package:flutter/material.dart';

import '../../../core/theme/app_theme.dart';
import '../../../core/widgets/app_widgets.dart';
import '../../../core/widgets/nia_kit.dart';
import '../data/discover_card.dart';

/// The swipeable introduction deck.
///
/// Redesigned against `DESIGN_INSPIRATIONS.md`: the card is now a full-bleed
/// media card with a **wine-tinted scrim** (ref 4), the metadata lives *on* the
/// photograph as small translucent badges, and the three actions are large,
/// unlabelled, physical bubbles with a clear hierarchy (refs 4 + 5) instead of
/// three identical outlined buttons.
class DiscoverDeck extends StatefulWidget {
  const DiscoverDeck({
    super.key,
    required this.cards,
    required this.onAction,
    required this.onCardTap,
    required this.onReload,
  });

  final List<DiscoverCard> cards;
  final Future<void> Function(DiscoverCard, String) onAction;
  final VoidCallback onReload;
  final void Function(DiscoverCard) onCardTap;

  @override
  State<DiscoverDeck> createState() => _DiscoverDeckState();
}

class _DiscoverDeckState extends State<DiscoverDeck>
    with SingleTickerProviderStateMixin {
  int _current = 0;
  double _dragX = 0;
  bool _acting = false;
  late final AnimationController _animController;

  @override
  void initState() {
    super.initState();
    _animController = AnimationController(
      duration: NiaMotion.base,
      vsync: this,
    );
  }

  @override
  void dispose() {
    _animController.dispose();
    super.dispose();
  }

  DiscoverCard get _currentCard => widget.cards[_current];

  Future<void> _settle(String action) async {
    if (_acting || widget.cards.isEmpty) return;
    setState(() => _acting = true);
    final card = _currentCard;
    try {
      await widget.onAction(card, action);
      if (mounted) {
        setState(() {
          _current = (_current + 1) % widget.cards.length;
          _dragX = 0;
        });
      }
    } catch (_) {
      // Error handled in onAction
    } finally {
      if (mounted) setState(() => _acting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    if (widget.cards.isEmpty) {
      return SurfaceCard(
        padding: const EdgeInsets.all(24),
        child: Column(
          children: [
            Text('No introductions are waiting right now.',
                textAlign: TextAlign.center,
                style: inter(15, color: context.palette.muted, height: 1.45)),
            const SizedBox(height: 18),
            PillCta(
              label: 'Refresh deck',
              icon: Icons.refresh_rounded,
              onPressed: widget.onReload,
            ),
          ],
        ),
      );
    }

    final card = _currentCard;
    final rotate = _dragX / 18;
    final likeHint = _dragX > 60;
    final passHint = _dragX < -60;

    return Column(
      children: [
        SizedBox(
          // The photograph owns the screen, but the height follows the viewport
          // instead of a fixed 470px — that pushed the actions below the fold on
          // small phones. 60% of the view, clamped so it never cramps an SE-class
          // phone nor dwarfs the actions on a tablet.
          height: (MediaQuery.sizeOf(context).height * 0.6).clamp(360.0, 500.0),
          child: Stack(
            children: [
              if (widget.cards.length > 1)
                Positioned.fill(
                  child: _DeckCard(
                    card: widget.cards[(_current + 1) % widget.cards.length],
                    behind: true,
                  ),
                ),
              AnimatedPositioned(
                duration: _acting ? Duration.zero : NiaMotion.base,
                left: _dragX,
                right: -_dragX,
                top: 0,
                bottom: 0,
                child: Transform.rotate(
                  angle: rotate * 3.14159 / 180,
                  child: SwipeDetector(
                    gesture: SwipeGesture(
                      onSwipeLeft: () => _settle('pass'),
                      onSwipeRight: () => _settle('like'),
                      onTap: () => widget.onCardTap(card),
                      disabled: _acting,
                    ),
                    child: _DeckCard(card: card),
                  ),
                ),
              ),
              if (likeHint && !_acting)
                const Positioned(
                  top: 44,
                  left: 28,
                  child: _Stamp(
                      text: 'LIKE', color: AppColors.success, rotation: -0.25),
                ),
              if (passHint && !_acting)
                const Positioned(
                  top: 44,
                  right: 28,
                  child: _Stamp(
                      text: 'PASS', color: AppColors.clay, rotation: 0.25),
                ),
            ],
          ),
        ),
        const SizedBox(height: 20),
        _ActionRow(
          busy: _acting,
          onPass: () => _settle('pass'),
          onSuperlike: () => _settle('superlike'),
          onLike: () => _settle('like'),
        ),
        if (card.photos.length > 1) ...[
          const SizedBox(height: 18),
          _PhotoDots(count: card.photos.length),
        ],
      ],
    );
  }
}

/// Three actions, one hierarchy: the affirmative action is largest and carries
/// the only gradient; the scarce action is gold and slightly smaller; the
/// reactive action is a quiet neutral surface. No text labels — the icon and
/// the physicality of the bubble carry the meaning.
class _ActionRow extends StatelessWidget {
  const _ActionRow({
    required this.busy,
    required this.onPass,
    required this.onSuperlike,
    required this.onLike,
  });

  final bool busy;
  final VoidCallback onPass;
  final VoidCallback onSuperlike;
  final VoidCallback onLike;

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.center,
      crossAxisAlignment: CrossAxisAlignment.center,
      children: [
        ActionBubble(
          icon: Icons.close_rounded,
          tone: ActionTone.neutral,
          size: 58,
          semanticLabel: 'Pass',
          onTap: busy ? null : onPass,
        ),
        const SizedBox(width: 20),
        ActionBubble(
          icon: Icons.star_rounded,
          tone: ActionTone.gold,
          size: 52,
          semanticLabel: 'Superlike',
          busy: busy,
          onTap: busy ? null : onSuperlike,
        ),
        const SizedBox(width: 20),
        ActionBubble(
          icon: Icons.favorite_rounded,
          tone: ActionTone.brand,
          size: 68,
          semanticLabel: 'Like',
          onTap: busy ? null : onLike,
        ),
      ],
    );
  }
}

class _PhotoDots extends StatelessWidget {
  const _PhotoDots({required this.count});
  final int count;

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.center,
      children: List.generate(count, (i) {
        return AnimatedContainer(
          duration: NiaMotion.base,
          curve: NiaMotion.easeOut,
          margin: const EdgeInsets.symmetric(horizontal: 3),
          width: i == 0 ? 22 : 7,
          height: 7,
          decoration: BoxDecoration(
            color: i == 0 ? AppColors.clay : context.palette.lineStrong,
            borderRadius: BorderRadius.circular(NiaRadius.pill),
          ),
        );
      }),
    );
  }
}

class _Stamp extends StatelessWidget {
  const _Stamp(
      {required this.text, required this.color, required this.rotation});
  final String text;
  final Color color;
  final double rotation;

  @override
  Widget build(BuildContext context) {
    return Transform.rotate(
      angle: rotation,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
        decoration: BoxDecoration(
          border: Border.all(color: color, width: 3),
          borderRadius: BorderRadius.circular(NiaRadius.sm),
        ),
        child: Text(
          text,
          style: inter(20, weight: FontWeight.w800, color: color)
              .copyWith(letterSpacing: 0.6),
        ),
      ),
    );
  }
}

/// A single introduction, rendered as a full-bleed media card.
///
/// Content order follows the reference: badges on the photo, then the name with
/// the age set lighter inline, then exactly one supporting line, then trust. A
/// second supporting line is what makes these cards feel busy.
class _DeckCard extends StatelessWidget {
  const _DeckCard({required this.card, this.behind = false});
  final DiscoverCard card;
  final bool behind;

  String? get _distanceLabel {
    final km = card.distanceKm;
    if (km == null) return null;
    if (km < 1) return 'Under 1 km';
    if (km < 10) return '${km.toStringAsFixed(1)} km';
    return '${km.round()} km';
  }

  String? get _supportingLine {
    final headline = card.headline?.trim();
    final city = card.city.trim();
    final profession = card.profession?.trim();

    final parts = <String>[
      if (headline != null && headline.isNotEmpty) headline,
      if ((headline == null || headline.isEmpty) &&
          profession != null &&
          profession.isNotEmpty)
        profession,
      if (city.isNotEmpty) city,
    ];
    return parts.isEmpty ? null : parts.join(' · ');
  }

  @override
  Widget build(BuildContext context) {
    final distance = _distanceLabel;
    final supporting = _supportingLine;
    final interests = card.sharedInterests.take(2).toList();

    final content = Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisSize: MainAxisSize.min,
      children: [
        // Name, with the age inline and lighter — the reference's treatment.
        Text.rich(
          TextSpan(children: [
            TextSpan(
              text: card.displayName,
              style: editorial(33, weight: FontWeight.w700)
                  .copyWith(color: Colors.white, height: 1.05),
            ),
            if (card.age > 0)
              TextSpan(
                text: '  ${card.age}',
                style: editorial(26, weight: FontWeight.w400)
                    .copyWith(color: Colors.white.withValues(alpha: 0.78)),
              ),
          ]),
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
        ),
        if (supporting != null) ...[
          const SizedBox(height: 6),
          Text(
            supporting,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: inter(13.5,
                weight: FontWeight.w500,
                color: Colors.white.withValues(alpha: 0.82),
                height: 1.3),
          ),
        ],
        const SizedBox(height: 12),
        Row(
          children: [
            TrustRow(
              primary: card.verified ? 'ID verified' : 'Vetted member',
              secondary: card.score == null ? null : '${card.score}% match',
            ),
            if (interests.isNotEmpty) ...[
              const SizedBox(width: 8),
              Expanded(
                child: Wrap(
                  spacing: 6,
                  alignment: WrapAlignment.end,
                  children: [
                    for (final interest in interests)
                      _InterestChip(label: interest),
                  ],
                ),
              ),
            ],
          ],
        ),
      ],
    );

    final media = MediaCard(
      imageUrl: card.photos.isNotEmpty ? card.photos.first : null,
      fallback: const _GradientBackground(),
      brandScrim: true,
      radius: NiaRadius.xl,
      scrimStart: 0.34,
      elevated: !behind,
      padding: const EdgeInsets.fromLTRB(20, 20, 20, 22),
      topLeft: [
        if (distance != null)
          MediaBadge(label: distance, icon: Icons.near_me_rounded),
      ],
      topRight: [
        if (card.isPremium)
          MediaBadge(label: 'Premium', icon: Icons.workspace_premium_rounded),
      ],
      content: content,
    );

    if (!behind) return media;

    // The waiting card sits behind and below, dimmed and slightly smaller, so
    // the stack reads as depth rather than as two equal panels.
    return Transform.scale(
      scale: 0.955,
      alignment: Alignment.topCenter,
      child: Opacity(opacity: 0.55, child: media),
    );
  }
}

/// A translucent chip for interests, sitting on the photograph. Deliberately
/// low-contrast: it is supporting detail, not a control.
class _InterestChip extends StatelessWidget {
  const _InterestChip({required this.label});
  final String label;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 4),
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: 0.16),
        borderRadius: BorderRadius.circular(NiaRadius.pill),
        border: Border.all(color: Colors.white.withValues(alpha: 0.26)),
      ),
      child: Text(label,
          style: inter(11,
              weight: FontWeight.w600, color: Colors.white, height: 1.2)),
    );
  }
}

/// Fallback artwork for a member with no photo — an illustrated portrait
/// silhouette rather than a grey box, so the card still looks intentional.
class _GradientBackground extends StatelessWidget {
  const _GradientBackground();

  @override
  Widget build(BuildContext context) {
    return CustomPaint(
      painter: _PortraitPainter(),
      size: Size.infinite,
    );
  }
}

class _PortraitPainter extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..shader = const LinearGradient(
        colors: [Color(0xFFB78368), Color(0xFF5B263B)],
      ).createShader(Offset.zero & size);
    canvas.drawRect(Offset.zero & size, paint);
    final head = Paint()..color = const Color(0xFFB96548);
    canvas.drawCircle(
        Offset(size.width * .54, size.height * .34), size.width * .18, head);
    canvas.drawOval(
        Rect.fromCenter(
            center: Offset(size.width * .54, size.height * .82),
            width: size.width * .65,
            height: size.height * .6),
        head);
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}
