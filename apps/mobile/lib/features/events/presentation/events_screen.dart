import 'package:flutter/material.dart';

import '../../../core/services.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/widgets/app_widgets.dart';
import '../../../core/widgets/nia_kit.dart';
import '../data/event_repository.dart';

class EventsScreen extends StatefulWidget {
  const EventsScreen({super.key});

  @override
  State<EventsScreen> createState() => _EventsScreenState();
}

class _EventsScreenState extends State<EventsScreen> {
  static List<EventItem> get previewEvents => <EventItem>[
        EventItem(
            id: 'preview-founders-table',
            title: 'The Founders Table',
            description:
                'An intimate dinner for builders shaping the next chapter.',
            eventType: 'Dinner',
            city: 'Johannesburg',
            venueName: 'Rosebank, shared after RSVP',
            startTime: _october,
            endTime: _octoberEnd,
            capacity: 24,
            ticketPrice: 0,
            attendeeCount: 17,
            featured: true),
        EventItem(
            id: 'preview-studio-walk',
            title: 'Sunday Studio Walk',
            description:
                'A slow morning through art, design, and good conversation.',
            eventType: 'Culture',
            city: 'Cape Town',
            venueName: 'Woodstock, shared after RSVP',
            startTime: _november,
            endTime: _novemberEnd,
            capacity: 18,
            ticketPrice: 0,
            attendeeCount: 11,
            featured: false),
        EventItem(
            id: 'preview-ambition',
            title: 'Conversations on Ambition',
            description:
                'A bright salon for honest stories about work and purpose.',
            eventType: 'Salon',
            city: 'Pretoria',
            venueName: 'Arcadia, shared after RSVP',
            startTime: _novemberLate,
            endTime: _novemberLateEnd,
            capacity: 30,
            ticketPrice: 0,
            attendeeCount: 21,
            featured: false),
      ];

  List<EventItem> events = const [];
  bool loading = true;
  String? error;

  @override
  void initState() {
    super.initState();
    loadEvents();
  }

  Future<void> loadEvents() async {
    setState(() {
      loading = true;
      error = null;
    });
    try {
      final result = await AppServices.events.upcoming();
      if (mounted) setState(() => events = result);
    } catch (exception) {
      if (mounted) {
        setState(() {
          error = exception.toString();
          events = previewEvents;
        });
      }
    } finally {
      if (mounted) setState(() => loading = false);
    }
  }

  Future<void> openEvent(EventItem event) async {
    var selected = event;
    if (!event.id.startsWith('preview-')) {
      try {
        selected = await AppServices.events.detail(event.id);
      } catch (_) {
        if (!mounted) return;
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
            content: Text('Event details are unavailable right now.')));
      }
    }
    if (!mounted) return;
    await showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => _EventDetailSheet(event: selected),
    );
  }

  @override
  Widget build(BuildContext context) => ListView(
        padding: const EdgeInsets.fromLTRB(20, 4, 20, 28),
        children: [
          Container(
            padding: const EdgeInsets.fromLTRB(18, 20, 18, 18),
            decoration: BoxDecoration(
              gradient: LinearGradient(
                colors: [context.palette.brandSoft, context.palette.surfaceRaised],
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
              ),
              borderRadius: BorderRadius.circular(NiaRadius.lg),
              border: Border.all(color: context.palette.line),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Icon(Icons.local_activity_outlined,
                    color: context.palette.brand, size: 26),
                const SizedBox(height: 14),
                Text('Find your people\nin the real world.',
                    style: editorial(34, weight: FontWeight.w700)
                        .copyWith(height: 1.04)),
                const SizedBox(height: 10),
                Text('Small rooms, good energy, and invitations worth accepting.',
                    style: inter(14,
                        weight: FontWeight.w400,
                        color: context.palette.muted,
                        height: 1.45)),
              ],
            ),
          ),
          const SizedBox(height: 26),
          if (loading) const _EventLoadingState(),
          if (!loading && error != null) _EventErrorState(onRetry: loadEvents),
          if (!loading && events.isEmpty) const _EventEmptyState(),
          if (!loading)
            ...events.map((event) =>
                _EventCard(event: event, onTap: () => openEvent(event))),
        ],
      );
}

