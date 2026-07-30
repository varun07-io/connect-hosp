import { env } from "../../env.js";
import { LocalDiskStorageProvider } from "./localDiskProvider.js";
import type { StorageProvider } from "./types.js";

// Phase 2: branch to an R2 (S3-compatible) adapter here once R2_* env vars are
// configured. Same StorageProvider contract, so no call site changes.
export function getStorageProvider(): StorageProvider {
  if (env.R2_ACCOUNT_ID && env.R2_ACCESS_KEY_ID && env.R2_SECRET_ACCESS_KEY && env.R2_BUCKET) {
    console.warn("R2 credentials detected but no real adapter is wired up yet — still using LocalDiskStorageProvider.");
  }
  return new LocalDiskStorageProvider();
}

export type { StorageProvider } from "./types.js";
export { verifySignedDownload } from "./localDiskProvider.js";
