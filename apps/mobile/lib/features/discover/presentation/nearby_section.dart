import 'package:flutter/material.dart';

import '../../../core/theme/app_theme.dart';
import '../../../core/widgets/nia_kit.dart';
import '../data/discover_card.dart';

/// Nearby members, presented as a horizontally scrolling rail of photo cards
/// rather than a 2-up grid.
///
/// Why the rail (DESIGN_INSPIRATIONS §5, ref 4): proximity is a *browsing*
/// context, not a decision context. A rail lets the eye sweep several people at
/// once, keeps each photo large enough to actually read a face, and leaves the
/// vertical axis free for the location controls above it. The 2-up grid forced
/// each photo down to a thumbnail while still consuming two rows of height.
///
/// The map view in the reference is deliberately not built here — it needs a
/// tile provider. The rail is the part that carries the value.
class NearbySection extends StatelessWidget {
  const NearbySection({
    super.key,
    required this.profiles,
    required this.onAction,
    required this.onCardTap,
    required this.onReload,
    this.subscription,
  });

  final List<NearbyProfile> profiles;
  final Future<void> Function(NearbyProfile, String) onAction;
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
        const SizedBox(height: 4),

        // The rail is full-bleed: it breaks out of the screen's 20px gutter so
        // the cards can run to the edge, which is what signals "scroll me".
        SizedBox(
          height: 252,
          child: ListView.separated(
            scrollDirection: Axis.horizontal,
            padding: const EdgeInsets.symmetric(horizontal: 20),
            itemCount: profiles.length,
            separatorBuilder: (_, __) => const SizedBox(width: 12),
            itemBuilder: (context, index) {
              final profile = profiles[index];
              return _NearbyCard(
                profile: profile,
                onTap: () => onCardTap(profile),
                onLike: () => onAction(profile, 'like'),
              );
            },
          ),
        ),

        if (!isPremium && profiles.isNotEmpty) ...[
          const SizedBox(height: 16),
          _UpsellNote(count: profiles.length),
        ],
      ],
    );
  }
}

class _NearbyCard extends StatelessWidget {
  const _NearbyCard({
    required this.profile,
    required this.onTap,
    required this.onLike,
  });

  final NearbyProfile profile;
  final VoidCallback onTap;
  final VoidCallback onLike;

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

    return SizedBox(
      width: 172,
      child: MediaCard(
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
        topRight: [
          // A quick affirmative without leaving the rail. It sits on the photo
          // rather than below it so the card keeps a single content block.
          _RailLikeButton(onTap: onLike, name: name),
        ],
        content: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(
              name,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: editorial(21, weight: FontWeight.w700)
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
      ),
    );
  }
}

class _RailLikeButton extends StatelessWidget {
  const _RailLikeButton({required this.onTap, required this.name});
  final VoidCallback onTap;
  final String name;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      button: true,
      label: 'Like $name',
      child: Material(
        color: Colors.white.withValues(alpha: 0.18),
        shape: const CircleBorder(),
        clipBehavior: Clip.antiAlias,
        child: InkWell(
          onTap: onTap,
          child: SizedBox(
            width: 36,
            height: 36,
            child: Icon(Icons.favorite_rounded,
                size: 18, color: Colors.white.withValues(alpha: 0.95)),
          ),
        ),
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
      padding: const EdgeInsets.fromLTRB(14, 12, 8, 12),
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
          TextButton(
            onPressed: () {},
            child: Text('Upgrade',
                style: inter(13, weight: FontWeight.w700, color: palette.warn)),
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
