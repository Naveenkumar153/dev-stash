import type { Session } from "next-auth";
import type { JWT } from "next-auth/jwt";
import { describe, expect, it } from "vitest";

import authConfig from "@/auth.config";

function runSession(token: JWT): Session {
  const session = { user: {}, expires: "2099-01-01T00:00:00.000Z" } as Session;
  // The callback's declared parameters cover both session strategies; with JWT
  // only `session` and `token` are passed.
  const callback = authConfig.callbacks.session as unknown as (params: {
    session: Session;
    token: JWT;
  }) => Session;
  return callback({ session, token });
}

describe("session callback", () => {
  it("copies the user id and Pro state from the token", () => {
    expect(runSession({ sub: "user-1", isPro: true }).user).toEqual({ id: "user-1", isPro: true });
  });

  it("reads a token without isPro as Free", () => {
    expect(runSession({ sub: "user-1" }).user).toEqual({ id: "user-1", isPro: false });
  });

  it("leaves the id unset without a subject", () => {
    expect(runSession({}).user).toEqual({ isPro: false });
  });
});
