import '../../../core/api/api_client.dart';

class EventItem {
  const EventItem({
    required this.id,
    required this.title,
    required this.description,
    required this.eventType,
    required this.city,
    required this.venueName,
    required this.startTime,
    required this.endTime,
    required this.capacity,
    required this.ticketPrice,
    required this.attendeeCount,
    required this.featured,
  });

  final String id;
  final String title;
  final String description;
  final String eventType;
  final String city;
  final String venueName;
  final DateTime startTime;
  final DateTime endTime;
  final int capacity;
  final double ticketPrice;
  final int attendeeCount;
  final bool featured;

  factory EventItem.fromJson(Map<String, dynamic> json) {
    return EventItem(
      id: json['id'] as String? ?? '',
      title: json['title'] as String? ?? 'Community event',
      description:
          json['description'] as String? ?? 'A considered Nia gathering.',
      eventType: json['eventType'] as String? ?? 'Community',
      city: json['city'] as String? ?? 'Johannesburg',
      venueName: json['venueName'] as String? ?? 'Venue shared after RSVP',
      startTime: DateTime.tryParse(json['startTime'] as String? ?? '') ??
          DateTime.now(),
      endTime:
          DateTime.tryParse(json['endTime'] as String? ?? '') ?? DateTime.now(),
      capacity: (json['capacity'] as num?)?.toInt() ?? 0,
      ticketPrice: (json['ticketPrice'] as num?)?.toDouble() ?? 0,
      attendeeCount: (json['attendeeCount'] as num?)?.toInt() ?? 0,
      featured: json['featured'] == true,
    );
  }
}

class RsvpResult {
  const RsvpResult({required this.status, required this.waitlisted});

  final String status;
  final bool waitlisted;

  factory RsvpResult.fromJson(Map<String, dynamic> json) => RsvpResult(
        status: json['status'] as String? ?? 'confirmed',
        waitlisted: json['waitlisted'] == true,
      );
}

class EventRepository {
  EventRepository(this._api);

  final ApiClient _api;

  Future<List<EventItem>> upcoming() async {
    final data = await _api.get<List<dynamic>>('/events');
    return data
        .whereType<Map<String, dynamic>>()
        .map(EventItem.fromJson)
        .toList();
  }

  Future<EventItem> detail(String eventId) async {
    final data = await _api.get<Map<String, dynamic>>('/events/$eventId');
    return EventItem.fromJson(data);
  }

  Future<RsvpResult> rsvp(String eventId) async {
    final data = await _api.post<Map<String, dynamic>>('/events/$eventId/rsvp');
    return RsvpResult.fromJson(data);
  }
}
