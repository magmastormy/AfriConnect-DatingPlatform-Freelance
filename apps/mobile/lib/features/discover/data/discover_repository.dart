import '../../../core/api/api_client.dart';
import 'discover_card.dart';

class DiscoverRepository {
  DiscoverRepository(this._api);

  final ApiClient _api;

  Future<List<DiscoverCard>> getDiscover({int limit = 20, String? city}) async {
    final query = StringBuffer('?limit=$limit');
    if (city != null && city.isNotEmpty) {
      query.write('&city=$city');
    }
    final raw =
        await _api.get<List<dynamic>>('/matches/discover${query.toString()}');
    return raw
        .whereType<Map<String, dynamic>>()
        .map(DiscoverCard.fromJson)
        .toList();
  }

  Future<ProfileRedNote> getProfile(String userId) async {
    final raw = await _api.get<Map<String, dynamic>>('/profile/$userId');
    return ProfileRedNote.fromJson(raw);
  }
}

class NearbyRepository {
  NearbyRepository(this._api);

  final ApiClient _api;

  Future<List<NearbyProfile>> getNearby(
      {String? city, String? district, int? limit}) async {
    final query = StringBuffer();
    if (city != null && city.isNotEmpty) query.write('city=$city');
    if (district != null && district.isNotEmpty) {
      if (query.isNotEmpty) query.write('&');
      query.write('district=$district');
    }
    if (limit != null) {
      if (query.isNotEmpty) query.write('&');
      query.write('limit=$limit');
    }
    final q = query.toString();
    final raw = await _api
        .get<List<dynamic>>('/discover/nearby${q.isEmpty ? '' : '?$q'}');
    return raw
        .whereType<Map<String, dynamic>>()
        .map(NearbyProfile.fromJson)
        .toList();
  }

  Future<Map<String, dynamic>> getNearbyStatus() async {
    return await _api.get<Map<String, dynamic>>('/profile/me');
  }

  Future<Map<String, dynamic>> shareLocation({
    required double latitude,
    required double longitude,
    String? district,
  }) async {
    return await _api.put<Map<String, dynamic>>('/profile/me/nearby', {
      'nearbyEnabled': true,
      'latitude': latitude,
      'longitude': longitude,
      if (district != null) 'district': district,
    });
  }

  Future<Map<String, dynamic>> forgetLocation() async {
    return await _api.put<Map<String, dynamic>>(
        '/profile/me/nearby', {'nearbyEnabled': false});
  }
}
