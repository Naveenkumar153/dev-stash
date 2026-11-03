import { Resend } from "resend";

// Until a domain is verified in Resend, only this sender works, and it only
// delivers to the Resend account owner's own address.
const DEFAULT_FROM = "DevStash <onboarding@resend.dev>";

let resend: Resend | undefined;

function getResend(): Resend {
  const apiKey = process.env.RESEND_EMAIL_API_KEY;
  if (!apiKey) {
    throw new Error("RESEND_EMAIL_API_KEY is not set");
  }
  resend ??= new Resend(apiKey);
  return resend;
}

/** Absolute origin for links in emails, e.g. `https://devstash.io`. */
export function getAppUrl(): string {
  return (process.env.AUTH_URL ?? "http://localhost:3000").replace(/\/+$/, "");
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

interface LinkEmail {
  to: string;
  name: string | null;
  url: string;
}

interface EmailContent {
  to: string;
  subject: string;
  text: string;
  html: string;
}

async function sendEmail({ to, subject, text, html }: EmailContent) {
  const { error } = await getResend().emails.send({
    from: process.env.EMAIL_FROM ?? DEFAULT_FROM,
    to,
    subject,
    text,
    html,
  });

  // The SDK reports failures in its result rather than throwing.
  if (error) {
    throw new Error(`Resend failed to send "${subject}": ${error.message}`);
  }
}

export async function sendVerificationEmail({ to, name, url }: LinkEmail) {
  const greeting = name ? `Hi ${name},` : "Hi,";

  await sendEmail({
    to,
    subject: "Verify your DevStash email",
    text: `${greeting}\n\nConfirm your email address to finish setting up DevStash:\n\n${url}\n\nThis link expires in 24 hours. If you didn't create an account, you can ignore this email.`,
    html: `<p>${escapeHtml(greeting)}</p>
<p>Confirm your email address to finish setting up DevStash.</p>
<p><a href="${escapeHtml(url)}">Verify email</a></p>
<p>This link expires in 24 hours. If you didn't create an account, you can ignore this email.</p>`,
  });
}

export async function sendPasswordResetEmail({ to, name, url }: LinkEmail) {
  const greeting = name ? `Hi ${name},` : "Hi,";

  await sendEmail({
    to,
    subject: "Reset your DevStash password",
    text: `${greeting}\n\nSomeone asked to reset the password for your DevStash account. Choose a new one here:\n\n${url}\n\nThis link expires in 1 hour. If you didn't ask for this, you can ignore this email and your password stays the same.`,
    html: `<p>${escapeHtml(greeting)}</p>
<p>Someone asked to reset the password for your DevStash account.</p>
<p><a href="${escapeHtml(url)}">Choose a new password</a></p>
<p>This link expires in 1 hour. If you didn't ask for this, you can ignore this email and your password stays the same.</p>`,
  });
}
