# ADR 0003: Backblaze B2 Object Storage & StorageProvider Abstraction

## Status

Accepted

## Context

NutriAI Persia requires cost-effective, high-durability object storage for user meal photos, lab result attachments, and meal analysis assets. Application code must never be hard-coded to vendor-specific AWS/S3 SDKs. Cloudflare R2 is explicitly excluded per project requirements.

## Decision

- Define a strict `StorageProvider` interface in `@nutriai/types` and implement `BackblazeB2StorageProvider` in `@nutriai/storage` using S3-compatible APIs.
- Use Web-standard `Uint8Array`, `ArrayBuffer`, `Blob`, and `ReadableStream` instead of Node `Buffer`.
- Enforce explicit configuration injection via `StorageFactory` and strictly disallow silent in-memory fallback in staging/production.
- Provide `MemoryStorageProvider` exclusively for offline unit testing and development contract verification.

## Presigned URL Constraint Note

Presigned S3/B2 PUT URLs authenticate uploads via signature parameters, but standard S3 PUT signatures do not enforce client payload byte caps (`maxSizeBytes`) natively at signature creation time. Payload constraints must be enforced at the client / edge gateway level, and this architectural property is explicitly documented.
