import 'package:flutter/material.dart';

import '../../../core/services.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/widgets/app_widgets.dart';
import '../data/notification_repository.dart';

class NotificationsSheet extends StatefulWidget {
  const NotificationsSheet({super.key});

  static Future<void> open(BuildContext context) async {
    await showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      backgroundColor: context.palette.background,
      builder: (_) => const NotificationsSheet(),
    );
  }

  @override
  State<NotificationsSheet> createState() => _NotificationsSheetState();
}

class _NotificationsSheetState extends State<NotificationsSheet> {
  static List<NotificationItem> get preview => <NotificationItem>[
        NotificationItem(
            id: 'preview-match',
            title: 'A new introduction is waiting',
            body:
                'Someone in your circle shares your interest in design and ambition.',
            createdAt: _previewTime,
            isRead: false),
        NotificationItem(
            id: 'preview-event',
            title: 'The Founders Table is filling up',
            body: 'There are only a few places left for the next dinner.',
            createdAt: _previewEarlier,
            isRead: true),
      ];

  List<NotificationItem> notifications = const [];
  bool loading = true;
  bool previewMode = false;

  @override
  void initState() {
    super.initState();
    loadNotifications();
  }

  Future<void> loadNotifications() async {
    try {
      final result = await AppServices.notifications.list();
      if (!mounted) return;
      setState(() => notifications = result);
    } catch (_) {
      if (mounted) {
        setState(() {
          notifications = preview;
          previewMode = true;
        });
      }
    } finally {
      if (mounted) setState(() => loading = false);
    }
  }

  Future<void> markAllRead() async {
    setState(() => notifications = notifications
        .map((item) => NotificationItem(
            id: item.id,
            title: item.title,
            body: item.body,
            createdAt: item.createdAt,
            isRead: true))
        .toList());
    if (!previewMode) {
      await AppServices.notifications.markAllRead().catchError((_) {});
    }
  }

  Future<void> markRead(NotificationItem item) async {
    if (item.isRead) return;
    setState(() {
      notifications = notifications
          .map((candidate) => candidate.id == item.id
              ? NotificationItem(
                  id: candidate.id,
                  title: candidate.title,
                  body: candidate.body,
                  createdAt: candidate.createdAt,
                  isRead: true)
              : candidate)
          .toList();
    });
    if (!previewMode) {
      await AppServices.notifications.markRead(item.id).catchError((_) {});
    }
  }

  @override
  Widget build(BuildContext context) {
    final unread = notifications.where((item) => !item.isRead).length;
    return SafeArea(
      child: SizedBox(
        height: MediaQuery.sizeOf(context).height * .72,
        child: Padding(
          padding: const EdgeInsets.fromLTRB(20, 12, 20, 18),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Center(
                  child: Container(
                      width: 36,
                      height: 4,
                      decoration: BoxDecoration(
                          color: context.palette.lineStrong,
                          borderRadius: BorderRadius.circular(99)))),
              const SizedBox(height: 20),
              Row(children: [
                Expanded(
                    child: Text('Notifications',
                        style: editorial(28, weight: FontWeight.w700))),
                if (unread > 0)
                  TextButton(
                      onPressed: markAllRead,
                      child: const Text('Mark all read'))
              ]),
              const SizedBox(height: 4),
              Text(
                  unread == 0
                      ? 'You are all caught up.'
                      : '$unread updates worth seeing.',
                  style: TextStyle(color: context.palette.muted)),
              const SizedBox(height: 18),
              if (loading)
                const Expanded(
                    child: Center(
                        child:
                            CircularProgressIndicator(color: AppColors.clay))),
              if (!loading && notifications.isEmpty)
                Expanded(
                    child: Center(
                        child: Text('No notifications yet.',
                            style: TextStyle(color: context.palette.muted)))),
              if (!loading && notifications.isNotEmpty)
                Expanded(
                    child: ListView.separated(
                        itemCount: notifications.length,
                        separatorBuilder: (_, __) => const SizedBox(height: 8),
                        itemBuilder: (context, index) => _NotificationTile(
                            item: notifications[index],
                            onTap: () => markRead(notifications[index])))),
            ],
          ),
        ),
      ),
    );
  }
}

class _NotificationTile extends StatelessWidget {
  const _NotificationTile({required this.item, required this.onTap});

  final NotificationItem item;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) => InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(16),
        child: SurfaceCard(
          padding: const EdgeInsets.all(13),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                width: 38,
                height: 38,
                decoration: BoxDecoration(
                  color: context.palette.successBg,
                  shape: BoxShape.circle,
                ),
                child: Icon(
                  item.isRead
                      ? Icons.check_rounded
                      : Icons.auto_awesome_rounded,
                  color: context.palette.success,
                  size: 19,
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Expanded(
                          child: Text(
                            item.title,
                            style: const TextStyle(fontWeight: FontWeight.w700),
                          ),
                        ),
                        if (!item.isRead)
                          const StatusPill('New', tone: PillTone.brand),
                      ],
                    ),
                    const SizedBox(height: 4),
                    Text(
                      item.body,
                      style: TextStyle(
                        color: context.palette.muted,
                        fontSize: 12,
                        height: 1.4,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      );
}

// `DateTime` has no const constructor in Dart, so these cannot be `const`.
final _previewTime = DateTime(2026, 9, 11, 12);
final _previewEarlier = DateTime(2026, 9, 10, 18);
