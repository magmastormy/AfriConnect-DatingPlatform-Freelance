import 'package:flutter/material.dart';

import '../../../core/services.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/widgets/app_widgets.dart';
import '../../../core/widgets/nia_kit.dart';
import '../../messages/presentation/conversation_screen.dart';

/// Segments derived from data we actually have — Every one / Strongest (>=90).
/// Inventing a "Recently matched" tab would need a timestamp the API doesn't
/// return, and a tab whose name promises more than the data can deliver is
/// worse than no tab.
enum MatchFilter { all, strongest }

class MatchesScreen extends StatefulWidget {
  const MatchesScreen({super.key});
  @override
  State<MatchesScreen> createState() => _MatchesScreenState();
}

class _MatchesScreenState extends State<MatchesScreen> {
  List<Map<String, dynamic>> matches = [];
  bool loading = true;
  MatchFilter filter = MatchFilter.all;

  @override
  void initState() {
    super.initState();
    loadMatches();
  }

  Future<void> loadMatches() async {
    try {
      final loaded = await AppServices.matches.mutual();
      if (mounted) setState(() => matches = loaded);
    } catch (_) {
      // Preview rows remain available without a signed-in API session.
    } finally {
      if (mounted) setState(() => loading = false);
    }
  }

  Future<void> openConversation(Map<String, dynamic> match) async {
    final userId = match['userId'] as String?;
    if (userId == null || userId.isEmpty) return;
    try {
      final conversationId = await AppServices.chat.createConversation(userId);
      if (!mounted) return;
      final name = match['name'] as String? ??
          match['displayName'] as String? ??
          'Member';
      await Navigator.push(
        context,
        MaterialPageRoute(
          builder: (_) =>
              ConversationScreen(conversationId: conversationId, name: name),
        ),
      );
    } catch (exception) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text('Could not open conversation: $exception')));
      }
    }
  }

  List<Map<String, dynamic>> get visible {
    switch (filter) {
      case MatchFilter.strongest:
        return matches.where((m) => _scoreOf(m) >= 90).toList();
      case MatchFilter.all:
        return matches;
    }
  }

  static int _scoreOf(Map<String, dynamic> match) {
    final value = match['score'];
    if (value is int) return value;
    if (value is num) return value.round();
    return 100;
  }

  @override
  Widget build(BuildContext context) {
    final shown = visible;

    return ListView(
      padding: const EdgeInsets.only(top: 8, bottom: 28),
      children: [
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 20),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Expanded(
                    child: Text('The people who\nchose you back.',
                        style: editorial(32, weight: FontWeight.w700)
                            .copyWith(height: 1.05)),
                  ),
                  Icon(Icons.auto_awesome,
                      color: context.palette.brand, size: 26),
                ],
              ),
              const SizedBox(height: 10),
              Text(
                'Mutual interest opens the door to a thoughtful conversation.',
                style: inter(14,
                    weight: FontWeight.w400,
                    color: context.palette.muted,
                    height: 1.45),
              ),
            ],
          ),
        ),

        if (loading)
          const Padding(
            padding: EdgeInsets.all(28),
            child: Center(child: CircularProgressIndicator()),
          ),

        // An avatar rail of everyone who matched, before the list. It gives the
        // screen a face-level summary before any reading is required.
        if (!loading && matches.isNotEmpty) ...[
          const SizedBox(height: 24),
          AvatarRail(
            size: 54,
            items: [
              for (final match in matches.take(12))
                AvatarRailItem(
                  label: _firstName(match),
                  imageUrl: _photoOf(match),
                  emphasised: match == matches.first,
                ),
            ],
            onTap: (index) => openConversation(matches[index]),
          ),
          const SizedBox(height: 22),
          FilterRail<MatchFilter>(
            selected: filter,
            onChanged: (value) => setState(() => filter = value),
            options: const [
              SegmentedOption(value: MatchFilter.all, label: 'Every one'),
              SegmentedOption(value: MatchFilter.strongest, label: 'Strongest'),
            ],
          ),
          const SizedBox(height: 14),
        ],

        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 20),
          child: Column(
            children: [
              if (!loading && matches.isNotEmpty && shown.isEmpty)
                _NoMatchesInSegment(
                  onReset: () => setState(() => filter = MatchFilter.all),
                ),
              if (!loading && matches.isNotEmpty)
                _MatchBentoGrid(
                  matches: shown,
                  nameOf: _name,
                  roleOf: _role,
                  photoOf: _photoOf,
                  scoreOf: _scoreOf,
                  onTap: openConversation,
                ),
              if (!loading && matches.isEmpty) ...[
                _MatchPreviewRow(),
                const SizedBox(height: 26),
                SectionHeader('People you may like'),
                _MatchRow(
                  name: 'Sibongile, 29',
                  role: 'Finance · Cape Town',
                  score: '91%',
                ),
                _MatchRow(
                  name: 'Thabo, 36',
                  role: 'Strategy · Johannesburg',
                  score: '88%',
                ),
                _MatchRow(
                  name: 'Maya, 30',
                  role: 'Law · Pretoria',
                  score: '84%',
                ),
              ],
            ],
          ),
        ),
      ],
    );
  }

  static String? _photoOf(Map<String, dynamic> match) {
    for (final key in const ['photo', 'photoUrl', 'avatar', 'avatarUrl']) {
      final value = match[key];
      if (value is String && value.isNotEmpty) return value;
    }
    final photos = match['photos'];
    if (photos is List && photos.isNotEmpty && photos.first is String) {
      return photos.first as String;
    }
    return null;
  }

  String _name(Map<String, dynamic> match) =>
      match['displayName'] as String? ??
      match['fullName'] as String? ??
      'Member';

  String _firstName(Map<String, dynamic> match) {
    final name = _name(match).trim();
    return name.isEmpty ? 'Member' : name.split(' ').first;
  }

  String _role(Map<String, dynamic> match) => [
        match['profession'],
        match['city']
      ].whereType<String>().where((v) => v.isNotEmpty).join(' · ');
}

