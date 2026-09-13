import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../../core/config/app_config.dart';
import '../../../core/services.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/widgets/app_widgets.dart';

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
    final complete = (profile?['completenessScore'] as num?)?.toInt() ??
        (profile?['isComplete'] == true ? 100 : 40);
    return ListView(
        padding: const EdgeInsets.fromLTRB(20, 4, 20, 28),
        children: [
          SurfaceCard(
              child: Row(children: [
            InitialAvatar(
                displayName.isEmpty ? 'M' : displayName[0].toUpperCase(),
                size: 68,
                color: AppColors.plum),
            const SizedBox(width: 14),
            Expanded(
                child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                  Text(displayName,
                      style: const TextStyle(
                          fontWeight: FontWeight.w700, fontSize: 18)),
                  const SizedBox(height: 4),
                  Text('$profession - $city',
                      style: const TextStyle(color: AppColors.muted)),
                  const SizedBox(height: 9),
                  Row(children: [
                    StatusPill(
                        vettingStatus?.contains('verified') == true
                            ? 'Verified'
                            : 'Vetting needed',
                        tone: vettingStatus?.contains('verified') == true
                            ? PillTone.good
                            : PillTone.warn),
                    const SizedBox(width: 6),
                    StatusPill('$complete% complete',
                        tone: complete >= 80 ? PillTone.good : PillTone.warn)
                  ])
                ])),
            IconButton(
                onPressed: editProfile,
                tooltip: 'Edit profile',
                icon: const Icon(Icons.edit_outlined))
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
                            borderRadius: BorderRadius.circular(14),
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
                          style: const TextStyle(
                              color: AppColors.muted, fontSize: 12))),
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
                      style: const TextStyle(fontWeight: FontWeight.w700)),
                  const SizedBox(height: 4),
                  const Text(
                      'Complete your identity check to unlock matching and messages.',
                      style: TextStyle(
                          color: AppColors.muted, fontSize: 12, height: 1.4))
                ])),
            OutlinedButton(
                onPressed: saving ? null : startVetting,
                child: Text(saving ? 'Opening...' : 'Get vetted'))
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
                      style: const TextStyle(fontWeight: FontWeight.w700)),
                  const SizedBox(height: 4),
                  const Text(
                      'More introductions, priority events, and deeper profiles.',
                      style: TextStyle(
                          color: AppColors.muted, fontSize: 12, height: 1.4))
                ])),
            if (!isPremium)
              FilledButton(
                  onPressed: openPayment,
                  style:
                      FilledButton.styleFrom(backgroundColor: AppColors.clay),
                  child: const Text('Upgrade'))
          ])),
          const SizedBox(height: 22),
          const SectionHeader('Your profile'),
          _ProfileSetting(
              icon: Icons.auto_awesome_outlined,
              title: 'Profile insights',
              detail: 'See what makes your profile stand out.',
              onTap: () => _showMessage('Profile insights',
                  'Your strongest signal is a complete, specific profile with a clear reason to start a conversation.')),
          _ProfileSetting(
              icon: Icons.lock_outline,
              title: 'Privacy & visibility',
              detail: 'Control what members can see.',
              onTap: () => _showPrivacy()),
          _ProfileSetting(
              icon: Icons.tune,
              title: 'Match preferences',
              detail: 'Tell us who you hope to meet.',
              onTap: () => _showPreferences()),
          const SizedBox(height: 22),
          const SectionHeader('Settings'),
          SurfaceCard(
              child: Column(children: [
            SwitchListTile(
                contentPadding: EdgeInsets.zero,
                title: const Text('Notifications',
                    style: TextStyle(fontWeight: FontWeight.w700)),
                subtitle: const Text('New matches, messages, and events',
                    style: TextStyle(color: AppColors.muted, fontSize: 12)),
                value: notifications,
                activeThumbColor: AppColors.clay,
                onChanged: toggleNotifications),
            const Divider(height: 1),
            SwitchListTile(
                contentPadding: EdgeInsets.zero,
                title: const Text('Nearby introductions',
                    style: TextStyle(fontWeight: FontWeight.w700)),
                subtitle: const Text('Share your area with vetted members',
                    style: TextStyle(color: AppColors.muted, fontSize: 12)),
                value: nearby,
                activeThumbColor: AppColors.clay,
                onChanged: toggleNearby),
            const Divider(height: 1),
            SwitchListTile(
                contentPadding: EdgeInsets.zero,
                title: const Text('Pause profile',
                    style: TextStyle(fontWeight: FontWeight.w700)),
                subtitle: const Text('Hide me from new discovery results',
                    style: TextStyle(color: AppColors.muted, fontSize: 12)),
                value: paused,
                activeThumbColor: AppColors.clay,
                onChanged: togglePaused)
          ])),
          const SizedBox(height: 12),
          _ProfileSetting(
              icon: Icons.settings_outlined,
              title: 'Account security',
              detail: 'Manage sessions and sign-in methods.',
              onTap: () => _showMessage('Account security',
                  'Your session is protected by a device-bound refresh token and secure storage.')),
          _ProfileSetting(
              icon: Icons.help_outline,
              title: 'Help & community guidelines',
              detail: 'We are here to help you date with intention.',
              onTap: () => _showMessage('Community guidelines',
                  'Be kind, protect personal information, and report anything that feels unsafe.')),
          const SizedBox(height: 16),
          TextButton(
              onPressed: signOut,
              child: const Text('Sign out',
                  style: TextStyle(color: AppColors.clay))),
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

class _ProfileSetting extends StatelessWidget {
  const _ProfileSetting(
      {required this.icon,
      required this.title,
      required this.detail,
      this.onTap});

  final IconData icon;
  final String title;
  final String detail;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) => Padding(
      padding: const EdgeInsets.only(bottom: 9),
      child: InkWell(
          onTap: onTap,
          borderRadius: BorderRadius.circular(16),
          child: SurfaceCard(
              padding: const EdgeInsets.all(13),
              child: Row(children: [
                Container(
                    width: 38,
                    height: 38,
                    decoration: const BoxDecoration(
                        color: AppColors.boneDeep, shape: BoxShape.circle),
                    child: Icon(icon, size: 19, color: AppColors.inkSoft)),
                const SizedBox(width: 12),
                Expanded(
                    child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                      Text(title,
                          style: const TextStyle(fontWeight: FontWeight.w700)),
                      const SizedBox(height: 3),
                      Text(detail,
                          style: const TextStyle(
                              color: AppColors.muted, fontSize: 12))
                    ])),
                const Icon(Icons.chevron_right, color: AppColors.muted)
              ]))));
}
