import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../../core/config/app_config.dart';
import '../../../core/services.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/widgets/app_widgets.dart';
import '../../../core/widgets/nia_kit.dart';
import '../../../core/widgets/theme_mode_selector.dart';

class ProfileScreen extends StatefulWidget {
  const ProfileScreen({super.key});

  @override
  State<ProfileScreen> createState() => _ProfileScreenState();
}

class _ProfileScreenState extends State<ProfileScreen> {
  Map<String, dynamic>? profile;
  bool notifications = true;
  bool nearby = false;
  bool loading = true;
  bool saving = false;
  bool isPremium = false;
  String? vettingStatus;

  @override
  void initState() {
    super.initState();
    loadAccount();
  }

  Future<void> loadAccount() async {
    var notificationsEnabled = true;
    try {
      notificationsEnabled =
          await AppServices.sessions.readNotificationsEnabled();
    } catch (_) {
      // Secure preference failure must not hide the server-backed profile.
    }
    try {
      final loaded = await AppServices.account.getProfile();
      final status = await AppServices.account.vettingStatus();
      final subscription = await AppServices.account.subscription();
      if (!mounted) return;
      setState(() {
        profile = loaded;
        notifications = notificationsEnabled;
        nearby = loaded['nearbyEnabled'] == true;
        isPremium =
            (subscription['plan'] as String?)?.toLowerCase() != 'free' &&
                subscription['plan'] != null;
        vettingStatus = status['verified'] == true
            ? 'Identity verified. Matching and messaging are unlocked.'
            : _statusLabel(status['status'] as String?);
      });
    } catch (_) {
      // The surface remains usable while the API is offline; edits still show a clear save error.
    } finally {
      if (mounted) setState(() => loading = false);
    }
  }

  String _statusLabel(String? status) => switch (status) {
        'pending' => 'Your identity check is being reviewed.',
        'rejected' => 'Your identity check needs another attempt.',
        _ => 'Complete your identity check to unlock matching and messages.',
      };

  String get displayName {
    final explicit = profile?['displayName'] as String?;
    if (explicit != null && explicit.trim().isNotEmpty) return explicit;
    final name =
        '${profile?['firstName'] ?? ''} ${profile?['lastName'] ?? ''}'.trim();
    return name.isEmpty ? 'Complete your profile' : name;
  }

  String get profession =>
      (profile?['profession'] as String?)?.trim().isNotEmpty == true
          ? profile!['profession'] as String
          : 'Add your profession';
  String get city => _pretty(profile?['city'] as String?);
  List<String> get photoUrls => (profile?['photos'] is List<dynamic>
          ? profile!['photos'] as List<dynamic>
          : const [])
      .map((photo) => photo is String
          ? photo
          : photo is Map<String, dynamic>
              ? photo['url']
              : null)
      .whereType<String>()
      .where((url) => url.isNotEmpty)
      .toList();
  String _pretty(String? value) {
    final raw = (value ?? '').trim();
    if (raw.isEmpty) return 'Add your city';
    return raw
        .replaceAll('_', ' ')
        .split(' ')
        .map((word) => word.isEmpty
            ? word
            : '${word[0].toUpperCase()}${word.substring(1)}')
        .join(' ');
  }

  /// Honest, human-readable gender for the attribute-chip strip. Returns '' when
  /// the member hasn't shared one, so no fake placeholder chip is ever shown.
  String get genderLabel {
    final raw = (profile?['gender'] as String?)?.trim().toLowerCase();
    return switch (raw) {
      'female' => 'Woman',
      'male' => 'Man',
      'non_binary' => 'Non-binary',
      'other' => 'Other',
      _ => '',
    };
  }

  /// Only real profile attributes, in display order. Empty values are skipped;
  /// [AttributeChips] turns a partial or empty list into a single add affordance.
  List<String> get attributeChips {
    final list = <String>[];
    final prof = (profile?['profession'] as String?)?.trim() ?? '';
    if (prof.isNotEmpty) list.add(prof);
    final c = (profile?['city'] as String?)?.trim() ?? '';
    if (c.isNotEmpty) list.add(_pretty(c));
    final g = genderLabel;
    if (g.isNotEmpty) list.add(g);
    return list;
  }

