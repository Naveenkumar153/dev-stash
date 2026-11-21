"use client";

import { Button } from "@/components/ui/button";
import { DialogClose, DialogFooter } from "@/components/ui/dialog";

interface DialogActionsProps {
  pending: boolean;
  submitLabel: string;
  /** The submit button's label while the action runs, e.g. "Saving...". */
  pendingLabel: string;
  /** Disables submit for an incomplete form; it's always disabled while pending. */
  submitDisabled?: boolean;
  /** For a dialog without a form: the submit button becomes a plain button calling this. */
  onSubmit?: () => void;
}

/** A form dialog's footer: Cancel and the submit button, both disabled while the action runs. */
export function DialogActions({
  pending,
  submitLabel,
  pendingLabel,
  submitDisabled = false,
  onSubmit,
}: Readonly<DialogActionsProps>) {
  return (
    <DialogFooter className="mx-0 mb-0 px-6">
      <DialogClose render={<Button type="button" variant="outline" disabled={pending} />}>
        Cancel
      </DialogClose>
      <Button
        type={onSubmit ? "button" : "submit"}
        disabled={pending || submitDisabled}
        onClick={onSubmit}
      >
        {pending ? pendingLabel : submitLabel}
      </Button>
    </DialogFooter>
  );
}
