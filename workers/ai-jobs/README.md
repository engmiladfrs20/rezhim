# NutriAI Persia - AI Jobs Worker

## Architecture Role (Phase 1 Placeholder)

`nutriai-ai-jobs` is dedicated to offloading heavy asynchronous nutrition workflows, such as:

1. Long-running Persian meal photo semantic segmentation and estimation.
2. Background synchronization with persistent storage.
3. Queue consumer execution decoupled from the synchronous HTTP API worker.

In Phase 1, the interface, bindings, and Worker structure are established as a foundational baseline without active external API traffic.
