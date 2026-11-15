"use client";

import { FolderPlus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useId, useState, useTransition, type TransitionStartFunction } from "react";
import { toast } from "sonner";

import { createCollection } from "@/actions/collections";
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
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { COLLECTION_CREATE_FAILED, type FieldErrors } from "@/lib/action-result";
import {
  COLLECTION_DESCRIPTION_MAX_LENGTH,
  COLLECTION_NAME_MAX_LENGTH,
} from "@/lib/collections";

/**
 * The top bar's New Collection button and the dialog it opens. The form mounts
 * with the dialog's popup, so every open starts blank and closing discards the
 * draft. Escape and the backdrop can't dismiss it mid-create, so the user
 * always sees how it ended.
 */
export function NewCollectionDialog() {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  function handleOpenChange(next: boolean) {
    if (!pending) {
      setOpen(next);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      {/* The text hides on phones, so the label carries the name. */}
      <DialogTrigger render={<Button variant="outline" size="lg" aria-label="New collection" />}>
        <FolderPlus aria-hidden />
        <span className="hidden sm:inline">New Collection</span>
      </DialogTrigger>
      <DialogContent className="max-h-[calc(100dvh-2rem)] gap-0 overflow-y-auto p-0">
        <DialogHeader className="p-6 pb-4">
          <DialogTitle>New collection</DialogTitle>
          <DialogDescription>Group related items of any type in one place.</DialogDescription>
        </DialogHeader>
        <NewCollectionForm
          pending={pending}
          startTransition={startTransition}
          onCreated={() => setOpen(false)}
        />
      </DialogContent>
    </Dialog>
  );
}

interface NewCollectionFormProps {
  pending: boolean;
  /** The dialog's transition, so it knows not to close while the create runs. */
  startTransition: TransitionStartFunction;
  onCreated: () => void;
}

/** Name and description, with Create / Cancel. */
function NewCollectionForm({ pending, startTransition, onCreated }: NewCollectionFormProps) {
  const router = useRouter();
  const id = useId();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const descriptionId = `${id}-description`;
  const descriptionErrorId = `${descriptionId}-error`;

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    startTransition(async () => {
      const result = await createCollection({ name, description });

      if (result.success) {
        toast.success("Collection created");
        onCreated();
        // Re-renders the server components so the cards, stats and sidebar show it.
        router.refresh();
        return;
      }

      setFieldErrors(result.fieldErrors);
      toast.error(result.error ?? COLLECTION_CREATE_FAILED);
    });
  }

  return (
    // noValidate: the server's checks are the source of truth for errors.
    <form onSubmit={handleSubmit} noValidate>
      <div className="flex flex-col gap-5 px-6 pb-6">
        <FormField
          id={`${id}-name`}
          label="Name"
          value={name}
          onChange={(event) => {
            setName(event.target.value);
            setFieldErrors((current) => ({ ...current, name: undefined }));
          }}
          placeholder="React Patterns"
          maxLength={COLLECTION_NAME_MAX_LENGTH}
          autoComplete="off"
          error={fieldErrors.name}
          // Read-only rather than disabled, so focus stays put for a retry.
          readOnly={pending}
          required
          autoFocus
        />

        <div className="grid gap-2">
          <Label htmlFor={descriptionId}>Description</Label>
          <Textarea
            id={descriptionId}
            name="description"
            value={description}
            onChange={(event) => {
              setDescription(event.target.value);
              setFieldErrors((current) => ({ ...current, description: undefined }));
            }}
            placeholder="What goes in this collection?"
            maxLength={COLLECTION_DESCRIPTION_MAX_LENGTH}
            aria-invalid={fieldErrors.description ? true : undefined}
            aria-describedby={fieldErrors.description ? descriptionErrorId : undefined}
            readOnly={pending}
            className="min-h-20"
          />
          {fieldErrors.description && (
            <p id={descriptionErrorId} className="text-sm text-destructive">
              {fieldErrors.description}
            </p>
          )}
        </div>
      </div>

      <DialogFooter className="mx-0 mb-0 px-6">
        <DialogClose render={<Button type="button" variant="outline" disabled={pending} />}>
          Cancel
        </DialogClose>
        <Button type="submit" disabled={pending || !name.trim()}>
          {pending ? "Creating..." : "Create"}
        </Button>
      </DialogFooter>
    </form>
  );
}
