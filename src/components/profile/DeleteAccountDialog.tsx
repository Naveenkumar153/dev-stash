"use client";

import { useTransition } from "react";
import { toast } from "sonner";

import { deleteAccount } from "@/actions/profile";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";

export function DeleteAccountDialog() {
  const [pending, startTransition] = useTransition();

  // A successful delete signs out and redirects, so only failures come back.
  function handleDelete() {
    startTransition(async () => {
      const result = await deleteAccount();
      if (!result.success) {
        toast.error(result.error ?? "Could not delete your account. Please try again.");
      }
    });
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger render={<Button variant="destructive" className="w-fit" />}>
        Delete account
      </AlertDialogTrigger>

      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete your account?</AlertDialogTitle>
          <AlertDialogDescription>
            This permanently deletes your account with all of its items and collections. It
            can&apos;t be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
          <AlertDialogAction variant="destructive" disabled={pending} onClick={handleDelete}>
            {pending ? "Deleting..." : "Delete account"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
