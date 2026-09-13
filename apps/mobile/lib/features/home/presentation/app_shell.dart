import 'dart:ui';

import 'package:flutter/material.dart';

import '../../../core/services.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/widgets/nia_mark.dart';
import '../../discover/presentation/discover_screen.dart';
import '../../events/presentation/events_screen.dart';
import '../../matches/presentation/matches_screen.dart';
import '../../messages/presentation/messages_screen.dart';
import '../../profile/presentation/profile_screen.dart';
import '../../notifications/data/notification_repository.dart';
import '../../notifications/presentation/notifications_sheet.dart';

class AppShell extends StatefulWidget {
  const AppShell({super.key});

  @override
  State<AppShell> createState() => _AppShellState();
}

class _AppShellState extends State<AppShell> {
  int index = 0;
  late final List<Widget?> pages;
  List<NotificationItem> notifications = const [];
  bool notificationsLoaded = false;

  static const titles = ['Discover', 'Matches', 'Messages', 'Events', 'You'];

  int get unreadNotifications =>
      notifications.where((item) => !item.isRead).length;

  @override
  void initState() {
    super.initState();
    pages = List<Widget?>.filled(titles.length, null);
    pages[0] = const DiscoverScreen();
    loadNotifications();
  }

  /// Guarded on a live API token: this widget renders inside the signed-in shell,
  /// but the token is read asynchronously, so a fetch can otherwise race the
  /// session exchange and return 401.
  Future<void> loadNotifications() async {
    final token = await AppServices.sessions.readAccessToken();
    if (!mounted || token == null || token.isEmpty) return;
    try {
      final loaded = await AppServices.notifications.list();
      if (mounted) {
        setState(() {
          notifications = loaded;
          notificationsLoaded = true;
        });
      }
    } catch (_) {
      // The badge simply stays hidden while notifications are unreachable.
      if (mounted) setState(() => notificationsLoaded = true);
    }
  }

  Future<void> openNotifications() async {
    await NotificationsSheet.open(context);
    if (mounted) await loadNotifications();
  }

  Widget createPage(int pageIndex) => switch (pageIndex) {
        0 => const DiscoverScreen(),
        1 => const MatchesScreen(),
        2 => const MessagesScreen(),
        3 => const EventsScreen(),
        _ => const ProfileScreen(),
      };

  void selectPage(int value) {
    setState(() {
      index = value;
      pages[value] ??= createPage(value);
    });
  }

  @override
  Widget build(BuildContext context) {
    final reducedMotion = MediaQuery.disableAnimationsOf(context);
    return Scaffold(
      appBar: AppBar(
        title: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            const NiaMark(size: 24),
            const SizedBox(width: 8),
            Text(titles[index], style: editorial(28, weight: FontWeight.w700)),
          ],
        ),
        actions: [
          IconButton(
            tooltip: unreadNotifications > 0
                ? '$unreadNotifications unread notifications'
                : 'Notifications',
            onPressed: openNotifications,
            icon: Badge(
              isLabelVisible: notificationsLoaded && unreadNotifications > 0,
              label: Text('$unreadNotifications'),
              backgroundColor: AppColors.clay,
              child: const Icon(Icons.notifications_none_rounded),
            ),
          ),
          const SizedBox(width: 6),
        ],
      ),
      body: Stack(
        children: [
          for (var pageIndex = 0; pageIndex < pages.length; pageIndex++)
            if (pages[pageIndex] != null)
              IgnorePointer(
                ignoring: pageIndex != index,
                child: TickerMode(
                  enabled: pageIndex == index,
                  child: AnimatedOpacity(
                    opacity: pageIndex == index ? 1 : 0,
                    duration: reducedMotion
                        ? Duration.zero
                        : const Duration(milliseconds: 240),
                    curve: Curves.easeOutCubic,
                    child: pages[pageIndex]!,
                  ),
                ),
              ),
        ],
      ),
      bottomNavigationBar: ClipRect(
        child: BackdropFilter(
          filter: ImageFilter.blur(sigmaX: 18, sigmaY: 18),
          child: NavigationBar(
            selectedIndex: index,
            onDestinationSelected: selectPage,
            backgroundColor: context.palette.surface.withValues(alpha: 0.78),
            surfaceTintColor: Colors.transparent,
            elevation: 0,
            indicatorColor: context.palette.brandSoft,
            labelTextStyle: const WidgetStatePropertyAll(
                TextStyle(fontSize: 11, fontWeight: FontWeight.w600)),
            destinations: const [
              NavigationDestination(
                  icon: Icon(Icons.explore_outlined),
                  selectedIcon: Icon(Icons.explore),
                  label: 'Discover'),
              NavigationDestination(
                  icon: Icon(Icons.favorite_border),
                  selectedIcon: Icon(Icons.favorite),
                  label: 'Matches'),
              NavigationDestination(
                  icon: Icon(Icons.chat_bubble_outline),
                  selectedIcon: Icon(Icons.chat_bubble),
                  label: 'Messages'),
              NavigationDestination(
                  icon: Icon(Icons.calendar_today_outlined),
                  selectedIcon: Icon(Icons.calendar_today),
                  label: 'Events'),
              NavigationDestination(
                  icon: Icon(Icons.person_outline),
                  selectedIcon: Icon(Icons.person),
                  label: 'You'),
            ],
          ),
        ),
      ),
    );
  }
}
