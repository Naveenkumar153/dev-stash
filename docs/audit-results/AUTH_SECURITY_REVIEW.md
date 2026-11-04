# Auth Security Review

**Last audit:** 2026-11-04
**Scope:** `src/auth.config.ts`, `src/auth.ts`, `src/proxy.ts`, `src/app/api/auth/{[...nextauth],register,verify-email}/route.ts`, `src/types/{next-auth.d,auth}.ts`, `src/actions/{auth,profile}.ts`, `src/lib/{password,auth-schemas,tokens,verification,password-reset,email,auth-redirect,prisma}.ts`, `src/lib/db/{user,profile}.ts`, `src/app/(auth)/**`, `src/app/profile/page.tsx`, `src/app/dashboard/{layout,page}.tsx`, `src/components/{auth,profile}/**`, `src/components/dashboard/SidebarUser.tsx`, `prisma/schema.prisma` (User, Account, Session, VerificationToken), `prisma/seed.ts` (hashing only), `.env.example`
**Result:** 0 Critical · 1 High · 3 Medium · 2 Low

## Critical

None found.

## High

### Credentials sign-in has no rate limiting, so passwords can be guessed without limit
`src/auth.ts:22-57`

**Problem:** Neither credentials entry point limits attempts, adds a delay, or locks the account: the `signInWithCredentials` action (`src/actions/auth.ts:33-68`) and NextAuth's own `POST /api/auth/callback/credentials`. Both reach `authorize`, which runs `verifyPassword()` on every attempt. The password policy is 8 characters minimum with no other rule (`src/lib/auth-schemas.ts:13-16`). `changePassword` (`src/actions/profile.ts:47`) also allows unlimited guesses at the current password.

**Attack:** An attacker fetches `/api/auth/csrf` once, then scripts `POST /api/auth/callback/credentials` (or the Server Action) with a target email and a password list. Only about 200 ms of bcrypt per guess slows them, and that cost parallelises across requests and instances. Weak or reused passwords fall to dictionary and credential-stuffing lists.

Two more effects follow:
- **CPU drain:** looping against a known address such as `demo@devstash.io` burns about 200 ms of pure-JS bcrypt CPU per request, which degrades the server.
- **Lock-out after a stolen session:** someone holding a stolen session cookie but not the password can brute-force the current password through `changePassword`, then set a new password and lock the owner out.

**Fix:** Throttle inside `authorize`. That covers both entry points, and `authorize` receives the original request headers. Key the limit on IP and on email, and back it with a shared store (Redis/Upstash, or a small Prisma table added through a migration), not process memory. Count only failures, and prefer a growing delay or a CAPTCHA over a hard lock on the email key, so an attacker can't lock a real user out.
```ts
// src/auth.ts
async authorize(input, request) {
  const parsed = signInSchema.safeParse(input);
  if (!parsed.success) return null;

  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (
    !(await rateLimit(`signin:ip:${ip}`, 20, FIFTEEN_MINUTES)) ||
    !(await rateLimit(`signin:email:${parsed.data.email}`, 10, FIFTEEN_MINUTES))
  ) {
    throw new TooManyAttempts(); // CredentialsSignin subclass, code = "rate_limited"
  }
  // ...existing lookup and verifyPassword
}
```
Map `rate_limited` in `signInWithCredentials` the same way `EMAIL_NOT_VERIFIED` is mapped. In `changePassword`, run `rateLimit(\`change-password:${session.user.id}\`, 5, FIFTEEN_MINUTES)` before `verifyPassword`.

**Verified by:**
- Code read: `src/auth.ts:22-57`, `src/actions/auth.ts:33-68` and `src/actions/profile.ts:23-59`. A grep for rate/limit across `src` returns nothing.
- Auth.js source: `node_modules/@auth/core/lib/actions/callback/index.js:227-236` calls `provider.authorize` directly with no throttle and forwards the request headers. `node_modules/next-auth/lib/actions.js:7` copies the incoming headers on the Server Action path.
- Timing: a bcryptjs 3.0.3 cost-12 compare took about 206 ms locally.

## Medium

### The register endpoint tells anyone whether an email has an account
`src/app/api/auth/register/route.ts:29-32`

**Problem:** For any existing user the route returns `409 "An account with this email already exists"`, including GitHub-only users, and nothing limits how often it can be called. This undoes the care taken to keep forgot-password and resend-verification from revealing accounts.

**Attack:** An attacker POSTs `{ name, email, password, confirmPassword }` for each address on a list. A 409 means the address has a DevStash account. A 201 means it didn't, and leaves a throwaway account behind. The confirmed list focuses the High finding's password guessing on real accounts and supports targeted "reset your DevStash password" phishing.

