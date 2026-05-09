import { audit as auditCore } from '@keynv/core';
import { desc, sql } from 'drizzle-orm';
import type { Db } from '../db/index.js';
import { schema } from '../db/index.js';

export interface AppendArgs {
  actor_user_id: string | null;
  actor_agent: string;
  event_type: auditCore.AuditEventType;
  payload: Record<string, unknown>;
}

/**
 * Appends an audit row in a single transaction so the hash chain
 * stays linear under concurrent writes. WAL mode + busy_timeout in
 * the connection pragmas keeps contention rare in practice.
 */
export async function appendAudit(db: Db, args: AppendArgs): Promise<auditCore.AuditEntry> {
  // Validate the payload shape against the per-event-type schema BEFORE
  // we hash. Catches non-JSON-roundtrippable values, unknown fields,
  // and event/payload mismatches at write time (audit finding H2).
  const payload = auditCore.validateAuditPayload(args.event_type, args.payload);

  return db.transaction((tx) => {
    const last = tx
      .select({ hash: schema.audit.hash, id: schema.audit.id })
      .from(schema.audit)
      .orderBy(desc(schema.audit.id))
      .limit(1)
      .all()[0];

    const ts = new Date().toISOString();
    const prevEntry = last
      ? ({
          id: last.id,
          hash: last.hash,
          prev_hash: '',
          ts: '',
          actor_user_id: null,
          actor_agent: '',
          event_type: args.event_type,
          payload: {},
        } satisfies auditCore.AuditEntry)
      : null;

    const built = auditCore.appendEntry(
      prevEntry,
      {
        ts,
        actor_user_id: args.actor_user_id,
        actor_agent: args.actor_agent,
        event_type: args.event_type,
        payload,
      },
      0, // placeholder; SQLite assigns the real id on insert
    );

    const inserted = tx
      .insert(schema.audit)
      .values({
        prev_hash: built.prev_hash,
        hash: built.hash,
        ts,
        actor_user_id: args.actor_user_id,
        actor_agent: args.actor_agent,
        event_type: args.event_type,
        payload_json: JSON.stringify(payload),
      })
      .returning({ id: schema.audit.id })
      .all()[0];

    if (!inserted) throw new Error('audit insert returned no row');
    return { ...built, id: inserted.id };
  });
}

export async function listAudit(
  db: Db,
  opts: {
    limit?: number | undefined;
    sinceId?: number | undefined;
    eventType?: string | undefined;
  } = {},
): Promise<auditCore.AuditEntry[]> {
  const limit = Math.min(opts.limit ?? 100, 1000);
  const conditions: ReturnType<typeof sql>[] = [];
  if (opts.sinceId) conditions.push(sql`id > ${opts.sinceId}`);
  if (opts.eventType) conditions.push(sql`event_type = ${opts.eventType}`);
  const whereClause = conditions.length ? sql`WHERE ${sql.join(conditions, sql` AND `)}` : sql``;
  const rows = (await db.all(
    sql`SELECT * FROM audit ${whereClause} ORDER BY id ASC LIMIT ${limit}`,
  )) as Array<{
    id: number;
    prev_hash: string;
    hash: string;
    ts: string;
    actor_user_id: string | null;
    actor_agent: string;
    event_type: string;
    payload_json: string;
  }>;
  return rows.map((r) => ({
    id: r.id,
    prev_hash: r.prev_hash,
    hash: r.hash,
    ts: r.ts,
    actor_user_id: r.actor_user_id,
    actor_agent: r.actor_agent,
    event_type: r.event_type as auditCore.AuditEventType,
    payload: JSON.parse(r.payload_json) as Record<string, unknown>,
  }));
}
