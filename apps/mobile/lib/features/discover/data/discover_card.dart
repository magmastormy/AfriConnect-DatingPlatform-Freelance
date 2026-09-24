class DiscoverCard {
  const DiscoverCard({
    required this.userId,
    required this.displayName,
    required this.age,
    required this.city,
    required this.photos,
    this.headline,
    this.bio,
    this.score,
    this.verified = false,
    this.isPremium = false,
    this.sharedInterests = const [],
    this.profession,
    this.employer,
    this.educationLevel,
    this.distanceKm,
  });

  final String userId;
  final String displayName;
  final int age;
  final String city;
  final List<String> photos;
  final String? headline;
  final String? bio;
  final int? score;
  final bool verified;
  final bool isPremium;
  final List<String> sharedInterests;
  final String? profession;
  final String? employer;
  final String? educationLevel;
  final double? distanceKm;

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
      bio: json['bio'] as String?,
      score: (json['score'] as num?)?.toInt(),
      verified: json['verified'] as bool? ?? false,
      isPremium: json['isPremium'] as bool? ?? false,
      sharedInterests: (json['sharedInterests'] as List<dynamic>? ?? const [])
          .whereType<String>()
          .toList(),
      profession: json['profession'] as String?,
      employer: json['employer'] as String?,
      educationLevel: json['educationLevel'] as String?,
      distanceKm: (json['distanceKm'] as num?)?.toDouble(),
    );
  }
}

class NearbyProfile {
  const NearbyProfile({
    required this.userId,
    required this.displayName,
    required this.firstName,
    required this.lastName,
    required this.age,
    required this.city,
    required this.photos,
    this.headline,
    this.bio,
    this.district,
    this.profession,
    this.employer,
    this.educationLevel,
    this.verified = false,
    this.isPremium = false,
    this.distanceKm,
  });

  final String userId;
  final String displayName;
  final String firstName;
  final String lastName;
  final int age;
  final String city;
  final List<String> photos;
  final String? headline;
  final String? bio;
  final String? district;
  final String? profession;
  final String? employer;
  final String? educationLevel;
  final bool verified;
  final bool isPremium;
  final double? distanceKm;

  String get fallbackName => '$firstName $lastName'.trim();

  factory NearbyProfile.fromJson(Map<String, dynamic> json) {
    return NearbyProfile(
      userId: json['userId'] as String? ?? '',
      displayName: json['displayName'] as String? ?? '',
      firstName: json['firstName'] as String? ?? '',
      lastName: json['lastName'] as String? ?? '',
      age: (json['age'] as num?)?.toInt() ?? 0,
      city: json['city'] as String? ?? '',
      photos: (json['photos'] as List<dynamic>? ?? const [])
          .whereType<String>()
          .toList(),
      headline: json['headline'] as String?,
      bio: json['bio'] as String?,
      district: json['district'] as String?,
      profession: json['profession'] as String?,
      employer: json['employer'] as String?,
      educationLevel: json['educationLevel'] as String?,
      verified: json['verified'] as bool? ?? false,
      isPremium: json['isPremium'] as bool? ?? false,
      distanceKm: (json['distanceKm'] as num?)?.toDouble(),
    );
  }
}

class ProfileRedNote {
  const ProfileRedNote({
    required this.userId,
    required this.fullName,
    this.displayName,
    required this.location,
    this.nationality,
    this.profession,
    this.industry = const [],
    this.educationLevel,
    this.gender,
    this.dateOfBirth,
    this.bio,
    this.headline,
    this.photos = const [],
    this.isPremium = false,
    this.verified = false,
    this.restricted = false,
  });

  final String userId;
  final String fullName;
  final String? displayName;
  final ProfileLocation location;
  final String? nationality;
  final String? profession;
  final List<String> industry;
  final String? educationLevel;
  final String? gender;
  final String? dateOfBirth;
  final String? bio;
  final String? headline;
  final List<String> photos;
  final bool isPremium;
  final bool verified;
  final bool restricted;

  factory ProfileRedNote.fromJson(Map<String, dynamic> json) {
    final location = json['location'] as Map<String, dynamic>?;
    return ProfileRedNote(
      userId: json['userId'] as String? ?? '',
      fullName: json['fullName'] as String? ?? 'Member',
      displayName: json['displayName'] as String?,
      location: ProfileLocation.fromJson(location ?? {}),
      nationality: json['nationality'] as String?,
      profession: json['profession'] as String?,
      industry: (json['industry'] as List<dynamic>? ?? const [])
          .whereType<String>()
          .toList(),
      educationLevel: json['educationLevel'] as String?,
      gender: json['gender'] as String?,
      dateOfBirth: json['dateOfBirth'] as String?,
      bio: json['bio'] as String?,
      headline: json['headline'] as String?,
      photos: (json['photos'] as List<dynamic>? ?? const [])
          .whereType<String>()
          .toList(),
      isPremium: json['isPremium'] as bool? ?? false,
      verified: json['verified'] as bool? ?? false,
      restricted: json['restricted'] as bool? ?? false,
    );
  }
}

class ProfileLocation {
  const ProfileLocation({required this.city, this.district});
  final String city;
  final String? district;

  factory ProfileLocation.fromJson(Map<String, dynamic> json) {
    return ProfileLocation(
      city: json['city'] as String? ?? '',
      district: json['district'] as String?,
    );
  }
}