**Fix:** While verification is on, give an existing email the same 201 "check your email" reply, and email that address a notice that the account already exists and it can sign in or reset the password. Do the bcrypt work on both paths and send all mail through `after()`, so the timing matches as well. With verification off, the toast-and-redirect UX needs the 409, so accept it only in that mode.
```ts
if (existing) {
  await hashPassword(password); // same cost as the create path
  after(() => sendAccountExistsEmail(email).catch(console.error));
  return Response.json(
    { success: true, data: { email, verificationRequired: true }, error: null },
    { status: 201 },
  );
}
```
`RegisterForm` reads only `error`, `data.email` and `data.verificationRequired`, so `id` and `name` can be dropped from the success body on both paths.

**Verified by:**
- Code read: `src/app/api/auth/register/route.ts:7, 29-32` and `src/components/auth/RegisterForm.tsx:48-66`.
- Next.js docs: `after()` is supported in Route Handlers and Server Functions (`node_modules/next/dist/docs/01-app/03-api-reference/04-functions/after.md`).

### Registration and the email-sending endpoints are throttled only per address
`src/app/api/auth/register/route.ts:13-54`

**Problem:** The only control on outbound email is a one-minute cooldown per address (`src/lib/verification.ts:25`, `src/lib/password-reset.ts:28`). Nothing limits requests per IP or in total. Registration has no limit at all. Each new address it accepts costs a bcrypt hash and a `users` row. With verification on, it also sends a Resend email whose greeting carries the attacker's `name`, up to 100 characters (`src/lib/email.ts:61-67`, `src/lib/auth-schemas.ts:31-35`).

**Attack:**
1. A script registers thousands of addresses, and DevStash mails "Verify your DevStash email — Hi \<attacker text\>," to each inbox. This spends the Resend quota and sender reputation until real verification and reset emails start failing, and every request leaves an unverified user row behind.
2. A script calls `requestPasswordReset` (`src/actions/auth.ts:126-148`) for one real user every 61 seconds. That inbox gets 1,440 reset emails a day, indefinitely. `resendVerificationEmail` does the same to unverified accounts.

Until a Resend domain is verified, Resend delivers only to the account owner, so case 1 currently lands as database and CPU load plus failed sends. Once `EMAIL_FROM` and a domain are set up, it becomes a spam relay.

**Fix:**
- Apply the High finding's limiter by IP to `POST /api/auth/register`, `requestPasswordReset` and `resendVerificationEmail`.
- Add a daily cap per address in the same store, on top of the cooldown (for example, at most 5 reset or verification emails per 24 hours).
- Drop the user-supplied name from the verification email, since the address owner has not confirmed the account is theirs.
```ts
// register route, before parsing the body
const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
if (!(await rateLimit(`register:ip:${ip}`, 5, ONE_HOUR))) {
  return errorResponse("Too many attempts. Try again later.", 429);
}
// in the Server Actions: const ip = (await headers()).get("x-forwarded-for") ...
```

**Verified by:**
- Code read: `src/app/api/auth/register/route.ts:13-54`, `src/actions/auth.ts:80-148`, `src/lib/verification.ts:24-36`, `src/lib/password-reset.ts:26-38`, `src/lib/tokens.ts:21-32` and `src/lib/email.ts:60-71`.
- There is no limiter anywhere in `src`.

### Password reset and password change leave existing sessions signed in
`src/lib/password-reset.ts:66-74`

**Problem:** Sessions are JWTs carrying only `sub`, and nothing ties them to the current password. Resetting the password (`src/lib/password-reset.ts:66-74`) or changing it (`src/actions/profile.ts:56-59`) leaves every earlier JWT valid. The page and action checks only confirm that the user row still exists: `src/lib/db/user.ts:34-49`, `src/lib/db/profile.ts:28-52` and `src/actions/profile.ts:24-26, 92-96`. A password change also leaves any pending reset link usable for up to an hour.

**Attack:**
1. An attacker who has the password (see High) or a session cookie signs in. The owner notices and resets or changes the password, but the attacker's session keeps working. The proxy re-issues the cookie with a fresh 30-day expiry on every visit to `/dashboard` or `/profile`, so the session never lapses while it's used. The attacker can still open `/profile` and delete the account, which asks for no password. Once the dashboards switch from the demo user to the session user, the attacker can also read the user's own data.
2. While `EMAIL_VERIFICATION_ENABLED=false`, an attacker registers `victim@corp.com` and keeps that session. The real owner later can't sign in with GitHub (`OAuthAccountNotLinked`), recovers the account through forgot-password, and starts storing data in it. The attacker's session survives the reset.

