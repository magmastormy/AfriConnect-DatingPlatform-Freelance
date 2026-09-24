import 'package:flutter/material.dart';

import '../../../core/theme/app_theme.dart';
import '../../../core/widgets/app_widgets.dart';
import '../../../core/widgets/nia_kit.dart';
import '../data/discover_card.dart';

/// The swipeable introduction deck.
///
/// Redesigned around the 她说 (Tantan-style) profile model: instead of tapping
/// through to a separate profile sheet, **the card opens in place**. Collapsed,
/// it is a full-bleed photograph with the member's name on the scrim. Expanded,
/// it holds their *whole* profile — every photo, the bio, the interests they
/// share with you, and the practical details — inside the same viewport, read by
/// scrolling vertically. The three actions sit **right-aligned** beneath the
/// card, and the horizontal swipe to pass / like keeps working in both states.
class DiscoverDeck extends StatefulWidget {
  const DiscoverDeck({
    super.key,
    required this.cards,
    required this.onAction,
    required this.onReload,
  });

  final List<DiscoverCard> cards;
  final Future<void> Function(DiscoverCard, String) onAction;
  final VoidCallback onReload;

  @override
  State<DiscoverDeck> createState() => _DiscoverDeckState();
}

class _DiscoverDeckState extends State<DiscoverDeck>
    with SingleTickerProviderStateMixin {
  int _current = 0;
  double _dragX = 0;
  bool _acting = false;
  bool _expanded = false;
  late final AnimationController _animController;
  final ScrollController _profileScroll = ScrollController();

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
    _profileScroll.dispose();
    super.dispose();
  }

  DiscoverCard get _currentCard => widget.cards[_current];

  void _expand() {
    if (_expanded) return;
    setState(() => _expanded = true);
  }

  void _collapse() {
    if (!_expanded) return;
    setState(() => _expanded = false);
    if (_profileScroll.hasClients) _profileScroll.jumpTo(0);
  }

  void _toggleExpanded() => _expanded ? _collapse() : _expand();

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
          _expanded = false;
        });
        if (_profileScroll.hasClients) _profileScroll.jumpTo(0);
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
    final viewport =
        (MediaQuery.sizeOf(context).height * 0.62).clamp(380.0, 560.0);

    return Column(
      children: [
        SizedBox(
          height: viewport,
          child: Stack(
            children: [
              // The next card peeks behind, but only while this one is collapsed.
              if (widget.cards.length > 1 && !_expanded)
                Positioned.fill(
                  child: _ProfileCard(
                    card: widget.cards[(_current + 1) % widget.cards.length],
                    behind: true,
                    expanded: false,
                    heroHeight: viewport,
                    scrollController: null,
                    onToggle: () {},
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
                      // A tap only *expands*; collapse is via the chip so reading
                      // the profile never collapses it by accident.
                      onSwipeLeft: () => _settle('pass'),
                      onSwipeRight: () => _settle('like'),
                      onTap: _expanded ? null : _expand,
                      disabled: _acting,
                    ),
                    child: _ProfileCard(
                      card: card,
                      expanded: _expanded,
                      heroHeight: viewport * 0.8,
                      scrollController: _profileScroll,
                      onToggle: _toggleExpanded,
                    ),
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
        const SizedBox(height: 18),
        _ActionRow(
          busy: _acting,
          onPass: () => _settle('pass'),
          onSuperlike: () => _settle('superlike'),
          onLike: () => _settle('like'),
        ),
      ],
    );
  }
}

/// The card shell: a rounded, softly-elevated container that clips its contents
/// and floats the expand / collapse chip.
class _ProfileCard extends StatelessWidget {
  const _ProfileCard({
    required this.card,
    required this.expanded,
    required this.heroHeight,
    required this.scrollController,
    this.behind = false,
    this.onToggle = _noop,
  });

  final DiscoverCard card;
  final bool expanded;
  final double heroHeight;
  final ScrollController? scrollController;
  final bool behind;
  final VoidCallback onToggle;

  static void _noop() {}

  @override
  Widget build(BuildContext context) {
    final palette = context.palette;
    final inner = DecoratedBox(
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(NiaRadius.xl),
        color: palette.surface,
        boxShadow: behind ? null : niaShadowMedia(),
      ),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(NiaRadius.xl),
        child: Stack(
          fit: StackFit.expand,
          children: [
            expanded
                ? _ExpandedProfile(
                    card: card,
                    heroHeight: heroHeight,
                    controller: scrollController,
                  )
                : _CollapsedProfile(card: card),
            if (!behind)
              Positioned(
                top: 12,
                right: 12,
                child: _ExpandChip(expanded: expanded, onTap: onToggle),
              ),
          ],
        ),
      ),
    );

    if (behind) {
      return Transform.scale(
        scale: 0.955,
        alignment: Alignment.topCenter,
        child: Opacity(opacity: 0.55, child: inner),
      );
    }
    return inner;
  }
}

