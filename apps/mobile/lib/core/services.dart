import '../features/account/data/account_repository.dart';
import '../features/auth/data/auth_repository.dart';
import '../features/auth/data/auth_session_store.dart';
import '../features/discover/data/discover_repository.dart';
import '../features/events/data/event_repository.dart';
import '../features/matches/data/match_repository.dart';
import '../features/messages/data/chat_repository.dart';
import '../features/notifications/data/notification_repository.dart';
import 'api/api_client.dart';
import 'storage/platform_storage.dart';
import 'theme/theme_controller.dart';

class AppServices {
  AppServices._();

  static late final PlatformStorage storage;
  static late final ThemeController theme;
  static late final ApiClient api;
  static late final AuthSessionStore sessions;
  static late final AuthRepository auth;
  static late final AccountRepository account;
  static late final ChatRepository chat;
  static late final MatchRepository matches;
  static late final EventRepository events;
  static late final NotificationRepository notifications;
  static late final DiscoverRepository discover;
  static late final NearbyRepository nearby;

  static Future<void> init() async {
    storage = await createPlatformStorage();
    // Read the appearance preference before the first frame so the app never
    // flashes the wrong theme on launch.
    theme = await ThemeController.restore(storage: storage);
    api = ApiClient(secureStorage: storage);
    sessions = AuthSessionStore(storage: storage);
    auth = AuthRepository(api, sessions: sessions);
    account = AccountRepository(api);
    chat = ChatRepository(api);
    matches = MatchRepository(api);
    events = EventRepository(api);
    notifications = NotificationRepository(api);
    discover = DiscoverRepository(api);
    nearby = NearbyRepository(api);
  }
}
