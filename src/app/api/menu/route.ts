
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
    const requested = req.nextUrl.searchParams
      .get('branchId')
      ?.trim();

    let branch = requested
      ? await prisma.branch.findUnique({
          where: { id: requested },
        })
      : await prisma.branch.findFirst({
          where: { isActive: true },
          orderBy: { name: 'asc' },
        });

    if (!branch || !branch.isActive) {
      branch = {
        ...FALLBACK_BRANCH,
        id: requested || FALLBACK_BRANCH.id,
      };
    }

    const items = await getMenuForBranch(branch.id);

    return NextResponse.json({
      branch: {
        id: branch.id,
        name: branch.name,
        city: branch.city,
        servicePincodes: Array.isArray(branch.servicePincodes)
          ? branch.servicePincodes
          : parsePincodes(branch),
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
