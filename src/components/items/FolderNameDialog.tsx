"use client";

import { useId, useState, useTransition, type TransitionStartFunction } from "react";
import { toast } from "sonner";

import { FormField } from "@/components/auth/FormField";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FOLDER_NAME_MAX_LENGTH } from "@/lib/folders";
import type { FolderResult } from "@/types/folders";
import { callAction } from "@/lib/action-call";

interface FolderNameDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  /** The submit button: "Create" or "Rename". */
  submitLabel: string;
  /** The submit button while the action runs: "Creating..." or "Renaming...". */
  pendingLabel: string;
  successMessage: string;
  /** The name the field starts with; blank for a new folder. */
  initialName?: string;
  /** Runs the server action with the typed name. */
  onSubmit: (name: string) => Promise<FolderResult>;
}

/**
 * A small dialog asking for a folder name, for New Folder and Rename. The form
 * mounts with the popup, so every open starts from `initialName`. A name clash
 * shows on the field; any other failure is toasted. Escape and the backdrop
 * can't close it while the action runs, so the user always sees how it ended.
 */
export function FolderNameDialog({ open, onOpenChange, ...formProps }: FolderNameDialogProps) {
  const [pending, startTransition] = useTransition();

  function handleOpenChange(next: boolean) {
    if (!pending) {
      onOpenChange(next);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="gap-0 p-0">
        <DialogHeader className="p-6 pb-4">
          <DialogTitle>{formProps.title}</DialogTitle>
          <DialogDescription className="wrap-break-word">{formProps.description}</DialogDescription>
        </DialogHeader>
        <FolderNameForm
          {...formProps}
          pending={pending}
          startTransition={startTransition}
          onDone={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  );
}

interface FolderNameFormProps extends Omit<FolderNameDialogProps, "open" | "onOpenChange" | "title" | "description"> {
  pending: boolean;
  startTransition: TransitionStartFunction;
  onDone: () => void;
}

function FolderNameForm({
  submitLabel,
  pendingLabel,
  successMessage,
  initialName = "",
  onSubmit,
  pending,
  startTransition,
  onDone,
}: FolderNameFormProps) {
  const id = useId();
  const [name, setName] = useState(initialName);
  const [error, setError] = useState<string>();
  const unchanged = name.trim() === initialName;

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    startTransition(async () => {
      const result = await callAction(() => onSubmit(name));
      if (!result) {
        return;
      }

      if (result.success) {
        toast.success(successMessage);
        // The folder actions re-render the list in their own response.
        onDone();
        return;
      }

      setError(result.fieldErrors.name);
      if (!result.fieldErrors.name) {
        toast.error(result.error ?? "Something went wrong. Please try again.");
      }
    });
  }

  return (
    // noValidate: the server's checks are the source of truth for errors.
    <form onSubmit={handleSubmit} noValidate>
      <div className="px-6 pb-6">
        <FormField
          id={`${id}-name`}
          label="Name"
          value={name}
          onChange={(event) => {
            setName(event.target.value);
            setError(undefined);
          }}
          // Selected on open, so a rename can be typed straight over.
          onFocus={(event) => event.currentTarget.select()}
          maxLength={FOLDER_NAME_MAX_LENGTH}
          autoComplete="off"
          error={error}
          // Read-only rather than disabled, so focus stays put for a retry.
          readOnly={pending}
          autoFocus
        />
      </div>

      <DialogFooter className="mx-0 mb-0 px-6">
        <DialogClose render={<Button type="button" variant="outline" disabled={pending} />}>
          Cancel
        </DialogClose>
        <Button type="submit" disabled={pending || !name.trim() || unchanged}>
          {pending ? pendingLabel : submitLabel}
        </Button>
      </DialogFooter>
    </form>
  );
}
