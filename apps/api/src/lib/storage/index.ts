import { env } from "../../env.js";
import { LocalDiskStorageProvider } from "./localDiskProvider.js";
import { S3StorageProvider } from "./s3Provider.js";
import type { StorageProvider } from "./types.js";

function makeS3Provider(bucket: string): StorageProvider {
  return new S3StorageProvider(
    bucket,
    env.AWS_REGION!,
    env.AWS_ACCESS_KEY_ID!,
    env.AWS_SECRET_ACCESS_KEY!,
  );
}

function isAwsConfigured(): boolean {
  return !!(env.AWS_REGION && env.AWS_ACCESS_KEY_ID && env.AWS_SECRET_ACCESS_KEY);
}

/** General-purpose provider (medical records vault). */
export function getStorageProvider(): StorageProvider {
  if (isAwsConfigured() && env.S3_BUCKET_MEDICAL) return makeS3Provider(env.S3_BUCKET_MEDICAL);
  return new LocalDiskStorageProvider();
}

/** KYC document storage — separate bucket with stricter IAM policy in production. */
export function getKycStorageProvider(): StorageProvider {
  if (isAwsConfigured() && env.S3_BUCKET_KYC) return makeS3Provider(env.S3_BUCKET_KYC);
  return new LocalDiskStorageProvider();
}

/** Hospital verification documents. */
export function getHospitalDocsStorageProvider(): StorageProvider {
  if (isAwsConfigured() && env.S3_BUCKET_HOSPITAL_DOCS) return makeS3Provider(env.S3_BUCKET_HOSPITAL_DOCS);
  return new LocalDiskStorageProvider();
}

/** Payment receipts / Razorpay webhook payloads archived as JSON. */
export function getPaymentStorageProvider(): StorageProvider {
  if (isAwsConfigured() && env.S3_BUCKET_PAYMENT_RECEIPTS) return makeS3Provider(env.S3_BUCKET_PAYMENT_RECEIPTS);
  return new LocalDiskStorageProvider();
}

export type { StorageProvider } from "./types.js";
export { verifySignedDownload } from "./localDiskProvider.js";
