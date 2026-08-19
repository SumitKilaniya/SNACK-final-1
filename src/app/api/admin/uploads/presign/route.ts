import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth, requireRole } from '@/lib/auth/guard';
import { assertSameOrigin } from '@/lib/auth/csrf';
import { handleError } from '@/lib/auth/errors';
import { requestContext } from '@/lib/auth/rate-limit';
import { auditLog } from '@/lib/auth/audit';
import { checkRateLimit } from '@/lib/auth/rate-limit';
import { isStorageConfigured, getPresignedUploadUrl, buildPublicUrl } from '@/lib/storage';

export const runtime = 'nodejs';

const presignSchema = z.object({
  fileName: z.string().trim().min(1).max(255),
  contentType: z.enum(['image/jpeg', 'image/png', 'image/webp']),
});

/**
 * Generate a presigned PUT URL so the admin browser can upload an image
 * directly to S3/R2/B2 without the file ever passing through Next.js.
 * Server-side only: the storage key is generated here, never from client input.
 */
export async function POST(req: NextRequest) {
  try {
    assertSameOrigin(req);
    const authed = await requireAuth(req);
    requireRole('SUPER_ADMIN')(authed);

    if (!isStorageConfigured()) {
      return NextResponse.json(
        {
          error:
            'Image storage is not configured. Set STORAGE_BUCKET, STORAGE_ACCESS_KEY_ID, STORAGE_SECRET_ACCESS_KEY, STORAGE_REGION, and STORAGE_PUBLIC_URL_BASE to enable direct uploads.',
          code: 'STORAGE_NOT_CONFIGURED',
        },
        { status: 503 }
      );
    }

    const hit = await checkRateLimit(`upload-presign:${authed.user.id}`, {
      windowMs: 60_000,
      max: 30,
    });
    if (!hit.ok) {
      return NextResponse.json(
        { error: 'Too many upload requests. Please slow down.' },
        { status: 429 }
      );
    }

    const body = await req.json().catch(() => null);
    const input = presignSchema.parse(body ?? {});

    // Generate storage key server-side: never trust client-supplied paths.
    const sanitized = input.fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
    const key = `menu-items/${crypto.randomUUID()}-${sanitized}`;

    const uploadUrl = await getPresignedUploadUrl(key, input.contentType);
    const publicUrl = buildPublicUrl(key);

    await auditLog({
      userId: authed.user.id,
      action: 'upload_presign_requested',
      ...requestContext(req),
      meta: { key, contentType: input.contentType },
    });

    return NextResponse.json({ uploadUrl, publicUrl, key });
  } catch (e) {
    return handleError(e);
  }
}
