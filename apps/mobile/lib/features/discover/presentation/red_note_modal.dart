import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../../core/theme/app_theme.dart';
import '../../../core/widgets/nia_kit.dart';
import '../data/discover_card.dart';

/// The full profile view.
///
/// Cloned from the 她说 / Tantan "card" layout: the photograph is a true
/// **full-screen, edge-to-edge** takeover (no rounded bottom sheet, no dim
/// backdrop, no 92% cap). Identity and actions are pinned over a bottom-up
/// scrim, photos are paged by horizontal swipe, and a row of dots up top
/// tracks position — exactly the way 她说 presents a tapped profile.
class RedNoteModal extends StatefulWidget {
  const RedNoteModal({
    super.key,
    required this.view,
    required this.busy,
    required this.onAct,
    required this.onMessage,
    required this.onClose,
  });

  final ProfileRedNote view;
  final bool busy;
  final Future<void> Function(String) onAct;
  final Future<void> Function(String) onMessage;
  final VoidCallback onClose;

  @override
  State<RedNoteModal> createState() => _RedNoteModalState();
}

class _RedNoteModalState extends State<RedNoteModal>
    with SingleTickerProviderStateMixin {
  int _photoIndex = 0;
  late final PageController _pageController;
  late final AnimationController _rise;

  @override
  void initState() {
    super.initState();
    _pageController = PageController();
    // One gesture: the view fades up and dims the world simultaneously.
    _rise = AnimationController(
      duration: NiaMotion.enter,
      vsync: this,
      value: 0,
    )..forward();
  }

  @override
  void didUpdateWidget(covariant RedNoteModal oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.view.userId != widget.view.userId) {
      _photoIndex = 0;
      _pageController.jumpToPage(0);
    }
  }

  @override
  void dispose() {
    _pageController.dispose();
    _rise.dispose();
    super.dispose();
  }

  int? _ageFromDob(String? dob) {
    if (dob == null) return null;
    final d = DateTime.tryParse(dob);
    if (d == null) return null;
    final now = DateTime.now();
    var age = now.year - d.year;
    if (now.month < d.month || (now.month == d.month && now.day < d.day)) {
      age--;
    }
    return age > 0 && age < 130 ? age : null;
  }

  String _formatLocation(ProfileLocation location) {
    if (location.district != null && location.district!.isNotEmpty) {
      return '${location.city} · ${location.district}';
    }
    return location.city;
  }

  @override
  Widget build(BuildContext context) {
    final photos = widget.view.photos;
    final screenH = MediaQuery.of(context).size.height;
    final age = _ageFromDob(widget.view.dateOfBirth);

    return AnnotatedRegion<SystemUiOverlayStyle>(
      value: SystemUiOverlayStyle.light,
      child: Material(
        color: context.palette.surface,
        child: FadeTransition(
          opacity: _rise,
          child: Stack(
            children: [
              // 1. Photograph — full screen, edge to edge.
              Positioned.fill(
                child: photos.isNotEmpty
                    ? PageView.builder(
                        controller: _pageController,
                        itemCount: photos.length,
                        onPageChanged: (i) =>
                            setState(() => _photoIndex = i),
                        itemBuilder: (context, index) => Image.network(
                          photos[index],
                          fit: BoxFit.cover,
                          width: double.infinity,
                          errorBuilder: (_, __, ___) =>
                              const _PhotoPlaceholder(),
                        ),
                      )
                    : const _PhotoPlaceholder(),
              ),

              // 2. Scrim — top fade for chrome, bottom fade for identity.
              Positioned.fill(
                child: DecoratedBox(
                  decoration: BoxDecoration(
                    gradient: LinearGradient(
                      begin: Alignment.topCenter,
                      end: Alignment.bottomCenter,
                      stops: const [0.0, 0.12, 0.5, 0.74, 1.0],
                      colors: [
                        Colors.black.withValues(alpha: 0.5),
                        Colors.black.withValues(alpha: 0),
                        Colors.black.withValues(alpha: 0),
                        Colors.black.withValues(alpha: 0.55),
                        Colors.black.withValues(alpha: 0.84),
                      ],
                    ),
                  ),
                ),
              ),

              // 3. Chrome + identity, laid out within safe areas.
              SafeArea(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    // Top chrome: close · dots
                    Row(
                      crossAxisAlignment: CrossAxisAlignment.center,
                      children: [
                        CircleIconButton(
                          icon: Icons.close_rounded,
                          semanticLabel: 'Close profile',
                          onMedia: true,
                          onTap: widget.onClose,
                        ),
                        const Spacer(),
                        if (photos.length > 1)
                          _PhotoDots(
                              count: photos.length, index: _photoIndex),
                      ],
                    ),

                    // Photo breathes between top chrome and the identity block.
                    const Spacer(),

                    // 4. Identity + details, scrollable over the scrim.
                    ConstrainedBox(
                      constraints: BoxConstraints(maxHeight: screenH * 0.6),
                      child: SingleChildScrollView(
                        padding: const EdgeInsets.fromLTRB(20, 0, 20, 4),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            if (widget.view.restricted) _RestrictedNote(),
                            // Name + age
                            Row(
                              crossAxisAlignment: CrossAxisAlignment.baseline,
                              textBaseline: TextBaseline.alphabetic,
                              children: [
                                Expanded(
                                  child: Text(
                                    widget.view.fullName,
                                    maxLines: 1,
                                    overflow: TextOverflow.ellipsis,
                                    style: editorial(30,
                                            weight: FontWeight.w700)
                                        .copyWith(color: Colors.white),
                                  ),
                                ),
                                if (age != null) ...[
                                  const SizedBox(width: 8),
                                  Text('$age',
                                      style: editorial(26,
                                              weight: FontWeight.w700)
                                          .copyWith(
                                              color: Colors.white
                                                  .withValues(alpha: 0.92))),
                                ],
                              ],
                            ),
                            const SizedBox(height: 8),
                            // Location + gender
                            Row(
                              children: [
                                Expanded(
                                  child: Text(
                                    _formatLocation(widget.view.location),
                                    maxLines: 1,
                                    overflow: TextOverflow.ellipsis,
                                    style: inter(14,
                                        weight: FontWeight.w500,
                                        color: Colors.white
                                            .withValues(alpha: 0.85),
                                        height: 1.3),
                                  ),
                                ),
                                if (widget.view.gender != null) ...[
                                  const SizedBox(width: 8),
                                  MediaBadge(label: widget.view.gender!),
                                ],
                              ],
                            ),
                            if (widget.view.verified ||
                                widget.view.isPremium) ...[
                              const SizedBox(height: 10),
                              TrustRow(
                                primary: widget.view.verified
                                    ? 'ID verified'
                                    : 'Vetted member',
                                secondary: widget.view.isPremium
                                    ? 'Premium'
                                    : null,
                              ),
                            ],
                            if (widget.view.headline != null) ...[
                              const SizedBox(height: 16),
                              Text(widget.view.headline!,
                                  style: editorial(19, weight: FontWeight.w700)
                                      .copyWith(color: Colors.white)),
                            ],
                            if (widget.view.bio != null) ...[
                              const SizedBox(height: 8),
                              Text(widget.view.bio!,
                                  style: inter(14,
                                      weight: FontWeight.w400,
                                      color: Colors.white
                                          .withValues(alpha: 0.82),
                                      height: 1.5)),
                            ],
                            _DetailList(view: widget.view, onMedia: true),
                            const SizedBox(height: 4),
                          ],
                        ),
                      ),
                    ),

                    // 5. Actions — pinned over the bottom of the scrim.
                    _Actions(
                      busy: widget.busy,
                      onAct: widget.onAct,
                      onMessage: () =>
                          widget.onMessage(widget.view.userId),
                    ),
                    const SizedBox(height: 8),
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

/// 她说-style position dots: the active one stretches into a pill.
class _PhotoDots extends StatelessWidget {
  const _PhotoDots({required this.count, required this.index});
  final int count;
  final int index;

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        for (int i = 0; i < count; i++)
          AnimatedContainer(
            duration: NiaMotion.fast,
            margin: const EdgeInsets.symmetric(horizontal: 3),
            width: i == index ? 18 : 6,
            height: 6,
            decoration: BoxDecoration(
              color: i == index
                  ? Colors.white
                  : Colors.white.withValues(alpha: 0.4),
              borderRadius: BorderRadius.circular(NiaRadius.pill),
            ),
          ),
      ],
    );
  }
}

/// The same three bubbles as the deck, plus a full-width send-off. Repeating
/// the deck's vocabulary here is deliberate: one set of affordances, learned
/// once.
class _Actions extends StatelessWidget {
  const _Actions({
    required this.busy,
    required this.onAct,
    required this.onMessage,
  });

  final bool busy;
  final Future<void> Function(String) onAct;
  final VoidCallback onMessage;

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.center,
          crossAxisAlignment: CrossAxisAlignment.center,
          children: [
            ActionBubble(
              icon: Icons.close_rounded,
              tone: ActionTone.neutral,
              size: 58,
              semanticLabel: 'Pass',
              onTap: busy ? null : () => onAct('pass'),
            ),
            const SizedBox(width: 20),
            ActionBubble(
              icon: Icons.star_rounded,
              tone: ActionTone.gold,
              size: 52,
              semanticLabel: 'Superlike',
              busy: busy,
              onTap: busy ? null : () => onAct('superlike'),
            ),
            const SizedBox(width: 20),
            ActionBubble(
              icon: Icons.favorite_rounded,
              tone: ActionTone.brand,
              size: 68,
              semanticLabel: 'Like',
              onTap: busy ? null : () => onAct('like'),
            ),
          ],
        ),
        const SizedBox(height: 14),
        PillCta(
          label: 'Send a message',
          icon: Icons.chat_bubble_outline_rounded,
          expand: true,
          onPressed: busy ? null : onMessage,
        ),
      ],
    );
  }
}

