import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:geolocator/geolocator.dart';
import 'package:go_router/go_router.dart';

import '../../../core/api/api_client.dart';
import '../../../core/services.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/widgets/app_widgets.dart';
import '../../../core/widgets/nia_kit.dart';
import '../data/discover_card.dart';
import 'discover_deck.dart';
import 'match_celebration.dart';
import 'nearby_section.dart';
import '../../matches/presentation/matches_screen.dart';
import 'red_note_modal.dart';

enum DiscoverMode { discover, nearby, matches }

class DiscoverScreen extends StatefulWidget {
  const DiscoverScreen({super.key});

  @override
  State<DiscoverScreen> createState() => _DiscoverScreenState();
}

class _DiscoverScreenState extends State<DiscoverScreen> {
  DiscoverMode _mode = DiscoverMode.discover;
  int _superCount = 0;
  bool _superLoading = false;

  // Discover state
  List<DiscoverCard> _discoverDeck = [];
  bool _discoverLoading = true;
  String? _discoverError;

  // Nearby state
  List<NearbyProfile> _nearbyProfiles = [];
  bool _nearbyLoading = false;
  String? _nearbyError;
  bool? _nearbyOptIn;
  bool _locBusy = false;
  Map<String, dynamic>? _subscription;

  // RedNote modal
  ProfileRedNote? _redNote;
  bool _redNoteLoading = false;
  String? _redNoteError;
  DiscoverMode? _redNoteSource;
  String? _unvettedGate;

  // Match celebration
  String? _celebrateUserId;

  @override
  void initState() {
    super.initState();
    _loadSuperCount();
    _loadDiscover();
  }

  Future<void> _loadSuperCount() async {
    if (_superLoading) return;
    setState(() => _superLoading = true);
    try {
      final data = await AppServices.matches.getSuperlikesReceived();
      if (mounted) {
        setState(() => _superCount = data['count'] as int? ?? 0);
      }
    } catch (_) {
      // Ignore
    } finally {
      if (mounted) setState(() => _superLoading = false);
    }
  }

  /// One place turns exceptions into copy a member can act on — raw exception
  /// text never reaches the UI.
  String _friendlyError(Object e) {
    if (e is ApiFailure) return e.message;
    final raw = e
        .toString()
        .replaceFirst(RegExp(r'^(Exception|ApiFailure):\s*'), '')
        .trim();
    final lower = raw.toLowerCase();
    if (lower.contains('socket') ||
        lower.contains('connection') ||
        lower.contains('network') ||
        lower.contains('failed host lookup')) {
      return 'You seem to be offline. Check your connection and try again.';
    }
    if (lower.contains('timeout')) {
      return 'This took too long to load. The API may be waking up — try again in a moment.';
    }
    if (lower.contains('404') || lower.contains('not found')) {
      return 'That member is no longer available.';
    }
    if (raw.isEmpty) return 'Something went wrong. Please try again.';
    return raw;
  }

