import { NextRequest, NextResponse } from 'next/server';
import { ApiError, handleError } from '@/lib/auth/errors';
import { requireAuth, requireBranchAccess, requireRole } from '@/lib/auth/guard';
import { prisma } from '@/lib/auth/prisma';
import { requestContext } from '@/lib/auth/rate-limit';
import { auditLog } from '@/lib/auth/audit';
import { branchUpdateSchema } from '@/lib/catalog-schemas';
import { stringifyPincodes } from '@/lib/catalog';

export const runtime = 'nodejs';

export async function GET(req: NextRequest, { params }: { params: Promise<{ branchId: string }> }) {
  try {
    const { branchId } = await params;
    const authed = await requireBranchAccess(req, branchId);

    const branch = await prisma.branch.findUnique({
      where: { id: branchId },
      include: { _count: { select: { users: true } } },
    });
    if (!branch) {
      return NextResponse.json({ error: 'Branch not found' }, { status: 404 });
    }

    await auditLog({
      userId: authed.user.id,
      action: 'branch_read',
      ...requestContext(req),
      meta: { branchId },
    });
    return NextResponse.json({
      branch: {
        id: branch.id,
        name: branch.name,
        city: branch.city,
        address: branch.address,
        servicePincodes: branch.servicePincodes ? (JSON.parse(branch.servicePincodes) as string[]) : [],
        isActive: branch.isActive,
        userCount: branch._count.users,
      },
    });
  } catch (e) {
    return handleError(e);
  }
}

/** Super admin: update a branch (details, service pincodes, deactivate/activate). */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ branchId: string }> }
) {
  try {
    const { branchId } = await params;
    const authed = await requireAuth(req);
    requireRole('SUPER_ADMIN')(authed);

    const existing = await prisma.branch.findUnique({ where: { id: branchId } });
    if (!existing) throw new ApiError(404, 'Branch not found', 'BRANCH_NOT_FOUND');

    const input = branchUpdateSchema.parse(await req.json());

    const branch = await prisma.branch.update({
      where: { id: branchId },
      data: {
        name: input.name ?? existing.name,
        city: input.city !== undefined ? input.city : existing.city,
        address: input.address !== undefined ? input.address : existing.address,
        servicePincodes: input.servicePincodes
          ? stringifyPincodes(input.servicePincodes)
          : existing.servicePincodes,
        isActive: input.isActive ?? existing.isActive,
      },
    });

    await auditLog({
      userId: authed.user.id,
      action: 'branch_updated',
      ...requestContext(req),
      meta: { branchId, changes: Object.keys(input) },
    });
    return NextResponse.json({ branch });
  } catch (e) {
    return handleError(e);
  }
}

/** Super admin: deactivate a branch (soft delete — keeps history intact). */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ branchId: string }> }
) {
  try {
    const { branchId } = await params;
    const authed = await requireAuth(req);
    requireRole('SUPER_ADMIN')(authed);

    const existing = await prisma.branch.findUnique({ where: { id: branchId } });
    if (!existing) throw new ApiError(404, 'Branch not found', 'BRANCH_NOT_FOUND');

    const branch = await prisma.branch.update({
      where: { id: branchId },
      data: { isActive: false },
    });

    await auditLog({
      userId: authed.user.id,
      action: 'branch_deactivated',
      ...requestContext(req),
      meta: { branchId },
    });
    return NextResponse.json({ branch });
  } catch (e) {
    return handleError(e);
  }
}
