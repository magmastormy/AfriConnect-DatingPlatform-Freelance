import 'dart:async';
import 'dart:convert';

import 'package:web_socket_channel/web_socket_channel.dart';

enum RealtimeStatus { disconnected, connecting, connected }

class RealtimeChatClient {
  RealtimeChatClient({
    required this.apiBaseUrl,
    this.token,
    this.tokenProvider,
    this.refreshTokenProvider,
  });

  final String apiBaseUrl;
  String? token;
  final Future<String?> Function()? tokenProvider;
  final Future<String?> Function()? refreshTokenProvider;
  WebSocketChannel? _channel;
  Timer? _reconnectTimer;
  final _events = StreamController<Map<String, dynamic>>.broadcast();
  final _status = StreamController<RealtimeStatus>.broadcast();
  var _disposed = false;
  var _connecting = false;
  var _hasConnected = false;
  var _reconnectAttempt = 0;

  Stream<Map<String, dynamic>> get events => _events.stream;
  Stream<RealtimeStatus> get status => _status.stream;

  void connect() {
    if (_disposed || _connecting || _channel != null) return;
    unawaited(_connect());
  }

  Future<void> _connect() async {
    _connecting = true;
    _status.add(RealtimeStatus.connecting);
    try {
      final resolvedToken = await _resolveToken();
      if (_disposed || resolvedToken == null || resolvedToken.isEmpty) {
        _scheduleReconnect();
        return;
      }
      final base = Uri.parse(apiBaseUrl);
      final wsScheme = base.scheme == 'https' ? 'wss' : 'ws';
      final path = base.path.replaceFirst(RegExp(r'/v1/?$'), '/ws');
      final uri = base.replace(
        scheme: wsScheme,
        path: path,
        queryParameters: {'token': resolvedToken},
      );
      final channel = WebSocketChannel.connect(uri);
      _channel = channel;
      await channel.ready;
      if (_disposed) return;
      token = resolvedToken;
      _hasConnected = true;
      _reconnectAttempt = 0;
      _status.add(RealtimeStatus.connected);
      channel.stream.listen(
        _handleFrame,
        onError: (Object error, StackTrace stackTrace) {
          _events.addError(error, stackTrace);
          _disconnectAndSchedule();
        },
        onDone: _disconnectAndSchedule,
        cancelOnError: true,
      );
    } catch (error, stackTrace) {
      _events.addError(error, stackTrace);
      _disconnectAndSchedule();
    } finally {
      _connecting = false;
    }
  }

  Future<String?> _resolveToken() async {
    if (_hasConnected && refreshTokenProvider != null) {
      return refreshTokenProvider!();
    }
    return token ?? await tokenProvider?.call();
  }

  void _handleFrame(dynamic raw) {
    if (raw is! String) return;
    try {
      final decoded = jsonDecode(raw);
      if (decoded is Map<String, dynamic>) _events.add(decoded);
    } catch (error, stackTrace) {
      _events.addError(error, stackTrace);
    }
  }

  void _disconnectAndSchedule() {
    if (_disposed) return;
    _channel = null;
    _status.add(RealtimeStatus.disconnected);
    _scheduleReconnect();
  }

  void _scheduleReconnect() {
    if (_disposed || _reconnectTimer != null) return;
    final seconds = 1 << _reconnectAttempt.clamp(0, 5).toInt();
    _reconnectAttempt = (_reconnectAttempt + 1).clamp(0, 5).toInt();
    _reconnectTimer = Timer(Duration(seconds: seconds), () {
      _reconnectTimer = null;
      connect();
    });
  }

  void ping() => _channel?.sink.add(jsonEncode({'type': 'ping'}));

  Future<void> dispose() async {
    _disposed = true;
    _reconnectTimer?.cancel();
    _reconnectTimer = null;
    await _channel?.sink.close();
    _channel = null;
    await _events.close();
    await _status.close();
  }
}