  Future<void> _loadDiscover() async {
    setState(() {
      _discoverLoading = true;
      _discoverError = null;
    });
    try {
      final cards = await AppServices.discover.getDiscover(limit: 20);
      if (mounted) {
        setState(() {
          _discoverDeck = cards;
          _discoverLoading = false;
        });
        if (cards.isNotEmpty) {
          AppServices.api.trackProfileView(cards.first.userId);
        }
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _discoverError = _friendlyError(e);
          _discoverLoading = false;
        });
      }
    }
  }

  Future<void> _loadNearby() async {
    setState(() {
      _nearbyLoading = true;
      _nearbyError = null;
    });
    try {
      final results = await Future.wait([
        AppServices.api
            .get<dynamic>('/billing/subscription')
            .catchError((_) => null),
        AppServices.nearby.getNearbyStatus(),
      ]);
      final sub = results[0] as Map<String, dynamic>?;
      final me = results[1] as Map<String, dynamic>;
      final nearbyEnabled = me['nearbyEnabled'] as bool? ?? false;

      if (mounted) {
        setState(() {
          _subscription = sub;
          _nearbyOptIn = nearbyEnabled;
          _nearbyLoading = false;
        });
      }

      if (!nearbyEnabled) {
        if (mounted) setState(() => _nearbyProfiles = []);
        return;
      }

      final profiles = await AppServices.nearby.getNearby();
      if (mounted) {
        setState(() => _nearbyProfiles = profiles);
        if (profiles.isNotEmpty) {
          AppServices.api.trackProfileView(profiles.first.userId);
        }
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _nearbyError = _friendlyError(e);
          _nearbyProfiles = [];
          _nearbyLoading = false;
        });
      }
    }
  }

  Future<void> _shareLocation() async {
    if (_locBusy) return;
    setState(() => _locBusy = true);
    try {
      // Skip location features on web for now
      if (kIsWeb) {
        throw Exception(
            'Location sharing is not available on web. Please use the mobile app.');
      }

      final permission = await Geolocator.checkPermission();
      if (permission == LocationPermission.denied) {
        final requested = await Geolocator.requestPermission();
        if (requested == LocationPermission.denied) {
          throw Exception(
              'Location permission was denied. Enable it in your device settings, then try again.');
        }
      }
      if (permission == LocationPermission.deniedForever) {
        throw Exception(
            'Location permission is permanently denied. Enable it in your device settings.');
      }

      final position = await Geolocator.getCurrentPosition(
        locationSettings: const LocationSettings(
          accuracy: LocationAccuracy.high,
          timeLimit: Duration(seconds: 10),
        ),
      );

      await AppServices.nearby.shareLocation(
        latitude: position.latitude,
        longitude: position.longitude,
      );

      if (mounted) {
        setState(() => _nearbyOptIn = true);
        await _loadNearby();
      }
    } catch (e) {
      final msg = _geolocationMessage(e);
      if (mounted) {
        setState(() => _nearbyError = msg);
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text(msg)));
      }
    } finally {
      if (mounted) setState(() => _locBusy = false);
    }
  }

  String _geolocationMessage(dynamic e) {
    if (e is ApiFailure) return e.message;
    if (e is Exception) {
      final msg = e.toString();
      if (msg.contains('denied') || msg.contains('permission')) {
        return 'Location permission was denied. Enable it in your device settings, then try again.';
      }
      if (msg.contains('timeout')) {
        return 'Your device took too long to find your location. Check your signal and try again.';
      }
      if (msg.contains('unavailable')) {
        return 'Location is unavailable right now. We\'ll still show members in your city.';
      }
      return msg.replaceFirst('Exception: ', '');
    }
    return 'Could not get your location.';
  }

  Future<void> _forgetLocation() async {
    if (_locBusy) return;
    setState(() => _locBusy = true);
    try {
      await AppServices.nearby.forgetLocation();
      if (mounted) {
        setState(() {
          _nearbyOptIn = false;
          _nearbyProfiles = [];
        });
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(_friendlyError(e))),
        );
      }
    } finally {
      if (mounted) setState(() => _locBusy = false);
    }
  }

  Future<void> _actOnDiscover(DiscoverCard card, String action) async {
    try {
      final result = await AppServices.matches.act(card.userId, action);
      if (result['mutual'] == true) {
        _showCelebration(card.userId);
      } else if (action == 'superlike') {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(
                content: Text(
                    'Superlike sent — they\'ll see it when they discover you')),
          );
        }
      }
      _loadSuperCount();
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(_friendlyError(e))),
        );
      }
    }
  }

  Future<void> _actOnNearby(NearbyProfile profile, String action) async {
    try {
      final result = await AppServices.matches.act(profile.userId, action);
      if (result['mutual'] == true) {
        _showCelebration(profile.userId);
      }
      _loadSuperCount();
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(_friendlyError(e))),
        );
      }
    }
  }

  void _showCelebration(String userId) {
    setState(() => _celebrateUserId = userId);
  }

  void _closeCelebration() {
    setState(() => _celebrateUserId = null);
  }

  Future<void> _openRedNote(String userId,
      {required DiscoverMode source}) async {
    // Check if user is vetted (can connect)
    final stage = await AppServices.auth.getVettingStage();
    final canConnect = stage == 'approved';

    if (!canConnect) {
      setState(() => _unvettedGate = userId);
      return;
    }

    setState(() {
      _redNoteLoading = true;
      _redNoteError = null;
      _redNoteSource = source;
    });

    try {
      final view = await AppServices.discover.getProfile(userId);
      if (mounted) {
        setState(() {
          _redNote = view;
          _redNoteLoading = false;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _redNoteError = _friendlyError(e);
          _redNoteLoading = false;
        });
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(_friendlyError(e))),
        );
      }
    }
  }

  void _closeRedNote() {
    setState(() {
      _redNote = null;
      _redNoteSource = null;
      _redNoteError = null;
    });
  }

  Future<void> _handleRedNoteAction(String action) async {
    if (_redNote == null || _redNoteSource == null) return;
    try {
      if (_redNoteSource == DiscoverMode.nearby) {
        final profile =
            _nearbyProfiles.firstWhere((p) => p.userId == _redNote!.userId);
        await _actOnNearby(profile, action);
      } else {
        final card =
            _discoverDeck.firstWhere((c) => c.userId == _redNote!.userId);
        await _actOnDiscover(card, action);
      }
      _closeRedNote();
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(_friendlyError(e))),
        );
      }
    }
  }

  Future<void> _startChat(String userId) async {
    try {
      final conversationId = await AppServices.chat.createConversation(userId);
      if (mounted) {
        context.go('/messages?conversation=$conversationId');
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(_friendlyError(e))),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Stack(
        children: [
          // Main content
          CustomScrollView(
            slivers: [
              SliverToBoxAdapter(
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(20, 8, 20, 24),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      // 她说-style header: the mode switch is the hero, the brand
                      // line a quiet echo beneath it. No heavy editorial headline —
                      // the card itself carries the voice.
                      Center(
                        child: _ModeTabs(
                          mode: _mode,
                          onChanged: (mode) {
                            setState(() => _mode = mode);
                            if (mode == DiscoverMode.nearby) _loadNearby();
                          },
                        ),
                      ),
                      const SizedBox(height: 12),
                      Center(
                        child: Text(
                          'Love, with intention.',
                          style: editorial(18, weight: FontWeight.w700)
                              .copyWith(
                                  color: context.palette.muted, height: 1.2),
                        ),
                      ),
                      if (_superCount > 0) ...[
                        const SizedBox(height: 12),
                        Center(child: _SuperlikeBadge(count: _superCount)),
                      ],
                      const SizedBox(height: 20),

                      // Content based on mode
if (_mode == DiscoverMode.discover) ...[
                _buildDiscoverContent(),
              ] else if (_mode == DiscoverMode.nearby) ...[
                _buildNearbyContent(),
              ] else ...[
                const SizedBox(
                  height: 760,
                  child: MatchesScreen(),
                ),
              ],
                    ],
                  ),
                ),
              ),
            ],
          ),

          // RedNote Modal
          if (_redNoteLoading) _LoadingOverlay(),
          if (_redNoteError != null)
            _ErrorOverlay(
                message: _redNoteError!,
                onRetry: () =>
                    _openRedNote(_redNote!.userId, source: _redNoteSource!)),
          if (_redNote != null)
            RedNoteModal(
              view: _redNote!,
              busy: false,
              onAct: _handleRedNoteAction,
              onMessage: _startChat,
              onClose: _closeRedNote,
            ),

          // Unvetted gate
          if (_unvettedGate != null)
            _UnvettedGate(
              onClose: () => setState(() => _unvettedGate = null),
            ),

          // Match celebration
          if (_celebrateUserId != null)
            MatchCelebration(
              userId: _celebrateUserId!,
              onClose: _closeCelebration,
              onMessage: _startChat,
            ),
        ],
      ),
    );
  }

  Widget _buildDiscoverContent() {
    if (_discoverLoading && _discoverDeck.isEmpty) {
      return const _DiscoverSkeletonGrid();
    }

    if (_discoverError != null) {
      return _ErrorState(
        message: _discoverError!,
        onRetry: _loadDiscover,
      );
    }

    if (_discoverDeck.isEmpty) {
      return _EmptyState(
        title: 'No introductions right now',
        message: 'Check back soon — new vetted members join every day.',
        actionLabel: 'See who liked you',
        onAction: () => context.go('/matches'),
      );
    }

    return Column(
      children: [
        DiscoverDeck(
          cards: _discoverDeck,
          onAction: _actOnDiscover,
          onReload: _loadDiscover,
        ),
        const SizedBox(height: 20),
        _NearbyOptInCard(
          enabled: _nearbyOptIn ?? false,
          onTap: () => setState(() => _mode = DiscoverMode.nearby),
        ),
      ],
    );
  }

  Widget _buildNearbyContent() {
    if (_nearbyLoading && _nearbyProfiles.isEmpty && _nearbyOptIn != false) {
      return const _DiscoverSkeletonGrid();
    }

    return Column(
      children: [
        // Location card
        SurfaceCard(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'Your location',
                style: editorial(18, weight: FontWeight.w700),
              ),
              const SizedBox(height: 12),
              if (_nearbyOptIn == true) ...[
                Text(
                  'You\'re sharing your location. We surface vetted members in your area.',
                  style: TextStyle(color: context.palette.muted, height: 1.4),
                ),
                const SizedBox(height: 12),
                OutlinedButton(
                  onPressed: _locBusy ? null : _forgetLocation,
                  child: Text(_locBusy ? 'Working…' : 'Forget my location'),
                ),
              ] else ...[
                Text(
                  'Share your location to see vetted members around you. '
                  'We delete your coordinates the moment you turn it off.',
                  style: TextStyle(color: context.palette.muted, height: 1.4),
                ),
                const SizedBox(height: 12),
                FilledButton(
                  onPressed: _locBusy ? null : _shareLocation,
                  child: Text(_locBusy ? 'Locating…' : 'Share my location'),
                ),
              ],
            ],
          ),
        ),
        const SizedBox(height: 20),

        // Nearby profiles
        if (_nearbyOptIn == true) ...[
          if (_nearbyError != null)
            _ErrorState(
              message: _nearbyError!,
              onRetry: _loadNearby,
            )
          else if (_nearbyProfiles.isEmpty)
            _EmptyState(
              title: 'No one nearby',
              message: 'No vetted members in your area yet.',
              actionLabel: 'Check again',
              onAction: _loadNearby,
            )
          else
            NearbySection(
              profiles: _nearbyProfiles,
              onCardTap: (profile) =>
                  _openRedNote(profile.userId, source: DiscoverMode.nearby),
              onReload: _loadNearby,
              subscription: _subscription,
            ),
        ],
      ],
    );
  }
}

