import { describe, expect, it } from "vitest";

import { BODY_NOT_JSON, BODY_TOO_LARGE, readJsonBody, readTextBody } from "@/lib/request-body";

function post(body: BodyInit | null, headers: HeadersInit = {}) {
  return new Request("http://localhost/api/auth/register", { method: "POST", body, headers });
}

/** A body sent without a Content-Length, the way a chunked upload arrives. */
function chunked(...chunks: string[]) {
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(encoder.encode(chunk));
      controller.close();
    },
  });

  return new Request("http://localhost/api/auth/register", {
    method: "POST",
    body: stream,
    duplex: "half",
  } as RequestInit);
}

describe("readJsonBody", () => {
  it("parses a JSON body within the limit", async () => {
    const result = await readJsonBody(post(JSON.stringify({ email: "ada@example.com" })), 1024);

    expect(result).toEqual({ ok: true, body: { email: "ada@example.com" } });
  });

  it("refuses a declared Content-Length over the limit without reading the body", async () => {
    const request = post("{}", { "content-length": "2048" });

    expect(await readJsonBody(request, 1024)).toEqual({
      ok: false,
      status: 413,
      error: BODY_TOO_LARGE,
    });
    expect(request.bodyUsed).toBe(false);
  });

  it("refuses a chunked body once it passes the limit", async () => {
    const result = await readJsonBody(chunked('{"a":"', "x".repeat(600), "x".repeat(600), '"}'), 1024);

    expect(result).toEqual({ ok: false, status: 413, error: BODY_TOO_LARGE });
  });

  it("accepts a chunked body that stays within the limit", async () => {
    expect(await readJsonBody(chunked('{"name":', '"Ada"}'), 1024)).toEqual({
      ok: true,
      body: { name: "Ada" },
    });
  });

  it("allows a body of exactly the limit", async () => {
    const body = JSON.stringify({ a: "x".repeat(1016) });

    expect(body).toHaveLength(1024);
    expect(await readJsonBody(post(body), 1024)).toMatchObject({ ok: true });
  });

  it("reports malformed JSON and an empty body as a 400", async () => {
    expect(await readJsonBody(post("{not json"), 1024)).toEqual({
      ok: false,
      status: 400,
      error: BODY_NOT_JSON,
    });
    expect(await readJsonBody(post(null), 1024)).toEqual({
      ok: false,
      status: 400,
      error: BODY_NOT_JSON,
    });
  });
});

describe("readTextBody", () => {
  it("returns the raw text, unparsed", async () => {
    expect(await readTextBody(post('{"a": 1}'), 1024)).toEqual({ ok: true, body: '{"a": 1}' });
  });

  it("refuses a declared length over the cap", async () => {
    const request = new Request("http://localhost/api", {
      method: "POST",
      headers: { "content-length": "2048" },
      body: "{}",
    });

    expect(await readTextBody(request, 1024)).toEqual({
      ok: false,
      status: 413,
      error: BODY_TOO_LARGE,
    });
  });

  it("refuses a chunked body once it passes the cap", async () => {
    expect(await readTextBody(chunked("x".repeat(600), "x".repeat(600)), 1024)).toMatchObject({
      ok: false,
      status: 413,
    });
  });

  it("reads an empty body as an empty string", async () => {
    expect(await readTextBody(post(null), 1024)).toEqual({ ok: true, body: "" });
  });
});
