import 'package:flutter/material.dart';

import '../../../core/services.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/widgets/app_widgets.dart';
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
                'A warm salon for honest stories about work and purpose.',
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
          Text('Find your people\nin the real world.',
              style: editorial(31, weight: FontWeight.w700)),
          const SizedBox(height: 8),
          const Text(
              'Small rooms, good energy, and invitations worth accepting.',
              style: TextStyle(color: AppColors.muted, height: 1.45)),
          const SizedBox(height: 22),
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

class _EventCard extends StatelessWidget {
  const _EventCard({required this.event, required this.onTap});
  final EventItem event;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final date = event.startTime;
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: SurfaceCard(
        padding: const EdgeInsets.all(14),
        child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Container(
            width: 56,
            padding: const EdgeInsets.symmetric(vertical: 8),
            decoration: BoxDecoration(
                color: event.featured ? AppColors.plum : AppColors.boneDeep,
                borderRadius: BorderRadius.circular(12)),
            child: Column(children: [
              Text(_month(date),
                  style: TextStyle(
                      color: event.featured ? AppColors.bone : AppColors.muted,
                      fontSize: 11,
                      fontWeight: FontWeight.w700,
                      letterSpacing: 1)),
              const SizedBox(height: 3),
              Text('${date.day}',
                  style: TextStyle(
                      color: event.featured ? Colors.white : AppColors.ink,
                      fontSize: 24,
                      fontFamily: 'Fraunces',
                      fontWeight: FontWeight.w700)),
            ]),
          ),
          const SizedBox(width: 14),
          Expanded(
              child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                if (event.featured)
                  const Padding(
                      padding: EdgeInsets.only(bottom: 4),
                      child: StatusPill('Featured', tone: PillTone.brand)),
                Text(event.title,
                    style: editorial(21, weight: FontWeight.w700)),
                const SizedBox(height: 5),
                Text('${event.city} - ${_time(date)}',
                    style:
                        const TextStyle(color: AppColors.muted, fontSize: 12)),
                const SizedBox(height: 3),
                Text('${event.eventType} - ${event.capacity} places',
                    style: const TextStyle(
                        color: AppColors.inkSoft, fontSize: 12)),
                const SizedBox(height: 9),
                PressScale(
                  onTap: onTap,
                  child: Container(
                    padding:
                        const EdgeInsets.symmetric(horizontal: 14, vertical: 9),
                    decoration: BoxDecoration(
                        border: Border.all(color: AppColors.lineStrong),
                        borderRadius: BorderRadius.circular(99)),
                    child: const Text('View event',
                        style: TextStyle(
                            fontWeight: FontWeight.w700, fontSize: 12)),
                  ),
                ),
              ])),
        ]),
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
    return SafeArea(
        child: Padding(
      padding: const EdgeInsets.all(12),
      child: GlassSheet(
          child: Padding(
        padding: const EdgeInsets.fromLTRB(8, 8, 8, 12),
        child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Center(
                  child: Container(
                      width: 36,
                      height: 4,
                      decoration: BoxDecoration(
                          color: AppColors.lineStrong,
                          borderRadius: BorderRadius.circular(99)))),
              const SizedBox(height: 22),
              if (event.featured)
                const StatusPill('Featured', tone: PillTone.brand),
              const SizedBox(height: 8),
              Text(event.title, style: editorial(29, weight: FontWeight.w700)),
              const SizedBox(height: 8),
              Text('${event.city} - ${event.venueName}',
                  style: const TextStyle(
                      color: AppColors.inkSoft, fontWeight: FontWeight.w600)),
              const SizedBox(height: 4),
              Text('${_date(event.startTime)} - ${_time(event.startTime)}',
                  style: const TextStyle(color: AppColors.muted)),
              const SizedBox(height: 18),
              Text(event.description, style: const TextStyle(height: 1.5)),
              const SizedBox(height: 18),
              Row(children: [
                StatusPill('${event.attendeeCount}/${event.capacity} attending',
                    tone: PillTone.good),
                const SizedBox(width: 8),
                StatusPill(event.ticketPrice == 0 ? 'Free' : 'Paid')
              ]),
              if (feedback != null) ...[
                const SizedBox(height: 14),
                Text(feedback!,
                    style:
                        const TextStyle(color: AppColors.muted, fontSize: 12))
              ],
              const SizedBox(height: 18),
              SizedBox(
                  width: double.infinity,
                  child: FilledButton(
                      onPressed: loading || rsvpd ? null : rsvp,
                      child: Text(loading
                          ? 'Saving...'
                          : rsvpd
                              ? 'RSVP confirmed'
                              : 'RSVP for this event'))),
            ]),
      )),
    ));
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
              child: ShimmerBlock(height: 150))));
}

class _EventEmptyState extends StatelessWidget {
  const _EventEmptyState();
  @override
  Widget build(BuildContext context) => const SurfaceCard(
          child:
              Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Icon(Icons.event_available_outlined, color: AppColors.clay, size: 28),
        SizedBox(height: 10),
        Text('Nothing on the calendar yet',
            style: TextStyle(fontWeight: FontWeight.w700)),
        SizedBox(height: 4),
        Text('Check back soon for the next considered gathering.',
            style: TextStyle(color: AppColors.muted, fontSize: 12))
      ]));
}

class _EventErrorState extends StatelessWidget {
  const _EventErrorState({required this.onRetry});
  final VoidCallback onRetry;
  @override
  Widget build(BuildContext context) => Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: SurfaceCard(
          child: Row(children: [
        const Icon(Icons.cloud_off_outlined, color: AppColors.clay),
        const SizedBox(width: 10),
        const Expanded(
            child: Text(
                'Live events unavailable. Showing the prototype calendar.',
                style: TextStyle(color: AppColors.muted, fontSize: 12))),
        TextButton(onPressed: onRetry, child: const Text('Retry'))
      ])));
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
