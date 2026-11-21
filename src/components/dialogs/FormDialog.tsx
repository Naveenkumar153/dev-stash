"use client";

import type { TransitionStartFunction } from "react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { usePendingDialog } from "@/hooks/use-pending-dialog";
import { cn } from "@/lib/utils";

/** What a form inside `FormDialog` gets to run its action and close. */
export interface FormDialogContext {
  pending: boolean;
  startTransition: TransitionStartFunction;
  close: () => void;
}

interface FormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: React.ReactNode;
  description: React.ReactNode;
  /** Where focus goes on close, for a dialog opened by something other than its trigger. */
  finalFocus?: React.RefObject<HTMLElement | null>;
  /** Extra classes for the popup, e.g. a wider `sm:max-w-lg`. */
  className?: string;
  /**
   * The form, rendered inside the popup so it mounts with each open: every
   * open starts from its initial values and closing discards a draft.
   */
  children: (context: FormDialogContext) => React.ReactNode;
}

/**
 * A dialog holding one form: the header, then the form, scrolling inside the
 * popup on short screens. Escape, the backdrop and the X can't close it while
 * the form's action runs.
 */
export function FormDialog({
  open,
  onOpenChange,
  title,
  description,
  finalFocus,
  className,
  children,
}: Readonly<FormDialogProps>) {
  const { pending, startTransition, handleOpenChange } = usePendingDialog(onOpenChange);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        finalFocus={finalFocus}
        className={cn("max-h-[calc(100dvh-2rem)] gap-0 overflow-y-auto p-0", className)}
      >
        <DialogHeader className="p-6 pb-4">
          <DialogTitle className="wrap-anywhere">{title}</DialogTitle>
          <DialogDescription className="wrap-anywhere">{description}</DialogDescription>
        </DialogHeader>
        {children({ pending, startTransition, close: () => onOpenChange(false) })}
      </DialogContent>
    </Dialog>
  );
}
