import 'package:flutter/material.dart';

import '../../../core/theme/app_theme.dart';
import '../../../core/widgets/nia_kit.dart';
import '../data/discover_card.dart';

/// Nearby members, presented as a two-column photo grid — the classic 她说 /
/// Tantan "附近" layout. Each tile is a full-bleed photograph with the name and
/// distance overlaid on a bottom scrim, and tapping it opens the full profile
/// (the RedNote modal). 她说's nearby view is a grid of faces, not a rail.
class NearbySection extends StatelessWidget {
  const NearbySection({
    super.key,
    required this.profiles,
    required this.onCardTap,
    required this.onReload,
    this.subscription,
  });

  final List<NearbyProfile> profiles;
  final void Function(NearbyProfile) onCardTap;
  final VoidCallback onReload;
  final Map<String, dynamic>? subscription;

  bool get isPremium {
    final plan = subscription?['plan'] as String?;
    final status = subscription?['status'] as String?;
    return plan == 'premium' && status == 'active';
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Expanded(
              child: Text(
                '${profiles.length} nearby '
                '${profiles.length == 1 ? 'member' : 'members'}',
                style: inter(13,
                    weight: FontWeight.w500, color: context.palette.muted),
              ),
            ),
            TextButton(
              onPressed: onReload,
              child: Text('Refresh', style: inter(13, weight: FontWeight.w600)),
            ),
          ],
        ),
        _NearbyGrid(
          profiles: profiles,
          onCardTap: onCardTap,
        ),
        if (!isPremium && profiles.isNotEmpty) ...[
          const SizedBox(height: 16),
          _UpsellNote(count: profiles.length),
        ],
      ],
    );
  }
}

/// The 2-up grid of nearby photo tiles. Kept as its own widget so the
/// `GridView` can be `shrinkWrap`ped inside the screen's scrolling column.
class _NearbyGrid extends StatelessWidget {
  const _NearbyGrid({
    required this.profiles,
    required this.onCardTap,
  });

  final List<NearbyProfile> profiles;
  final void Function(NearbyProfile) onCardTap;

  @override
  Widget build(BuildContext context) {
    return GridView.builder(
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
        crossAxisCount: 2,
        childAspectRatio: 0.76,
        crossAxisSpacing: 12,
        mainAxisSpacing: 12,
      ),
      itemCount: profiles.length,
      itemBuilder: (context, index) {
        final profile = profiles[index];
        return _NearbyCard(
          profile: profile,
          onTap: () => onCardTap(profile),
        );
      },
    );
  }
}

class _NearbyCard extends StatelessWidget {
  const _NearbyCard({required this.profile, required this.onTap});

  final NearbyProfile profile;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final name = profile.displayName.isNotEmpty
        ? profile.displayName
        : profile.fallbackName;
    final distance = _shortDistance(profile.distanceKm);
    final supporting = profile.headline?.trim().isNotEmpty == true
        ? profile.headline!.trim()
        : (profile.profession?.trim().isNotEmpty == true
            ? profile.profession!.trim()
            : profile.city.trim());

    return MediaCard(
      imageUrl: profile.photos.isNotEmpty ? profile.photos.first : null,
      brandScrim: true,
      radius: NiaRadius.lg,
      scrimStart: 0.42,
      onTap: onTap,
      padding: const EdgeInsets.fromLTRB(13, 13, 13, 14),
      topLeft: [
        if (distance != null)
          MediaBadge(label: distance, icon: Icons.near_me_rounded),
      ],
      content: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(
            name,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: editorial(19, weight: FontWeight.w700)
                .copyWith(color: Colors.white, height: 1.1),
          ),
          if (supporting.isNotEmpty) ...[
            const SizedBox(height: 3),
            Text(
              supporting,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: inter(12,
                  weight: FontWeight.w500,
                  color: Colors.white.withValues(alpha: 0.78),
                  height: 1.3),
            ),
          ],
        ],
      ),
    );
  }
}

class _UpsellNote extends StatelessWidget {
  const _UpsellNote({required this.count});
  final int count;

  @override
  Widget build(BuildContext context) {
    final palette = context.palette;
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: palette.warnBg,
        borderRadius: BorderRadius.circular(NiaRadius.sm),
        border: Border.all(color: palette.warn.withValues(alpha: 0.35)),
      ),
      child: Row(
        children: [
          Expanded(
            child: Text(
              'Showing $count nearby ${count == 1 ? 'member' : 'members'}. '
              'Upgrade to Premium to see everyone around you.',
              style: inter(12.5,
                  weight: FontWeight.w500, color: palette.warn, height: 1.4),
            ),
          ),
        ],
      ),
    );
  }
}

/// Compact distance label for the on-photo badge — the reference shows a bare
/// figure plus unit, not a sentence.
String? _shortDistance(double? distanceKm) {
  if (distanceKm == null) return null;
  if (distanceKm < 1) return 'Under 1 km';
  if (distanceKm < 10) return '${distanceKm.toStringAsFixed(1)} km';
  return '${distanceKm.round()} km';
}
