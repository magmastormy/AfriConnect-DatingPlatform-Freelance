import 'package:flutter/material.dart';

import '../../../core/services.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/widgets/app_widgets.dart';
import '../data/discover_card.dart';

class DiscoverScreen extends StatefulWidget {
  const DiscoverScreen({super.key});

  @override
  State<DiscoverScreen> createState() => _DiscoverScreenState();
}

class _DiscoverScreenState extends State<DiscoverScreen> {
  bool nearby = false;

  @override
  void initState() {
    super.initState();
    loadNearbyPreference();
  }

  Future<void> loadNearbyPreference() async {
    try {
      final profile = await AppServices.account.getProfile();
      if (mounted) setState(() => nearby = profile['nearbyEnabled'] == true);
    } catch (_) {
      // The opt-in card defaults to the safe state when the API is unavailable.
    }
  }

  Future<void> openNearbySetup() async {
    var consent = nearby;
    final enabled = await showModalBottomSheet<bool>(
      context: context,
      backgroundColor: context.palette.background,
      builder: (sheetContext) => StatefulBuilder(
        builder: (context, setSheetState) => SafeArea(
          child: Padding(
            padding: const EdgeInsets.fromLTRB(20, 14, 20, 24),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Center(
                    child: Container(
                        width: 36,
                        height: 4,
                        decoration: BoxDecoration(
                            color: context.palette.lineStrong,
                            borderRadius: BorderRadius.circular(99)))),
                const SizedBox(height: 20),
                Text('Nearby introductions',
                    style: editorial(27, weight: FontWeight.w700)),
                const SizedBox(height: 8),
                Text(
                    'Choose whether vetted members can discover you by area. Your exact location is never shown.',
                    style:
                        TextStyle(color: context.palette.muted, height: 1.45)),
                const SizedBox(height: 14),
                SwitchListTile(
                  contentPadding: EdgeInsets.zero,
                  title: const Text('Show me nearby',
                      style: TextStyle(fontWeight: FontWeight.w700)),
                  subtitle: Text('Opt in to local introductions',
                      style: TextStyle(
                          color: context.palette.muted, fontSize: 12)),
                  value: consent,
                  activeThumbColor: AppColors.clay,
                  onChanged: (value) => setSheetState(() => consent = value),
                ),
                const SizedBox(height: 10),
                SizedBox(
                    width: double.infinity,
                    child: FilledButton(
                        onPressed: () => Navigator.pop(sheetContext, consent),
                        child: const Text('Save nearby preference'))),
              ],
            ),
          ),
        ),
      ),
    );
    if (enabled == null || !mounted) return;
    final previous = nearby;
    setState(() => nearby = enabled);
    try {
      await AppServices.account.updateNearby(enabled);
    } catch (exception) {
      if (!mounted) return;
      setState(() => nearby = previous);
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(
          content: Text('Could not save nearby preference: $exception')));
    }
  }

  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.fromLTRB(20, 2, 20, 28),
      children: [
        Text('Good to see you.',
            style: Theme.of(context)
                .textTheme
                .bodyMedium
                ?.copyWith(color: AppColors.muted)),
        const SizedBox(height: 4),
        Text('A few people worth\nmeeting today.',
            style: editorial(34, weight: FontWeight.w700)),
        const SizedBox(height: 22),
        const _DiscoverDeck(),
        const SizedBox(height: 22),
        const SectionHeader('Today in your circle', action: 'See all'),
        const _InsightStrip(),
        const SizedBox(height: 24),
        const SectionHeader('Nearby introductions', action: 'Explore'),
        SizedBox(
            height: 170,
            child: ListView(scrollDirection: Axis.horizontal, children: const [
              _MiniProfile(
                  name: 'Ama',
                  role: 'Product lead',
                  city: 'Cape Town',
                  initial: 'A'),
              _MiniProfile(
                  name: 'Lebo', role: 'Doctor', city: 'Pretoria', initial: 'L'),
              _MiniProfile(
                  name: 'Zola', role: 'Founder', city: 'Durban', initial: 'Z'),
            ])),
        const SizedBox(height: 24),
        SurfaceCard(
            child: Row(children: [
          const Icon(Icons.location_on_outlined, color: AppColors.clay),
          const SizedBox(width: 12),
          Expanded(
              child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                Text(nearby ? 'Nearby is on' : 'Nearby is opt-in',
                    style: const TextStyle(fontWeight: FontWeight.w700)),
                const SizedBox(height: 3),
                const Text('Share your area to see vetted members around you.',
                    style: TextStyle(
                        color: AppColors.muted, fontSize: 12, height: 1.4)),
              ])),
          TextButton(
              onPressed: openNearbySetup,
              child: Text(nearby ? 'Manage' : 'Set up')),
        ])),
      ],
    );
  }
}

