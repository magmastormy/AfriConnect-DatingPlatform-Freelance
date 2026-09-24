import 'dart:async';

import 'package:flutter/material.dart';

import '../../../core/realtime/realtime_chat_client.dart';
import '../../../core/services.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/widgets/app_widgets.dart';
import '../../../core/widgets/nia_kit.dart';
import '../data/chat_repository.dart';
import 'conversation_screen.dart';

class MessagesScreen extends StatefulWidget {
  const MessagesScreen({super.key});
  @override
  State<MessagesScreen> createState() => _MessagesScreenState();
}

class _MessagesScreenState extends State<MessagesScreen> {
  RealtimeChatClient? realtime;
  StreamSubscription<Map<String, dynamic>>? events;
  StreamSubscription<RealtimeStatus>? statusEvents;
  bool live = false;
  bool loading = true;

  /// Unread badge for the seeded preview row only. Real conversations carry their
  /// own unread count from the API, so this must not start above zero.
  int previewUnread = 2;
  String? currentUserId;
  List<ChatConversation> conversations = [];

  @override
  void initState() {
    super.initState();
    connectRealtime();
    loadConversations();
  }

  Future<void> loadConversations() async {
    try {
      final loaded = await AppServices.chat.conversations();
      if (mounted) setState(() => conversations = loaded);
    } catch (_) {
      // Seeded rows keep preview mode useful without an API session.
    } finally {
      if (mounted) setState(() => loading = false);
    }
  }

  Future<void> connectRealtime() async {
    currentUserId = await AppServices.sessions.readUserId();
    final token = await AppServices.sessions.readAccessToken();
    if (!mounted || token == null) return;
    realtime = RealtimeChatClient(
      apiBaseUrl: AppServices.api.baseUrl,
      token: token,
      refreshTokenProvider: () async {
        final refreshed = await AppServices.auth.refreshAccessToken();
        return refreshed ? AppServices.sessions.readAccessToken() : null;
      },
    );
    events = realtime!.events.listen((event) {
      if (!mounted) return;
      if (event['type'] != 'message') return;
      final raw = event['message'];
      if (raw is! Map<String, dynamic> || raw['senderId'] == currentUserId) {
        return;
      }
      final conversationId = event['conversationId'] as String?;
      final index = conversationId == null
          ? -1
          : conversations.indexWhere((item) => item.id == conversationId);
      final content = raw['isDeleted'] == true
          ? 'Message recalled'
          : (raw['content'] as String? ??
              (raw['imageUrl'] != null ? 'Photo' : 'New message'));
      final createdAt = DateTime.tryParse(raw['createdAt'] as String? ?? '');
      setState(() {
        if (index >= 0) {
          conversations[index] = conversations[index].copyWith(
            preview: content,
            unread: conversations[index].unread + 1,
            lastMessageAt: createdAt,
          );
        } else {
          // A message for a conversation this screen has not loaded yet still
          // needs to surface, so bump the preview badge instead of dropping it.
          previewUnread += 1;
        }
      });
    });
    statusEvents = realtime!.status.listen((status) {
      if (mounted) setState(() => live = status == RealtimeStatus.connected);
    });
    realtime!.connect();
  }

  @override
  void dispose() {
    events?.cancel();
    statusEvents?.cancel();
    realtime?.dispose();
    super.dispose();
  }

