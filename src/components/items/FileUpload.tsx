"use client";

import { File as FileIcon, Upload, X } from "lucide-react";
import Image from "next/image";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { UPLOAD_CONSTRAINTS, getUploadAccept, validateUpload } from "@/lib/file-upload";
import { formatFileSize } from "@/lib/format";
import type { FileItemType } from "@/lib/item-types";
import { cn } from "@/lib/utils";

/** A file the user picked, with an object URL for previewing it when it's an image. */
export interface SelectedFile {
  file: File;
  previewUrl: string | null;
}

interface FileUploadProps {
  id: string;
  /** The field's label, e.g. "Image". */
  label: string;
  typeName: FileItemType;
  value: SelectedFile | null;
  onChange: (value: SelectedFile | null) => void;
  /** How much has been sent, 0 to 1, while uploading; null otherwise. */
  progress: number | null;
  disabled?: boolean;
  /** An error from the server about the file. */
  error?: string;
}

/** Whether a drag carries files, rather than text or a link from the page. */
function isFileDrag(event: React.DragEvent) {
  return event.dataTransfer.types.includes("Files");
}

/**
 * Picks one file for a file or image item, by drag-and-drop or the file
 * browser. The file is checked against its type's rules as soon as it's
 * picked; the upload itself happens when the form is submitted, with its
 * progress shown here. A file dropped anywhere on the field is taken - on the
 * picked file's card it replaces it - so the browser never opens it instead.
 */
export function FileUpload({
  id,
  label,
  typeName,
  value,
  onChange,
  progress,
  disabled,
  error,
}: FileUploadProps) {
  const [rejection, setRejection] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const previewUrl = value?.previewUrl;
  const labelId = `${id}-label`;
  const errorId = `${id}-error`;

  // Frees the preview's memory once it's replaced, removed or unmounted.
  useEffect(() => {
    if (!previewUrl) return;
    return () => URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

  function select(file: File | undefined) {
    if (!file) return;

    const check = validateUpload(typeName, file);
    if (!check.success) {
      setRejection(check.error);
      return;
    }

    setRejection(null);
    onChange({ file, previewUrl: typeName === "image" ? URL.createObjectURL(file) : null });
  }

  function handleDragOver(event: React.DragEvent) {
    if (!isFileDrag(event)) return;
    event.preventDefault();
    if (!disabled) setDragging(true);
  }

  function handleDragLeave(event: React.DragEvent) {
    // Moving onto a child element also fires dragleave on the field itself.
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
      setDragging(false);
    }
  }

  function handleDrop(event: React.DragEvent) {
    if (!isFileDrag(event)) return;
    event.preventDefault();
    setDragging(false);
    if (!disabled) select(event.dataTransfer.files[0]);
  }

  const message = rejection ?? error;

  return (
    <div
      className="grid gap-2"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Points at the file input while it's shown; afterwards it names the picked file's card. */}
      <Label id={labelId} htmlFor={value ? undefined : id}>
        {label}
      </Label>
      {value ? (
        <SelectedFileCard
          labelledBy={labelId}
          value={value}
          progress={progress}
          dragging={dragging}
          disabled={disabled}
          onRemove={() => onChange(null)}
        />
      ) : (
        <DropZone
          id={id}
          typeName={typeName}
          dragging={dragging}
          disabled={disabled}
          invalid={Boolean(message)}
          describedBy={message ? errorId : undefined}
          onSelect={select}
        />
      )}
      {message && (
        <p id={errorId} role="alert" className="text-sm text-destructive">
          {message}
        </p>
      )}
    </div>
  );
}

interface DropZoneProps {
  id: string;
  typeName: FileItemType;
  dragging: boolean;
  disabled?: boolean;
  invalid: boolean;
  describedBy?: string;
  onSelect: (file: File | undefined) => void;
}

