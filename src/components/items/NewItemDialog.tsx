"use client";

import { Plus } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useId, useState, useTransition, type TransitionStartFunction } from "react";
import { toast } from "sonner";

import { createItem } from "@/actions/items";
import { FileUpload, type SelectedFile } from "@/components/items/FileUpload";
import {
  EMPTY_ITEM_FORM,
  ItemFormFields,
  toItemInput,
  type ItemFormValues,
} from "@/components/items/ItemFormFields";
import { ItemTypeSelector } from "@/components/items/ItemTypeSelector";
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
import type { FieldErrors } from "@/lib/auth-schemas";
import type { UpdateItemInput } from "@/lib/item-schemas";
import {
  getContentEditorKind,
  getCreatableTypeFromPath,
  getEditableItemFields,
  getItemTypeLabel,
  isFileItemType,
  type CreatableItemType,
  type FileItemType,
} from "@/lib/item-types";
import { postFormWithProgress } from "@/lib/upload-request";
import type { CreateItemResult, UploadItemResponse } from "@/types/items";

const CREATE_FAILED = "Couldn't create this item. Please try again.";

interface NewItemDialogProps {
  /**
   * The type the form starts on, which also names the button ("New Note"), as
   * on a type's list page. Without it the button is the top bar's generic one,
   * which starts on the type of the list page it's shown over, else snippet.
   */
  defaultType?: CreatableItemType;
}

/**
 * A New Item button and the dialog it opens. The form mounts with the dialog's
 * popup, so every open starts blank and closing discards the draft.
 */
export function NewItemDialog({ defaultType }: NewItemDialogProps) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  // Escape and the backdrop can't dismiss the dialog mid-create, so the user
  // always sees how it ended.
  function handleOpenChange(next: boolean) {
    if (!pending) {
      setOpen(next);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      {defaultType ? (
        <DialogTrigger render={<Button size="lg" />}>
          <Plus aria-hidden />
          New {getItemTypeLabel(defaultType)}
        </DialogTrigger>
      ) : (
        // The text hides on phones, so the label carries the name.
        <DialogTrigger render={<Button size="lg" aria-label="New item" />}>
          <Plus aria-hidden />
          <span className="hidden sm:inline">New Item</span>
        </DialogTrigger>
      )}
      <DialogContent className="max-h-[calc(100dvh-2rem)] gap-0 overflow-y-auto p-0 sm:max-w-lg">
        <DialogHeader className="p-6 pb-4">
          <DialogTitle>New item</DialogTitle>
          <DialogDescription>Save a snippet, prompt, command, note, link, file or image.</DialogDescription>
        </DialogHeader>
        <NewItemForm
          defaultType={defaultType ?? getCreatableTypeFromPath(pathname) ?? "snippet"}
          pending={pending}
          startTransition={startTransition}
          onCreated={() => setOpen(false)}
        />
      </DialogContent>
    </Dialog>
  );
}

interface NewItemFormProps {
  defaultType: CreatableItemType;
  pending: boolean;
  /** The dialog's transition, so it knows not to close while the create runs. */
  startTransition: TransitionStartFunction;
  onCreated: () => void;
}

/** The type picker, the file picker for file types, the fields that type uses, and Create / Cancel. */
function NewItemForm({ defaultType, pending, startTransition, onCreated }: NewItemFormProps) {
  const router = useRouter();
  const fileInputId = useId();
  const [typeName, setTypeName] = useState<CreatableItemType>(defaultType);
  const [values, setValues] = useState<ItemFormValues>(EMPTY_ITEM_FORM);
  const [upload, setUpload] = useState<SelectedFile | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const fields = getEditableItemFields(typeName);
  const needsFile = isFileItemType(typeName);

  function handleChange(name: keyof ItemFormValues, value: string) {
    setValues((current) => ({ ...current, [name]: value }));
  }

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
      let result: CreateItemResult;
      if (isFileItemType(typeName)) {
        if (!upload) return;
        setProgress(0);
        result = await uploadFileItem(typeName, toItemInput(values, fields), upload.file, setProgress);
        setProgress(null);
      } else {
        result = await createItem({ ...toItemInput(values, fields), typeName });
      }

      if (result.success) {
        toast.success("Item created");
        onCreated();
        // Re-renders the server components so the lists, stats and counts show it.
        router.refresh();
        return;
      }

      setFieldErrors(result.fieldErrors);
      toast.error(result.error ?? CREATE_FAILED);
    });
  }

  return (
    // noValidate: the server's checks are the source of truth for errors.
    // A file dropped outside the file field is ignored rather than opened by
    // the browser, which would navigate away and lose the draft.
    <form onSubmit={handleSubmit} onDragOver={ignoreFileDrop} onDrop={ignoreFileDrop} noValidate>
      <div className="flex flex-col gap-5 px-6 pb-6">
        <ItemTypeSelector value={typeName} onChange={handleTypeChange} disabled={pending} />
        {needsFile && (
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

/**
 * Sends a file item to the upload route, reporting progress as the file goes
 * up. A dropped connection resolves to an error result rather than throwing.
 */
async function uploadFileItem(
  typeName: FileItemType,
  input: UpdateItemInput,
  file: File,
  onProgress: (fraction: number) => void,
): Promise<UploadItemResponse> {
  const form = new FormData();
  form.set("typeName", typeName);
  form.set("title", input.title);
  form.set("description", input.description ?? "");
  for (const tag of input.tags) {
    form.append("tags", tag);
  }
  form.set("file", file);

  try {
    const { body } = await postFormWithProgress<UploadItemResponse>(
      "/api/items/upload",
      form,
      onProgress,
    );
    return body ?? { success: false, data: null, error: CREATE_FAILED, fieldErrors: {} };
  } catch {
    return {
      success: false,
      data: null,
      error: "Couldn't reach the server. Check your connection and try again.",
      fieldErrors: {},
    };
  }
}
