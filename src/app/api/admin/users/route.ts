import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/auth/prisma';
import { ApiError, handleError } from '@/lib/auth/errors';
import { requireAuth, requireRole } from '@/lib/auth/guard';
import { assertSameOrigin } from '@/lib/auth/csrf';
import { hashPassword } from '@/lib/auth/password';
import { requestContext } from '@/lib/auth/rate-limit';
import { auditLog } from '@/lib/auth/audit';
import type { Role } from '@prisma/client';

export const runtime = 'nodejs';

const createUserSchema = z.object({
  name: z.string().trim().min(1).max(120),
  email: z.string().trim().email().max(255),
  password: z.string().min(8, 'Password must be at least 8 characters').max(128),
  role: z.enum(['BRANCH_ADMIN', 'SUPER_ADMIN']),
  branchId: z.string().optional(),
});

/**
 * Super admin: list every account. Filters: ?role= (CUSTOMER | BRANCH_ADMIN |
 * SUPER_ADMIN), ?search= (email/name substring), ?status= (active | deactivated).
 */
export async function GET(req: NextRequest) {
  try {
    assertSameOrigin(req);
    const authed = await requireAuth(req);
    requireRole('SUPER_ADMIN')(authed);

    const sp = req.nextUrl.searchParams;
    const role = sp.get('role');
    const search = sp.get('search')?.trim();
    const status = sp.get('status');

    const users = await prisma.user.findMany({
      where: {
        ...(role && ['CUSTOMER', 'BRANCH_ADMIN', 'SUPER_ADMIN'].includes(role)
          ? { role: role as Role }
          : {}),
        ...(search ? { OR: [{ email: { contains: search } }, { name: { contains: search } }] } : {}),
        ...(status === 'deactivated'
          ? { deactivatedAt: { not: null } }
          : status === 'active'
            ? { deactivatedAt: null }
            : {}),
      },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        phoneVerified: true,
        role: true,
        branchId: true,
        deactivatedAt: true,
        createdAt: true,
        _count: { select: { orders: true } },
        branch: { select: { id: true, name: true } },
      },
    });

    await auditLog({
      userId: authed.user.id,
      action: 'users_listed',
      ...requestContext(req),
      meta: { role: role ?? null, status: status ?? null },
    });

    return NextResponse.json({
      users: users.map((u) => ({
        id: u.id,
        name: u.name,
        email: u.email,
        phone: u.phone,
        phoneVerified: u.phoneVerified,
        role: u.role,
        branchId: u.branchId,
        branchName: u.branch?.name ?? null,
        isActive: !u.deactivatedAt,
        deactivatedAt: u.deactivatedAt,
        orderCount: u._count.orders,
        createdAt: u.createdAt,
      })),
    });
  } catch (e) {
    return handleError(e);
  }
}

/** Super admin: provision a branch admin / super admin account. */
export async function POST(req: NextRequest) {
  try {    assertSameOrigin(req);
    const authed = await requireAuth(req);
    requireRole('SUPER_ADMIN')(authed);

    const body = await req.json()
      .catch(() => {
      throw new ApiError(400, 'Invalid request body', 'BAD_REQUEST');
    });
    const input = createUserSchema.parse(body);

    if (input.role === 'BRANCH_ADMIN' && !input.branchId) {
      throw new ApiError(400, 'A branch is required for branch admin accounts', 'BRANCH_REQUIRED');
    }
    const branch = input.branchId
      ? await prisma.branch.findUnique({ where: { id: input.branchId } })
      : null;
    if (input.branchId && !branch) {
      throw new ApiError(404, 'Branch not found', 'BRANCH_NOT_FOUND');
    }

    const email = input.email.toLowerCase();
    const exists = await prisma.user.findUnique({ where: { email } });
    if (exists) {
      throw new ApiError(409, 'An account with this email already exists', 'EMAIL_TAKEN');
    }

    const user = await prisma.user.create({
      data: {
        name: input.name,
        email,
        passwordHash: await hashPassword(input.password),
        role: input.role,
        branchId: input.role === 'BRANCH_ADMIN' ? input.branchId : null,
        phoneVerified: true, // staff accounts are created verified by the super admin
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        branchId: true,
        deactivatedAt: true,
        createdAt: true,
      },
    });

    await auditLog({
      userId: authed.user.id,
      action: 'user_created',
      ...requestContext(req),
      meta: { targetUserId: user.id, role: user.role, branchId: user.branchId },
    });

    return NextResponse.json({ user }, { status: 201 });
  } catch (e) {
    return handleError(e);
  }
}