class _SuperlikeBadge extends StatelessWidget {
  const _SuperlikeBadge({required this.count});
  final int count;

  @override
  Widget build(BuildContext context) => Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
        decoration: BoxDecoration(
          color: AppColors.gold.withValues(alpha: 0.15),
          borderRadius: BorderRadius.circular(NiaRadius.pill),
          border: Border.all(color: AppColors.gold),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.star, color: AppColors.gold, size: 16),
            const SizedBox(width: 4),
            Text(
              '$count new ${count == 1 ? 'superlike' : 'superlikes'}',
              style: const TextStyle(
                color: AppColors.gold,
                fontWeight: FontWeight.w700,
                fontSize: 12,
              ),
            ),
          ],
        ),
      );
}

class _ModeTabs extends StatelessWidget {
  const _ModeTabs({required this.mode, required this.onChanged});
  final DiscoverMode mode;
  final ValueChanged<DiscoverMode> onChanged;

  @override
  Widget build(BuildContext context) {
    // A single sliding segmented control rather than two boxy tabs — the
    // reference behaviour for a mutually exclusive pair (DESIGN_INSPIRATIONS §2).
    return SegmentedPill<DiscoverMode>(
      selected: mode,
      onChanged: onChanged,
      options: const [
  SegmentedOption(value: DiscoverMode.discover, label: 'Curated matches'),
  SegmentedOption(value: DiscoverMode.nearby, label: 'Nearby'),
  SegmentedOption(value: DiscoverMode.matches, label: 'Matches'),
      ],
    );
  }
}

