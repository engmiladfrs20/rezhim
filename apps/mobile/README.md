# NutriAI Persia Mobile (Expo / React Native)

## Architecture & RTL/LTR Strategy

- Built with React Native & Expo SDK 52
- Native RTL support configured via `I18nManager` (`supportsRTL: true` in `app.json`)
- Reuses `@nutriai/localization` and `@nutriai/types` from shared workspace packages
- Android and iOS compatible project structure

## Running on a phone

Set the public API URL in a local, ignored file before starting Expo:

```env
# apps/mobile/.env.local
EXPO_PUBLIC_API_URL=https://nutriai-api-production.rezhimvip.workers.dev
```

Run `pnpm --filter @nutriai/mobile start` and scan the QR code with Expo Go. The phone and development computer must be on the same Wi-Fi network. If LAN discovery is unavailable, use `pnpm --filter @nutriai/mobile start -- --tunnel`.

## Building an Android APK

The repository includes an EAS `preview` profile that produces an installable APK. EAS authentication and an Android application ID are intentionally account-specific:

```bash
npx eas-cli@latest login
npx eas-cli@latest build:configure
npx eas-cli@latest build --platform android --profile preview
```

Download the APK from the build URL printed by EAS. Do not place B2 or Gemini credentials in Expo configuration or the mobile bundle; the app only receives the public API URL.