  Uri _mobileHostedUri(String raw) {
    final uri = Uri.parse(raw);
    if (defaultTargetPlatform == TargetPlatform.android &&
        (uri.host == 'localhost' || uri.host == '127.0.0.1')) {
      return uri.replace(host: '10.0.2.2');
    }
    return uri;
  }

  Future<void> startVetting() async {
    setState(() => saving = true);
    try {
      final result = await AppServices.account.startVetting();
      final hostedUrl = result['hostedUrl'] as String?;
      if (hostedUrl == null ||
          !await launchUrl(_mobileHostedUri(hostedUrl),
              mode: LaunchMode.externalApplication)) {
        throw Exception('Could not open the verification page.');
      }
      if (mounted) {
        setState(() => vettingStatus =
            'Vetting opened in your browser. Return here to refresh your status.');
      }
    } catch (e) {
      if (mounted) setState(() => vettingStatus = e.toString());
    } finally {
      if (mounted) setState(() => saving = false);
    }
  }

  Future<void> refreshVetting() async {
    try {
      final result = await AppServices.account.vettingStatus();
      if (mounted) {
        setState(() => vettingStatus = result['verified'] == true
            ? 'Identity verified. Matching and messaging are unlocked.'
            : _statusLabel(result['status'] as String?));
      }
    } catch (e) {
      if (mounted) setState(() => vettingStatus = e.toString());
    }
  }

