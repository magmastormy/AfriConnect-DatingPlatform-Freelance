import 'package:flutter/material.dart';

import '../../../core/services.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/widgets/app_widgets.dart';
import '../../messages/presentation/conversation_screen.dart';

class MatchesScreen extends StatefulWidget {
  const MatchesScreen({super.key});
  @override
  State<MatchesScreen> createState() => _MatchesScreenState();
}

class _MatchesScreenState extends State<MatchesScreen> {
  List<Map<String, dynamic>> matches = [];
  bool loading = true;

  @override
  void initState() {
    super.initState();
    loadMatches();
  }

  Future<void> loadMatches() async {
    try {
      final loaded = await AppServices.matches.mutual();
      if (mounted) setState(() => matches = loaded);
    } catch (_) {
      // Preview rows remain available without a signed-in API session.
    } finally {
      if (mounted) setState(() => loading = false);
    }
  }

  Future<void> openConversation(Map<String, dynamic> match) async {
    final userId = match['userId'] as String?;
    if (userId == null || userId.isEmpty) return;
    try {
      final conversationId = await AppServices.chat.createConversation(userId);
      if (!mounted) return;
      final name = match['name'] as String? ??
          match['displayName'] as String? ??
          'Member';
      await Navigator.push(
          context,
          MaterialPageRoute(
              builder: (_) => ConversationScreen(
                  conversationId: conversationId, name: name)));
    } catch (exception) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text('Could not open conversation: $exception')));
      }
    }
  }

  @override
  Widget build(BuildContext context) =>
      ListView(padding: const EdgeInsets.fromLTRB(20, 4, 20, 28), children: [
        Text('The people who chose you back.',
            style: editorial(28, weight: FontWeight.w700)),
        const SizedBox(height: 7),
        const Text(
            'Mutual interest opens the door to a thoughtful conversation.',
            style: TextStyle(color: AppColors.muted, height: 1.45)),
        const SizedBox(height: 24),
        if (loading)
          const Padding(
              padding: EdgeInsets.all(20),
              child: Center(child: CircularProgressIndicator())),
        if (matches.isNotEmpty)
          ...matches.map((match) => _MatchRow(
              initial: _initial(match),
              name: _name(match),
              role: _role(match),
              score: '${match['score'] ?? 100}%',
              action: () => openConversation(match))),
        if (!loading && matches.isEmpty) ...const [
          SurfaceCard(
              child: Row(children: [
            InitialAvatar('K', size: 62, color: AppColors.clayDark),
            SizedBox(width: 13),
            Expanded(
                child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                  Text('Kabelo, 34',
                      style:
                          TextStyle(fontWeight: FontWeight.w700, fontSize: 16)),
                  SizedBox(height: 4),
                  Text('Entrepreneur · Sandton',
                      style: TextStyle(color: AppColors.muted, fontSize: 13)),
                  SizedBox(height: 8),
                  StatusPill('New match', tone: PillTone.brand)
                ])),
            FilledButton(onPressed: null, child: Text('Message'))
          ])),
          SizedBox(height: 24),
          SectionHeader('People you may like'),
          _MatchRow(
              initial: 'S',
              name: 'Sibongile, 29',
              role: 'Finance · Cape Town',
              score: '91%'),
          _MatchRow(
              initial: 'T',
              name: 'Thabo, 36',
              role: 'Strategy · Johannesburg',
              score: '88%'),
          _MatchRow(
              initial: 'M',
              name: 'Maya, 30',
              role: 'Law · Pretoria',
              score: '84%'),
        ],
      ]);

  String _name(Map<String, dynamic> match) =>
      match['displayName'] as String? ??
      match['fullName'] as String? ??
      'Member';
  String _initial(Map<String, dynamic> match) =>
      _name(match).trim().isEmpty ? 'M' : _name(match).trim()[0].toUpperCase();
  String _role(Map<String, dynamic> match) => [
        match['profession'],
        match['city']
      ].whereType<String>().where((v) => v.isNotEmpty).join(' · ');
}

class _MatchRow extends StatelessWidget {
  const _MatchRow(
      {required this.initial,
      required this.name,
      required this.role,
      required this.score,
      this.action});
  final String initial;
  final String name;
  final String role;
  final String score;
  final VoidCallback? action;
  @override
  Widget build(BuildContext context) => Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: SurfaceCard(
          padding: const EdgeInsets.all(12),
          child: Row(children: [
            InitialAvatar(initial, size: 52, color: AppColors.plum),
            const SizedBox(width: 12),
            Expanded(
                child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                  Text(name,
                      style: const TextStyle(fontWeight: FontWeight.w700)),
                  const SizedBox(height: 3),
                  Text(role,
                      style:
                          const TextStyle(color: AppColors.muted, fontSize: 12))
                ])),
            StatusPill(score, tone: PillTone.good),
            const SizedBox(width: 4),
            IconButton(
                onPressed: action,
                icon: const Icon(Icons.chevron_right, color: AppColors.muted))
          ])));
}