**Fix:** Add a version number to the user (this needs a migration) and check it in the Node-side `jwt` callback, which runs on every `auth()` call from `@/auth`.
```prisma
model User {
  // ...
  sessionVersion Int @default(0)
}
```
```ts
// src/auth.ts (the edge proxy can't reach the DB; pages and actions re-check through auth())
callbacks: {
  ...authConfig.callbacks,
  async jwt({ token, user }) {
    if (user) {
      token.sv = (user as { sessionVersion?: number }).sessionVersion ?? 0;
      return token;
    }
    if (!token.sub) return token;
    const row = await prisma.user.findUnique({
      where: { id: token.sub },
      select: { sessionVersion: true },
    });
    return row?.sessionVersion === token.sv ? token : null; // null clears the session
  },
},
```
The rest of the change:
- Have `authorize` return `sessionVersion`.
- Do `sessionVersion: { increment: 1 }` in the same write as the reset and the change.
- In `changePassword`, also delete the `resetIdentifier(email)` tokens. Then sign the current browser back in with the new password (`signIn("credentials", { email, password, redirect: false })`), so only the other sessions end.
- Don't refresh `sv` from the `update` trigger, because its `session` argument comes from the client.
- Add `sv?: number` to the `JWT` interface in `src/types/next-auth.d.ts`.

**Verified by:**
- Code read: `src/lib/password-reset.ts:51-76`, `src/actions/profile.ts:23-129`, `src/auth.config.ts:20-29` (there is no `jwt` callback), `src/lib/db/user.ts:34-49` and `src/lib/db/profile.ts:28-52`.
- `node_modules/@auth/core/lib/actions/session.js:28-56` calls `callbacks.jwt` on every session read, re-signs the token with a new expiry, and clears the cookie when the callback returns `null`.
- `node_modules/next-auth/lib/index.js:182-184`: the proxy wrapper forwards that refreshed `set-cookie`.
- `node_modules/@auth/core/lib/init.js:38` sets a 30-day idle `maxAge`.

## Low

### Forgot-password, resend-verification and sign-in still reveal accounts through timing and the cooldown message
`src/actions/auth.ts:140-141`

**Problem:** Each of these answers more slowly, or differently, when the account exists:
- **Forgot-password:** `requestPasswordReset` waits on the token transaction and the Resend API call only for credentials accounts (lines 140-141).
- **Resend verification:** for real unverified accounts, `resendVerificationEmail` waits on Resend (line 97). It also answers "An email was just sent. Wait a minute…" on a second call within a minute (lines 98-104) and "Could not send the email…" when Resend fails (lines 107-110).
- **Sign-in:** credentials `authorize` returns before bcrypt for unknown and GitHub-only emails (`src/auth.ts:41-43`), so a wrong password on a real credentials account takes about 200 ms longer.

**Attack:** An attacker times `requestPasswordReset` or sign-in across a list of addresses, or calls `resendVerificationEmail` twice per address. The slower or differently worded replies mark the real (or real but unverified) accounts. This is only Low because register already leaks the same fact outright (Medium above). Once that is fixed, these become the leak, so fix them together.

**Fix:**
- In both actions, run the issue-and-send step through `after()`.
- In `resendVerificationEmail`, return the plain success reply for the cooldown and send-failure cases, as `requestPasswordReset` already does.
- In `authorize`, compare against a fixed dummy hash when there is no password.
```ts
// src/actions/auth.ts, requestPasswordReset
if (user?.passwordHash) {
  after(() =>
    issuePasswordResetEmail(parsed.data, user.name).catch((error) =>
      console.error("Sending password reset email failed", error),
    ),
  );
}

// src/auth.ts
if (!user?.passwordHash) {
  await verifyPassword(parsed.data.password, DUMMY_HASH); // a cost-12 hash generated once
  return null;
}
```

**Verified by:**
- Code read: `src/actions/auth.ts:80-148`, `src/auth.ts:40-48`, `src/lib/password-reset.ts:26-38` (the transaction and `sendPasswordResetEmail` are awaited) and `src/lib/email.ts:45-58`.
- Timing: a bcryptjs cost-12 compare took about 206 ms locally.

### A reset link can be used twice if two submissions arrive together
`src/lib/password-reset.ts:57-74`

**Problem:** `resetPasswordWithToken` checks the token with a plain read (`checkToken`, `src/lib/tokens.ts:53-62`) and then spends about 200 ms hashing. After that it runs a batch whose `deleteMany` succeeds even when it deletes nothing. Two concurrent submissions of the same link therefore both pass the check and both commit, and the last password wins.

