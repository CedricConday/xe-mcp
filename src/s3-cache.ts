/**
 * S3-backed rate history cache.
 * Lambda functions use this instead of hitting Frankfurter/Xe on every invocation.
 * Cache TTL: 1 hour per pair. Format: xe-mcp-cache/{from}-{to}/{YYYY-MM-DD}.json
 */

import { S3Client, GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";

const s3 = new S3Client({ region: process.env.AWS_REGION ?? "ap-southeast-2" });

export function s3CacheAvailable(): boolean {
  return !!(process.env.CACHE_BUCKET);
}

function cacheKey(from: string, to: string, date: string): string {
  return `${from.toUpperCase()}-${to.toUpperCase()}/${date}.json`;
}

export interface CachedRate {
  rate: number;
  cachedAt: string;
  source: "xe" | "frankfurter";
}

export async function getCachedRate(
  from: string,
  to: string,
  date: string
): Promise<CachedRate | null> {
  const bucket = process.env.CACHE_BUCKET;
  if (!bucket) return null;

  try {
    const { Body } = await s3.send(
      new GetObjectCommand({ Bucket: bucket, Key: cacheKey(from, to, date) })
    );
    const text = await Body?.transformToString();
    if (!text) return null;
    return JSON.parse(text) as CachedRate;
  } catch {
    return null;
  }
}

export async function setCachedRate(
  from: string,
  to: string,
  date: string,
  rate: number,
  source: "xe" | "frankfurter"
): Promise<void> {
  const bucket = process.env.CACHE_BUCKET;
  if (!bucket) return;

  const entry: CachedRate = { rate, cachedAt: new Date().toISOString(), source };

  await s3.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: cacheKey(from, to, date),
      Body: JSON.stringify(entry),
      ContentType: "application/json",
    })
  );
}
