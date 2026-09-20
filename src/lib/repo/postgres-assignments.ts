import { and, eq, gte, lte } from 'drizzle-orm';
import { getDb, schema } from '@/lib/db/client';
import { storeId } from './postgres-store';
import type { AssignmentRepository } from './types';

export const postgresAssignmentRepository: AssignmentRepository = {
  async listAssignments(businessDate) {
    const db = getDb();
    const store = await storeId();

    const rows = await db
      .select({
        templateCode: schema.assignments.templateCode,
        slot: schema.assignments.slot,
        assignedTo: schema.assignments.assignedTo,
        assignedToName: schema.users.displayName,
        assignedAt: schema.assignments.assignedAt,
      })
      .from(schema.assignments)
      .innerJoin(schema.users, eq(schema.users.id, schema.assignments.assignedTo))
      .where(
        and(
          eq(schema.assignments.storeId, store),
          eq(schema.assignments.businessDate, businessDate),
        ),
      );

    return rows.map((r) => ({
      templateCode: r.templateCode,
      slot: r.slot,
      assignedTo: r.assignedTo,
      assignedToName: r.assignedToName,
      assignedAt: r.assignedAt.toISOString(),
    }));
  },

  async listAssignmentsBetween(from, to) {
    const db = getDb();
    const store = await storeId();

    const rows = await db
      .select({
        businessDate: schema.assignments.businessDate,
        templateCode: schema.assignments.templateCode,
        slot: schema.assignments.slot,
        assignedTo: schema.assignments.assignedTo,
        assignedToName: schema.users.displayName,
        assignedAt: schema.assignments.assignedAt,
      })
      .from(schema.assignments)
      .innerJoin(schema.users, eq(schema.users.id, schema.assignments.assignedTo))
      .where(
        and(
          eq(schema.assignments.storeId, store),
          gte(schema.assignments.businessDate, from),
          lte(schema.assignments.businessDate, to),
        ),
      );

    return rows.map((r) => ({
      businessDate: r.businessDate,
      templateCode: r.templateCode,
      slot: r.slot,
      assignedTo: r.assignedTo,
      assignedToName: r.assignedToName,
      assignedAt: r.assignedAt.toISOString(),
    }));
  },

  async setAssignment({ businessDate, templateCode, slot, assignedTo, assignedBy }) {
    const db = getDb();
    const store = await storeId();

    // Upsert on the unique index: re-assigning a list replaces its owner rather
    // than leaving two people each believing it is theirs.
    await db
      .insert(schema.assignments)
      .values({ storeId: store, businessDate, templateCode, slot, assignedTo, assignedBy })
      .onConflictDoUpdate({
        target: [
          schema.assignments.storeId,
          schema.assignments.businessDate,
          schema.assignments.templateCode,
          schema.assignments.slot,
        ],
        set: { assignedTo, assignedBy, assignedAt: new Date() },
      });
  },

  async clearAssignment({ businessDate, templateCode, slot }) {
    const db = getDb();
    const store = await storeId();

    await db
      .delete(schema.assignments)
      .where(
        and(
          eq(schema.assignments.storeId, store),
          eq(schema.assignments.businessDate, businessDate),
          eq(schema.assignments.templateCode, templateCode),
          eq(schema.assignments.slot, slot),
        ),
      );
  },
};