// `DateTime` has no const constructor in Dart, so these cannot be `const`.
// They are local wall-clock times: Africa/Johannesburg is UTC+2 year-round.
final _october = DateTime(2026, 10, 18, 19);
final _octoberEnd = DateTime(2026, 10, 18, 22);
final _november = DateTime(2026, 11, 2, 10, 30);
final _novemberEnd = DateTime(2026, 11, 2, 13);
final _novemberLate = DateTime(2026, 11, 14, 18, 30);
final _novemberLateEnd = DateTime(2026, 11, 14, 21);

/// The date tile carries the card: an oversized day numeral with the month
/// above it. This is the one place in the app where a *number* is the hero
/// rather than a name or a word (DESIGN_INSPIRATIONS §2, ref 1).
const LinearGradient _featuredGradient = LinearGradient(
  begin: Alignment.topLeft,
  end: Alignment.bottomRight,
  colors: [AppColors.clay, AppColors.clayDark],
);

class _DateTile extends StatelessWidget {
  const _DateTile({required this.date, required this.featured, this.size = 72});

  final DateTime date;
  final bool featured;
  final double size;

  @override
  Widget build(BuildContext context) {
    final palette = context.palette;
    final dayColor = featured ? Colors.white : palette.ink;
    final monthColor = featured ? Colors.white : palette.muted;

    return Container(
      width: size,
      padding: const EdgeInsets.symmetric(vertical: 10),
      decoration: BoxDecoration(
        // A BoxDecoration may not carry both a colour and a gradient, so the
        // featured tile expresses its fill through the gradient alone.
        color: featured ? null : palette.surfaceRaised,
        borderRadius: BorderRadius.circular(NiaRadius.sm),
        border: featured ? null : Border.all(color: palette.line),
        gradient: featured ? _featuredGradient : null,
      ),
      child: Column(
        children: [
          Text(_month(date),
              style: inter(10.5, weight: FontWeight.w700, color: monthColor)
                  .copyWith(letterSpacing: 1.1)),
          const SizedBox(height: 2),
          Text('${date.day}',
              style: numeral(size * 0.42, weight: FontWeight.w700)
                  .copyWith(color: dayColor)),
          const SizedBox(height: 1),
          Text(_time(date),
              style: inter(10.5, weight: FontWeight.w600, color: monthColor)
                  .copyWith(height: 1.1)),
        ],
      ),
    );
  }
}

