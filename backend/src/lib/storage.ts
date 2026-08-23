import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { AppError } from "./errors";
import { env } from "./env";

export interface ObjectMetadata {
  sizeBytes: number;
  contentType?: string;
  etag?: string;
}

export interface ObjectStorage {
  createUploadUrl(input: { key: string; contentType: string; sizeBytes: number }): Promise<{ url: string; expiresAt: Date }>;
  putObject(input: { key: string; buffer: Buffer; contentType: string }): Promise<void>;
  headObject(key: string): Promise<ObjectMetadata | null>;
  createDownloadUrl(input: { key: string; filename: string }): Promise<{ url: string; expiresAt: Date }>;
  deleteObject(key: string): Promise<void>;
}

function storageUnavailable(): never {
  throw new AppError(503, "Object storage não configurado", "storage_unavailable");
}

class S3ObjectStorage implements ObjectStorage {
  private readonly client: S3Client;
  // Presigning client: signs against the browser-reachable endpoint so the
  // returned URL host matches what a real browser will request (SigV4 binds
  // the Host header). Server-side ops (head/delete) keep the internal client.
  private readonly presignClient: S3Client;

  constructor() {
    if (!env.STORAGE_BUCKET || !env.STORAGE_ACCESS_KEY || !env.STORAGE_SECRET_KEY) storageUnavailable();
    const credentials = { accessKeyId: env.STORAGE_ACCESS_KEY, secretAccessKey: env.STORAGE_SECRET_KEY };
    this.client = new S3Client({
      region: env.STORAGE_REGION,
      endpoint: env.STORAGE_ENDPOINT,
      forcePathStyle: env.STORAGE_FORCE_PATH_STYLE,
      credentials,
    });
    this.presignClient = new S3Client({
      region: env.STORAGE_REGION,
      endpoint: env.STORAGE_PUBLIC_ENDPOINT ?? env.STORAGE_ENDPOINT,
      forcePathStyle: env.STORAGE_FORCE_PATH_STYLE,
      credentials,
    });
  }

  async createUploadUrl(input: { key: string; contentType: string; sizeBytes: number }) {
    const expiresIn = Math.min(900, Math.max(60, env.STORAGE_PRESIGN_TTL_SECONDS));
    const command = new PutObjectCommand({
      Bucket: env.STORAGE_BUCKET,
      Key: input.key,
      ContentType: input.contentType,
      ContentLength: input.sizeBytes,
    });
    return { url: await getSignedUrl(this.presignClient, command, { expiresIn }), expiresAt: new Date(Date.now() + expiresIn * 1000) };
  }

  async putObject(input: { key: string; buffer: Buffer; contentType: string }): Promise<void> {
    const command = new PutObjectCommand({
      Bucket: env.STORAGE_BUCKET,
      Key: input.key,
      Body: input.buffer,
      ContentType: input.contentType,
      ContentLength: input.buffer.length,
    });
    await this.client.send(command);
  }

  async headObject(key: string): Promise<ObjectMetadata | null> {
    try {
      const result = await this.client.send(new HeadObjectCommand({ Bucket: env.STORAGE_BUCKET, Key: key }));
      return { sizeBytes: result.ContentLength ?? 0, contentType: result.ContentType, etag: result.ETag };
    } catch (error) {
      const name = error instanceof Error ? error.name : "";
      if (name === "NotFound" || name === "NoSuchKey") return null;
      throw error;
    }
  }

  async createDownloadUrl(input: { key: string; filename: string }) {
    const expiresIn = Math.min(900, Math.max(60, env.STORAGE_PRESIGN_TTL_SECONDS));
    const safeFilename = input.filename.replace(/[\r\n]/g, "").slice(0, 255) || "download";
    const command = new GetObjectCommand({
      Bucket: env.STORAGE_BUCKET,
      Key: input.key,
      ResponseContentDisposition: `attachment; filename*=UTF-8''${encodeURIComponent(safeFilename)}`,
    });
    return { url: await getSignedUrl(this.presignClient, command, { expiresIn }), expiresAt: new Date(Date.now() + expiresIn * 1000) };
  }

  async deleteObject(key: string) {
    await this.client.send(new DeleteObjectCommand({ Bucket: env.STORAGE_BUCKET, Key: key }));
  }
}

export function getObjectStorage(): ObjectStorage {
  return new S3ObjectStorage();
}