  Future<void> openPayment() async {
    try {
      final result = await AppServices.account.checkout(
        plan: 'premium',
        successUrl: AppConfig.paymentReturn('success').toString(),
        cancelUrl: AppConfig.paymentReturn('cancelled').toString(),
      );
      final url = result['url'] as String?;
      if (url == null ||
          !await launchUrl(Uri.parse(url),
              mode: LaunchMode.externalApplication)) {
        throw Exception('Could not open checkout.');
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text(e.toString())));
      }
    }
  }

  Future<void> signOut() async {
    try {
      await AppServices.auth.signOut();
    } finally {
      if (mounted) context.go('/login');
    }
  }

  Future<void> editProfile() async {
    final first =
        TextEditingController(text: profile?['firstName'] as String? ?? '');
    final last =
        TextEditingController(text: profile?['lastName'] as String? ?? '');
    final professionController =
        TextEditingController(text: profile?['profession'] as String? ?? '');
    final bioController =
        TextEditingController(text: profile?['bio'] as String? ?? '');
    final employerController =
        TextEditingController(text: profile?['employer'] as String? ?? '');
    const cities = {
      'johannesburg',
      'cape_town',
      'pietermaritzburg',
      'durban',
      'pretoria'
    };
    const genders = {'female', 'male', 'non_binary', 'other'};
    final existingCity = profile?['city'] as String?;
    final existingGender = profile?['gender'] as String?;
    var selectedCity = cities.contains(existingCity) ? existingCity : null;
    var selectedGender =
        genders.contains(existingGender) ? existingGender : null;
    final saved = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: const Text('Edit your profile'),
        content: SingleChildScrollView(
            child: Column(mainAxisSize: MainAxisSize.min, children: [
          TextField(
              controller: first,
              decoration: const InputDecoration(labelText: 'First name')),
          const SizedBox(height: 12),
          TextField(
              controller: last,
              decoration: const InputDecoration(labelText: 'Last name')),
          const SizedBox(height: 12),
          TextField(
              controller: professionController,
              decoration: const InputDecoration(labelText: 'Profession')),
          const SizedBox(height: 12),
          TextField(
              controller: employerController,
              decoration: const InputDecoration(labelText: 'Employer')),
          const SizedBox(height: 12),
          TextField(
              controller: bioController,
              maxLines: 3,
              maxLength: 500,
              decoration: const InputDecoration(labelText: 'About you')),
          const SizedBox(height: 12),
          DropdownButtonFormField<String>(
              initialValue: selectedCity,
              decoration: const InputDecoration(labelText: 'City'),
              items: const [
                DropdownMenuItem(
                    value: 'johannesburg', child: Text('Johannesburg')),
                DropdownMenuItem(value: 'cape_town', child: Text('Cape Town')),
                DropdownMenuItem(
                    value: 'pietermaritzburg', child: Text('Pietermaritzburg')),
                DropdownMenuItem(value: 'durban', child: Text('Durban')),
                DropdownMenuItem(value: 'pretoria', child: Text('Pretoria')),
              ],
              onChanged: (value) => selectedCity = value),
          const SizedBox(height: 12),
          DropdownButtonFormField<String>(
              initialValue: selectedGender,
              decoration: const InputDecoration(labelText: 'Gender'),
              items: const [
                DropdownMenuItem(value: 'female', child: Text('Female')),
                DropdownMenuItem(value: 'male', child: Text('Male')),
                DropdownMenuItem(
                    value: 'non_binary', child: Text('Non-binary')),
                DropdownMenuItem(value: 'other', child: Text('Other')),
              ],
              onChanged: (value) => selectedGender = value),
        ])),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(dialogContext, false),
              child: const Text('Cancel')),
          FilledButton(
              onPressed: () async {
                if (first.text.trim().isEmpty ||
                    last.text.trim().isEmpty ||
                    selectedCity == null ||
                    selectedGender == null) {
                  ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
                      content: Text(
                          'Add your name, city, and gender before saving.')));
                  return;
                }
                try {
                  final savedProfile = await AppServices.account.updateProfile({
                    'firstName': first.text.trim(),
                    'lastName': last.text.trim(),
                    'profession': professionController.text.trim(),
                    'employer': employerController.text.trim(),
                    'bio': bioController.text.trim(),
                    if (selectedCity != null) 'city': selectedCity,
                    if (selectedGender != null) 'gender': selectedGender,
                  });
                  if (!dialogContext.mounted) return;
                  Navigator.pop(dialogContext, true);
                  if (mounted) setState(() => profile = savedProfile);
                } catch (e) {
                  if (mounted) {
                    ScaffoldMessenger.of(context)
                        .showSnackBar(SnackBar(content: Text(e.toString())));
                  }
                }
              },
              child: const Text('Save')),
        ],
      ),
    );
    first.dispose();
    last.dispose();
    professionController.dispose();
    bioController.dispose();
    employerController.dispose();
    if (saved == true && mounted) {
      ScaffoldMessenger.of(context)
          .showSnackBar(const SnackBar(content: Text('Profile saved')));
    }
  }

  Future<void> toggleNearby(bool value) async {
    final previous = nearby;
    setState(() => nearby = value);
    try {
      final updated = await AppServices.account.updateNearby(value);
      if (mounted) setState(() => profile = updated);
    } catch (e) {
      if (!mounted) return;
      setState(() => nearby = previous);
      ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Could not save nearby preference: $e')));
    }
  }

  Future<void> toggleNotifications(bool value) async {
    setState(() => notifications = value);
    try {
      await AppServices.sessions.saveNotificationsEnabled(value);
    } catch (exception) {
      if (!mounted) return;
      setState(() => notifications = !value);
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(
          content: Text('Could not save notification preference: $exception')));
    }
  }

  Future<void> togglePaused(bool value) async {
    try {
      final updated = await AppServices.account.pauseProfile(value);
      if (mounted) setState(() => profile = updated);
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text('Could not update profile visibility: $e')));
      }
    }
  }

  Future<void> addPhoto() async {
    final controller = TextEditingController();
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: const Text('Add a profile photo'),
        content: TextField(
          controller: controller,
          keyboardType: TextInputType.url,
          decoration: const InputDecoration(hintText: 'https://...'),
        ),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(dialogContext, false),
              child: const Text('Cancel')),
          FilledButton(
              onPressed: () => Navigator.pop(dialogContext, true),
              child: const Text('Add photo')),
        ],
      ),
    );
    final url = controller.text.trim();
    controller.dispose();
    if (confirmed != true || !mounted) return;
    final parsed = Uri.tryParse(url);
    if (parsed == null ||
        !parsed.hasScheme ||
        !{'http', 'https'}.contains(parsed.scheme)) {
      ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Use a valid HTTPS image URL.')));
      return;
    }
    try {
      final updated =
          await AppServices.account.addPhoto(url, isPrimary: photoUrls.isEmpty);
      if (mounted) setState(() => profile = updated);
    } catch (exception) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text('Could not add photo: $exception')));
      }
    }
  }

  Future<void> removePhoto(String url) async {
    try {
      final updated = await AppServices.account.removePhoto(url);
      if (mounted) setState(() => profile = updated);
    } catch (exception) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text('Could not remove photo: $exception')));
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    if (loading) {
      return const Padding(
          padding: EdgeInsets.all(24), child: ShimmerBlock(height: 150));
    }
    final paused = profile?['isPaused'] == true;
    final vettingVerified = vettingStatus?.contains('verified') == true;
    final complete = (profile?['completenessScore'] as num?)?.toInt() ??
        (profile?['isComplete'] == true ? 100 : 40);
    return ListView(
        padding: const EdgeInsets.fromLTRB(20, 4, 20, 28),
        children: [
          // Identity hero. Every other tab opens with a display headline and
          // one supporting line; "You" opened with whatever settings happened
          // to come first, which gave it no top at all.
          Container(
              padding: const EdgeInsets.all(18),
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  colors: [
                    context.palette.surfaceRaised,
                    context.palette.brandSoft.withValues(alpha: 0.34),
                  ],
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                ),
                borderRadius: BorderRadius.circular(NiaRadius.lg),
                border: Border.all(color: context.palette.line),
              ),
              child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(children: [
                      _ProfileAvatar(
                        letter: displayName.isEmpty
                            ? 'M'
                            : displayName[0].toUpperCase(),
                        photoUrl: photoUrls.isNotEmpty ? photoUrls.first : null,
                        size: 72,
                      ),
                      const SizedBox(width: 14),
                      Expanded(
                          child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                            Text(displayName,
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                style: editorial(22, weight: FontWeight.w700)),
                          ])),
                      IconButton(
                          onPressed: editProfile,
                          tooltip: 'Edit profile',
                          icon: const Icon(Icons.edit_outlined))
                    ]),
                    const SizedBox(height: 14),
                    AttributeChips(chips: attributeChips, onAdd: editProfile),
                    const SizedBox(height: 18),
                    _CompletenessBar(score: complete),
                    const SizedBox(height: 14),
                    Row(children: [
                      StatusPill(
                          // The status string is a human sentence, so this stays
                          // a substring test rather than an equality check.
                          vettingVerified ? 'Verified' : 'Vetting needed',
                          tone:
                              vettingVerified ? PillTone.good : PillTone.warn),
                      const SizedBox(width: 6),
                      StatusPill('$complete% complete',
                          tone: complete >= 80 ? PillTone.good : PillTone.warn)
                    ]),
                    const SizedBox(height: 12),
                    InkWell(
                      onTap: _showVoiceIntroSoon,
                      borderRadius: BorderRadius.circular(NiaRadius.sm),
                      child: Row(children: [
                        Icon(Icons.graphic_eq_rounded,
                            color: context.palette.muted, size: 20),
                        const SizedBox(width: 10),
                        Expanded(
                          child: Text('Voice intro',
                              style: inter(14,
                                  weight: FontWeight.w600,
                                  color: context.palette.ink)),
                        ),
                        StatusPill('Soon', tone: PillTone.neutral),
                        const SizedBox(width: 4),
                        Icon(Icons.chevron_right, color: context.palette.muted),
                      ]),
                    ),
                  ])),
          const SizedBox(height: 14),
          SectionHeader('Your photos', action: 'Add', onAction: addPhoto),
          SurfaceCard(
            child: photoUrls.isEmpty
                ? Row(children: [
                    Icon(Icons.photo_camera_outlined,
                        color: context.palette.muted),
                    const SizedBox(width: 10),
                    Expanded(
                        child: Text(
                            'Add a clear, recent photo to make your introduction feel more personal.',
                            style: TextStyle(
                                color: context.palette.muted,
                                fontSize: 12,
                                height: 1.4)))
                  ])
                : SizedBox(
                    height: 96,
                    child: ListView.separated(
                      scrollDirection: Axis.horizontal,
                      itemCount: photoUrls.length,
                      separatorBuilder: (_, __) => const SizedBox(width: 10),
                      itemBuilder: (context, index) => Stack(children: [
                        ClipRRect(
                            borderRadius: BorderRadius.circular(NiaRadius.md),
                            child: Image.network(photoUrls[index],
                                width: 96,
                                height: 96,
                                fit: BoxFit.cover,
                                errorBuilder: (_, __, ___) => Container(
                                    width: 96,
                                    height: 96,
                                    color: context.palette.surfaceRaised,
                                    child: Icon(Icons.broken_image_outlined,
                                        color: context.palette.muted)))),
                        Positioned(
                            top: 4,
                            right: 4,
                            child: IconButton(
                                onPressed: () => removePhoto(photoUrls[index]),
                                icon: const Icon(Icons.close, size: 16),
                                style: IconButton.styleFrom(
                                    backgroundColor: Colors.black54,
                                    foregroundColor: Colors.white,
                                    padding: EdgeInsets.zero,
                                    minimumSize: const Size(26, 26))))
                      ]),
                    ),
                  ),
          ),
          const SizedBox(height: 14),
          if (vettingStatus != null)
            Padding(
                padding: const EdgeInsets.only(bottom: 10),
                child: Row(children: [
                  Expanded(
                      child: Text(vettingStatus!,
                          style: TextStyle(
                              color: context.palette.muted, fontSize: 12))),
                  TextButton(
                      onPressed: refreshVetting, child: const Text('Refresh'))
                ])),
          SurfaceCard(
              child: Row(children: [
            Expanded(
                child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                  Text(paused ? 'Profile paused' : 'Ready to be seen?',
                      style: inter(15.5, weight: FontWeight.w700)),
                  const SizedBox(height: 4),
                  Text(
                      'Complete your identity check to unlock matching and messages.',
                      style: TextStyle(
                          color: context.palette.muted,
                          fontSize: 12,
                          height: 1.4))
                ])),
            GhostButton(
                label: saving ? 'Opening…' : 'Get vetted',
                onPressed: saving ? null : startVetting)
          ])),
          const SizedBox(height: 12),
          SurfaceCard(
              child: Row(children: [
            Expanded(
                child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                  Text(
                      isPremium
                          ? 'Premium membership active'
                          : 'Premium membership',
                      style: inter(15.5, weight: FontWeight.w700)),
                  const SizedBox(height: 4),
                  Text(
                      'More introductions, priority events, and deeper profiles.',
                      style: TextStyle(
                          color: context.palette.muted,
                          fontSize: 12,
                          height: 1.4))
                ])),
            if (!isPremium)
              PillCta(
                  label: 'Upgrade',
                  icon: Icons.workspace_premium_rounded,
                  onPressed: openPayment)
          ])),
          const SizedBox(height: 22),
          const SectionHeader('Your profile'),
          SurfaceCard(
              child: Column(children: [
            SettingsRow(
                icon: Icons.auto_awesome_outlined,
                title: 'Profile insights',
                subtitle: 'See what makes your profile stand out.',
                onTap: () => _showMessage('Profile insights',
                    'Your strongest signal is a complete, specific profile with a clear reason to start a conversation.')),
            const Hairline(),
            SettingsRow(
                icon: Icons.lock_outline,
                title: 'Privacy & visibility',
                subtitle: 'Control what members can see.',
                onTap: () => _showPrivacy()),
            const Hairline(),
            SettingsRow(
                icon: Icons.tune,
                title: 'Match preferences',
                subtitle: 'Tell us who you hope to meet.',
                onTap: () => _showPreferences()),
          ])),
          const SizedBox(height: 22),
          const SectionHeader('Settings'),
          SurfaceCard(
              child: Column(children: [
            SettingsRow(
                icon: Icons.palette_outlined,
                title: 'Appearance',
                subtitle: 'Light, dark, or match your device',
                trailing: const ThemeModeSelector()),
            const Hairline(),
            SettingsRow(
                icon: Icons.notifications_none_outlined,
                title: 'Notifications',
                subtitle: 'New matches, messages, and events',
                trailing: Switch(
                    value: notifications,
                    activeThumbColor: AppColors.clay,
                    activeTrackColor: context.palette.brandSoft,
                    onChanged: toggleNotifications)),
            const Hairline(),
            SettingsRow(
                icon: Icons.near_me_outlined,
                title: 'Nearby introductions',
                subtitle: 'Share your area with vetted members',
                trailing: Switch(
                    value: nearby,
                    activeThumbColor: AppColors.clay,
                    activeTrackColor: context.palette.brandSoft,
                    onChanged: toggleNearby)),
            const Hairline(),
            SettingsRow(
                icon: Icons.visibility_outlined,
                title: 'Pause profile',
                subtitle: 'Hide me from new discovery results',
                trailing: Switch(
                    value: paused,
                    activeThumbColor: AppColors.clay,
                    activeTrackColor: context.palette.brandSoft,
                    onChanged: togglePaused)),
          ])),
          const SizedBox(height: 12),
          const SectionHeader('Account'),
          SurfaceCard(
              child: Column(children: [
            SettingsRow(
                icon: Icons.settings_outlined,
                title: 'Account security',
                subtitle: 'Manage sessions and sign-in methods.',
                onTap: () => _showMessage('Account security',
                    'Your session is protected by a device-bound refresh token and secure storage.')),
            const Hairline(),
            SettingsRow(
                icon: Icons.help_outline,
                title: 'Help & community guidelines',
                subtitle: 'We are here to help you date with intention.',
                onTap: () => _showMessage('Community guidelines',
                    'Be kind, protect personal information, and report anything that feels unsafe.')),
          ])),
          const SizedBox(height: 16),
          GhostButton(onPressed: signOut, expand: true, label: 'Sign out')
        ]);
  }

  Future<void> _showPrivacy() async {
    var showAge = profile?['privacy'] is Map<String, dynamic>
        ? (profile!['privacy'] as Map<String, dynamic>)['showAge'] != false
        : true;
    await showDialog<void>(
        context: context,
        builder: (dialogContext) => AlertDialog(
                title: const Text('Privacy & visibility'),
                content: StatefulBuilder(
                    builder: (_, setState) => SwitchListTile(
                        contentPadding: EdgeInsets.zero,
                        tileColor: Colors.transparent,
                        title: const Text('Show my age'),
                        value: showAge,
                        onChanged: (value) => setState(() => showAge = value))),
                actions: [
                  TextButton(
                      onPressed: () => Navigator.pop(dialogContext),
                      child: const Text('Cancel')),
                  FilledButton(
                      onPressed: () async {
                        try {
                          await AppServices.account
                              .updatePrivacy({'showAge': showAge});
                          if (dialogContext.mounted) {
                            Navigator.pop(dialogContext);
                          }
                        } catch (exception) {
                          if (mounted) {
                            ScaffoldMessenger.of(context).showSnackBar(SnackBar(
                                content: Text(
                                    'Could not save privacy settings: $exception')));
                          }
                        }
                      },
                      child: const Text('Save'))
                ]));
  }

  Future<void> _showPreferences() async {
    final ageMin = TextEditingController(
        text:
            '${(profile?['preferences'] as Map<String, dynamic>?)?['ageMin'] ?? 24}');
    final ageMax = TextEditingController(
        text:
            '${(profile?['preferences'] as Map<String, dynamic>?)?['ageMax'] ?? 42}');
    await showDialog<void>(
        context: context,
        builder: (dialogContext) => AlertDialog(
                title: const Text('Match preferences'),
                content: Row(children: [
                  Expanded(
                      child: TextField(
                          controller: ageMin,
                          keyboardType: TextInputType.number,
                          decoration:
                              const InputDecoration(labelText: 'Min age'))),
                  const SizedBox(width: 12),
                  Expanded(
                      child: TextField(
                          controller: ageMax,
                          keyboardType: TextInputType.number,
                          decoration:
                              const InputDecoration(labelText: 'Max age')))
                ]),
                actions: [
                  TextButton(
                      onPressed: () => Navigator.pop(dialogContext),
                      child: const Text('Cancel')),
                  FilledButton(
                      onPressed: () async {
                        final minimum = int.tryParse(ageMin.text);
                        final maximum = int.tryParse(ageMax.text);
                        if (minimum == null ||
                            maximum == null ||
                            minimum < 18 ||
                            maximum > 80 ||
                            minimum > maximum) {
                          if (mounted) {
                            ScaffoldMessenger.of(context).showSnackBar(
                                const SnackBar(
                                    content: Text(
                                        'Choose a valid age range from 18 to 80.')));
                          }
                          return;
                        }
                        try {
                          await AppServices.account.updatePreferences(
                              {'ageMin': minimum, 'ageMax': maximum});
                          if (dialogContext.mounted) {
                            Navigator.pop(dialogContext);
                          }
                        } catch (exception) {
                          if (mounted) {
                            ScaffoldMessenger.of(context).showSnackBar(SnackBar(
                                content: Text(
                                    'Could not save preferences: $exception')));
                          }
                        }
                      },
                      child: const Text('Save'))
                ]));
    ageMin.dispose();
    ageMax.dispose();
  }

  void _showVoiceIntroSoon() {
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text('Voice intros are rolling out soon.')),
    );
  }

  Future<void> _showMessage(String title, String message) => showDialog<void>(
      context: context,
      builder: (_) => AlertDialog(
              title: Text(title),
              content: Text(message),
              actions: [
                TextButton(
                    onPressed: () => Navigator.pop(context),
                    child: const Text('Close'))
              ]));
}