class _EventCard extends StatelessWidget {
  const _EventCard({required this.event, required this.onTap});
  final EventItem event;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final palette = context.palette;
    final date = event.startTime;

    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: PressScale(
        onTap: onTap,
        child: SurfaceCard(
          padding: const EdgeInsets.all(14),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              _DateTile(date: date, featured: event.featured),
              const SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    if (event.featured)
                      const Padding(
                        padding: EdgeInsets.only(bottom: 5),
                        child: StatusPill('Featured', tone: PillTone.brand),
                      ),
                    Text(event.title,
                        style: editorial(21, weight: FontWeight.w700)),
                    const SizedBox(height: 6),
                    Row(
                      children: [
                        Flexible(
                          child: Text(event.city,
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: inter(12.5,
                                  weight: FontWeight.w500,
                                  color: palette.muted)),
                        ),
                        Padding(
                          padding: const EdgeInsets.symmetric(horizontal: 6),
                          child: Text('·',
                              style: inter(12.5, color: palette.lineStrong)),
                        ),
                        Text(event.eventType,
                            style: inter(12.5,
                                weight: FontWeight.w500, color: palette.muted)),
                      ],
                    ),
                    const SizedBox(height: 2),
                    const SizedBox(height: 10),
                    Row(
                      children: [
                        Expanded(
                          child: ClipRRect(
                            borderRadius: BorderRadius.circular(99),
                            child: LinearProgressIndicator(
                              minHeight: 6,
                              value: event.capacity == 0
                                  ? 0
                                  : (event.attendeeCount / event.capacity)
                                      .clamp(0.0, 1.0),
                              backgroundColor: palette.line,
                              valueColor: AlwaysStoppedAnimation(palette.brand),
                            ),
                          ),
                        ),
                        const SizedBox(width: 8),
                        Text('${event.attendeeCount}/${event.capacity}',
                            style: inter(11,
                                weight: FontWeight.w700,
                                color: palette.inkSoft)),
                      ],
                    ),
                  ],
                ),
              ),
              // The row itself is the affordance; a nested "View event" button
              // competed with the title for the same tap.
              Padding(
                padding: const EdgeInsets.only(top: 2),
                child: Icon(Icons.chevron_right_rounded,
                    color: palette.lineStrong, size: 22),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _EventDetailSheet extends StatefulWidget {
  const _EventDetailSheet({required this.event});
  final EventItem event;

  @override
  State<_EventDetailSheet> createState() => _EventDetailSheetState();
}

class _EventDetailSheetState extends State<_EventDetailSheet> {
  bool loading = false;
  bool rsvpd = false;
  String? feedback;

  Future<void> rsvp() async {
    if (widget.event.id.startsWith('preview-')) {
      setState(() {
        rsvpd = true;
        feedback = 'You are on the guest list for this preview event.';
      });
      return;
    }
    setState(() => loading = true);
    try {
      final result = await AppServices.events.rsvp(widget.event.id);
      if (mounted) {
        setState(() {
          rsvpd = true;
          feedback = result.waitlisted
              ? 'You are on the waitlist.'
              : 'You are on the guest list.';
        });
      }
    } catch (exception) {
      if (mounted) setState(() => feedback = exception.toString());
    } finally {
      if (mounted) setState(() => loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final event = widget.event;
    final palette = context.palette;

    return SafeArea(
      child: Padding(
        padding: const EdgeInsets.only(top: 12),
        child: Container(
          constraints: BoxConstraints(
              maxHeight: MediaQuery.of(context).size.height * 0.92),
          decoration: BoxDecoration(
            color: palette.surface,
            borderRadius: const BorderRadius.vertical(
                top: Radius.circular(NiaRadius.xxl)),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withValues(alpha: 0.24),
                blurRadius: 40,
                offset: const Offset(0, -12),
              ),
            ],
          ),
          child: SingleChildScrollView(
            padding: const EdgeInsets.fromLTRB(20, 8, 20, 0),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Center(
                  child: Container(
                    width: 40,
                    height: 4,
                    decoration: BoxDecoration(
                      color: palette.lineStrong,
                      borderRadius: BorderRadius.circular(NiaRadius.pill),
                    ),
                  ),
                ),
                const SizedBox(height: 24),

                // Date-as-hero, with the title beside it.
                Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    _DateTile(
                        date: event.startTime,
                        featured: event.featured,
                        size: 84),
                    const SizedBox(width: 16),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          if (event.featured)
                            const Padding(
                              padding: EdgeInsets.only(bottom: 6),
                              child:
                                  StatusPill('Featured', tone: PillTone.brand),
                            ),
                          Text(event.title,
                              style: editorial(26, weight: FontWeight.w700)
                                  .copyWith(height: 1.1)),
                          const SizedBox(height: 8),
                          Text(event.eventType,
                              style: inter(13,
                                  weight: FontWeight.w600,
                                  color: palette.inkSoft)),
                        ],
                      ),
                    ),
                  ],
                ),

                const SizedBox(height: 20),
                const Hairline(),
                _SheetRow(
                    label: 'Where',
                    valueText: '${event.city} — ${event.venueName}'),
                const Hairline(),
                _SheetRow(
                    label: 'When',
                    valueText:
                        '${_date(event.startTime)}, ${_time(event.startTime)} – ${_time(event.endTime)}'),
                const Hairline(),
                _SheetRow(
                    label: 'Attending',
                    valueText:
                        '${event.attendeeCount} of ${event.capacity} places taken'),
                const Hairline(),
                _SheetRow(
                    label: 'Entry',
                    valueText: event.ticketPrice == 0 ? 'Free' : 'Paid'),
                const Hairline(),

                const SizedBox(height: 20),
                Text(event.description,
                    style: inter(14,
                        weight: FontWeight.w400,
                        color: palette.inkSoft,
                        height: 1.55)),

                if (feedback != null) ...[
                  const SizedBox(height: 20),
                  Container(
                    width: double.infinity,
                    padding: const EdgeInsets.all(14),
                    decoration: BoxDecoration(
                      color: palette.successBg,
                      borderRadius: BorderRadius.circular(NiaRadius.sm),
                      border: Border.all(
                          color: palette.success.withValues(alpha: 0.35)),
                    ),
                    child: Text(feedback!,
                        style: inter(13,
                            weight: FontWeight.w600, color: palette.success)),
                  ),
                ],

                const SizedBox(height: 24),
                PillCta(
                  label: loading
                      ? 'Saving…'
                      : rsvpd
                          ? 'RSVP confirmed'
                          : 'RSVP for this event',
                  icon: rsvpd ? Icons.check_rounded : null,
                  expand: true,
                  busy: loading,
                  onPressed: loading || rsvpd ? null : rsvp,
                ),
                SizedBox(height: MediaQuery.of(context).padding.bottom + 20),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

/// A label / value pair divided by hairlines. On a bottom sheet over the light
/// canvas, hairlines separate cleanly whereas rows of tinted fills would not.
class _SheetRow extends StatelessWidget {
  const _SheetRow({required this.label, required this.valueText});
  final String label;
  final String valueText;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 14),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 96,
            child: Text(label,
                style: inter(13,
                    weight: FontWeight.w500, color: context.palette.muted)),
          ),
          Expanded(
            child: Text(valueText,
                style: inter(14,
                    weight: FontWeight.w500,
                    color: context.palette.ink,
                    height: 1.35)),
          ),
        ],
      ),
    );
  }
}

