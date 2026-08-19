import { NextResponse } from 'next/server';
import { prisma } from '@/lib/auth/prisma';
import { parsePincodes } from '@/lib/catalog';

export const runtime = 'nodejs';

/** Cache active branch list for 5 minutes — branches change rarely. */
export const revalidate = 300;

const FALLBACK_BRANCHES = [
  {
    id: 'br_btm_layout',
    name: 'BTM Layout',
    city: 'Bengaluru',
    address: '100 Ft Ring Road, BTM 2nd Stage',
    servicePincodes: ['560076', '560078', '560103'],
  },
  {
    id: 'br_indiranagar',
    name: 'Indiranagar',
    city: 'Bengaluru',
    address: '100 Feet Road, Indiranagar',
    servicePincodes: ['560038', '560075', '560008'],
  },
];

/** Public: list active branches (for the branch selector). */
export async function GET() {
  try {
    let branches: any[] = [];
    try {
      branches = await prisma.branch.findMany({
        where: { isActive: true },
        orderBy: { name: 'asc' },
      });
    } catch {
      branches = [];
    }

    if (!branches || branches.length === 0) {
      return NextResponse.json({
        branches: FALLBACK_BRANCHES,
      });
    }

    return NextResponse.json({
      branches: branches.map((b) => ({
        id: b.id,
        name: b.name,
        city: b.city,
        address: b.address,
        servicePincodes: parsePincodes(b),
      })),
    });
  } catch {
    return NextResponse.json({
      branches: FALLBACK_BRANCHES,
    });
  }
}
