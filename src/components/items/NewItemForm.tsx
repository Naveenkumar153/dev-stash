"use client";

import { useRouter } from "next/navigation";
import { useId, useState, type TransitionStartFunction } from "react";
import { toast } from "sonner";

import { createItem } from "@/actions/items";
import { useProAccess } from "@/components/billing/ProAccessProvider";
import { UpgradeCallout } from "@/components/billing/UpgradeCallout";
import { FileUpload, type SelectedFile } from "@/components/items/FileUpload";
import {
  EMPTY_ITEM_FORM,
  ItemFormFields,
  toItemInput,
  type ItemFormChange,
  type ItemFormValues,
} from "@/components/items/ItemFormFields";
import { ItemTypeSelector } from "@/components/items/ItemTypeSelector";
import { Button } from "@/components/ui/button";
import { DialogClose, DialogFooter } from "@/components/ui/dialog";
import { useUpgradeErrorToast } from "@/hooks/use-upgrade-error-toast";
import { ITEM_CREATE_FAILED, type FieldErrors } from "@/lib/action-result";
import {
  getContentEditorKind,
  getEditableItemFields,
  getItemTypeLabel,
  isFileItemType,
  type CreatableItemType,
} from "@/lib/item-types";
import { uploadFileItem } from "@/lib/item-upload";
import type { CreateItemResult } from "@/types/items";
import { callAction } from "@/lib/action-call";

interface NewItemFormProps {
  defaultType: CreatableItemType;
  /** The folder a new file goes in; null for the top level. Ignored for other types. */
  folderId: string | null;
  pending: boolean;
  /** The dialog's transition, so it knows not to close while the create runs. */
  startTransition: TransitionStartFunction;
  onCreated: () => void;
}

/** The type picker, the file picker for file types, the fields that type uses, and Create / Cancel. */
export function NewItemForm({
  defaultType,
  folderId,
  pending,
  startTransition,
  onCreated,
}: NewItemFormProps) {
  const router = useRouter();
  const hasProAccess = useProAccess();
  const showError = useUpgradeErrorToast();
  const fileInputId = useId();
  const [typeName, setTypeName] = useState<CreatableItemType>(defaultType);
  const [values, setValues] = useState<ItemFormValues>(EMPTY_ITEM_FORM);
  const [upload, setUpload] = useState<SelectedFile | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const fields = getEditableItemFields(typeName);
  const needsFile = isFileItemType(typeName);
  // File and image items are Pro: without access the upload field becomes an
  // upgrade prompt, and Create stays disabled since there's no file.
  const uploadLocked = needsFile && !hasProAccess;

  const handleChange: ItemFormChange = (name, value) => {
    setValues((current) => ({ ...current, [name]: value }));
  };

  function handleTypeChange(next: CreatableItemType) {
    setTypeName(next);
    // A file picked for one type may break the other's rules.
    setUpload(null);
    // Errors for fields the new type hides would otherwise linger unseen.
    setFieldErrors({});
  }

  function handleFileChange(next: SelectedFile | null) {
    setUpload(next);
    setFieldErrors((current) => ({ ...current, file: undefined }));
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    startTransition(async () => {
      let result: CreateItemResult | null;
      if (isFileItemType(typeName)) {
        if (!upload) return;
        setProgress(0);
        result = await uploadFileItem(
          { typeName, folderId: typeName === "file" ? folderId : null },
          toItemInput(values, fields),
          upload.file,
          setProgress,
        );
        setProgress(null);
      } else {
        result = await callAction(() => createItem({ ...toItemInput(values, fields), typeName }));
      }
      if (!result) {
        return;
      }

      if (result.success) {
        toast.success("Item created");
        onCreated();
        // Re-renders the server components so the lists, stats and counts show it.
        router.refresh();
        return;
      }

      setFieldErrors(result.fieldErrors);
      showError(result.error, ITEM_CREATE_FAILED);
    });
  }

  return (
    // noValidate: the server's checks are the source of truth for errors.
    // A file dropped outside the file field is ignored rather than opened by
    // the browser, which would navigate away and lose the draft.
    <form onSubmit={handleSubmit} onDragOver={ignoreFileDrop} onDrop={ignoreFileDrop} noValidate>
      <div className="flex flex-col gap-5 px-6 pb-6">
        <ItemTypeSelector value={typeName} onChange={handleTypeChange} disabled={pending} />
        {uploadLocked && (
          <UpgradeCallout>
            {getItemTypeLabel(typeName)} uploads are a Pro feature. Upgrade to save files and
            images.
          </UpgradeCallout>
        )}
        {needsFile && !uploadLocked && (
          <FileUpload
            // A fresh field per type, so a rejection under File doesn't linger under Image.
            key={typeName}
            id={fileInputId}
            label={getItemTypeLabel(typeName)}
            typeName={typeName}
            value={upload}
            onChange={handleFileChange}
            progress={progress}
            disabled={pending}
            error={fieldErrors.file}
          />
        )}
        <ItemFormFields
          typeName={typeName}
          values={values}
          errors={fieldErrors}
          fields={fields}
          contentEditor={getContentEditorKind(typeName)}
          onChange={handleChange}
        />
      </div>

      <DialogFooter className="mx-0 mb-0 px-6">
        <DialogClose render={<Button type="button" variant="outline" disabled={pending} />}>
          Cancel
        </DialogClose>
        <Button type="submit" disabled={pending || !values.title.trim() || (needsFile && !upload)}>
          {pending ? (needsFile ? "Uploading..." : "Creating...") : "Create"}
        </Button>
      </DialogFooter>
    </form>
  );
}

/** Cancels the browser's default for a dragged file: opening it in place of the page. */
function ignoreFileDrop(event: React.DragEvent) {
  if (event.dataTransfer.types.includes("Files")) {
    event.preventDefault();
  }
}
