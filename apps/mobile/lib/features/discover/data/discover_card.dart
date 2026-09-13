class DiscoverCard {
  const DiscoverCard({
    required this.userId,
    required this.displayName,
    required this.age,
    required this.city,
    required this.photos,
    this.headline,
    this.score,
    this.verified = false,
    this.isPremium = false,
    this.sharedInterests = const [],
  });

  final String userId;
  final String displayName;
  final int age;
  final String city;
  final List<String> photos;
  final String? headline;
  final int? score;
  final bool verified;
  final bool isPremium;
  final List<String> sharedInterests;

  factory DiscoverCard.fromJson(Map<String, dynamic> json) {
    return DiscoverCard(
      userId: json['userId'] as String? ?? '',
      displayName: json['displayName'] as String? ?? 'Member',
      age: (json['age'] as num?)?.toInt() ?? 0,
      city: json['city'] as String? ?? '',
      photos: (json['photos'] as List<dynamic>? ?? const [])
          .whereType<String>()
          .toList(),
      headline: json['headline'] as String?,
      score: (json['score'] as num?)?.toInt(),
      verified: json['verified'] as bool? ?? false,
      isPremium: json['isPremium'] as bool? ?? false,
      sharedInterests: (json['sharedInterests'] as List<dynamic>? ?? const [])
          .whereType<String>()
          .toList(),
    );
  }
}
