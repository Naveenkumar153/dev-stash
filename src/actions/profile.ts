"use server";

import { auth, signOut } from "@/auth";
import { SIGN_IN_PATH } from "@/lib/auth-redirect";
import { changePasswordSchema, getFieldErrors, type FieldErrors } from "@/lib/auth-schemas";
import { getUserFileKeys } from "@/lib/db/items";
import { DEMO_USER_EMAIL } from "@/lib/db/user";
import { hashPassword, verifyPassword } from "@/lib/password";
import { resetIdentifier } from "@/lib/password-reset";
import { prisma } from "@/lib/prisma";
import { discardStoredFiles } from "@/lib/stored-files";

export interface ChangePasswordResult {
  success: boolean;
  data: null;
  error: string | null;
  fieldErrors: FieldErrors;
}

/**
 * Changes the signed-in user's password after checking the current one.
 * GitHub-only accounts have no password, so they are turned away here as well
 * as by the page hiding the form.
 */
export async function changePassword(formData: FormData): Promise<ChangePasswordResult> {
  const session = await auth();
  if (!session?.user?.id) {
    return { success: false, data: null, error: "You are not signed in.", fieldErrors: {} };
  }

  const parsed = changePasswordSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { success: false, data: null, error: null, fieldErrors: getFieldErrors(parsed.error) };
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { passwordHash: true },
    });
    if (!user?.passwordHash) {
      return {
        success: false,
        data: null,
        error: "This account signs in with GitHub and has no password to change.",
        fieldErrors: {},
      };
    }
    if (!(await verifyPassword(parsed.data.currentPassword, user.passwordHash))) {
      return {
        success: false,
        data: null,
        error: null,
        fieldErrors: { currentPassword: "Current password is incorrect" },
      };
    }

    await prisma.user.update({
      where: { id: session.user.id },
      data: { passwordHash: await hashPassword(parsed.data.password) },
    });
    return { success: true, data: null, error: null, fieldErrors: {} };
  } catch (error) {
    console.error("Changing password failed", error);
    return {
      success: false,
      data: null,
      error: "Could not change your password. Please try again.",
      fieldErrors: {},
    };
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
 * Deletes the signed-in user and everything they own, then signs them out.
 * On success this redirects and never returns.
 */
export async function deleteAccount(): Promise<DeleteAccountResult> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return { success: false, data: null, error: "You are not signed in." };
  }

  try {
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true } });
    if (!user) {
      return { success: false, data: null, error: "Account not found." };
    }
    // Every dashboard still reads the demo account's data via getCurrentUserId().
    if (user.email === DEMO_USER_EMAIL) {
      return { success: false, data: null, error: "The demo account can't be deleted." };
    }

    const [tagIds, fileKeys] = await Promise.all([getUserTagIds(userId), getUserFileKeys(userId)]);
    // One transaction, so a failure leaves the account as it was. Items go
    // first because `Item.itemType` has no cascade, so a custom type can't be
    // deleted while its items exist.
    await prisma.$transaction([
      prisma.item.deleteMany({ where: { userId } }),
      prisma.verificationToken.deleteMany({
        where: { identifier: { in: [user.email, resetIdentifier(user.email)] } },
      }),
      // Cascades to collections, their join rows, custom types, accounts and sessions.
      prisma.user.delete({ where: { id: userId } }),
      // Tags are global, so only this user's that nothing else uses now go.
      prisma.tag.deleteMany({ where: { id: { in: tagIds }, items: { none: {} } } }),
    ]);

    // R2 isn't part of the transaction, so its files go once the rows are gone.
    await discardStoredFiles(fileKeys);
  } catch (error) {
    console.error("Deleting account failed", error);
    return { success: false, data: null, error: "Could not delete your account. Please try again." };
  }

  // Throws the redirect, so it stays outside the try.
  await signOut({ redirectTo: `${SIGN_IN_PATH}?deleted=1` });
  return { success: true, data: null, error: null };
}