  Future<void> _openConversation(ChatConversation conversation) async {
    await Navigator.push(
      context,
      MaterialPageRoute(
        builder: (_) => ConversationScreen(
            conversationId: conversation.id, name: conversation.otherName),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.only(top: 8, bottom: 28),
      children: [
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 20),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  Expanded(
                    child: Text(
                      'Make room for\na good conversation.',
                      style: editorial(32, weight: FontWeight.w700)
                          .copyWith(height: 1.05),
                    ),
                  ),
                  Container(
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: context.palette.brandSoft.withValues(alpha: 0.5),
                      shape: BoxShape.circle,
                    ),
                    child: Icon(Icons.forum_outlined,
                        color: context.palette.brand, size: 22),
                  ),
                  const SizedBox(width: 12),
                  Padding(
                    padding: const EdgeInsets.only(bottom: 6),
                    child: StatusPill(live ? 'Live' : 'Offline',
                        tone: live ? PillTone.good : PillTone.neutral),
                  ),
                ],
              ),
              const SizedBox(height: 20),
              const SearchPill(
                placeholder: 'Search conversations',
                icon: Icons.search_rounded,
              ),
            ],
          ),
        ),

        if (loading)
          const Padding(
            padding: EdgeInsets.all(28),
            child: Center(child: CircularProgressIndicator()),
          ),

        // People rail: three or more conversations earns a face-level shortcut
        // above the list. Fewer than that and it would only add weight.
        if (conversations.length >= 3) ...[
          const SizedBox(height: 22),
          AvatarRail(
            size: 52,
            items: [
              for (final conversation in conversations.take(12))
                AvatarRailItem(
                  label: _firstName(conversation.otherName),
                  imageUrl: conversation.photo,
                  emphasised: conversation == conversations.first,
                ),
            ],
            onTap: (index) => _openConversation(conversations[index]),
          ),
        ],

        const SizedBox(height: 18),

        // Conversation rows are separated by hairlines rather than boxed into
        // individual cards: each row is a continuation of one list, and drawing
        // twelve boxes made the screen heavier than its content.
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 20),
          child: Column(
            children: [
              if (conversations.isNotEmpty)
                for (var i = 0; i < conversations.length; i++) ...[
                  _ConversationRow(
                    initial: _initial(conversations[i].otherName),
                    photoUrl: conversations[i].photo,
                    name: conversations[i].otherName,
                    preview: conversations[i].preview,
                    time: _timeLabel(conversations[i].lastMessageAt),
                    unread: conversations[i].unread,
                    onTap: () => _openConversation(conversations[i]),
                  ),
                  if (i != conversations.length - 1) const Hairline(indent: 74),
                ],
              if (!loading && conversations.isEmpty) ...[
                _ConversationRow(
                  initial: 'K',
                  name: 'Kabelo',
                  preview: 'You: I’m looking forward to it.',
                  time: '10:42',
                  unread: previewUnread,
                  onTap: () {
                    setState(() => previewUnread = 0);
                    Navigator.push(
                      context,
                      MaterialPageRoute(
                        builder: (_) => const ConversationScreen(
                            conversationId: 'demo-kabelo', name: 'Kabelo'),
                      ),
                    );
                  },
                ),
                const Hairline(indent: 74),
                const _ConversationRow(
                  initial: 'A',
                  name: 'Ama',
                  preview: 'That sounds like a great weekend plan.',
                  time: 'Yesterday',
                ),
                const Hairline(indent: 74),
                const _ConversationRow(
                    initial: 'N', name: 'Nandi', preview: 'Photo', time: 'Mon'),
              ],
            ],
          ),
        ),

        const SizedBox(height: 24),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 20),
          child: SurfaceCard(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const StatusPill('Private by design', tone: PillTone.good),
                const SizedBox(height: 10),
                Text('Conversations are only available after mutual interest.',
                    style: editorial(17, weight: FontWeight.w700)),
                const SizedBox(height: 6),
                Text('Keep it kind, curious, and true to you.',
                    style: inter(12.5,
                        weight: FontWeight.w400,
                        color: context.palette.muted,
                        height: 1.4)),
              ],
            ),
          ),
        ),
      ],
    );
  }

  static String _firstName(String name) {
    final trimmed = name.trim();
    return trimmed.isEmpty ? 'Member' : trimmed.split(' ').first;
  }

  String _initial(String name) =>
      name.trim().isEmpty ? 'M' : name.trim()[0].toUpperCase();

  String _timeLabel(DateTime? date) {
    if (date == null) return '';
    final now = DateTime.now();
    if (date.day == now.day &&
        date.month == now.month &&
        date.year == now.year) {
      return '${date.hour.toString().padLeft(2, '0')}:${date.minute.toString().padLeft(2, '0')}';
    }
    return 'Earlier';
  }
}

class _ConversationRow extends StatelessWidget {
  const _ConversationRow({
    required this.initial,
    required this.name,
    required this.preview,
    required this.time,
    this.unread = 0,
    this.photoUrl,
    this.onTap,
  });

  final String initial;
  final String name;
  final String preview;
  final String time;
  final int unread;
  final String? photoUrl;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final palette = context.palette;
    final hasUnread = unread > 0;

    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(NiaRadius.sm),
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 13),
        child: Row(
          children: [
            _RowAvatar(initial: initial, photoUrl: photoUrl, size: 52),
            const SizedBox(width: 13),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Expanded(
                        child: Text(
                          name,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: inter(15.5,
                              weight:
                                  hasUnread ? FontWeight.w700 : FontWeight.w600,
                              color: palette.ink),
                        ),
                      ),
                      const SizedBox(width: 8),
                      Text(time,
                          style: inter(11.5,
                              weight: FontWeight.w500,
                              color:
                                  hasUnread ? palette.brandOn : palette.muted)),
                    ],
                  ),
                  const SizedBox(height: 5),
                  Text(
                    preview,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: inter(13,
                        weight: hasUnread ? FontWeight.w500 : FontWeight.w400,
                        color: hasUnread ? palette.inkSoft : palette.muted),
                  ),
                ],
              ),
            ),
            if (hasUnread)
              Container(
                margin: const EdgeInsets.only(left: 10),
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                decoration: BoxDecoration(
                  color: AppColors.clay,
                  borderRadius: BorderRadius.circular(NiaRadius.pill),
                ),
                child: Text('$unread',
                    style: niaLabel(11, weight: FontWeight.w700)
                        .copyWith(color: palette.onBrand)),
              ),
          ],
        ),
      ),
    );
  }
}

class _RowAvatar extends StatelessWidget {
  const _RowAvatar({
    required this.initial,
    required this.size,
    this.photoUrl,
  });

  final String initial;
  final double size;
  final String? photoUrl;

  @override
  Widget build(BuildContext context) {
    if (photoUrl != null && photoUrl!.isNotEmpty) {
      return Container(
        width: size,
        height: size,
        decoration: BoxDecoration(
          shape: BoxShape.circle,
          border: Border.all(color: context.palette.line),
        ),
        clipBehavior: Clip.antiAlias,
        child: Image.network(
          photoUrl!,
          fit: BoxFit.cover,
          errorBuilder: (_, __, ___) =>
              InitialAvatar(initial, size: size, color: AppColors.plum),
        ),
      );
    }
    return InitialAvatar(initial, size: size, color: AppColors.plum);
  }
}
