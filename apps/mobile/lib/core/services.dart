import 'api/api_client.dart';
import '../features/auth/data/auth_repository.dart';
import '../features/auth/data/auth_session_store.dart';
import '../features/account/data/account_repository.dart';
import '../features/messages/data/chat_repository.dart';
import '../features/matches/data/match_repository.dart';
import '../features/events/data/event_repository.dart';
import '../features/notifications/data/notification_repository.dart';
import '../features/discover/data/discover_repository.dart';

class AppServices {
  AppServices._();

  static final api = ApiClient();
  static final sessions = AuthSessionStore();
  static final auth = AuthRepository(api, sessions: sessions);
  static final account = AccountRepository(api);
  static final chat = ChatRepository(api);
  static final matches = MatchRepository(api);
  static final events = EventRepository(api);
  static final notifications = NotificationRepository(api);
  static final discover = DiscoverRepository(api);
}
