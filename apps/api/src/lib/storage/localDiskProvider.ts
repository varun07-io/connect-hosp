import { createHmac, timingSafeEqual } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { env } from "../../env.js";
import type { StorageProvider } from "./types.js";

const UPLOAD_ROOT = path.resolve(process.cwd(), "var", "uploads");

function sign(key: string, expiresAt: number): string {
  return createHmac("sha256", env.FILE_SIGNING_SECRET).update(`${key}:${expiresAt}`).digest("hex");
}

export function verifySignedDownload(key: string, expiresAt: number, token: string): boolean {
  if (Date.now() > expiresAt) return false;
  const expected = Buffer.from(sign(key, expiresAt));
  const actual = Buffer.from(token);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

function safePath(key: string): string {
  const resolved = path.resolve(UPLOAD_ROOT, key);
  if (!resolved.startsWith(UPLOAD_ROOT)) {
    throw new Error("Invalid storage key");
  }
  return resolved;
}

/**
 * No-account stand-in for Cloudflare R2: writes encrypted-at-rest-by-the-OS files
 * under apps/api/var/uploads and issues HMAC-signed, expiring links served by the
 * /files route — same contract (`getSignedDownloadUrl`) the real R2 adapter will
 * expose once R2_* env vars are set.
 */
export class LocalDiskStorageProvider implements StorageProvider {
  async putObject(key: string, data: Buffer): Promise<void> {
    const filePath = safePath(key);
    await mkdir(path.dirname(filePath), { recursive: true });
    await writeFile(filePath, data);
  }

  async getSignedDownloadUrl(key: string, expiresInSeconds: number): Promise<string> {
    const expiresAt = Date.now() + expiresInSeconds * 1000;
    const token = sign(key, expiresAt);
    const url = new URL("/files/download", env.API_PUBLIC_URL);
    url.searchParams.set("key", key);
    url.searchParams.set("exp", String(expiresAt));
    url.searchParams.set("token", token);
    return url.toString();
  }

  async deleteObject(key: string): Promise<void> {
    await rm(safePath(key), { force: true });
  }

  async readObject(key: string): Promise<Buffer> {
    return readFile(safePath(key));
  }
}