/// The illustrative "first match" shown while the list is empty. It is a
/// preview of the reward, not a placeholder for broken data.
class _MatchPreviewRow extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    final palette = context.palette;
    return SurfaceCard(
      padding: const EdgeInsets.all(14),
      child: Row(
        children: [
          InitialAvatar('K', size: 58, color: AppColors.clayDark),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('Kabelo, 34',
                    style:
                        inter(16, weight: FontWeight.w700, color: palette.ink)),
                const SizedBox(height: 4),
                Text('Entrepreneur · Sandton',
                    style: inter(13,
                        weight: FontWeight.w400, color: palette.muted)),
                const SizedBox(height: 10),
                const StatusPill('New match', tone: PillTone.brand),
              ],
            ),
          ),
          PillCta(label: 'Message', onPressed: () {}),
        ],
      ),
    );
  }
}

class _NoMatchesInSegment extends StatelessWidget {
  const _NoMatchesInSegment({required this.onReset});
  final VoidCallback onReset;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: SurfaceCard(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('Nothing above 90% yet',
                style: editorial(19, weight: FontWeight.w700)),
            const SizedBox(height: 8),
            Text(
              'Compatibility scores settle once you have both been through '
              'vetting and answered a little more.',
              style: inter(13,
                  weight: FontWeight.w400,
                  color: context.palette.muted,
                  height: 1.45),
            ),
            const SizedBox(height: 14),
            PillCta(
              label: 'Show every one',
              onPressed: onReset,
            ),
          ],
        ),
      ),
    );
  }
}

class _MatchBentoGrid extends StatelessWidget {
  const _MatchBentoGrid({
    required this.matches,
    required this.nameOf,
    required this.roleOf,
    required this.photoOf,
    required this.scoreOf,
    required this.onTap,
  });

  final List<Map<String, dynamic>> matches;
  final String Function(Map<String, dynamic>) nameOf;
  final String Function(Map<String, dynamic>) roleOf;
  final String? Function(Map<String, dynamic>) photoOf;
  final int Function(Map<String, dynamic>) scoreOf;
  final Future<void> Function(Map<String, dynamic>) onTap;

