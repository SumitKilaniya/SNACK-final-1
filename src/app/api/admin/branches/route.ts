import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, requireRole } from '@/lib/auth/guard';
import { handleError } from '@/lib/auth/errors';
import { prisma } from '@/lib/auth/prisma';
import { requestContext } from '@/lib/auth/rate-limit';
import { auditLog } from '@/lib/auth/audit';
import { branchCreateSchema } from '@/lib/catalog-schemas';
import { stringifyPincodes } from '@/lib/catalog';

export const runtime = 'nodejs';

/** Super admin: list every branch (active + inactive) with user counts. */
export async function GET(req: NextRequest) {
  try {
    const authed = await requireAuth(req);
    requireRole('SUPER_ADMIN')(authed);

    const branches = await prisma.branch.findMany({
      orderBy: { name: 'asc' },
      include: { _count: { select: { users: true } } },
    });

    await auditLog({
      userId: authed.user.id,
      action: 'branches_listed',
      ...requestContext(req),
    });
    return NextResponse.json({
      branches: branches.map((b) => ({
        id: b.id,
        name: b.name,
        city: b.city,
        address: b.address,
        servicePincodes: b.servicePincodes ? (JSON.parse(b.servicePincodes) as string[]) : [],
        isActive: b.isActive,
        userCount: b._count.users,
        createdAt: b.createdAt,
      })),
    });
  } catch (e) {
    return handleError(e);
  }
}

/** Super admin: create a branch. */
export async function POST(req: NextRequest) {
  try {
    const authed = await requireAuth(req);
    requireRole('SUPER_ADMIN')(authed);

    const input = branchCreateSchema.parse(await req.json());

    const branch = await prisma.branch.create({
      data: {
        name: input.name,
        city: input.city,
        address: input.address,
        servicePincodes: input.servicePincodes ? stringifyPincodes(input.servicePincodes) : null,
      },
    });

    await auditLog({
      userId: authed.user.id,
      action: 'branch_created',
      ...requestContext(req),
      meta: { branchId: branch.id, name: branch.name },
    });
    return NextResponse.json({ branch }, { status: 201 });
  } catch (e) {
    return handleError(e);
  }
}
