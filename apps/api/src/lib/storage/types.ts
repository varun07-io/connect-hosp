export interface StorageProvider {
  /** Stores the object under `key` and returns nothing — callers persist the key, never a URL. */
  putObject(key: string, data: Buffer, contentType: string): Promise<void>;
  /** A time-limited, access-controlled URL a client can fetch directly (VLT-06). */
  getSignedDownloadUrl(key: string, expiresInSeconds: number): Promise<string>;
  deleteObject(key: string): Promise<void>;
}
