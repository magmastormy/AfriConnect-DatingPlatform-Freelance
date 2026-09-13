# Nia Mobile

The native Flutter client for Nia, the considered dating experience backed by
the AfriConnect API.

This application is intentionally isolated from `apps/web`. It communicates
with the existing Express API through typed Dart repositories and never imports
React, Next.js, TypeScript, or web-only packages.

## Prerequisites

- Flutter 3.47.x (stable) with Dart 3.13.x — verified against Flutter 3.47.3 / Dart 3.13.3.
- A device target: Android emulator, iOS simulator, or a physical device.

The repository carries the isolated Dart client source but **not** the generated
Android/iOS host folders. `flutter create` is intentionally the first step on a
Flutter-enabled machine so the host project uses that machine's current Gradle,
Xcode, and CocoaPods templates. Keep the generated folders inside
`apps/mobile`; they are not shared with the web app.

```bash
flutter create --platforms=android,ios .
flutter pub get
```

On a Windows-first development machine you can also generate the desktop host
to smoke-test the UI without an emulator:

```bash
flutter create --platforms=windows .
flutter run -d windows
```

## Configuration

All configuration is injected at build time with `--dart-define`. Nothing is
read from a checked-in `.env`.

| Define | Required | Purpose |
| --- | --- | --- |
| `API_ORIGIN` | yes (non-local) | API origin, e.g. `https://api.example.com`. Default `http://localhost:4000`. |
| `API_MOUNT_PATH` | yes (non-local) | Must equal the server's `API_MOUNT_PATH` (mirror of the web app's `NEXT_PUBLIC_API_MOUNT`). Default `api`. |
| `CLERK_PUBLISHABLE_KEY` | optional | When set, the native Clerk sign-in surface replaces the OTP fallback. |
| `NIA_WEB_BASE_URL` | optional | Web origin for Stripe returns and hosted flows. Default `https://africonnect.pro`. |

The base URL is composed as `{API_ORIGIN}/{API_MOUNT_PATH}/v1`. The API surface
is deliberately hidden behind an unguessable mount segment on the server, so a
non-local build **must** pass `API_MOUNT_PATH` — the client cannot discover it.

### Android emulator

`10.0.2.2` is the emulator's alias for the host machine's loopback:

```bash
flutter run \
  --dart-define=API_ORIGIN=http://10.0.2.2:4000 \
  --dart-define=API_MOUNT_PATH=api
```

### iOS simulator

```bash
flutter run \
  --dart-define=API_ORIGIN=http://localhost:4000 \
  --dart-define=API_MOUNT_PATH=api
```

### With Clerk

```bash
flutter run \
  --dart-define=CLERK_PUBLISHABLE_KEY=pk_test_your_key \
  --dart-define=API_ORIGIN=http://10.0.2.2:4000 \
  --dart-define=API_MOUNT_PATH=api
```

The mobile client opens Stripe Checkout in the system browser for payments,
opens the hosted Smile ID verification flow for vetting, and connects chat to
the API WebSocket at `/{API_MOUNT_PATH}/ws` after a session token is available.

The web return origin defaults to `https://africonnect.pro`. Override it for a
staging environment with `--dart-define=NIA_WEB_BASE_URL=https://...`.

## Data boundary

Flutter does not connect directly to PostgreSQL. `API_ORIGIN` points to the
existing Express API, whose Prisma repositories remain the source of truth for
profiles, matches, events, RSVPs, notifications, and chat. The Dart client
keeps that boundary typed through feature repositories and the shared response
envelope (`{success, data}` / `{success: false, error: {message, code}}`), so
Android and iOS use the same database-backed contract.

## Platform polish

The shared UI adapts density and transitions for iOS and Android, uses safe
glass surfaces for sheets and navigation, preserves system text scaling, and
honours reduced-motion settings. The app keeps platform-native navigation
transitions while sharing Nia's palette, bundled Fraunces/Inter typography,
Nia mark, and interaction language.

## Verification

```bash
flutter analyze
flutter test
dart format --set-exit-if-changed .
```

### Windows note: `flutter test` and `PROGRAMFILES(X86)`

Flutter's Windows toolchain resolves `vswhere.exe` through the
`ProgramFiles(x86)` environment variable when configuring native-asset build
hooks. If that variable is unset (common in minimal shells and sandboxed CI),
every `flutter test` invocation aborts with:

```
%PROGRAMFILES(X86)% environment variable not found.
```

Export it before running tests, for example:

```bash
export "ProgramFiles(x86)=C:\\Program Files (x86)"
flutter test
```

`flutter analyze` is unaffected — it never touches the native toolchain.
