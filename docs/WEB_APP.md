# NutriAI Persia Web App

The production web client is available at <https://nutriai-web.pages.dev/>.
It uses the authenticated Worker API with browser credentials (`credentials: include`)
and never embeds provider keys in the bundle.

## Available areas

- Authentication and registration with Persian/English RTL/LTR switching.
- Profile and password management.
- Daily water, weight and fasting summary.
- Food search, barcode lookup, categories and nutrient definitions.
- Nutrition targets, aggregate calculations and food diary CRUD.
- Meal-plan generation, food substitution and recipe nutrition calculation.
- AI generation, coach, text food logging and image recognition requests.
- Water, fasting and habit tracking.
- Pantry, fridge, freezer and shopping-list CRUD.
- Weight history/trend, subscription entitlement, B2 signed URLs.
- Admin-only analytics, user lookup and food/source management for admin roles.

The **امکانات کامل سامانه** workspace exposes every authenticated Worker route with
an editable path/body, explicit loading state, and a safe response/error panel. It is
intended for both user workflows and end-to-end verification while richer guided forms
are added to individual areas.

## Install on iPhone

Open the production URL in Safari, choose **Share → Add to Home Screen**, and launch
the resulting NutriAI icon. The web client ships a manifest, maskable icon, standalone
display mode, theme metadata and a service worker app shell cache.

## Local verification

```text
pnpm --filter @nutriai/web test
pnpm --filter @nutriai/web build
```

The API health probe is CORS-enabled for the Pages origin and returns a degraded state
when a browser/network failure occurs instead of presenting a false local success.
