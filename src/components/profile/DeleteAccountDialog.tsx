"use client";

import { useState } from "react";

import { deleteAccount } from "@/actions/profile";
import { ConfirmDeleteDialog } from "@/components/dialogs/ConfirmDeleteDialog";
import { AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { ACCOUNT_DELETE_FAILED } from "@/lib/action-result";

interface DeleteAccountDialogProps {
  /** A Pro subscriber's subscription is canceled with the account. */
  isPro: boolean;
}

/**
 * Confirms deleting the signed-in account. A successful delete signs out and
 * redirects, so only failures come back to the dialog.
 */
export function DeleteAccountDialog({ isPro }: Readonly<DeleteAccountDialogProps>) {
  const [open, setOpen] = useState(false);

  return (
    <ConfirmDeleteDialog
      open={open}
      onOpenChange={setOpen}
      trigger={
        <AlertDialogTrigger render={<Button variant="destructive" className="w-fit" />}>
          Delete account
        </AlertDialogTrigger>
      }
      title="Delete your account?"
      description={`This permanently deletes your account with all of its items and collections. It can't be undone.${
        isPro ? " This also cancels your Pro subscription immediately." : ""
      }`}
      confirmLabel="Delete account"
      onConfirm={deleteAccount}
      failedMessage={ACCOUNT_DELETE_FAILED}
    />
  );
}
