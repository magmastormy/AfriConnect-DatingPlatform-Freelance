import '../../../core/api/api_client.dart';

class AccountRepository {
  AccountRepository(this._api);
  final ApiClient _api;

  Future<Map<String, dynamic>> getProfile() =>
      _api.get<Map<String, dynamic>>('/profile/me');

  Future<Map<String, dynamic>> updateProfile(Map<String, dynamic> input) =>
      _api.put<Map<String, dynamic>>('/profile/me', input);

  Future<Map<String, dynamic>> addPhoto(String url, {bool isPrimary = false}) =>
      _api.post<Map<String, dynamic>>(
          '/profile/me/photos', {'url': url, 'isPrimary': isPrimary});

  Future<Map<String, dynamic>> removePhoto(String url) =>
      _api.delete<Map<String, dynamic>>('/profile/me/photos', {'url': url});

  Future<Map<String, dynamic>> updatePreferences(Map<String, dynamic> input) =>
      _api.put<Map<String, dynamic>>('/profile/me/preferences', input);

  Future<Map<String, dynamic>> updatePrivacy(Map<String, dynamic> input) =>
      _api.put<Map<String, dynamic>>('/profile/me/privacy', input);

  Future<Map<String, dynamic>> updateNearby(bool enabled) =>
      _api.put<Map<String, dynamic>>(
          '/profile/me/nearby', {'nearbyEnabled': enabled});

  Future<Map<String, dynamic>> pauseProfile(bool paused) =>
      _api.post<Map<String, dynamic>>('/profile/me/pause', {'paused': paused});

  Future<Map<String, dynamic>> getVettingStatus() =>
      _api.get<Map<String, dynamic>>('/applications/me');

  Future<Map<String, dynamic>> submitApplication(Map<String, dynamic> input) =>
      _api.post<Map<String, dynamic>>('/applications', input);

  Future<Map<String, dynamic>> startVetting() =>
      _api.post<Map<String, dynamic>>('/vetting/smile/session');

  Future<Map<String, dynamic>> vettingStatus() =>
      _api.get<Map<String, dynamic>>('/vetting/smile/status');

  Future<Map<String, dynamic>> checkout(
          {required String plan,
          required String successUrl,
          required String cancelUrl}) =>
      _api.post<Map<String, dynamic>>('/billing/checkout-session',
          {'plan': plan, 'successUrl': successUrl, 'cancelUrl': cancelUrl});

  Future<Map<String, dynamic>> subscription() =>
      _api.get<Map<String, dynamic>>('/billing/subscription');
}
