
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/auth/prisma';
import { getMenuForBranch, parsePincodes } from '@/lib/catalog';

export const runtime = 'nodejs';
export const revalidate = 300;

const FALLBACK_BRANCH = {
  id: 'br_btm_layout',
  name: 'BTM Layout',
  city: 'Bengaluru',
  servicePincodes: ['560076', '560078', '560103'],
};

export async function GET(req: NextRequest) {
  try {
    const requested =
      req.nextUrl.searchParams.get('branchId')?.trim();

    const dbBranch = requested
      ? await prisma.branch.findUnique({
          where: { id: requested },
        })
      : await prisma.branch.findFirst({
          where: { isActive: true },
          orderBy: { name: 'asc' },
        });

    const branchId =
      dbBranch?.isActive
        ? dbBranch.id
        : requested || FALLBACK_BRANCH.id;

    const branchDetails = dbBranch?.isActive
      ? {
          id: dbBranch.id,
          name: dbBranch.name,
          city: dbBranch.city,
          servicePincodes: parsePincodes(dbBranch),
        }
      : {
          id: branchId,
          name: FALLBACK_BRANCH.name,
          city: FALLBACK_BRANCH.city,
          servicePincodes: FALLBACK_BRANCH.servicePincodes,
        };

    const items = await getMenuForBranch(branchId);

    return NextResponse.json({
      branch: branchDetails,
      items,
    });
  } catch (error) {
    console.error('GET /api/menu failed:', error);

    return NextResponse.json(
      { error: 'Failed to load menu' },
      { status: 500 }
    );
  }
}
