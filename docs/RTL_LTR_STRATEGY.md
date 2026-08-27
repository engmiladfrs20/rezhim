# NutriAI Persia - RTL / LTR Strategy

## 1. Direction Mapping

- **`fa` (Persian)**: `dir="rtl"`, Font: Vazirmatn.
- **`en` (English)**: `dir="ltr"`, Font: Plus Jakarta Sans.

## 2. Web Runtime Synchronization

- The web app listens to `@nutriai/localization` state updates and synchronously mutates:
  - `document.documentElement.lang = locale`
  - `document.documentElement.dir = direction`

## 3. Mobile (React Native) Synchronization

- On Android/iOS, Expo invokes `I18nManager.allowRTL(isRTL)` and `I18nManager.forceRTL(isRTL)`.
- UI spacing uses logical properties or flexbox alignment.