class _DiscoverDeck extends StatefulWidget {
  const _DiscoverDeck();

  @override
  State<_DiscoverDeck> createState() => _DiscoverDeckState();
}

class _DiscoverDeckState extends State<_DiscoverDeck> {
  static const previewCards = [
    DiscoverCard(
        userId: 'preview-nandi',
        displayName: 'Nandi',
        age: 31,
        city: 'Johannesburg',
        photos: [],
        headline: 'Architect',
        score: 94,
        verified: true),
    DiscoverCard(
        userId: 'preview-kabelo',
        displayName: 'Kabelo',
        age: 34,
        city: 'Sandton',
        photos: [],
        headline: 'Entrepreneur',
        score: 91,
        verified: true),
    DiscoverCard(
        userId: 'preview-ama',
        displayName: 'Ama',
        age: 29,
        city: 'Cape Town',
        photos: [],
        headline: 'Product lead',
        score: 88,
        verified: true),
  ];

  List<DiscoverCard> cards = const [];
  int current = 0;
  double dragX = 0;
  bool loading = true;
  bool previewMode = false;
  bool acting = false;

  @override
  void initState() {
    super.initState();
    loadCards();
  }

  Future<void> loadCards() async {
    try {
      final loaded = await AppServices.discover.getDiscover();
      if (mounted) setState(() => cards = loaded);
    } catch (_) {
      if (mounted) {
        setState(() {
          cards = previewCards;
          previewMode = true;
        });
      }
    } finally {
      if (mounted) setState(() => loading = false);
    }
  }

  Future<void> settle(String action) async {
    if (loading || acting || cards.isEmpty) return;
    final card = cards[current];
    final messenger = ScaffoldMessenger.of(context);
    setState(() {
      acting = true;
      dragX = 0;
      current = (current + 1) % cards.length;
    });
    if (!previewMode) {
      try {
        final data = switch (action) {
          'like' => await AppServices.matches.like(card.userId),
          'pass' => await AppServices.matches.pass(card.userId),
          _ => await AppServices.matches.superlike(card.userId),
        };
        if (mounted && data['mutual'] == true) {
          messenger.showSnackBar(const SnackBar(
              content: Text('It is a mutual match. Start a conversation.')));
        }
      } catch (exception) {
        if (mounted) {
          messenger.showSnackBar(
              SnackBar(content: Text('That action was not saved: $exception')));
        }
      }
    }
    if (mounted) setState(() => acting = false);
  }

  @override
  Widget build(BuildContext context) {
    if (loading) return const ShimmerBlock(height: 360, radius: 22);
    if (cards.isEmpty) {
      return SurfaceCard(
          child: Column(children: [
        const Text('No introductions are waiting right now.'),
        const SizedBox(height: 12),
        OutlinedButton(onPressed: loadCards, child: const Text('Refresh deck'))
      ]));
    }
    final card = cards[current];
    return Column(children: [
      GestureDetector(
        onHorizontalDragUpdate: (details) =>
            setState(() => dragX += details.delta.dx),
        onHorizontalDragEnd: (_) {
          if (dragX.abs() > 90) {
            settle(dragX > 0 ? 'like' : 'pass');
          } else {
            setState(() => dragX = 0);
          }
        },
        child: AnimatedContainer(
            duration: const Duration(milliseconds: 180),
            transform: Matrix4.translationValues(dragX, 0, 0)
              ..rotateZ(dragX / 1800),
            child: _DeckCard(card: card)),
      ),
      const SizedBox(height: 12),
      Row(mainAxisAlignment: MainAxisAlignment.center, children: [
        _DeckButton(
            icon: Icons.close,
            label: 'Pass',
            color: AppColors.inkSoft,
            onTap: () => settle('pass')),
        const SizedBox(width: 18),
        _DeckButton(
            icon: Icons.star,
            label: 'Superlike',
            color: AppColors.gold,
            onTap: () => settle('superlike')),
        const SizedBox(width: 18),
        _DeckButton(
            icon: Icons.favorite,
            label: 'Like',
            color: AppColors.clay,
            onTap: () => settle('like')),
      ]),
    ]);
  }
}