  @override
  Widget build(BuildContext context) {
    return Wrap(
      spacing: 10,
      runSpacing: 10,
      children: [
        for (var index = 0; index < matches.length; index++)
          SizedBox(
            width: index == 0
                ? double.infinity
                : (MediaQuery.sizeOf(context).width - 50) / 2,
            child: _MatchBentoCard(
              name: nameOf(matches[index]),
              role: roleOf(matches[index]),
              photoUrl: photoOf(matches[index]),
              score: '${scoreOf(matches[index])}%',
              featured: index == 0,
              onTap: () => onTap(matches[index]),
            ),
          ),
      ],
    );
  }
}

class _MatchBentoCard extends StatelessWidget {
  const _MatchBentoCard({
    required this.name,
    required this.role,
    required this.score,
    required this.onTap,
    this.photoUrl,
    this.featured = false,
  });

  final String name;
  final String role;
  final String score;
  final String? photoUrl;
  final bool featured;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final palette = context.palette;
    return PressScale(
      onTap: onTap,
      child: SurfaceCard(
        padding: EdgeInsets.all(featured ? 14 : 10),
        child: Row(
          children: [
            _MatchAvatar(
              initial: name.isEmpty ? 'M' : name[0].toUpperCase(),
              photoUrl: photoUrl,
              size: featured ? 104 : 62,
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(children: [
                    Expanded(
                      child: Text(name,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: inter(featured ? 17 : 14,
                              weight: FontWeight.w700, color: palette.ink)),
                    ),
                    StatusPill(score, tone: PillTone.good),
                  ]),
                  const SizedBox(height: 5),
                  Text(role.isEmpty ? 'AfriConnect member' : role,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: inter(12,
                          color: palette.muted, height: 1.3)),
                  if (featured) ...[
                    const SizedBox(height: 12),
                    Text('Mutual interest',
                        style: inter(12,
                            weight: FontWeight.w700, color: palette.brand)),
                  ],
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _MatchRow extends StatelessWidget {
  const _MatchRow({
    required this.name,
    required this.role,
    required this.score,
    this.photoUrl,
    this.action,
  });

  final String name;
  final String role;
  final String score;
  final String? photoUrl;
  final VoidCallback? action;

  @override
  Widget build(BuildContext context) {
    final palette = context.palette;
    final initial = name.trim().isEmpty ? 'M' : name.trim()[0].toUpperCase();

    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: PressScale(
        onTap: action,
        child: SurfaceCard(
          padding: const EdgeInsets.all(10),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.center,
            children: [
              _MatchAvatar(initial: initial, photoUrl: photoUrl, size: 88),
              const SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Expanded(
                          child: Text(name,
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: inter(16,
                                  weight: FontWeight.w700, color: palette.ink)),
                        ),
                        StatusPill(score, tone: PillTone.good),
                      ],
                    ),
                    const SizedBox(height: 5),
                    Text(role.isEmpty ? 'AfriConnect member' : role,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: inter(12.5,
                            weight: FontWeight.w400, color: palette.muted)),
                    const SizedBox(height: 12),
                    Row(
                      children: [
                        Icon(Icons.favorite_rounded,
                            size: 15, color: palette.brand),
                        const SizedBox(width: 5),
                        Text('Mutual interest',
                            style: inter(12,
                                weight: FontWeight.w600,
                                color: palette.brand)),
                        const Spacer(),
                        Icon(Icons.chevron_right_rounded,
                            color: palette.lineStrong, size: 20),
                      ],
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _MatchAvatar extends StatelessWidget {
  const _MatchAvatar({
    required this.initial,
    required this.size,
    this.photoUrl,
  });

  final String initial;
  final double size;
  final String? photoUrl;

  @override
  Widget build(BuildContext context) {
    if (photoUrl != null && photoUrl!.isNotEmpty) {
      return Container(
        width: size,
        height: size,
        decoration: BoxDecoration(
          shape: BoxShape.circle,
          border: Border.all(color: context.palette.line, width: 1),
        ),
        clipBehavior: Clip.antiAlias,
        child: Image.network(
          photoUrl!,
          fit: BoxFit.cover,
          errorBuilder: (_, __, ___) =>
              InitialAvatar(initial, size: size, color: AppColors.plum),
        ),
      );
    }
    return InitialAvatar(initial, size: size, color: AppColors.plum);
  }
}
