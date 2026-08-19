import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/auth/prisma';
import { ApiError, handleError } from '@/lib/auth/errors';
import { requireAuth, requireRole } from '@/lib/auth/guard';
import { assertSameOrigin } from '@/lib/auth/csrf';
import { requestContext } from '@/lib/auth/rate-limit';
import { auditLog } from '@/lib/auth/audit';
import type { Role } from '@prisma/client';

export const runtime = 'nodejs';

const updateUserSchema = z.object({
  /** true → deactivate, false → reactivate */
  deactivated: z.boolean().optional(),
  role: z.enum(['CUSTOMER', 'BRANCH_ADMIN', 'SUPER_ADMIN']).optional(),
  /** required when role is BRANCH_ADMIN; null/undefined to clear for others */
  branchId: z.string().nullable().optional(),
});

/**
 * Super admin: manage a user account — deactivate/reactivate, promote/demote
 * role, reassign branch. Server-side checks only: the caller must be SUPER_ADMIN
 * and cannot deactivate or demote their own account.
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    assertSameOrigin(req);
    const authed = await requireAuth(req);
    requireRole('SUPER_ADMIN')(authed);

    const body = await req.json().catch(() => {
      throw new ApiError(400, 'Invalid request body', 'BAD_REQUEST');
    });
    const input = updateUserSchema.parse(body);

    const target = await prisma.user.findUnique({ where: { id } });
    if (!target) throw new ApiError(404, 'User not found', 'USER_NOT_FOUND');

    // Guardrails: a super admin can't lock themselves out or demote themselves.
    if (id === authed.user.id) {
      if (input.deactivated === true) {
        throw new ApiError(422, 'You cannot deactivate your own account', 'SELF_DEACTIVATE');
      }
      if (input.role && input.role !== 'SUPER_ADMIN') {
        throw new ApiError(422, 'You cannot change your own role', 'SELF_ROLE_CHANGE');
      }
    }

    // Branch validation for role assignments.
    const newRole = input.role ?? target.role;
    let branchId = input.branchId !== undefined ? input.branchId : target.branchId;
    if (newRole === 'BRANCH_ADMIN' && !branchId) {
      throw new ApiError(400, 'A branch is required for branch admin accounts', 'BRANCH_REQUIRED');
    }
    if (branchId && newRole !== 'BRANCH_ADMIN') {
      branchId = null; // non-branch-admin accounts never carry a branch
    }
    if (branchId) {
      const branch = await prisma.branch.findUnique({ where: { id: branchId } });
      if (!branch) throw new ApiError(404, 'Branch not found', 'BRANCH_NOT_FOUND');
    }

    const user = await prisma.user.update({
      where: { id },
      data: {
        ...(input.deactivated !== undefined
          ? { deactivatedAt: input.deactivated ? new Date() : null }
          : {}),
        ...(input.role ? { role: newRole as Role } : {}),
        ...(input.branchId !== undefined ? { branchId } : {}),
        // Deactivating or demoting an admin kills their active sessions.
        ...(input.deactivated === true || (input.role && input.role !== target.role)
          ? { tokenVersion: { increment: 1 } }
          : {}),
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        branchId: true,
        deactivatedAt: true,
        tokenVersion: true,
      },
    });

    await auditLog({
      userId: authed.user.id,
      action: 'user_updated',
      ...requestContext(req),
      meta: { targetUserId: id, changes: Object.keys(input) },
    });

    return NextResponse.json({ user });
  } catch (e) {
    return handleError(e);
  }
}
