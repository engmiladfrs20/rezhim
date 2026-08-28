import { applyD1Migrations } from 'cloudflare:test';
import { env, type ProvidedEnv } from 'cloudflare:workers';

await applyD1Migrations((env as ProvidedEnv).DB!, (env as ProvidedEnv).TEST_MIGRATIONS);
