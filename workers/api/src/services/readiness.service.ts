import type { CloudflareEnv, ReadinessCheckResponse, SystemMetadata } from '@nutriai/types';
import { SystemRepository } from '../db/system.repository';

export class ReadinessService {
  constructor(private readonly env: CloudflareEnv) {}

  async checkSystemReadiness(): Promise<ReadinessCheckResponse> {
    const repo = new SystemRepository(this.env.DB);
    let isConnected = false;

    try {
      // Core check: Ping the database directly
      isConnected = await repo.testConnection();

      // Additional check: Validate core metadata exist
      const metadata = await repo.getMetadata('schema_version');
      if (isConnected && metadata) {
        return {
          status: 'ok',
          service: this.env.SERVICE_NAME || 'nutriai-api',
          database: 'connected',
          timestamp: new Date().toISOString(),
        };
      }
    } catch (err) {
      console.error(
        JSON.stringify({
          event: 'readiness_check_failure',
          error: err instanceof Error ? err.message : 'Unknown error',
          environment: this.env.APP_ENV || 'development',
        }),
      );
    }

    return {
      status: 'degraded',
      service: this.env.SERVICE_NAME || 'nutriai-api',
      database: isConnected ? 'connected' : 'disconnected',
      timestamp: new Date().toISOString(),
    };
  }

  async getSystemMetadata(): Promise<SystemMetadata | null> {
    const repo = new SystemRepository(this.env.DB);
    try {
      return await repo.getMetadata('schema_version');
    } catch {
      return null;
    }
  }
}
