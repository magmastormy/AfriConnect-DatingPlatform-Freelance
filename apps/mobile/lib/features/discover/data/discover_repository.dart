import '../../../core/api/api_client.dart';
import 'discover_card.dart';

class DiscoverRepository {
  DiscoverRepository(this._api);

  final ApiClient _api;

  Future<List<DiscoverCard>> getDiscover({int limit = 20}) async {
    final raw = await _api.get<List<dynamic>>('/matches/discover?limit=$limit');
    return raw
        .whereType<Map<String, dynamic>>()
        .map(DiscoverCard.fromJson)
        .toList();
  }
  // Deck actions (like / pass / superlike) intentionally live on MatchRepository
  // so there is a single code path for recording interest.
}
