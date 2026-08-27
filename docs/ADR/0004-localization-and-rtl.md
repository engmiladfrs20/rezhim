# ADR 0004: Shared Type-Safe Localization & Bi-directional (RTL/LTR) Strategy

## Status

Accepted

## Context

Persian (fa) is the primary first-class language with Right-to-Left (RTL) script direction, and English (en) is supported with Left-to-Right (LTR) script direction. Localization must be shared seamlessly across Web, Admin, and Mobile clients with type-safety and fallback mechanisms.

## Decision

- Build a dedicated `@nutriai/localization` workspace package.
- Type-safe nested key path resolution with compile-time safety.
- Fallback locale statically locked to Persian (`fa`).
- Standardized `Intl.NumberFormat` and `Intl.DateTimeFormat` abstractions.
- Document-level synchronization of `html[lang]` and `html[dir]` in web environments, and `I18nManager.forceRTL()` in React Native mobile environments.
