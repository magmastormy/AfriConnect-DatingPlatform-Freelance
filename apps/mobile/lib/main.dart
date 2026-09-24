import 'package:clerk_flutter/clerk_flutter.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import 'core/services.dart';
import 'core/theme/app_theme.dart';
import 'core/widgets/device_frame.dart';
import 'features/auth/presentation/login_screen.dart';
import 'features/onboarding/presentation/onboarding_screen.dart';
import 'features/home/presentation/app_shell.dart';
import 'features/showcase/interactions_showcase_screen.dart';
import 'features/splash/presentation/splash_screen.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await AppServices.init();
  await AppServices.auth.restoreSession();
  runApp(const ProviderScope(child: AfriConnectApp()));
}

class AfriConnectApp extends StatelessWidget {
  const AfriConnectApp({super.key});

  /// Built once and reused.
  ///
  /// [MaterialApp] is rebuilt whenever the appearance preference changes, and
  /// handing it a fresh [GoRouter] each time would reset the navigation stack —
  /// so the router lives here, outside the rebuild, and only the theme swaps.
  static final GoRouter _router = GoRouter(
    initialLocation: '/splash',
    refreshListenable: AppServices.auth,
    redirect: (context, state) {
      if (state.matchedLocation == '/' && AppServices.auth.requiresLogin) {
        return '/login';
      }
      return null;
    },
    routes: [
      GoRoute(path: '/splash', builder: (_, __) => const SplashScreen()),
      GoRoute(path: '/login', builder: (_, __) => const LoginScreen()),
      GoRoute(path: '/onboarding', builder: (_, __) => const OnboardingScreen()),
      GoRoute(path: '/', builder: (_, __) => const AppShell()),
      GoRoute(path: '/preview', builder: (_, __) => const AppShell()),
      GoRoute(
          path: '/showcase',
          builder: (_, __) => const InteractionsShowcaseScreen()),
    ],
  );

  @override
  Widget build(BuildContext context) {
    const publishableKey = String.fromEnvironment('CLERK_PUBLISHABLE_KEY');
    // Rebuilds the MaterialApp when the member picks Light / Dark / System.
    return ListenableBuilder(
      listenable: AppServices.theme,
      builder: (context, _) {
        final app = MaterialApp.router(
          title: 'Nia',
          debugShowCheckedModeBanner: false,
          theme: AppTheme.light,
          darkTheme: AppTheme.dark,
          themeMode: AppServices.theme.mode,
          routerConfig: _router,
          builder: (context, child) => DeviceFrameWrapper(child: child!),
        );
        if (publishableKey.isEmpty) return app;
        return ClerkAuth(
            config: ClerkAuthConfig(publishableKey: publishableKey),
            child: app);
      },
    );
  }
}