class _PhotoPlaceholder extends StatelessWidget {
  const _PhotoPlaceholder();

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: const BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [AppColors.clayDark, AppColors.plum],
        ),
      ),
      child: Center(
        child: Icon(Icons.person_outline_rounded,
            size: 72, color: Colors.white.withValues(alpha: 0.4)),
      ),
    );
  }
}

class _DetailList extends StatelessWidget {
  const _DetailList({required this.view, this.onMedia = false});
  final ProfileRedNote view;
  final bool onMedia;

  @override
  Widget build(BuildContext context) {
    final items = <_DetailItem>[];

    if (view.nationality != null) {
      items.add(_DetailItem('Nationality', view.nationality!));
    }
    if (view.profession != null) {
      items.add(_DetailItem('Profession', view.profession!));
    }
    if (view.industry.isNotEmpty) {
      items.add(_DetailItem('Industry', view.industry.join(', ')));
    }
    if (view.educationLevel != null) {
      items.add(_DetailItem('Education', view.educationLevel!));
    }

    if (items.isEmpty) return const SizedBox.shrink();

    final labelColor = onMedia
        ? Colors.white.withValues(alpha: 0.6)
        : context.palette.muted;
    final valueColor =
        onMedia ? Colors.white.withValues(alpha: 0.95) : context.palette.ink;
    final hairline = onMedia
        ? Colors.white.withValues(alpha: 0.16)
        : context.palette.line;

    return Padding(
      padding: const EdgeInsets.only(top: 20),
      child: Column(
        children: [
          Container(height: 1, color: hairline),
          for (final item in items) ...[
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 13),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  SizedBox(
                    width: 104,
                    child: Text(item.label,
                        style: inter(13.5,
                            weight: FontWeight.w500, color: labelColor)),
                  ),
                  Expanded(
                    child: Text(item.value,
                        style: inter(14,
                            weight: FontWeight.w500,
                            color: valueColor,
                            height: 1.35)),
                  ),
                ],
              ),
            ),
            if (item != items.last) Container(height: 1, color: hairline),
          ],
          Container(height: 1, color: hairline),
          const SizedBox(height: 20),
        ],
      ),
    );
  }
}

class _RestrictedNote extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    final palette = context.palette;
    return Container(
      margin: const EdgeInsets.only(bottom: 16),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: palette.warnBg,
        borderRadius: BorderRadius.circular(NiaRadius.sm),
        border: Border.all(color: palette.warn.withValues(alpha: 0.35)),
      ),
      child: Text(
        'Some details are hidden because this member is Premium.',
        style: inter(12.5,
            weight: FontWeight.w500, color: palette.warn, height: 1.4),
      ),
    );
  }
}

class _DetailItem {
  const _DetailItem(this.label, this.value);
  final String label;
  final String value;
}