/// Collapsed: the full-bleed photograph with the member's identity on the
/// scrim, plus an honest hint that there is a fuller profile to read.
class _CollapsedProfile extends StatelessWidget {
  const _CollapsedProfile({required this.card});
  final DiscoverCard card;

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
    final interests = card.sharedInterests.take(3).toList();

    final content = Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisSize: MainAxisSize.min,
      children: [
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
        const SizedBox(height: 14),
        Row(
          children: [
            Icon(Icons.unfold_more_rounded,
                size: 15, color: Colors.white.withValues(alpha: 0.85)),
            const SizedBox(width: 6),
            Text('See full profile',
                style: inter(12.5,
                    weight: FontWeight.w600,
                    color: Colors.white.withValues(alpha: 0.85))),
          ],
        ),
      ],
    );

    final topLeft = <Widget>[
      if (distance != null)
        MediaBadge(label: distance, icon: Icons.near_me_rounded),
      if (card.photos.length > 1)
        MediaBadge(
          label: '${card.photos.length} photos',
          icon: Icons.photo_library_outlined,
        ),
    ];

    return MediaCard(
      imageUrl: card.photos.isNotEmpty ? card.photos.first : null,
      fallback: const _PortraitFallback(),
      brandScrim: true,
      radius: NiaRadius.xl,
      elevated: false,
      scrimStart: 0.34,
      padding: const EdgeInsets.fromLTRB(20, 20, 20, 22),
      topLeft: topLeft,
      topRight: [
        if (card.isPremium)
          MediaBadge(label: 'Premium', icon: Icons.workspace_premium_rounded),
      ],
      content: content,
    );
  }
}

/// Expanded: a scrollable profile that lives inside the same card window. The
/// member's whole story — photos, bio, shared interests, details — is reachable
/// by scrolling down, 她说-style. Swipe still passes / likes in this state.
class _ExpandedProfile extends StatelessWidget {
  const _ExpandedProfile({
    required this.card,
    required this.heroHeight,
    required this.controller,
  });

  final DiscoverCard card;
  final double heroHeight;
  final ScrollController? controller;

  String? get _distanceLabel {
    final km = card.distanceKm;
    if (km == null) return null;
    if (km < 1) return 'Under 1 km';
    if (km < 10) return '${km.toStringAsFixed(1)} km';
    return '${km.round()} km';
  }

