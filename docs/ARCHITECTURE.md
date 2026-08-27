# NutriAI Persia - Architecture Specification (Phase 1)

## 1. Monorepo Overview

NutriAI Persia is built as a modular TypeScript Monorepo:

```text
├── apps/
│   ├── web/           # React 18 + Vite + Tailwind (User Web App)
│   ├── admin/         # React 18 + Vite (Admin Management Shell)
│   └── mobile/        # Expo & React Native (Mobile Shell)
├── workers/
│   ├── api/           # Cloudflare Workers + Hono REST API
│   └── ai-jobs/       # Asynchronous Queue Worker placeholder
├── packages/
│   ├── config/        # Base TSConfigs, ESLint Presets, Prettier
│   ├── types/         # Domain, Storage, API & Cloudflare Type Definitions
│   ├── schemas/       # Zod Validation Schemas (Env, Storage, Health)
│   ├── localization/  # Shared i18n dictionaries (fa/en) & RTL logic
│   ├── storage/       # Backblaze B2 & Memory Storage Providers
│   └── testing/       # Shared test fixtures & mocks
├── docs/              # Architecture Decisions & Strategy Documentation
└── .github/workflows/ # CI/CD Automation Workflows
```

## 2. Responsibilities

- **`apps/web`**: Single-page application shell delivering accessible Persian/English navigation and runtime locale/direction switching.
- **`apps/admin`**: Isolated operational shell with protected area layout.
- **`apps/mobile`**: React Native/Expo Android-compatible shell with RTL architecture.
- **`workers/api`**: Serverless edge API handling HTTP requests, `GET /health`, security headers, request ID tracking, and safe error normalization.
- **`packages/storage`**: Decoupled cloud storage layer utilizing Backblaze B2 S3 API with Web Stream support.
- **`packages/localization`**: Centralized, typed localization with fallback and Intl formatters.
