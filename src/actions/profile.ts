"use server";

import { signIn, signOut } from "@/auth";
import {
  ACCOUNT_DELETE_FAILED,
  SESSION_EXPIRED,
  actionFailure,
  formFailure,
  getFieldErrors,
  type FieldErrors,
} from "@/lib/action-result";
import { SIGN_IN_PATH } from "@/lib/auth-redirect";
import { changePasswordSchema } from "@/lib/auth-schemas";
import {
  cancelCustomerSubscriptions,
  cancelSubscription,
  clearSubscription,
} from "@/lib/db/billing";
import { isDemoEmail } from "@/lib/demo-account";
import { hashPassword, verifyPassword } from "@/lib/password";
import { resetIdentifier } from "@/lib/password-reset";
import { prisma } from "@/lib/prisma";
import { getRateLimitError } from "@/lib/rate-limit";
import { getSessionUserId } from "@/lib/session";
import { discardUserFiles } from "@/lib/stored-files";

export interface ChangePasswordResult {
  success: boolean;
  data: null;
  error: string | null;
  fieldErrors: FieldErrors;
}

/**
 * Signs this browser back in with the new password, so the version bump that
 * ends every other session doesn't end this one too: the fresh token carries
 * the new version. If it fails the change still stands, and this browser is
 * simply asked to sign in again.
 */
async function keepThisSession(email: string, password: string): Promise<void> {
  try {
    await signIn("credentials", { email, password, redirect: false });
  } catch (error) {
    console.error("Re-issuing the session after a password change failed", error);
  }
}

/**
 * Changes the signed-in user's password after checking the current one.
 * GitHub-only accounts have no password, so they are turned away here as well
 * as by the page hiding the form.
 */
export async function changePassword(formData: FormData): Promise<ChangePasswordResult> {
  const userId = await getSessionUserId();
  if (!userId) {
    return formFailure(SESSION_EXPIRED);
  }

  const parsed = changePasswordSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { success: false, data: null, error: null, fieldErrors: getFieldErrors(parsed.error) };
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, passwordHash: true },
    });
    // Its password is published so anyone can try the app; one visitor
    // changing it would lock everyone else out.
    if (user && isDemoEmail(user.email)) {
      return formFailure("The demo account's password can't be changed.");
    }
    if (!user?.passwordHash) {
      return formFailure("This account signs in with GitHub and has no password to change.");
    }
    // Before bcrypt, so a stolen session can't brute-force the current password.
    const rateLimitError = await getRateLimitError("changePassword", userId);
    if (rateLimitError) {
      return formFailure(rateLimitError);
    }
    if (!(await verifyPassword(parsed.data.currentPassword, user.passwordHash))) {
      return {
        success: false,
        data: null,
        error: null,
        fieldErrors: { currentPassword: "Current password is incorrect" },
      };
    }

    // Bumping the version ends every session signed in with the old password,
    // including one an attacker may hold.
    await prisma.user.update({
      where: { id: userId },
      data: {
        passwordHash: await hashPassword(parsed.data.password),
        sessionVersion: { increment: 1 },
      },
    });
    await keepThisSession(user.email, parsed.data.password);
    return { success: true, data: null, error: null, fieldErrors: {} };
  } catch (error) {
    console.error("Changing password failed", error);
    return formFailure("Couldn't change your password. Please try again.");
  }
}

export interface DeleteAccountResult {
  success: boolean;
  data: null;
  error: string | null;
}

/** Ids of the tags on `userId`'s items, to clear any the deletion leaves unused. */
async function getUserTagIds(userId: string): Promise<string[]> {
  const tags = await prisma.tag.findMany({
    where: { items: { some: { userId } } },
    select: { id: true },
  });
  return tags.map((tag) => tag.id);
}

/**
 * Deletes the user's rows in one transaction, so a failure leaves the account
 * as it was. Items go first because `Item.itemType` has no cascade, so a
 * custom type can't be deleted while its items exist.
 */
async function deleteUserRows(userId: string, email: string): Promise<void> {
  const tagIds = await getUserTagIds(userId);
  await prisma.$transaction([
    prisma.item.deleteMany({ where: { userId } }),
    prisma.verificationToken.deleteMany({
      where: { identifier: { in: [email, resetIdentifier(email)] } },
    }),
    // Cascades to collections, their join rows, custom types, accounts and sessions.
    prisma.user.delete({ where: { id: userId } }),
    // Tags are global, so only this user's that nothing else uses now go.
    prisma.tag.deleteMany({ where: { id: { in: tagIds }, items: { none: {} } } }),
  ]);
}

const SUBSCRIPTION_CANCEL_FAILED = "Couldn't cancel your subscription. Please try again.";
const DELETE_FAILED_AFTER_CANCEL =
  "Your subscription was canceled, but your account couldn't be deleted. Please try again.";

interface BillingRefs {
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
}

/**
 * Cancels every live subscription the account has at Stripe (not only the
 * stored one, which is whichever was applied last). Returns how many were
 * canceled, or null (logged) when Stripe refused.
 */
async function tryCancelSubscriptions(refs: BillingRefs): Promise<number | null> {
  try {
    if (refs.stripeCustomerId) {
      return await cancelCustomerSubscriptions(refs.stripeCustomerId);
    }
    if (refs.stripeSubscriptionId) {
      await cancelSubscription(refs.stripeSubscriptionId);
      return 1;
    }
    return 0;
  } catch (error) {
    console.error("Canceling subscriptions before account delete failed", error);
    return null;
  }
}

/**
 * Deletes the signed-in user and everything they own, then signs them out.
 * On success this redirects and never returns.
 */
export async function deleteAccount(): Promise<DeleteAccountResult> {
  const userId = await getSessionUserId();
  if (!userId) {
    return actionFailure(SESSION_EXPIRED);
  }

  let canceled = 0;
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, stripeCustomerId: true, stripeSubscriptionId: true },
    });
    if (!user) {
      return actionFailure("Account not found.");
    }
    // The seeded demo account is shared for trying the app, so it stays.
    if (isDemoEmail(user.email)) {
      return actionFailure("The demo account can't be deleted.");
    }

    // Stripe would keep billing a deleted account, so the subscriptions are
    // canceled first and nothing is deleted if that fails. The customer stays
    // for invoices and refunds; its later subscription.deleted webhooks find
    // no user and change nothing.
    const result = await tryCancelSubscriptions(user);
    if (result === null) {
      return actionFailure(SUBSCRIPTION_CANCEL_FAILED);
    }
    canceled = result;

    await deleteUserRows(userId, user.email);
  } catch (error) {
    console.error("Deleting account failed", error);
    if (canceled === 0) {
      return actionFailure(ACCOUNT_DELETE_FAILED);
    }
    // The account stays but its subscription is gone: end Pro now rather
    // than when the webhook lands, and say why.
    try {
      await clearSubscription(userId);
    } catch (clearError) {
      console.error("Recording the canceled subscription failed", clearError);
    }
    return actionFailure(DELETE_FAILED_AFTER_CANCEL);
  }

  // R2 isn't part of the transaction, so its files go once the rows are gone.
  // Listing them by the user's key prefix only now also catches an upload
  // whose row committed while this was running. The account is already
  // deleted, so a failure here is logged rather than reported as one.
  try {
    await discardUserFiles(userId);
  } catch (error) {
    console.error("Removing a deleted account's stored files failed", error);
  }

  // Throws the redirect, so it stays outside the try.
  await signOut({ redirectTo: `${SIGN_IN_PATH}?deleted=1` });
  return { success: true, data: null, error: null };
}