class _DiscoverSkeletonGrid extends StatelessWidget {
  const _DiscoverSkeletonGrid();

  @override
  Widget build(BuildContext context) {
    // A single tall shimmer shaped like the collapsed profile card — the deck's
    // first card is what will arrive, so the placeholder foreshadows it rather
    // than implying a grid. 她说 loads one big card, not a wall of tiles.
    final viewport =
        (MediaQuery.sizeOf(context).height * 0.62).clamp(380.0, 560.0);
    return ShimmerBlock(height: viewport, radius: NiaRadius.xl);
  }
}

class _ErrorState extends StatelessWidget {
  const _ErrorState({required this.message, required this.onRetry});
  final String message;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    return SurfaceCard(
      child: Column(
        children: [
          Text(message, style: TextStyle(color: context.palette.muted)),
          const SizedBox(height: 12),
          FilledButton(onPressed: onRetry, child: const Text('Retry')),
        ],
      ),
    );
  }
}

class _EmptyState extends StatelessWidget {
  const _EmptyState({
    required this.title,
    required this.message,
    required this.actionLabel,
    required this.onAction,
  });

  final String title;
  final String message;
  final String actionLabel;
  final VoidCallback onAction;

  @override
  Widget build(BuildContext context) {
    final palette = context.palette;
    // 她说-style empty state: a single calm icon, centered, never a busy card.
    return Center(
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 32, vertical: 40),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 72,
              height: 72,
              decoration: BoxDecoration(
                color: palette.brandSoft,
                shape: BoxShape.circle,
              ),
              child: Icon(Icons.favorite_border_rounded,
                  size: 32, color: palette.brandOn),
            ),
            const SizedBox(height: 20),
            Text(title,
                style: editorial(22, weight: FontWeight.w700),
                textAlign: TextAlign.center),
            const SizedBox(height: 8),
            Text(message,
                style: TextStyle(color: palette.muted, height: 1.5),
                textAlign: TextAlign.center),
            const SizedBox(height: 22),
            FilledButton(onPressed: onAction, child: Text(actionLabel)),
          ],
        ),
      ),
    );
  }
}

