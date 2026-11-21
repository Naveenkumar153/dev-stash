"use client";

import { toast } from "sonner";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { usePendingDialog } from "@/hooks/use-pending-dialog";
import { callAction } from "@/lib/action-call";

interface ConfirmDeleteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: React.ReactNode;
  description: React.ReactNode;
  /** The destructive button's label. */
  confirmLabel?: string;
  /** Runs the delete, a server action returning `{ success, error }`. */
  onConfirm: () => Promise<{ success: boolean; error: string | null }>;
  /** Toasted when the delete fails without its own message. */
  failedMessage: string;
  /** Toasted after a successful delete; omit when success navigates away. */
  successMessage?: string;
  /** Runs after a successful delete, once the dialog has closed. */
  onDeleted?: () => void;
  /** Where focus goes on close, for a dialog opened by something other than its trigger. */
  finalFocus?: React.RefObject<HTMLElement | null>;
  /** An `AlertDialogTrigger`, for a dialog that brings its own button. */
  trigger?: React.ReactNode;
}

/**
 * Confirms a permanent delete. Nothing is deleted until the user confirms; a
 * failure is toasted and leaves the dialog open so they can retry or cancel,
 * and it can't be dismissed while the delete runs.
 */
export function ConfirmDeleteDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "Delete",
  onConfirm,
  failedMessage,
  successMessage,
  onDeleted,
  finalFocus,
  trigger,
}: Readonly<ConfirmDeleteDialogProps>) {
  const { pending, startTransition, handleOpenChange } = usePendingDialog(onOpenChange);

  function handleDelete() {
    startTransition(async () => {
      const result = await callAction(onConfirm);
      if (!result) {
        return;
      }

      if (!result.success) {
        toast.error(result.error ?? failedMessage);
        return;
      }

      onOpenChange(false);
      if (successMessage) {
        toast.success(successMessage);
      }
      onDeleted?.();
    });
  }

  return (
    <AlertDialog open={open} onOpenChange={handleOpenChange}>
      {trigger}

      <AlertDialogContent finalFocus={finalFocus}>
        <AlertDialogHeader>
          <AlertDialogTitle className="wrap-anywhere">{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
          <AlertDialogAction variant="destructive" disabled={pending} onClick={handleDelete}>
            {pending ? "Deleting..." : confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