class _EventLoadingState extends StatelessWidget {
  const _EventLoadingState();
  @override
  Widget build(BuildContext context) => Column(
        children: List.generate(
          3,
          (index) => const Padding(
            padding: EdgeInsets.only(bottom: 12),
            child: ShimmerBlock(height: 132, radius: NiaRadius.md),
          ),
        ),
      );
}

class _EventEmptyState extends StatelessWidget {
  const _EventEmptyState();
  @override
  Widget build(BuildContext context) => SurfaceCard(
        padding: const EdgeInsets.all(24),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Icon(Icons.event_available_outlined,
                color: AppColors.clay, size: 30),
            const SizedBox(height: 12),
            Text('Nothing on the calendar yet',
                style: editorial(20, weight: FontWeight.w700)),
            const SizedBox(height: 8),
            Text(
              'Check back soon for the next considered gathering.',
              style: inter(13,
                  weight: FontWeight.w400,
                  color: context.palette.muted,
                  height: 1.45),
            ),
          ],
        ),
      );
}

class _EventErrorState extends StatelessWidget {
  const _EventErrorState({required this.onRetry});
  final VoidCallback onRetry;
  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.only(bottom: 12),
        child: SurfaceCard(
          padding: const EdgeInsets.all(14),
          child: Row(
            children: [
              const Icon(Icons.cloud_off_outlined, color: AppColors.clay),
              const SizedBox(width: 12),
              Expanded(
                child: Text(
                  'Live events unavailable. Showing the prototype calendar.',
                  style: inter(12.5,
                      weight: FontWeight.w500,
                      color: context.palette.muted,
                      height: 1.4),
                ),
              ),
              const SizedBox(width: 8),
              TextButton(
                onPressed: onRetry,
                child: Text('Retry', style: inter(13, weight: FontWeight.w700)),
              ),
            ],
          ),
        ),
      );
}

String _month(DateTime date) => const [
      'JAN',
      'FEB',
      'MAR',
      'APR',
      'MAY',
      'JUN',
      'JUL',
      'AUG',
      'SEP',
      'OCT',
      'NOV',
      'DEC'
    ][date.month - 1];
String _time(DateTime date) =>
    '${date.hour.toString().padLeft(2, '0')}:${date.minute.toString().padLeft(2, '0')}';
String _date(DateTime date) => '${date.day} ${_month(date)} ${date.year}';
