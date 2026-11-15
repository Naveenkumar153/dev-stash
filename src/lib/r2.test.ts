import { beforeEach, describe, expect, it, vi } from "vitest";

import { listFileKeys } from "@/lib/r2";

const send = vi.hoisted(() => vi.fn());

// The SDK client is replaced by a stub whose `send` each test scripts; the
// commands only carry their input, which is what the tests check.
vi.mock("@aws-sdk/client-s3", () => {
  class Command {
    constructor(public input: Record<string, unknown>) {}
  }
  return {
    S3Client: class {
      send = send;
    },
    ListObjectsV2Command: class extends Command {},
    DeleteObjectCommand: class extends Command {},
    GetObjectCommand: class extends Command {},
    PutObjectCommand: class extends Command {},
    NoSuchKey: class extends Error {},
  };
});

beforeEach(() => {
  vi.stubEnv("R2_ACCOUNT_ID", "account");
  vi.stubEnv("R2_ACCESS_KEY_ID", "key");
  vi.stubEnv("R2_SECRET_ACCESS_KEY", "secret");
  vi.stubEnv("R2_BUCKET_NAME", "devstash");
});

describe("listFileKeys", () => {
  it("lists every key under the prefix, following the pages", async () => {
    send
      .mockResolvedValueOnce({
        Contents: [{ Key: "user-1/a.png" }, { Key: "user-1/b.md" }],
        IsTruncated: true,
        NextContinuationToken: "page-2",
      })
      .mockResolvedValueOnce({ Contents: [{ Key: "user-1/c.pdf" }], IsTruncated: false });

    expect(await listFileKeys("user-1/")).toEqual(["user-1/a.png", "user-1/b.md", "user-1/c.pdf"]);
    expect(send).toHaveBeenCalledTimes(2);
    expect(send.mock.calls[0][0].input).toEqual({
      Bucket: "devstash",
      Prefix: "user-1/",
      ContinuationToken: undefined,
    });
    expect(send.mock.calls[1][0].input).toMatchObject({ ContinuationToken: "page-2" });
  });

  it("returns nothing for an empty prefix listing", async () => {
    send.mockResolvedValueOnce({ KeyCount: 0, IsTruncated: false });

    expect(await listFileKeys("user-1/")).toEqual([]);
    expect(send).toHaveBeenCalledOnce();
  });

  it("lets a failed request reject, for the caller to handle", async () => {
    send.mockRejectedValueOnce(new Error("R2 unavailable"));

    await expect(listFileKeys("user-1/")).rejects.toThrow("R2 unavailable");
  });
});
