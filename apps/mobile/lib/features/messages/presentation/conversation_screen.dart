import 'dart:async';

import 'package:flutter/material.dart';

import '../../../core/realtime/realtime_chat_client.dart';
import '../../../core/services.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/widgets/app_widgets.dart';
import '../../../core/widgets/nia_kit.dart';
import '../data/chat_repository.dart';

class ConversationScreen extends StatefulWidget {
  const ConversationScreen(
      {required this.conversationId, required this.name, super.key});

  final String conversationId;
  final String name;

  @override
  State<ConversationScreen> createState() => _ConversationScreenState();
}

class _ConversationScreenState extends State<ConversationScreen> {
  final draft = TextEditingController();
  final messages = <ChatMessage>[];
  RealtimeChatClient? realtime;
  StreamSubscription<Map<String, dynamic>>? events;
  StreamSubscription<RealtimeStatus>? statusEvents;
  String? currentUserId;
  String? error;
  bool previewMode = false;
  bool live = false;
  bool loading = true;
  bool sending = false;

  @override
  void initState() {
    super.initState();
    loadHistory();
  }

  Future<void> loadHistory() async {
    currentUserId = await AppServices.sessions.readUserId();
    try {
      final loaded = await AppServices.chat.history(widget.conversationId);
      if (mounted) {
        setState(() => messages
          ..clear()
          ..addAll(loaded));
      }
    } catch (_) {
      previewMode = widget.conversationId.startsWith('demo-');
      if (previewMode) {
        messages.addAll([
          ChatMessage(
            id: 'preview-1',
            senderId: 'other',
            content: 'I am glad we found each other here.',
            createdAt: DateTime.now().subtract(const Duration(minutes: 12)),
          ),
          ChatMessage(
            id: 'preview-2',
            senderId: 'me',
            content: 'Me too. What has been energising you lately?',
            createdAt: DateTime.now().subtract(const Duration(minutes: 8)),
          ),
        ]);
      } else {
        error = 'Chat history is unavailable right now.';
      }
    } finally {
      try {
        if (!previewMode) {
          await AppServices.chat.markRead(widget.conversationId);
        }
      } catch (_) {
        // A read receipt must not prevent the conversation from opening.
      }
      await connectRealtime();
      if (mounted) setState(() => loading = false);
    }
  }

