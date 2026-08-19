import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

/** Check whether all required storage env vars are present. */
export function isStorageConfigured(): boolean {
  return Boolean(
    process.env.STORAGE_BUCKET &&
      process.env.STORAGE_ACCESS_KEY_ID &&
      process.env.STORAGE_SECRET_ACCESS_KEY &&
      process.env.STORAGE_REGION &&
      process.env.STORAGE_PUBLIC_URL_BASE
  );
}

function getS3Client(): S3Client {
  const config: Record<string, unknown> = {
    region: process.env.STORAGE_REGION || 'auto',
    credentials: {
      accessKeyId: process.env.STORAGE_ACCESS_KEY_ID!,
      secretAccessKey: process.env.STORAGE_SECRET_ACCESS_KEY!,
    },
  };
  // R2, B2, and other S3-compatible services need a custom endpoint.
  // For real AWS S3, STORAGE_ENDPOINT is omitted and the SDK uses the default.
  if (process.env.STORAGE_ENDPOINT) {
    config.endpoint = process.env.STORAGE_ENDPOINT;
    config.forcePathStyle = true;
  }
  return new S3Client(config);
}

/**
 * Generate a presigned PUT URL that lets the browser upload directly to the
 * bucket (never through the Next.js server). The URL is short-lived (5 min).
 */
export async function getPresignedUploadUrl(
  key: string,
  contentType: string
): Promise<string> {
  const command = new PutObjectCommand({
    Bucket: process.env.STORAGE_BUCKET!,
    Key: key,
    ContentType: contentType,
  });
  return getSignedUrl(getS3Client(), command, { expiresIn: 300 });
}

/** Build the public URL for an object given its key. */
export function buildPublicUrl(key: string): string {
  const base = (process.env.STORAGE_PUBLIC_URL_BASE || '').replace(/\/$/, '');
  return `${base}/${key}`;
}