**Attack:** Only someone who already holds a valid link and submits within about 200 ms of another submission benefits. They could just as well have used the link first, so the practical gain is close to none. The flaw is that the single-use guarantee the code documents is not enforced.

**Fix:** Make spending the token the condition for the write. Hash before the transaction and put a `delete` first in the batch. `delete` throws P2025 when the row is already gone, so a concurrent second submission rolls back.
```ts
const passwordHash = await hashPassword(password);
try {
  await prisma.$transaction([
    prisma.verificationToken.delete({
      where: {
        identifier_token: { identifier, token: hashToken(token) },
        expires: { gt: new Date() },
      },
    }),
    prisma.user.updateMany({ where: { email }, data: { passwordHash } }),
    prisma.user.updateMany({
      where: { email, emailVerified: null },
      data: { emailVerified: new Date() },
    }),
  ]);
} catch (error) {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
    return "invalid";
  }
  throw error;
}
```
Expose this as a `spendToken()` helper in `src/lib/tokens.ts`, so `hashToken` stays private.

**Verified by:**
- Code read: `src/lib/password-reset.ts:51-76` and `src/lib/tokens.ts:53-66`.
- Postgres READ COMMITTED behaviour: the second transaction's `updateMany` waits for the first one's row lock and then proceeds, and its `deleteMany` matches 0 rows without failing.

## Passed Checks

**Password handling**
- ✅ Hashing algorithm and cost: `src/lib/password.ts:5-9` uses bcryptjs 3.0.3 at cost 12 (`$2b$12$`), about 200 ms per compare.
- ✅ Every `passwordHash` write goes through `hashPassword()`: register `route.ts:35`, reset `password-reset.ts:66-68`, change `actions/profile.ts:58`, seed `prisma/seed.ts:372`. A grep finds no other writer.
- ✅ The 72-byte limit applies on every path that sets a password: `passwordSchema` (`auth-schemas.ts:13-16`, a UTF-8 byte count) is used by `registerSchema`, `resetPasswordSchema` and `changePasswordSchema` (lines 37, 46, 56), and `RegisterForm` validates with the same schema.
- ✅ The hash never leaves the server:
  - `authorize` returns only id, email, name and image (`auth.ts:56`).
  - `getProfileUser` reduces it to `hasPassword` (`db/profile.ts:49-51`), and `getSessionUser` never selects it (`db/user.ts:40-43`).
  - Action results carry no user data, and client components receive only `SessionUser`, the email or the token.
  - The JWT is built from name, email, picture and sub only, and there is no custom `jwt` callback (`@auth/core/lib/actions/callback/index.js:72-77, 247-252`).
- ✅ `authorize` returns `null` the same way for bad input, an unknown email, a GitHub-only user and a wrong password (`auth.ts:23-48`). `EmailNotVerified` is thrown only after the password matches (`auth.ts:50-54`).

**Rate limiting and enumeration (reply content)**
- ✅ `requestPasswordReset` returns the same panel for unknown, GitHub-only, cooldown and send-failure cases (`actions/auth.ts:135-147`).
- ✅ Reset and verification tokens can't be brute-forced: they carry 256 bits, and an invalid token is rejected before any bcrypt work (`password-reset.ts:57-60`).
- ✅ Sign-in error copy comes from a fixed map, and `?error=` is never reflected (`auth-redirect.ts:27-44`).

**Email verification**
- ✅ Tokens come from a CSPRNG with 256 bits of entropy: `randomBytes(32)` (`tokens.ts:36`).
- ✅ Only the SHA-256 hash is stored, and lookup is by hash through the `@@unique([identifier, token])` key (`tokens.ts:13-15, 42, 54-56`).
- ✅ Expiry is set to 24 hours and enforced on consumption, and expired tokens are deleted (`verification.ts:7, 49-51`, `tokens.ts:43, 61`).
- ✅ A token is spent in the same transaction that sets `emailVerified`, and issuing a new token deletes the earlier ones (`verification.ts:56-59`, `tokens.ts:37-38`).
- ✅ Verification is bound to the email: the identifier is the address the link was sent to, and the update is scoped by `where: { email }` (`verification.ts:29, 45, 57`).
- ✅ Unverified credentials sign-in is blocked, and the flag counts as on unless it is exactly `false` (`auth.ts:52`, `verification.ts:15-17`).

