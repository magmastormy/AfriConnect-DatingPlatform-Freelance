import 'dart:async';

import 'package:flutter/material.dart';

import '../../../core/realtime/realtime_chat_client.dart';
import '../../../core/services.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/widgets/app_widgets.dart';
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

  @override
  Widget build(BuildContext context) =>
      ListView(padding: const EdgeInsets.fromLTRB(20, 4, 20, 28), children: [
        Row(crossAxisAlignment: CrossAxisAlignment.end, children: [
          Expanded(
              child: Text('Make room for a good conversation.',
                  style: editorial(28, weight: FontWeight.w700))),
          StatusPill(live ? 'Live' : 'Offline',
              tone: live ? PillTone.good : PillTone.neutral)
        ]),
        const SizedBox(height: 20),
        TextField(
            decoration: InputDecoration(
                hintText: 'Search conversations',
                prefixIcon: const Icon(Icons.search),
                filled: true,
                fillColor: context.palette.surface,
                border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(14),
                    borderSide: BorderSide(color: context.palette.line)))),
        const SizedBox(height: 18),
        if (loading)
          const Padding(
              padding: EdgeInsets.all(20),
              child: Center(child: CircularProgressIndicator())),
        if (conversations.isNotEmpty)
          ...conversations.map((conversation) => _Conversation(
              initial: _initial(conversation.otherName),
              name: conversation.otherName,
              preview: conversation.preview,
              time: _timeLabel(conversation.lastMessageAt),
              unread: conversation.unread,
              onTap: () => Navigator.push(
                  context,
                  MaterialPageRoute(
                      builder: (_) => ConversationScreen(
                          conversationId: conversation.id,
                          name: conversation.otherName))))),
        if (!loading && conversations.isEmpty) ...[
          _Conversation(
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
                            conversationId: 'demo-kabelo', name: 'Kabelo')));
              }),
          const _Conversation(
              initial: 'A',
              name: 'Ama',
              preview: 'That sounds like a great weekend plan.',
              time: 'Yesterday'),
          const _Conversation(
              initial: 'N', name: 'Nandi', preview: 'Photo', time: 'Mon'),
        ],
        const SizedBox(height: 20),
        const SurfaceCard(
            child:
                Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          StatusPill('Private by design', tone: PillTone.good),
          SizedBox(height: 9),
          Text('Conversations are only available after mutual interest.',
              style: TextStyle(fontWeight: FontWeight.w700)),
          SizedBox(height: 4),
          Text('Keep it kind, curious, and true to you.',
              style: TextStyle(color: AppColors.muted, fontSize: 12))
        ])),
      ]);

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

class _Conversation extends StatelessWidget {
  const _Conversation(
      {required this.initial,
      required this.name,
      required this.preview,
      required this.time,
      this.unread = 0,
      this.onTap});
  final String initial;
  final String name;
  final String preview;
  final String time;
  final int unread;
  final VoidCallback? onTap;
  @override
  Widget build(BuildContext context) => Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: InkWell(
          onTap: onTap,
          borderRadius: BorderRadius.circular(16),
          child: SurfaceCard(
              padding: const EdgeInsets.all(13),
              child: Row(children: [
                InitialAvatar(initial, size: 52, color: AppColors.plum),
                const SizedBox(width: 12),
                Expanded(
                    child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                      Row(children: [
                        Text(name,
                            style:
                                const TextStyle(fontWeight: FontWeight.w700)),
                        const Spacer(),
                        Text(time,
                            style: TextStyle(
                                color: context.palette.muted, fontSize: 11))
                      ]),
                      const SizedBox(height: 6),
                      Text(preview,
                          overflow: TextOverflow.ellipsis,
                          style: TextStyle(
                              color: context.palette.muted, fontSize: 13))
                    ])),
                if (unread > 0)
                  Container(
                      margin: const EdgeInsets.only(left: 8),
                      padding: const EdgeInsets.all(6),
                      decoration: const BoxDecoration(
                          color: AppColors.clay, shape: BoxShape.circle),
                      child: Text('$unread',
                          style: const TextStyle(
                              color: Colors.white,
                              fontSize: 11,
                              fontWeight: FontWeight.w700)))
              ]))));
}
