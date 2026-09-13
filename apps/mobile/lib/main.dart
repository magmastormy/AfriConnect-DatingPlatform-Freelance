import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:clerk_flutter/clerk_flutter.dart';

import 'core/theme/app_theme.dart';
import 'core/services.dart';
import 'features/auth/presentation/login_screen.dart';
import 'features/home/presentation/app_shell.dart';
import 'features/splash/presentation/splash_screen.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await AppServices.auth.restoreSession();
  runApp(const ProviderScope(child: AfriConnectApp()));
}

class AfriConnectApp extends StatelessWidget {
  const AfriConnectApp({super.key});

  @override
  Widget build(BuildContext context) {
    final router = GoRouter(
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
        GoRoute(path: '/', builder: (_, __) => const AppShell()),
        GoRoute(path: '/preview', builder: (_, __) => const AppShell()),
      ],
    );

    final app = MaterialApp.router(
      title: 'Nia',
      debugShowCheckedModeBanner: false,
      theme: AppTheme.light,
      darkTheme: AppTheme.dark,
      themeMode: ThemeMode.system,
      routerConfig: router,
    );
    const publishableKey = String.fromEnvironment('CLERK_PUBLISHABLE_KEY');
    if (publishableKey.isEmpty) return app;
    return ClerkAuth(
        config: ClerkAuthConfig(publishableKey: publishableKey), child: app);
  }
}
