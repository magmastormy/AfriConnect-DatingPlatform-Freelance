import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:clerk_flutter/clerk_flutter.dart';

import '../../../core/services.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/widgets/nia_kit.dart';
import '../../../core/widgets/nia_mark.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});
  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final email = TextEditingController();
  final phone = TextEditingController();
  final code = TextEditingController();
  bool otpSent = false;
  bool loading = false;
  String? error;

  @override
  void dispose() {
    email.dispose();
    phone.dispose();
    code.dispose();
    super.dispose();
  }

  Future<void> submit() async {
    if (email.text.trim().isEmpty || phone.text.trim().isEmpty) {
      setState(() => error = 'Add your email and mobile number to continue.');
      return;
    }
    setState(() {
      loading = true;
      error = null;
    });
    try {
      if (!otpSent) {
        await AppServices.auth
            .requestOtp(email: email.text.trim(), phone: phone.text.trim());
        setState(() => otpSent = true);
      } else {
        await AppServices.auth.verifyOtp(
            email: email.text.trim(),
            phone: phone.text.trim(),
            code: code.text.trim());
        if (mounted) context.go('/onboarding');
      }
    } catch (e) {
      setState(() => error = e.toString());
    } finally {
      if (mounted) setState(() => loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final clerkEnabled =
        const String.fromEnvironment('CLERK_PUBLISHABLE_KEY').isNotEmpty;
    if (clerkEnabled) {
      return Scaffold(
          body: SafeArea(
              child: ClerkAuthBuilder(
                  signedInBuilder: (context, auth) =>
                      _ClerkSessionSync(auth: auth),
                  signedOutBuilder: (context, _) =>
                      const ClerkAuthentication())));
    }
    return Scaffold(
        body: SafeArea(
            child: ListView(
                padding: const EdgeInsets.fromLTRB(24, 36, 24, 24),
                children: [
          Row(children: [
            const NiaMark(size: 28),
            const SizedBox(width: 10),
            const BrandWordmark(size: 22)
          ]),
          const SizedBox(height: 72),
          Text('Meet with\nintention.',
              style: editorial(48, weight: FontWeight.w700)),
          const SizedBox(height: 18),
          Text(
              otpSent
                  ? 'Enter the six-digit code we sent you.'
                  : 'A considered community for African professionals\nready for something real.',
              style: inter(15,
                  weight: FontWeight.w400,
                  color: context.palette.muted,
                  height: 1.55)),
          const SizedBox(height: 38),
          _FieldLabel(
              label: 'Your email',
              child: TextField(
                  controller: email,
                  enabled: !otpSent,
                  keyboardType: TextInputType.emailAddress,
                  decoration:
                      const InputDecoration(hintText: 'you@example.com'))),
          const SizedBox(height: 16),
          _FieldLabel(
              label: 'Mobile number',
              child: TextField(
                  controller: phone,
                  enabled: !otpSent,
                  keyboardType: TextInputType.phone,
                  decoration:
                      const InputDecoration(hintText: '+27 82 000 0000'))),
          if (otpSent) ...[
            const SizedBox(height: 16),
            _FieldLabel(
                label: 'One-time code',
                child: TextField(
                    controller: code,
                    keyboardType: TextInputType.number,
                    maxLength: 6,
                    decoration: const InputDecoration(
                        hintText: '000000', counterText: '')))
          ],
          if (error != null) ...[
            const SizedBox(height: 14),
            Text(error!, style: const TextStyle(color: Color(0xFFB3261E)))
          ],
          const SizedBox(height: 24),
          PillCta(
              label: loading
                  ? 'Working…'
                  : otpSent
                      ? 'Verify and enter'
                      : 'Send me an OTP',
              style: PillCtaStyle.ink,
              expand: true,
              busy: loading,
              onPressed: loading ? null : submit),
          if (otpSent)
            Center(
                child: TextButton(
                    onPressed:
                        loading ? null : () => setState(() => otpSent = false),
                    child: const Text('Use a different email'))),
          const SizedBox(height: 8),
          Center(
              child: TextButton(
                  onPressed: () => context.go('/preview'),
                  child: const Text('Preview the mobile experience'))),
          const SizedBox(height: 8),
          const SizedBox(height: 18),
          Container(
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              color: context.palette.surfaceRaised,
              borderRadius: BorderRadius.circular(NiaRadius.md),
              border: Border.all(color: context.palette.line),
            ),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Icon(Icons.verified_user_outlined,
                    size: 18, color: context.palette.brand),
                const SizedBox(width: 10),
                Expanded(
                  child: Text(
                    'Your profile is private until you choose to connect. We use your email and mobile number to keep the community real.',
                    style: inter(12,
                        weight: FontWeight.w500,
                        color: context.palette.muted,
                        height: 1.45),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 14),
          Text(
              'By continuing, you agree to our member terms and privacy promise.',
              textAlign: TextAlign.center,
              style: inter(12,
                  weight: FontWeight.w400,
                  color: context.palette.muted,
                  height: 1.45)),
        ])));
  }
}

class _ClerkSessionSync extends StatefulWidget {
  const _ClerkSessionSync({required this.auth});
  final ClerkAuthState auth;
  @override
  State<_ClerkSessionSync> createState() => _ClerkSessionSyncState();
}

class _ClerkSessionSyncState extends State<_ClerkSessionSync> {
  late final Future<void> sync = _sync();

  Future<void> _sync() async {
    final token = await widget.auth.sessionToken();
    await AppServices.auth.exchangeClerkToken(token.jwt);
  }

  @override
  Widget build(BuildContext context) => FutureBuilder<void>(
      future: sync,
      builder: (context, snapshot) {
        if (snapshot.hasError) {
          return Center(
              child: Text(
                  'Could not connect your Clerk session: ${snapshot.error}'));
        }
        if (snapshot.connectionState != ConnectionState.done) {
          return const Center(child: CircularProgressIndicator());
        }
        WidgetsBinding.instance.addPostFrameCallback((_) {
          if (context.mounted) context.go('/');
        });
        return const Center(child: CircularProgressIndicator());
      });
}

class _FieldLabel extends StatelessWidget {
  const _FieldLabel({required this.label, required this.child});
  final String label;
  final Widget child;
  @override
  Widget build(BuildContext context) =>
      Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Text(label, style: Theme.of(context).textTheme.labelLarge),
        const SizedBox(height: 8),
        child
      ]);
}