class _DeckCard extends StatelessWidget {
  const _DeckCard({required this.card});

  final DiscoverCard card;

  @override
  Widget build(BuildContext context) => Container(
        height: 360,
        decoration: BoxDecoration(
            color: AppColors.plum, borderRadius: BorderRadius.circular(22)),
        clipBehavior: Clip.antiAlias,
        child: Stack(children: [
          Positioned.fill(child: CustomPaint(painter: _PortraitPainter())),
          if (card.photos.isNotEmpty)
            Positioned.fill(
                child: Image.network(card.photos.first,
                    fit: BoxFit.cover,
                    errorBuilder: (_, __, ___) => const SizedBox.shrink())),
          Positioned.fill(
              child: DecoratedBox(
                  decoration: BoxDecoration(
                      gradient: LinearGradient(
                          begin: Alignment.topCenter,
                          end: Alignment.bottomCenter,
                          colors: [
                Colors.transparent,
                Colors.black.withValues(alpha: .82)
              ])))),
          Positioned(
              top: 16,
              left: 16,
              child: StatusPill('${card.score ?? 0}% compatibility',
                  tone: PillTone.good)),
          Positioned(
              left: 20,
              right: 20,
              bottom: 18,
              child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('${card.displayName}, ${card.age}',
                        style: editorial(31, weight: FontWeight.w700)
                            .copyWith(color: Colors.white)),
                    const SizedBox(height: 4),
                    Text('${card.headline ?? 'Professional'} - ${card.city}',
                        style: const TextStyle(color: Colors.white70)),
                    const SizedBox(height: 8),
                    Wrap(spacing: 6, children: [
                      if (card.verified)
                        const StatusPill('Verified', tone: PillTone.good),
                      if (card.isPremium)
                        const StatusPill('Premium', tone: PillTone.brand),
                      ...card.sharedInterests.take(2).map(
                          (item) => StatusPill(item, tone: PillTone.neutral)),
                    ]),
                  ])),
        ]),
      );
}

class _DeckButton extends StatelessWidget {
  const _DeckButton(
      {required this.icon,
      required this.label,
      required this.color,
      required this.onTap});

  final IconData icon;
  final String label;
  final Color color;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) => Column(children: [
        IconButton(
            onPressed: onTap,
            icon: Icon(icon, color: color),
            style: IconButton.styleFrom(
                backgroundColor: context.palette.surface,
                side: BorderSide(color: context.palette.line))),
        Text(label,
            style: TextStyle(color: context.palette.muted, fontSize: 10))
      ]);
}

class _PortraitPainter extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..shader =
          const LinearGradient(colors: [Color(0xFFB78368), Color(0xFF5B263B)])
              .createShader(Offset.zero & size);
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
  bool shouldRepaint(covariant _PortraitPainter oldDelegate) => false;
}

class _InsightStrip extends StatelessWidget {
  const _InsightStrip();

  @override
  Widget build(BuildContext context) => SurfaceCard(
      padding: const EdgeInsets.all(14),
      child: Row(children: [
        Container(
            width: 42,
            height: 42,
            decoration: const BoxDecoration(
                color: AppColors.successBg, shape: BoxShape.circle),
            child: const Icon(Icons.auto_awesome, color: AppColors.success)),
        const SizedBox(width: 12),
        const Expanded(
            child:
                Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text('3 new introductions',
              style: TextStyle(fontWeight: FontWeight.w700)),
          SizedBox(height: 3),
          Text('Your strongest shared value today is ambition.',
              style: TextStyle(fontSize: 12, color: AppColors.muted))
        ])),
        const Icon(Icons.chevron_right, color: AppColors.muted)
      ]));
}

class _MiniProfile extends StatelessWidget {
  const _MiniProfile(
      {required this.name,
      required this.role,
      required this.city,
      required this.initial});

  final String name;
  final String role;
  final String city;
  final String initial;

  @override
  Widget build(BuildContext context) => Container(
      width: 148,
      margin: const EdgeInsets.only(right: 12),
      padding: const EdgeInsets.all(13),
      decoration: BoxDecoration(
          color: context.palette.surface,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: context.palette.line)),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        InitialAvatar(initial, size: 48, color: AppColors.plum),
        const Spacer(),
        Text(name, style: editorial(20, weight: FontWeight.w700)),
        Text(role,
            overflow: TextOverflow.ellipsis,
            style: const TextStyle(fontSize: 12)),
        Text(city, style: TextStyle(color: context.palette.muted, fontSize: 12))
      ]));
}
