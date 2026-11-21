import { describe, expect, it, vi } from "vitest";

import { getOpenAI, getSafetyIdentifier, isAiConfigured } from "@/lib/openai";

describe("isAiConfigured", () => {
  it("is true only while a key is set", () => {
    expect(isAiConfigured()).toBe(false);
    vi.stubEnv("OPENAI_API_KEY", "");
    expect(isAiConfigured()).toBe(false);
    vi.stubEnv("OPENAI_API_KEY", "sk-test");
    expect(isAiConfigured()).toBe(true);
  });
});

describe("getOpenAI", () => {
  it("throws while no key is set", () => {
    expect(() => getOpenAI()).toThrow("OPENAI_API_KEY is not set");
  });

  it("creates the client once and reuses it", () => {
    vi.stubEnv("OPENAI_API_KEY", "sk-test");
    const client = getOpenAI();

    expect(getOpenAI()).toBe(client);
    expect(client.timeout).toBe(30_000);
    expect(client.maxRetries).toBe(1);
  });
});

describe("getSafetyIdentifier", () => {
  it("is a stable SHA-256 hex digest that doesn't contain the id", () => {
    const id = getSafetyIdentifier("user-1");

    expect(id).toMatch(/^[0-9a-f]{64}$/);
    expect(getSafetyIdentifier("user-1")).toBe(id);
    expect(getSafetyIdentifier("user-2")).not.toBe(id);
    expect(id).not.toContain("user-1");
  });
});