/// The member's own avatar, showing a real photo when they have one rather
/// than always falling back to an initial.
class _ProfileAvatar extends StatelessWidget {
  const _ProfileAvatar({
    required this.letter,
    required this.size,
    this.photoUrl,
  });

  final String letter;
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
          border: Border.all(color: context.palette.line, width: 1.5),
        ),
        clipBehavior: Clip.antiAlias,
        child: Image.network(
          photoUrl!,
          fit: BoxFit.cover,
          errorBuilder: (_, __, ___) =>
              InitialAvatar(letter, size: size, color: AppColors.plum),
        ),
      );
    }
    return InitialAvatar(letter, size: size, color: AppColors.plum);
  }
}

/// Profile completeness as a single measured bar. A pill progress track reads
/// as a fact about *you*; a percentage chip among other chips read as
/// decoration.
class _CompletenessBar extends StatelessWidget {
  const _CompletenessBar({required this.score});

  final int score;

  @override
  Widget build(BuildContext context) {
    final palette = context.palette;
    final fraction = (score.clamp(0, 100) / 100);
    final complete = score >= 80;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Expanded(
              child: Text(
                complete
                    ? 'Your profile is ready to be seen'
                    : 'Finish your profile to be discovered',
                style: inter(12.5,
                    weight: FontWeight.w600, color: palette.inkSoft),
              ),
            ),
            Text('$score%',
                style: editorial(15, weight: FontWeight.w700).copyWith(
                    color: complete ? palette.success : palette.warn)),
          ],
        ),
        const SizedBox(height: 8),
        ClipRRect(
          borderRadius: BorderRadius.circular(NiaRadius.pill),
          child: TweenAnimationBuilder<double>(
            tween: Tween(begin: 0, end: fraction),
            duration: MediaQuery.disableAnimationsOf(context)
                ? Duration.zero
                : NiaMotion.enter,
            curve: NiaMotion.easeOut,
            builder: (_, value, __) => Container(
              // An explicit infinite width is required — a Container inside a
              // loose constraint would otherwise collapse to zero here and the
              // track would never paint.
              width: double.infinity,
              height: 7,
              decoration: BoxDecoration(color: palette.line),
              clipBehavior: Clip.antiAlias,
              child: FractionallySizedBox(
                alignment: Alignment.centerLeft,
                widthFactor: value,
                child: DecoratedBox(
                  decoration: BoxDecoration(
                    gradient: complete
                        ? null
                        : const LinearGradient(
                            colors: [AppColors.gold, AppColors.clay],
                          ),
                    color: complete ? palette.success : null,
                  ),
                ),
              ),
            ),
          ),
        ),
      ],
    );
  }
}
