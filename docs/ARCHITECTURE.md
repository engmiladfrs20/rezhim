# NutriAI Persia - Architecture Specification

## 1. Monorepo Overview

NutriAI Persia is built as a modular TypeScript Monorepo:

```text
├── apps/
│   ├── web/           # React 18 + Vite + Tailwind (User Web App)
│   ├── admin/         # React 18 + Vite (Admin Management Shell)
│   └── mobile/        # Expo & React Native (Mobile Shell)
├── data/
│   └── sources/       # Curated Iranian food datasets and ingestion adapter templates
├── workers/
│   ├── api/           # Cloudflare Workers + Hono REST API
│   └── ai-jobs/       # Typed asynchronous Queue Worker boundary
├── packages/
│   ├── config/        # Base TSConfigs, ESLint Presets, Prettier
│   ├── types/         # Domain, Storage, API & Cloudflare Type Definitions
│   ├── schemas/       # Zod Validation Schemas (Env, Storage, Health, Food, Manifest)
│   ├── ai/            # Server-side Gemini provider boundary
│   ├── localization/  # Shared i18n dictionaries (fa/en), Persian normalizer & RTL logic
│   ├── storage/       # Backblaze B2 & Memory Storage Providers
│   └── testing/       # Shared test fixtures & mocks
├── docs/              # Architecture Decisions & Strategy Documentation
└── .github/workflows/ # CI/CD Automation Workflows
```

## 2. Responsibilities

- **`apps/web`**: Single-page application shell delivering accessible Persian/English navigation and runtime locale/direction switching.
- **`apps/admin`**: Isolated operational shell with protected area layout and Food Catalog management interface.
- **`apps/mobile`**: React Native/Expo Android-compatible shell with RTL architecture.
- **`data/sources`**: Authoritative baseline datasets, license boundary definitions, and typed manifests with SHA-256 integrity checksums.
- **`workers/api`**: Serverless edge API built with **Hono**, managing robust Cloudflare HTTP interactions. Uses isolated controllers targeting native decoupled Repositories routing queries securely against **Cloudflare D1** SQLite databases.
- **Inventory routes**: Authenticated `/api/v1/pantry` and `/api/v1/shopping-list` boundaries persist user-owned stock and shopping records with active-food validation.
- **`workers/api/test`**: Integration tests execute exactly matching the remote worker contexts powered natively by `@cloudflare/vitest-plugin`, simulating exact real D1 bounds directly leveraging bound miniflare executions securely without external mocks.
- **`packages/storage`**: Decoupled cloud storage layer utilizing Backblaze B2 S3 API with Web Stream support.
- **`packages/localization`**: Centralized, typed localization with fallback, Persian typography normalizer (`normalizePersianText`), collision comparator (`normalizePersianForComparison`), and Intl formatters.
