// Unit tests never talk to a real service. Vitest doesn't load `.env`, but a
// shell can still export these, and `.env.production` points at production -
// so they are cleared before any module reads them. A test that forgets to
// mock `@/lib/prisma` then fails with "DATABASE_URL is not set" instead of
// connecting to a database.
const SERVICE_VARS = [
  "DATABASE_URL",
  "UPSTASH_REDIS_REST_URL",
  "UPSTASH_REDIS_REST_TOKEN",
  "RESEND_EMAIL_API_KEY",
  "AUTH_SECRET",
  "AUTH_GITHUB_ID",
  "AUTH_GITHUB_SECRET",
  "R2_ACCOUNT_ID",
  "R2_ACCESS_KEY_ID",
  "R2_SECRET_ACCESS_KEY",
  "R2_BUCKET_NAME",
];

// App settings, cleared so a value exported in the shell can't change a
// result. Tests that need one set it with `vi.stubEnv()`.
const SETTING_VARS = ["AUTH_URL", "EMAIL_FROM", "EMAIL_VERIFICATION_ENABLED"];

for (const name of [...SERVICE_VARS, ...SETTING_VARS]) {
  delete process.env[name];
}
