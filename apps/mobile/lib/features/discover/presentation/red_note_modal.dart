import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../../core/theme/app_theme.dart';
import '../../../core/widgets/app_widgets.dart';
import '../../../core/widgets/nia_kit.dart';
import '../data/discover_card.dart';

/// The full profile sheet.
///
/// Redesigned against `DESIGN_INSPIRATIONS.md` (refs 2 + 5): the member's name
/// and headline now sit **on** the photograph behind a scrim, exactly as they
/// do in the reference profile screen, instead of being repeated in a second
/// block below it. The sheet rises rather than fading, and the three swipe
/// actions are the same bubbles used on the deck — so a member learns the
/// vocabulary once and it holds everywhere.
class RedNoteModal extends StatefulWidget {
  const RedNoteModal({
    super.key,
    required this.view,
    required this.canConnect,
    required this.busy,
    required this.onAct,
    required this.onMessage,
    required this.onClose,
  });

  final ProfileRedNote view;
  final bool canConnect;
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
    // One gesture: the sheet rises and dims the world simultaneously.
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

  void _goPhoto(int delta) {
    final photos = widget.view.photos;
    if (photos.isEmpty) return;
    final newIndex = (_photoIndex + delta + photos.length) % photos.length;
    _pageController.animateToPage(
      newIndex,
      duration: NiaMotion.enter,
      curve: NiaMotion.easeOut,
    );
  }

