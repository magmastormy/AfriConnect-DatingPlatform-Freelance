import 'dart:ui';

import 'package:flutter/material.dart';

import '../../../core/services.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/widgets/nia_kit.dart';
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

class _AppShellState extends State<AppShell>
    with SingleTickerProviderStateMixin {
  int index = 0;
  late final List<Widget?> pages;
  List<NotificationItem> notifications = const [];
  bool notificationsLoaded = false;

  /// Drives the incoming tab's fade-in. Only the active tab is ever painted
  /// (the rest are `Offstage`), so this fades one page in over the shell
  /// background — never a cross-fade of two live pages, which is what caused
  /// the old bleed-through between tabs.
  late final AnimationController _fade;

  static const titles = ['Discover', 'Matches', 'Messages', 'Events', 'You'];

  int get unreadNotifications =>
      notifications.where((item) => !item.isRead).length;

  @override
  void initState() {
    super.initState();
    pages = List<Widget?>.filled(titles.length, null);
    pages[0] = const DiscoverScreen();
    _fade = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 220),
      value: 1, // the first paint is not animated
    );
    loadNotifications();
  }

  @override
  void dispose() {
    _fade.dispose();
    super.dispose();
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
    if (value == index) return;
    final reduceMotion = MediaQuery.disableAnimationsOf(context);
    setState(() {
      index = value;
      pages[value] ??= createPage(value);
    });
    if (reduceMotion) {
      _fade.value = 1;
    } else {
      _fade.forward(from: 0);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        titleSpacing: 20,
        title: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            // The serif face belongs to the *brand*; the tab name is location
            // information and is demoted to a small sans label. Previously the
            // tab name was set in the display face, which spent the brand
            // voice on a navigation label.
            const BrandWordmark(size: 26),
            const SizedBox(width: 10),
            Text(
              titles[index],
              style: niaLabel(12, weight: FontWeight.w600)
                  .copyWith(color: context.palette.muted),
            ),
          ],
        ),
        actions: [
          CircleIconButton(
            icon: Icons.notifications_none_rounded,
            onMedia: false,
            semanticLabel: unreadNotifications > 0
                ? '$unreadNotifications unread notifications'
                : 'Notifications',
            badgeCount: notificationsLoaded ? unreadNotifications : null,
            onTap: openNotifications,
          ),
          const SizedBox(width: 16),
        ],
      ),
      body: Stack(
        children: [
          for (var pageIndex = 0; pageIndex < pages.length; pageIndex++)
            if (pages[pageIndex] != null)
              // Only the active tab is painted. `Offstage` keeps every tab's
              // state alive (scroll position, form input) while removing the
              // inactive ones from the paint tree entirely — so the outgoing
              // tab can never bleed through the incoming one. The incoming tab
              // fades in via `_fade` over the shell background.
              Offstage(
                offstage: pageIndex != index,
                child: TickerMode(
                  enabled: pageIndex == index,
                  child: FadeTransition(
                    opacity: _fade,
                    child: pages[pageIndex]!,
                  ),
                ),
              ),
        ],
      ),
      bottomNavigationBar: Container(
        // Mirrors the web BottomNav: a hairline top edge + soft upward float
        // shadow so the bar reads as a floating glass sheet, not a flat strip.
        decoration: BoxDecoration(
          border:
              Border(top: BorderSide(color: context.palette.line, width: 1)),
          boxShadow: const [
            BoxShadow(
              color: Color(0x0F000000),
              blurRadius: 24,
              offset: Offset(0, -8),
            ),
          ],
        ),
        child: ClipRect(
          child: BackdropFilter(
            filter: ImageFilter.blur(sigmaX: 20, sigmaY: 20),
            child: NavigationBarTheme(
              data: NavigationBarThemeData(
                indicatorColor: context.palette.brandSoft,
                // Active navigation uses Royal Blue; inactive items stay muted.
                iconTheme: WidgetStateProperty.resolveWith(
                  (states) => IconThemeData(
                    size: 24,
                    color: states.contains(WidgetState.selected)
                        ? context.palette.brandOn
                        : context.palette.muted,
                  ),
                ),
                labelTextStyle: WidgetStateProperty.resolveWith(
                  (states) => niaLabel(11, weight: FontWeight.w600).copyWith(
                    color: states.contains(WidgetState.selected)
                        ? context.palette.ink
                        : context.palette.muted,
                  ),
                ),
              ),
              child: NavigationBar(
                selectedIndex: index,
                onDestinationSelected: selectPage,
                backgroundColor:
                    context.palette.surface.withValues(alpha: 0.82),
                surfaceTintColor: Colors.transparent,
                elevation: 0,
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
        ),
      ),
    );
  }
}
