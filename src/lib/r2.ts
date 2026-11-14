import {
  DeleteObjectCommand,
  GetObjectCommand,
  NoSuchKey,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";

let client: S3Client | undefined;

function getEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is not set`);
  }
  return value;
}

function getBucket(): string {
  return getEnv("R2_BUCKET_NAME");
}

/** R2 speaks the S3 API at the account's endpoint, in the "auto" region. */
function getClient(): S3Client {
  client ??= new S3Client({
    region: "auto",
    endpoint: `https://${getEnv("R2_ACCOUNT_ID")}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: getEnv("R2_ACCESS_KEY_ID"),
      secretAccessKey: getEnv("R2_SECRET_ACCESS_KEY"),
    },
    // Only send and check the checksums S3 requires, not the SDK's newer
    // defaults, which S3-compatible stores don't all support.
    requestChecksumCalculation: "WHEN_REQUIRED",
    responseChecksumValidation: "WHEN_REQUIRED",
  });
  return client;
}

/** Stores `body` at `key`, replacing anything already there. */
export async function putFile(key: string, body: Uint8Array, contentType: string): Promise<void> {
  await getClient().send(
    new PutObjectCommand({
      Bucket: getBucket(),
      Key: key,
      Body: body,
      ContentType: contentType,
      ContentLength: body.byteLength,
    }),
  );
}

export interface StoredFile {
  body: ReadableStream;
  /** Bytes, when R2 reports it. */
  size: number | undefined;
}

/** The file at `key` as a stream, or null when nothing is stored there. */
export async function getFile(key: string): Promise<StoredFile | null> {
  try {
    const object = await getClient().send(new GetObjectCommand({ Bucket: getBucket(), Key: key }));
    if (!object.Body) {
      return null;
    }

    return { body: object.Body.transformToWebStream(), size: object.ContentLength };
  } catch (error) {
    if (error instanceof NoSuchKey) {
      return null;
    }
    throw error;
  }
}

/** Removes the file at `key`. Succeeds when nothing is stored there. */
export async function deleteFile(key: string): Promise<void> {
  await getClient().send(new DeleteObjectCommand({ Bucket: getBucket(), Key: key }));
}
