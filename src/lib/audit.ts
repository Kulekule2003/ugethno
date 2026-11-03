import { db } from "@/lib/db";
import type { EntityType, Prisma } from "@prisma/client";
export async function audit(actorId: string, entity: EntityType, entityId: string, action: string, field?: string, oldValue?: unknown, newValue?: unknown) {
  await db.auditEntry.create({ data: { actorId, entity, entityId, action, field, oldValue: oldValue as Prisma.InputJsonValue, newValue: newValue as Prisma.InputJsonValue } });
}