  Future<void> connectRealtime() async {
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
      if (!mounted ||
          event['type'] != 'message' ||
          event['conversationId'] != widget.conversationId) {
        return;
      }
      final raw = event['message'];
      if (raw is Map<String, dynamic> &&
          raw['id'] is String &&
          !messages.any((m) => m.id == raw['id'])) {
        setState(() => messages.add(ChatMessage.fromJson(raw)));
      }
    });
    statusEvents = realtime!.status.listen((status) {
      if (mounted) setState(() => live = status == RealtimeStatus.connected);
    });
    realtime!.connect();
  }

  Future<void> send() async {
    final text = draft.text.trim();
    if (text.isEmpty || sending || error != null) return;
    setState(() {
      sending = true;
      draft.clear();
    });
    try {
      if (previewMode) {
        if (mounted) {
          setState(() => messages.add(ChatMessage(
                id: 'local-${DateTime.now().microsecondsSinceEpoch}',
                senderId: currentUserId ?? 'me',
                content: text,
                createdAt: DateTime.now(),
              )));
        }
        return;
      }
      final message = await AppServices.chat.send(widget.conversationId, text);
      if (mounted && !messages.any((m) => m.id == message.id)) {
        setState(() => messages.add(message));
      }
    } catch (exception) {
      if (mounted) {
        draft.text = text;
        ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text('Message was not sent: $exception')));
      }
    } finally {
      if (mounted) setState(() => sending = false);
    }
  }

  @override
  void dispose() {
    draft.dispose();
    events?.cancel();
    statusEvents?.cancel();
    realtime?.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final initial =
        widget.name.trim().isEmpty ? 'M' : widget.name.trim()[0].toUpperCase();
    return Scaffold(
      appBar: AppBar(
        title: Row(children: [
          InitialAvatar(initial, size: 34, color: AppColors.plum),
          const SizedBox(width: 10),
          Expanded(
              child: Text(widget.name,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: inter(17, weight: FontWeight.w700))),
          StatusPill(live ? 'Live' : 'Offline',
              tone: live ? PillTone.good : PillTone.neutral),
        ]),
      ),
      body: Column(children: [
        Expanded(child: _messageBody()),
        if (!loading && error == null && messages.isEmpty)
          Padding(
            padding: const EdgeInsets.fromLTRB(14, 4, 14, 6),
            child: SuggestionChips(
              label: 'Start with an opener',
              suggestions: const [
                'What does a good evening look like for you?',
                'What are you hoping to find here?',
                'What have you been proud of lately?',
                'What got you into your line of work?',
              ],
              onPick: (text) {
                draft.text = text;
                send();
              },
            ),
          ),
        SafeArea(
          child: Padding(
            padding: const EdgeInsets.fromLTRB(14, 8, 14, 12),
            child: Row(children: [
              Expanded(
                child: TextField(
                  controller: draft,
                  enabled: !sending && error == null,
                  textInputAction: TextInputAction.send,
                  onSubmitted: (_) => send(),
                  style: inter(14.5,
                      weight: FontWeight.w400, color: context.palette.ink),
                  decoration: InputDecoration(
                    hintText: 'Write something thoughtful',
                    hintStyle: inter(14.5,
                        weight: FontWeight.w400, color: context.palette.muted),
                    contentPadding: const EdgeInsets.symmetric(
                        horizontal: 18, vertical: 14),
                    border: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(NiaRadius.pill),
                        borderSide: BorderSide(color: context.palette.line)),
                    enabledBorder: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(NiaRadius.pill),
                        borderSide: BorderSide(color: context.palette.line)),
                    focusedBorder: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(NiaRadius.pill),
                        borderSide: const BorderSide(
                            color: AppColors.clay, width: 1.5)),
                  ),
                ),
              ),
              const SizedBox(width: 10),
              ActionBubble(
                icon: Icons.arrow_upward_rounded,
                tone: ActionTone.brand,
                size: 48,
                semanticLabel: 'Send message',
                busy: sending,
                onTap: sending || error != null ? null : send,
              ),
            ]),
          ),
        ),
      ]),
    );
  }

  Widget _messageBody() {
    if (loading) return const Center(child: CircularProgressIndicator());
    if (error != null) {
      return Center(
          child: Text(error!, style: TextStyle(color: context.palette.muted)));
    }
    if (messages.isEmpty) {
      return const Center(child: Text('Start with something curious.'));
    }
    return ListView.builder(
      padding: const EdgeInsets.all(18),
      itemCount: messages.length,
      itemBuilder: (context, index) {
        final message = messages[index];
        final mine =
            message.senderId == currentUserId || message.senderId == 'me';
        return Align(
          alignment: mine ? Alignment.centerRight : Alignment.centerLeft,
          child: Container(
            margin: const EdgeInsets.only(bottom: 10),
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 11),
            constraints: const BoxConstraints(maxWidth: 290),
            decoration: BoxDecoration(
              color: mine ? AppColors.clay : context.palette.surface,
              border: Border.all(
                  color: mine ? AppColors.clay : context.palette.line),
              // Asymmetric corners: the corner nearest the sender is pulled
              // in, so the bubble reads as coming from a side rather than
              // being a floating rectangle.
              borderRadius: BorderRadius.only(
                topLeft: const Radius.circular(NiaRadius.lg),
                topRight: const Radius.circular(NiaRadius.lg),
                bottomLeft: mine
                    ? const Radius.circular(NiaRadius.lg)
                    : const Radius.circular(NiaRadius.sm),
                bottomRight: mine
                    ? const Radius.circular(NiaRadius.sm)
                    : const Radius.circular(NiaRadius.lg),
              ),
            ),
            child: Text(
              message.isDeleted ? 'Message recalled' : message.content,
              style: inter(14.5,
                  weight: FontWeight.w400,
                  // Text on a brand-filled bubble follows the same
                  // "on-brand" rule as every other filled control.
                  color: mine ? context.palette.onBrand : context.palette.ink,
                  height: 1.45),
            ),
          ),
        );
      },
    );
  }
}
