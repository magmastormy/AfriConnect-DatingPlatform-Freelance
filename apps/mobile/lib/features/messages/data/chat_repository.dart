import '../../../core/api/api_client.dart';

class ChatMessage {
  const ChatMessage(
      {required this.id,
      required this.senderId,
      required this.content,
      required this.createdAt,
      this.imageUrl,
      this.isDeleted = false,
      this.recalledAt});
  final String id;
  final String senderId;
  final String content;
  final DateTime createdAt;
  final String? imageUrl;
  final bool isDeleted;
  final DateTime? recalledAt;

  factory ChatMessage.fromJson(Map<String, dynamic> json) => ChatMessage(
      id: json['id'] as String? ?? '',
      senderId: json['senderId'] as String? ?? '',
      content: json['content'] as String? ?? '',
      createdAt: DateTime.tryParse(json['createdAt'] as String? ?? '') ??
          DateTime.now(),
      imageUrl: json['imageUrl'] as String?,
      isDeleted: json['isDeleted'] as bool? ?? false,
      recalledAt: DateTime.tryParse(json['recalledAt'] as String? ?? ''));
}

class ChatConversation {
  const ChatConversation(
      {required this.id,
      required this.otherName,
      required this.otherId,
      required this.preview,
      required this.unread,
      this.photo,
      this.verified = false,
      this.isPremium = false,
      this.lastMessageAt});
  final String id;
  final String otherName;
  final String otherId;
  final String preview;
  final int unread;
  final String? photo;
  final bool verified;
  final bool isPremium;
  final DateTime? lastMessageAt;

  ChatConversation copyWith(
      {String? preview, int? unread, DateTime? lastMessageAt}) {
    return ChatConversation(
      id: id,
      otherName: otherName,
      otherId: otherId,
      preview: preview ?? this.preview,
      unread: unread ?? this.unread,
      photo: photo,
      verified: verified,
      isPremium: isPremium,
      lastMessageAt: lastMessageAt ?? this.lastMessageAt,
    );
  }

  factory ChatConversation.fromJson(Map<String, dynamic> json) {
    final other = json['other'] as Map<String, dynamic>?;
    final last = json['lastMessage'] as Map<String, dynamic>?;
    return ChatConversation(
        id: json['id'] as String? ?? '',
        otherId: other?['userId'] as String? ?? '',
        otherName: other?['displayName'] as String? ?? 'Member',
        preview: last?['isDeleted'] == true
            ? 'Message recalled'
            : (last?['content'] as String? ??
                (last?['imageUrl'] != null ? 'Photo' : 'No messages yet')),
        unread: (json['unread'] as num?)?.toInt() ?? 0,
        photo: other?['photo'] as String?,
        verified: other?['verified'] as bool? ?? false,
        isPremium: other?['isPremium'] as bool? ?? false,
        lastMessageAt: DateTime.tryParse(last?['createdAt'] as String? ?? ''));
  }
}

class ChatRepository {
  ChatRepository(this._api);
  final ApiClient _api;

  Future<List<ChatConversation>> conversations() async {
    final raw = await _api.get<List<dynamic>>('/chat/conversations');
    return raw
        .whereType<Map<String, dynamic>>()
        .map(ChatConversation.fromJson)
        .toList();
  }

  Future<List<ChatMessage>> history(String conversationId) async {
    final raw =
        await _api.get<List<dynamic>>('/chat/conversations/$conversationId');
    return raw
        .whereType<Map<String, dynamic>>()
        .map(ChatMessage.fromJson)
        .toList();
  }

  Future<ChatMessage> send(String conversationId, String content) async {
    final data = await _api.post<Map<String, dynamic>>(
        '/chat/conversations/$conversationId', {'content': content});
    return ChatMessage.fromJson(data);
  }

  Future<String> createConversation(String targetUserId) async {
    final data = await _api.post<Map<String, dynamic>>(
      '/chat/conversations',
      {'targetId': targetUserId},
    );
    final id = data['id'] as String?;
    if (id == null || id.isEmpty) {
      throw const ApiFailure('The conversation response was incomplete.',
          code: 'BAD_CONVERSATION');
    }
    return id;
  }

  Future<void> markRead(String conversationId) async {
    await _api.post<Map<String, dynamic>>(
        '/chat/conversations/$conversationId/read', {});
  }
}
