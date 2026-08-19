import { NextResponse } from 'next/server';
import { prisma } from '@/lib/auth/prisma';

export const runtime = 'nodejs';
// Never cache: monitors and load balancers rely on a live signal.
export const dynamic = 'force-dynamic';

/**
 * Liveness + DB-readiness probe. Returns 200 with DB connectivity status,
 * memory usage, and uptime. Point monitors / load balancers at /api/health.
 */
export async function GET() {
  let dbStatus = 'down';
  try {
    // Attempt standard raw query or lightweight user count
    await prisma.$queryRawUnsafe('SELECT 1');
    dbStatus = 'up';
  } catch {
    try {
      await prisma.user.count({ take: 1 });
      dbStatus = 'up';
    } catch (e) {
      console.error('[health] database unreachable:', e);
      dbStatus = 'down';
    }
  }

  const mem = process.memoryUsage();
  const memory = {
    heapUsedMB: Math.round(mem.heapUsed / 1024 / 1024),
    heapTotalMB: Math.round(mem.heapTotal / 1024 / 1024),
    rssMB: Math.round(mem.rss / 1024 / 1024),
  };

  const isHealthy = dbStatus === 'up';
  const responseData = {
    status: isHealthy ? 'healthy' : 'unhealthy',
    ok: isHealthy,
    db: dbStatus,
    redis: process.env.REDIS_URL ? 'configured' : 'not_configured',
    uptimeSeconds: Math.floor(process.uptime()),
    memory,
    timestamp: new Date().toISOString(),
  };

  return NextResponse.json(responseData, { status: isHealthy ? 200 : 503 });
}

