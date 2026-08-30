import type { D1Database } from '@cloudflare/workers-types';
import type { FoodImportLogRecord } from './models';

export class FoodImportLogRepository {
  constructor(private readonly db: D1Database) {}

  async create(record: FoodImportLogRecord): Promise<void> {
    await this.db
      .prepare(
        `INSERT INTO food_import_logs (
          id, source_id, dataset_name, file_checksum,
          total_records, inserted_count, updated_count, unchanged_count, skipped_count,
          status, error_summary, executed_by, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        record.id,
        record.source_id,
        record.dataset_name,
        record.file_checksum,
        record.total_records,
        record.inserted_count,
        record.updated_count,
        record.unchanged_count,
        record.skipped_count,
        record.status,
        record.error_summary,
        record.executed_by,
        record.created_at,
      )
      .run();
  }

  async listRecent(limit = 20): Promise<FoodImportLogRecord[]> {
    const results = await this.db
      .prepare(
        `SELECT
          id, source_id, dataset_name, file_checksum,
          total_records, inserted_count, updated_count, unchanged_count, skipped_count,
          status, error_summary, executed_by, created_at
        FROM food_import_logs
        ORDER BY created_at DESC
        LIMIT ?`,
      )
      .bind(limit)
      .all<FoodImportLogRecord>();

    return results.results ?? [];
  }

  async findBySourceId(sourceId: string, limit = 20): Promise<FoodImportLogRecord[]> {
    const results = await this.db
      .prepare(
        `SELECT
          id, source_id, dataset_name, file_checksum,
          total_records, inserted_count, updated_count, unchanged_count, skipped_count,
          status, error_summary, executed_by, created_at
        FROM food_import_logs
        WHERE source_id = ?
        ORDER BY created_at DESC
        LIMIT ?`,
      )
      .bind(sourceId, limit)
      .all<FoodImportLogRecord>();

    return results.results ?? [];
  }
}
