import '../../../core/api/api_client.dart';

class MatchRepository {
  MatchRepository(this._api);
  final ApiClient _api;

  Future<List<Map<String, dynamic>>> mutual() async {
    final raw = await _api.get<List<dynamic>>('/matches/mutual');
    return raw.whereType<Map<String, dynamic>>().toList();
  }

  Future<Map<String, dynamic>> like(String userId) => _action(userId, 'like');
  Future<Map<String, dynamic>> pass(String userId) => _action(userId, 'pass');
  Future<Map<String, dynamic>> superlike(String userId) =>
      _action(userId, 'superlike');

  Future<Map<String, dynamic>> act(String userId, String action) =>
      _action(userId, action);

  Future<Map<String, dynamic>> _action(String userId, String action) =>
      _api.post<Map<String, dynamic>>('/matches/$userId/$action', {});

  Future<Map<String, dynamic>> getSuperlikesReceived() =>
      _api.get<Map<String, dynamic>>('/matches/superlikes-received');
}
