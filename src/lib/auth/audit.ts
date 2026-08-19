import { prisma } from './prisma';

export interface AuditEntry {
  userId?: string | null;
  action: string;
  ip?: string;
  userAgent?: string;
  meta?: Record<string, unknown>;
}

/**
 * Record a security event. Never throws — auditing must not break the
 * request it is attached to.
 */
export async function auditLog(entry: AuditEntry): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        userId: entry.userId ?? null,
        action: entry.action,
        ip: entry.ip ?? null,
        userAgent: entry.userAgent ?? null,
        meta: entry.meta ? JSON.stringify(entry.meta) : null,
      },
    });
  } catch (e) {
    console.error('[auth] audit write failed:', e);
  }
}