  @override
  Widget build(BuildContext context) {
    final palette = context.palette;
    final distance = _distanceLabel;
    final heroContent = _HeroIdentity(card: card);
    final rest = card.photos.skip(1).toList();

    return Container(
      color: palette.surface,
      child: SingleChildScrollView(
        controller: controller,
        physics: const BouncingScrollPhysics(),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Hero photograph — name sits on the scrim, exactly as collapsed.
            MediaCard(
              imageUrl: card.photos.isNotEmpty ? card.photos.first : null,
              fallback: const _PortraitFallback(),
              brandScrim: true,
              radius: 0,
              elevated: false,
              scrimStart: 0.34,
              height: heroHeight,
              padding: const EdgeInsets.fromLTRB(20, 20, 20, 22),
              topLeft: [
                if (distance != null)
                  MediaBadge(label: distance, icon: Icons.near_me_rounded),
              ],
              content: heroContent,
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 18, 20, 24),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  if (card.isPremium || card.verified)
                    Padding(
                      padding: const EdgeInsets.only(bottom: 14),
                      child: Wrap(
                        spacing: 8,
                        runSpacing: 8,
                        children: [
                          if (card.verified)
                            StatusPill('Verified', tone: PillTone.good),
                          if (card.isPremium)
                            StatusPill('Premium', tone: PillTone.brand),
                        ],
                      ),
                    ),
                  if (card.headline != null && card.headline!.trim().isNotEmpty)
                    Padding(
                      padding: const EdgeInsets.only(bottom: 2),
                      child: Text(card.headline!,
                          style:
                              editorial(19, weight: FontWeight.w700).copyWith(
                            color: palette.ink,
                          )),
                    ),

                  // The remaining photographs — the headline of "see everything".
                  if (rest.isNotEmpty) ...[
                    const SizedBox(height: 18),
                    const _SectionLabel('Photos'),
                    const SizedBox(height: 10),
                    for (final url in rest)
                      Padding(
                        padding: const EdgeInsets.only(bottom: 12),
                        child: ClipRRect(
                          borderRadius:
                              BorderRadius.circular(NiaRadius.md),
                          child: AspectRatio(
                            aspectRatio: 4 / 5,
                            child: Image.network(
                              url,
                              fit: BoxFit.cover,
                              errorBuilder: (_, __, ___) =>
                                  const _PortraitFallback(),
                            ),
                          ),
                        ),
                      ),
                  ],

                  // Bio.
                  if (card.bio != null && card.bio!.trim().isNotEmpty) ...[
                    const _SectionLabel('About'),
                    const SizedBox(height: 6),
                    Text(card.bio!,
                        style: inter(14.5,
                            weight: FontWeight.w400,
                            color: palette.inkSoft,
                            height: 1.55)),
                  ],

                  // Interests shared with the viewer.
                  if (card.sharedInterests.isNotEmpty) ...[
                    const SizedBox(height: 20),
                    const _SectionLabel('Interests you share'),
                    const SizedBox(height: 10),
                    Wrap(
                      spacing: 8,
                      runSpacing: 8,
                      children: [
                        for (final interest in card.sharedInterests)
                          _InterestPill(label: interest),
                      ],
                    ),
                  ],

                  // Practical details.
                  const SizedBox(height: 22),
                  const _SectionLabel('Details'),
                  const SizedBox(height: 4),
                  _DetailList(card: card),

                  SizedBox(
                      height: MediaQuery.of(context).padding.bottom + 8),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// The name + age + support line + trust, drawn on the hero photograph.
class _HeroIdentity extends StatelessWidget {
  const _HeroIdentity({required this.card});
  final DiscoverCard card;

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
    final supporting = _supportingLine;
    final interests = card.sharedInterests.take(3).toList();
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisSize: MainAxisSize.min,
      children: [
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
  }
}

/// Right-aligned action rail — one hierarchy (like largest), per the kit rules.
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
    return Padding(
      padding: const EdgeInsets.only(right: 4),
      child: Row(
        // Right-aligned, per the brief: the buttons sit to the right so the
        // card reads left (identity) → right (decision).
        mainAxisAlignment: MainAxisAlignment.end,
        crossAxisAlignment: CrossAxisAlignment.center,
        children: [
          ActionBubble(
            icon: Icons.close_rounded,
            tone: ActionTone.neutral,
            size: 58,
            semanticLabel: 'Pass',
            onTap: busy ? null : onPass,
          ),
          const SizedBox(width: 16),
          ActionBubble(
            icon: Icons.star_rounded,
            tone: ActionTone.gold,
            size: 52,
            semanticLabel: 'Superlike',
            busy: busy,
            onTap: busy ? null : onSuperlike,
          ),
          const SizedBox(width: 16),
          ActionBubble(
            icon: Icons.favorite_rounded,
            tone: ActionTone.brand,
            size: 68,
            semanticLabel: 'Like',
            onTap: busy ? null : onLike,
          ),
        ],
      ),
    );
  }
}

class _ExpandChip extends StatelessWidget {
  const _ExpandChip({required this.expanded, required this.onTap});
  final bool expanded;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 11, vertical: 7),
        decoration: BoxDecoration(
          color: Colors.white.withValues(alpha: 0.92),
          borderRadius: BorderRadius.circular(NiaRadius.pill),
          boxShadow: niaShadowBubble(Colors.black),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(
              expanded ? Icons.unfold_less_rounded : Icons.unfold_more_rounded,
              size: 14,
              color: AppColors.plum,
            ),
            const SizedBox(width: 5),
            Text(
              expanded ? 'Less' : 'Full profile',
              style: inter(12, weight: FontWeight.w700, color: AppColors.plum),
            ),
          ],
        ),
      ),
    );
  }
}