class _NearbyOptInCard extends StatelessWidget {
  const _NearbyOptInCard({required this.enabled, required this.onTap});
  final bool enabled;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return SurfaceCard(
      child: Row(
        children: [
          Icon(Icons.location_on_outlined,
              color: Theme.of(context).colorScheme.primary, size: 28),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  enabled ? 'Nearby is on' : 'Nearby introductions',
                  style: const TextStyle(fontWeight: FontWeight.w700),
                ),
                const SizedBox(height: 3),
                Text(
                  enabled
                      ? 'You\'re seeing vetted members around you.'
                      : 'Opt in to see vetted members near you.',
                  style: TextStyle(
                      color: context.palette.muted, fontSize: 12, height: 1.4),
                ),
              ],
            ),
          ),
          TextButton(
              onPressed: onTap, child: Text(enabled ? 'Manage' : 'Explore')),
        ],
      ),
    );
  }
}

class _LoadingOverlay extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return Container(
      color: Colors.black.withValues(alpha: 0.3),
      child: const Center(child: CircularProgressIndicator()),
    );
  }
}

class _ErrorOverlay extends StatelessWidget {
  const _ErrorOverlay({required this.message, required this.onRetry});
  final String message;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    return Container(
      color: Colors.black.withValues(alpha: 0.5),
      child: Center(
        child: Container(
          margin: const EdgeInsets.all(24),
          padding: const EdgeInsets.all(24),
          decoration: BoxDecoration(
            color: context.palette.surface,
            borderRadius: BorderRadius.circular(NiaRadius.xl),
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(message,
                  style: TextStyle(color: context.palette.ink),
                  textAlign: TextAlign.center),
              const SizedBox(height: 16),
              SizedBox(
                width: double.infinity,
                child: FilledButton(
                    onPressed: onRetry, child: const Text('Try again')),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _UnvettedGate extends StatelessWidget {
  const _UnvettedGate({required this.onClose});
  final VoidCallback onClose;

  @override
  Widget build(BuildContext context) {
    return Container(
      color: Colors.black.withValues(alpha: 0.5),
      child: Center(
        child: Container(
          margin: const EdgeInsets.all(24),
          padding: const EdgeInsets.all(24),
          decoration: BoxDecoration(
            color: context.palette.surface,
            borderRadius: BorderRadius.circular(NiaRadius.xl),
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text('Almost there',
                  style: editorial(22, weight: FontWeight.w700)),
              const SizedBox(height: 12),
              Text(
                'You can preview members while your profile is being '
                'verified. Once you\'re vetted, profiles open up and you '
                'can like, match and message.',
                style: TextStyle(color: context.palette.muted),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 20),
              SizedBox(
                width: double.infinity,
                child: FilledButton(
                    onPressed: onClose, child: const Text('Got it')),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
