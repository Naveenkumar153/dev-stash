"use client";

import { useId, useState, type TransitionStartFunction } from "react";

import { FormField } from "@/components/auth/FormField";
import { DialogActions } from "@/components/dialogs/DialogActions";
import { Field } from "@/components/forms/Field";
import { Textarea } from "@/components/ui/textarea";
import { useUpgradeErrorToast } from "@/hooks/use-upgrade-error-toast";
import type { FieldErrors } from "@/lib/action-result";
import type { CollectionFormInput } from "@/lib/collection-schemas";
import {
  COLLECTION_DESCRIPTION_MAX_LENGTH,
  COLLECTION_NAME_MAX_LENGTH,
} from "@/lib/collections";
import { callAction } from "@/lib/action-call";

/** What a collection form's submit returns: the shape both actions share. */
interface CollectionFormResult {
  success: boolean;
  error: string | null;
  fieldErrors: FieldErrors;
}

interface CollectionFormProps {
  /** The values the fields start from: blank for New, the collection's for Edit. */
  initialValues?: { name: string; description: string | null };
  submitLabel: string;
  pendingLabel: string;
  /** Shown when the action fails without its own message. */
  fallbackError: string;
  pending: boolean;
  /** The dialog's transition, so it knows not to close while the save runs. */
  startTransition: TransitionStartFunction;
  onSubmit: (values: CollectionFormInput) => Promise<CollectionFormResult>;
  /** Runs after a successful save, e.g. to toast, close and refresh. */
  onSaved: () => void;
}

/**
 * A collection's Name and Description with Cancel and a submit button, for
 * `CollectionFormDialog`. It mounts with the
 * dialog's popup, so every open starts from `initialValues`. A failure keeps
 * the input, marks the fields and toasts the error.
 */
export function CollectionForm({
  initialValues,
  submitLabel,
  pendingLabel,
  fallbackError,
  pending,
  startTransition,
  onSubmit,
  onSaved,
}: Readonly<CollectionFormProps>) {
  const id = useId();
  const [name, setName] = useState(initialValues?.name ?? "");
  const [description, setDescription] = useState(initialValues?.description ?? "");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

  const showError = useUpgradeErrorToast();

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    startTransition(async () => {
      const result = await callAction(() => onSubmit({ name, description }));
      if (!result) {
        return;
      }

      if (result.success) {
        onSaved();
        return;
      }

      setFieldErrors(result.fieldErrors);
      showError(result.error, fallbackError);
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

        <Field id={`${id}-description`} label="Description" error={fieldErrors.description}>
          {(control) => (
            <Textarea
              {...control}
              name="description"
              value={description}
              onChange={(event) => {
                setDescription(event.target.value);
                setFieldErrors((current) => ({ ...current, description: undefined }));
              }}
              placeholder="What goes in this collection?"
              maxLength={COLLECTION_DESCRIPTION_MAX_LENGTH}
              readOnly={pending}
              className="min-h-20"
            />
          )}
        </Field>
      </div>

      <DialogActions
        pending={pending}
        submitLabel={submitLabel}
        pendingLabel={pendingLabel}
        submitDisabled={!name.trim()}
      />
    </form>
  );
}