**Password reset**
- ✅ Reset tokens use the same mechanics with a 1-hour TTL (`password-reset.ts:13, 32`).
- ✅ Reset tokens are kept separate from verification tokens under the `password-reset:<email>` identifier (`password-reset.ts:18-20`). `z.email()` rejects `:` (checked against zod 4.6.7), so no registered address can collide with it, and verification's deletes never touch reset tokens.
- ✅ The token is deleted in the same transaction as the password write, and all reset tokens for the address go with it (`password-reset.ts:67-74`). The concurrency caveat is the second Low finding.
- ✅ The link is checked before the page renders and again on submit (`reset-password/page.tsx:32`, `actions/auth.ts:172`), and the email in the link must match the token's identifier.
- ✅ The reset page sets `Referrer-Policy: no-referrer` through `metadata.referrer` (`reset-password/page.tsx:16-20`), which Next.js renders as `<meta name="referrer">` (per `generate-metadata.md`).
- ✅ Email links are built from `AUTH_URL`, not the request `Host`, so a forged Host header can't poison reset links (`email.ts:19-21`).
- ✅ A reset marks the email verified (`password-reset.ts:69-72`), and deleting an account clears both token namespaces (`actions/profile.ts:114-116`).

**Profile page and account mutations**
- ✅ The profile page loads the user from `auth()` → `session.user.id` and redirects when there is none (`db/profile.ts:28-52`, `profile/page.tsx:26-32`). Stats are scoped to that id (`profile/page.tsx:34`).
- ✅ `changePassword` checks the session itself, loads the user by session id, refuses GitHub-only accounts and verifies the current password (`actions/profile.ts:24-54`).
- ✅ `deleteAccount` is scoped to the session id. One transaction removes:
  - the user's items;
  - both token namespaces;
  - the user, which cascades to `Account`, `Session`, collections, join rows and custom types (`onDelete: Cascade` in the schema);
  - tags left unused.

  It then calls `signOut()` (`actions/profile.ts:91-129`). JWTs on other devices then fail the user-row check.
- ✅ The proxy matcher covers `/dashboard` and `/profile` and every subpath (`proxy.ts:22-24`; `:path*` means zero or more segments per Next.js `proxy.md:128`). The dashboard layout and the profile page re-check the session, and both profile actions call `auth()` themselves, so none of them relies on the proxy alone.

**Other**
- ✅ No open redirect. `safeCallbackUrl()` keeps only same-site paths (`auth-redirect.ts:12-22`), and NextAuth's default `redirect` callback prefixes `baseUrl` to any `/…` value (`@auth/core/lib/init.js:13-19`), so even a tab-smuggled `/\t/evil.example` stays on the origin. The proxy builds `callbackUrl` from the path and search only (`proxy.ts:14-17`).
- ✅ Email HTML escapes the greeting and the URL (`email.ts:23-30, 67-69, 81-83`), and the subjects are constants.
- ✅ No secrets reach client code. `process.env` is read only in server modules (`email.ts`, `verification.ts`, `prisma.ts`), and there is no `NEXT_PUBLIC_*` anywhere in `src`. Client components import only schemas, path constants and Server Actions. `.env.example` holds placeholders only.
- ✅ The registration race is handled: `P2002` maps to 409 (`route.ts:56-60`). Emails are normalised (trimmed and lowercased) the same way for sign-up, sign-in and reset (`auth-schemas.ts:5-9`).

## Recommendations

- **Two-step verification link:** turn email verification into a GET page plus a POST confirm (`src/app/api/auth/verify-email/route.ts:11`). Mail link scanners such as Safe Links then can't verify an account the address owner never created.
- **Re-authenticate before deleting:** ask for the current password, or have the user type their email, before `deleteAccount`. Then a borrowed or stolen session can't delete the account in one click.
- **Move the session check into the data layer:** when `getCurrentUserId()` moves to the session user, put the check inside that function, not only in `dashboard/layout.tsx`. Layouts don't re-render on navigation (`node_modules/next/dist/docs/01-app/02-guides/authentication.md:1348-1354`).
- **Protect the demo account's password:** it is in source (`12345678`, `prisma/seed.ts:22`), and `changePassword` doesn't refuse the demo account the way `deleteAccount` does. Wherever the seed has run, anyone can sign in as demo and change its password. Refuse it there too, and keep the demo user out of production.
- **Future `jwt` callbacks:** if one is ever added, never spread `user` into the token. On GitHub sign-in, `user` is the adapter's full row, including `passwordHash` (`@auth/prisma-adapter` `getUserByAccount` uses `include: { user: true }`).
- **Document the auth env vars:** add `AUTH_SECRET`, `AUTH_GITHUB_ID`, `AUTH_GITHUB_SECRET` and `RESEND_EMAIL_API_KEY` to `.env.example` as empty placeholders.
- **Later:** optional 2FA and a breached-password check at registration.