/** A dashed target that shows where to drop a file, or opens the file browser when clicked. */
function DropZone({ id, typeName, dragging, disabled, invalid, describedBy, onSelect }: DropZoneProps) {
  const noun = typeName === "image" ? "an image" : "a file";
  const extensions = [...UPLOAD_CONSTRAINTS[typeName].extensions.keys()];
  const maxSize = formatFileSize(UPLOAD_CONSTRAINTS[typeName].maxBytes);

  return (
    <label
      htmlFor={id}
      className={cn(
        "flex cursor-pointer flex-col items-center gap-2 rounded-lg border border-dashed border-input px-4 py-8 text-center transition-colors hover:bg-muted/40",
        "has-focus-visible:border-ring has-focus-visible:ring-3 has-focus-visible:ring-ring/50",
        dragging && "border-ring bg-muted/40",
        invalid && "border-destructive",
        disabled && "pointer-events-none opacity-50",
      )}
    >
      <Upload aria-hidden className="size-6 text-muted-foreground" />
      <span className="text-sm font-medium">
        Drag and drop {noun}, or <span className="text-primary underline">browse</span>
      </span>
      <span className="text-xs text-muted-foreground">
        {extensions.join(", ").toUpperCase()} up to {maxSize}
      </span>
      <input
        id={id}
        type="file"
        accept={getUploadAccept(typeName)}
        disabled={disabled}
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
        className="sr-only"
        onChange={(event) => {
          onSelect(event.target.files?.[0]);
          // Lets the same file be picked again after it's removed.
          event.target.value = "";
        }}
      />
    </label>
  );
}

interface SelectedFileCardProps {
  /** The field label's id, which names the card. */
  labelledBy: string;
  value: SelectedFile;
  progress: number | null;
  /** A file is being dragged over the card, to replace this one. */
  dragging: boolean;
  disabled?: boolean;
  onRemove: () => void;
}

/** The picked file: an image preview or the file's name and size, then the upload's progress. */
function SelectedFileCard({
  labelledBy,
  value,
  progress,
  dragging,
  disabled,
  onRemove,
}: SelectedFileCardProps) {
  const { file, previewUrl } = value;

  return (
    <div
      role="group"
      aria-labelledby={labelledBy}
      className={cn(
        "flex flex-col gap-3 rounded-lg border border-input p-3 transition-colors",
        dragging && "border-ring bg-muted/40",
      )}
    >
      {previewUrl && (
        <div className="relative h-48 w-full overflow-hidden rounded-md bg-muted/40">
          <Image src={previewUrl} alt={`Preview of ${file.name}`} fill unoptimized className="object-contain" />
        </div>
      )}

      <div className="flex items-center gap-3">
        <FileIcon aria-hidden className="size-5 shrink-0 text-muted-foreground" />
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-sm font-medium">{file.name}</span>
          <span className="text-xs text-muted-foreground">{formatFileSize(file.size)}</span>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label={`Remove ${file.name}`}
          disabled={disabled}
          onClick={onRemove}
        >
          <X aria-hidden />
        </Button>
      </div>

      {progress !== null && <UploadProgress progress={progress} />}
    </div>
  );
}

/** A progress bar for the upload; once every byte is sent, the server is still storing it. */
function UploadProgress({ progress }: { progress: number }) {
  const percent = Math.round(progress * 100);
  const label = percent < 100 ? `Uploading... ${percent}%` : "Processing...";

  return (
    <div className="flex flex-col gap-1.5">
      <progress
        value={percent}
        max={100}
        aria-label="Upload progress"
        className={cn(
          "h-1.5 w-full appearance-none overflow-hidden rounded-full bg-muted",
          "[&::-webkit-progress-bar]:bg-muted [&::-webkit-progress-value]:rounded-full [&::-webkit-progress-value]:bg-primary [&::-webkit-progress-value]:transition-[width]",
          "[&::-moz-progress-bar]:rounded-full [&::-moz-progress-bar]:bg-primary",
        )}
      />
      <span aria-live="polite" className="text-xs text-muted-foreground">
        {label}
      </span>
    </div>
  );
}
