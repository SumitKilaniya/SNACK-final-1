
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

type MenuBranch = {
  id: string;
  name: string;
  city: string | null;
  servicePincodes: string | null;
  isActive: boolean;
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

    const branch: MenuBranch =
      dbBranch && dbBranch.isActive
        ? dbBranch
        : {
            id: requested || FALLBACK_BRANCH.id,
            name: FALLBACK_BRANCH.name,
            city: FALLBACK_BRANCH.city,
            servicePincodes: JSON.stringify(
              FALLBACK_BRANCH.servicePincodes
            ),
            isActive: true,
          };

    const items = await getMenuForBranch(branch.id);

    return NextResponse.json({
      branch: {
        id: branch.id,
        name: branch.name,
        city: branch.city,
        servicePincodes: parsePincodes(branch),
      },
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