  @override
  Widget build(BuildContext context) {
    final photos = widget.view.photos;
    final palette = context.palette;

    return AnnotatedRegion<SystemUiOverlayStyle>(
      value: SystemUiOverlayStyle.light,
      child: GestureDetector(
        onTap: widget.onClose,
        child: Container(
          color: Colors.black.withValues(alpha: 0.62),
          child: Align(
            alignment: Alignment.bottomCenter,
            child: GestureDetector(
              onTap: () {}, // Swallow taps so the sheet itself doesn't close.
              child: SlideTransition(
                position: Tween<Offset>(
                  begin: const Offset(0, 0.10),
                  end: Offset.zero,
                ).animate(
                    CurvedAnimation(parent: _rise, curve: NiaMotion.easeOut)),
                child: FadeTransition(
                  opacity: _rise,
                  child: Container(
                    width: double.infinity,
                    constraints: BoxConstraints(
                      maxHeight: MediaQuery.of(context).size.height * 0.92,
                    ),
                    decoration: BoxDecoration(
                      color: palette.surface,
                      borderRadius: const BorderRadius.vertical(
                          top: Radius.circular(NiaRadius.xxl)),
                      boxShadow: [
                        BoxShadow(
                          color: Colors.black.withValues(alpha: 0.3),
                          blurRadius: 40,
                          offset: const Offset(0, -16),
                        ),
                      ],
                    ),
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        _SheetGrabber(),
                        // The gallery starts below the grabber, clear of the
                        // sheet's rounded corners, so it needs no clipping.
                        Stack(
                          children: [
                            // Gallery
                            if (photos.isNotEmpty)
                              SizedBox(
                                height: 400,
                                child: PageView.builder(
                                  controller: _pageController,
                                  itemCount: photos.length,
                                  onPageChanged: (i) =>
                                      setState(() => _photoIndex = i),
                                  itemBuilder: (context, index) =>
                                      Image.network(
                                    photos[index],
                                    fit: BoxFit.cover,
                                    width: double.infinity,
                                    errorBuilder: (_, __, ___) =>
                                        const _PhotoPlaceholder(),
                                  ),
                                ),
                              )
                            else
                              const _PhotoPlaceholder(height: 400),

                            // Scrim — the name below is white on an unknown
                            // photograph, so this is not optional.
                            Positioned.fill(
                              child: DecoratedBox(
                                decoration: BoxDecoration(
                                  gradient: LinearGradient(
                                    begin: Alignment.topCenter,
                                    end: Alignment.bottomCenter,
                                    stops: NiaScrim.mediaStops,
                                    colors: NiaScrim.brandColors(
                                        AppColors.clayDark, AppColors.plum),
                                  ),
                                ),
                              ),
                            ),

                            // Chrome
                            Positioned(
                              top: 14,
                              left: 14,
                              child: CircleIconButton(
                                icon: Icons.close_rounded,
                                semanticLabel: 'Close profile',
                                onMedia: true,
                                onTap: widget.onClose,
                              ),
                            ),

                            if (photos.length > 1) ...[
                              Positioned(
                                top: 14,
                                right: 14,
                                child: _CounterPill(
                                    index: _photoIndex, total: photos.length),
                              ),
                              Positioned(
                                left: 10,
                                top: 0,
                                bottom: 0,
                                child: Center(
                                  child: CircleIconButton(
                                    icon: Icons.chevron_left_rounded,
                                    semanticLabel: 'Previous photo',
                                    onMedia: true,
                                    onTap: () => _goPhoto(-1),
                                  ),
                                ),
                              ),
                              Positioned(
                                right: 10,
                                top: 0,
                                bottom: 0,
                                child: Center(
                                  child: CircleIconButton(
                                    icon: Icons.chevron_right_rounded,
                                    semanticLabel: 'Next photo',
                                    onMedia: true,
                                    onTap: () => _goPhoto(1),
                                  ),
                                ),
                              ),
                            ],

                            // Identity, on the photograph.
                            Positioned(
                              left: 20,
                              right: 20,
                              bottom: 18,
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                  Text(
                                    widget.view.fullName,
                                    maxLines: 1,
                                    overflow: TextOverflow.ellipsis,
                                    style:
                                        editorial(30, weight: FontWeight.w700)
                                            .copyWith(color: Colors.white),
                                  ),
                                  const SizedBox(height: 6),
                                  Row(
                                    children: [
                                      Expanded(
                                        child: Text(
                                          _formatLocation(widget.view.location),
                                          maxLines: 1,
                                          overflow: TextOverflow.ellipsis,
                                          style: inter(13.5,
                                              weight: FontWeight.w500,
                                              color: Colors.white
                                                  .withValues(alpha: 0.82),
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
                                ],
                              ),
                            ),
                          ],
                        ),

                        Flexible(
                          child: SingleChildScrollView(
                            padding: const EdgeInsets.fromLTRB(20, 18, 20, 0),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                if (widget.view.restricted) _RestrictedNote(),
                                if (widget.view.headline != null) ...[
                                  const SizedBox(height: 4),
                                  Text(widget.view.headline!,
                                      style: editorial(19,
                                          weight: FontWeight.w700)),
                                ],
                                if (widget.view.bio != null) ...[
                                  const SizedBox(height: 8),
                                  Text(widget.view.bio!,
                                      style: inter(14,
                                          weight: FontWeight.w400,
                                          color: palette.inkSoft,
                                          height: 1.5)),
                                ],
                                _DetailList(view: widget.view),
                                const SizedBox(height: 4),
                                Wrap(
                                  spacing: 8,
                                  runSpacing: 8,
                                  children: [
                                    if (widget.view.verified)
                                      StatusPill('Verified',
                                          tone: PillTone.good),
                                    if (widget.view.isPremium)
                                      StatusPill('Premium',
                                          tone: PillTone.brand),
                                  ],
                                ),
                                const SizedBox(height: 24),
                                _Actions(
                                  canConnect: widget.canConnect,
                                  busy: widget.busy,
                                  onAct: widget.onAct,
                                  onMessage: () =>
                                      widget.onMessage(widget.view.userId),
                                  onClose: widget.onClose,
                                ),
                                SizedBox(
                                    height:
                                        MediaQuery.of(context).padding.bottom +
                                            16),
                              ],
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }

  String _formatLocation(ProfileLocation location) {
    if (location.district != null && location.district!.isNotEmpty) {
      return '${location.city} · ${location.district}';
    }
    return location.city;
  }
}

class _SheetGrabber extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return Container(
      width: 40,
      height: 4,
      margin: const EdgeInsets.only(top: 12, bottom: 10),
      decoration: BoxDecoration(
        color: context.palette.lineStrong,
        borderRadius: BorderRadius.circular(NiaRadius.pill),
      ),
    );
  }
}

class _CounterPill extends StatelessWidget {
  const _CounterPill({required this.index, required this.total});
  final int index;
  final int total;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
      decoration: BoxDecoration(
        color: Colors.black.withValues(alpha: 0.5),
        borderRadius: BorderRadius.circular(NiaRadius.pill),
        border: Border.all(color: Colors.white.withValues(alpha: 0.18)),
      ),
      child: Text('${index + 1} / $total',
          style: inter(12,
              weight: FontWeight.w600, color: Colors.white, height: 1.2)),
    );
  }
}

/// The same three bubbles as the deck, plus a full-width send-off. Repeating
/// the deck's vocabulary here is deliberate: one set of affordances, learned
/// once.
class _Actions extends StatelessWidget {
  const _Actions({
    required this.canConnect,
    required this.busy,
    required this.onAct,
    required this.onMessage,
    required this.onClose,
  });

  final bool canConnect;
  final bool busy;
  final Future<void> Function(String) onAct;
  final VoidCallback onMessage;
  final VoidCallback onClose;

  @override
  Widget build(BuildContext context) {
    if (!canConnect) {
      return Column(
        children: [
          PillCta(
            label: 'Get vetted to connect',
            icon: Icons.verified_user_outlined,
            expand: true,
            onPressed: onClose,
          ),
          const SizedBox(height: 10),
          GhostButton(
            label: 'Not now',
            expand: true,
            onPressed: onClose,
          ),
        ],
      );
    }

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
        const SizedBox(height: 22),
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
  const _PhotoPlaceholder({this.height = 220});
  final double height;

  @override
  Widget build(BuildContext context) {
    return Container(
      height: height,
      decoration: const BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [AppColors.clayDark, AppColors.plum],
        ),
      ),
      child: Center(
        child: Icon(Icons.person_outline_rounded,
            size: 64, color: Colors.white.withValues(alpha: 0.4)),
      ),
    );
  }
}

class _DetailList extends StatelessWidget {
  const _DetailList({required this.view});
  final ProfileRedNote view;

  @override
  Widget build(BuildContext context) {
    final palette = context.palette;
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
    if (view.dateOfBirth != null) {
      final date = DateTime.tryParse(view.dateOfBirth!);
      if (date != null) {
        items
            .add(_DetailItem('Born', '${date.day}/${date.month}/${date.year}'));
      }
    }

    if (items.isEmpty) return const SizedBox.shrink();

    return Padding(
      padding: const EdgeInsets.only(top: 20),
      child: Column(
        children: [
          const Hairline(),
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
                            weight: FontWeight.w500, color: palette.muted)),
                  ),
                  Expanded(
                    child: Text(item.value,
                        style: inter(14,
                            weight: FontWeight.w500,
                            color: palette.ink,
                            height: 1.35)),
                  ),
                ],
              ),
            ),
            if (item != items.last) const Hairline(),
          ],
          const Hairline(),
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
              'Some details are hidden because this member is Premium.',
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

class _DetailItem {
  const _DetailItem(this.label, this.value);
  final String label;
  final String value;
}
