import { NextRequest, NextResponse } from 'next/server';
import { ApiError, handleError } from '@/lib/auth/errors';
import { prisma } from '@/lib/auth/prisma';
import { parsePincodes } from '@/lib/catalog';

export const runtime = 'nodejs';

/**
 * Branch discovery: given a delivery pincode, return the active branch(es)
 * whose service area includes it.
 *   GET /api/branches/nearby?pincode=560076
 */
export async function GET(req: NextRequest) {
  try {
    const pincode = req.nextUrl.searchParams.get('pincode')?.trim() ?? '';
    if (!/^\d{6}$/.test(pincode)) {
      throw new ApiError(400, 'A valid 6-digit pincode is required', 'BAD_REQUEST');
    }

    const branches = await prisma.branch.findMany({ where: { isActive: true } });
    const matches = branches.filter((b) => parsePincodes(b).includes(pincode));

    return NextResponse.json({
      pincode,
      branches: matches.map((b) => ({
        id: b.id,
        name: b.name,
        city: b.city,
        address: b.address,
        servicePincodes: parsePincodes(b),
      })),
    });
  } catch (e) {
    return handleError(e);
  }
}