class _SectionLabel extends StatelessWidget {
  const _SectionLabel(this.text);
  final String text;

  @override
  Widget build(BuildContext context) => Text(
        text.toUpperCase(),
        style: niaLabel(11, weight: FontWeight.w700)
            .copyWith(color: context.palette.muted, letterSpacing: 0.8),
      );
}

class _DetailRow extends StatelessWidget {
  const _DetailRow({required this.label, required this.value});
  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    final palette = context.palette;
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 12),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 92,
            child: Text(label,
                style: inter(13, weight: FontWeight.w500, color: palette.muted)),
          ),
          Expanded(
            child: Text(value,
                style: inter(14, weight: FontWeight.w500, color: palette.ink)),
          ),
        ],
      ),
    );
  }
}

class _DetailList extends StatelessWidget {
  const _DetailList({required this.card});
  final DiscoverCard card;

  @override
  Widget build(BuildContext context) {
    final palette = context.palette;
    final items = <_DetailRow>[];
    if (card.headline != null && card.headline!.trim().isNotEmpty) {
      items.add(_DetailRow(label: 'Headline', value: card.headline!.trim()));
    }
    if (card.profession != null && card.profession!.trim().isNotEmpty) {
      items.add(_DetailRow(label: 'Profession', value: card.profession!.trim()));
    }
    if (card.employer != null && card.employer!.trim().isNotEmpty) {
      items.add(_DetailRow(label: 'Works at', value: card.employer!.trim()));
    }
    if (card.educationLevel != null && card.educationLevel!.isNotEmpty) {
      items.add(_DetailRow(
          label: 'Education', value: _prettyEducation(card.educationLevel!)));
    }
    if (card.city.trim().isNotEmpty) {
      items.add(_DetailRow(label: 'Based in', value: card.city.trim()));
    }
    if (card.distanceKm != null) {
      final km = card.distanceKm!;
      items.add(_DetailRow(
        label: 'Distance',
        value: km < 1
            ? 'Under 1 km'
            : km < 10
                ? '${km.toStringAsFixed(1)} km away'
                : '${km.round()} km away',
      ));
    }

    if (items.isEmpty) {
      return Text('No details shared yet.',
          style: inter(13.5, color: palette.muted));
    }

    return Column(
      children: [
        for (var i = 0; i < items.length; i++) ...[
          items[i],
          if (i != items.length - 1) const Hairline(),
        ],
      ],
    );
  }

  String _prettyEducation(String level) {
    final map = {
      'high_school': 'High school',
      'diploma': 'Diploma',
      'bachelors': "Bachelor's",
      'masters': "Master's",
      'phd': 'PhD',
      'other': 'Other',
    };
    return map[level] ?? level;
  }
}

/// Translucent chip for interests, sitting *on* the photograph.
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
          style: inter(11, weight: FontWeight.w600, color: Colors.white)),
    );
  }
}

/// Solid pill for interests on the light canvas (expanded profile body).
class _InterestPill extends StatelessWidget {
  const _InterestPill({required this.label});
  final String label;

  @override
  Widget build(BuildContext context) {
    final palette = context.palette;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 13, vertical: 8),
      decoration: BoxDecoration(
        color: palette.surfaceRaised,
        borderRadius: BorderRadius.circular(NiaRadius.pill),
        border: Border.all(color: palette.line),
      ),
      child: Text(label,
          style: inter(13,
              weight: FontWeight.w500, color: palette.inkSoft)),
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

/// Fallback artwork for a member with no photo — an illustrated portrait
/// silhouette rather than a grey box, so the card still looks intentional.
class _PortraitFallback extends StatelessWidget {
  const _PortraitFallback();

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
