import { FILE_ITEM_TYPES, type FileItemType } from "@/lib/item-types";

const MB = 1024 * 1024;

interface UploadConstraint {
  /** Largest file accepted, in bytes. */
  maxBytes: number;
  /** "Images can be up to 5 MB." */
  sizeError: string;
  /**
   * Each accepted extension and the MIME types a browser may report for it.
   * The first is the canonical type, which is what the file is stored and
   * served as - the browser's reported type is never trusted beyond the check.
   */
  extensions: ReadonlyMap<string, readonly [string, ...string[]]>;
}

/** Size and type rules for each file-backed item type. */
export const UPLOAD_CONSTRAINTS: Record<FileItemType, UploadConstraint> = {
  image: {
    maxBytes: 5 * MB,
    sizeError: "Images can be up to 5 MB.",
    extensions: new Map([
      ["png", ["image/png"]],
      ["jpg", ["image/jpeg"]],
      ["jpeg", ["image/jpeg"]],
      ["gif", ["image/gif"]],
      ["webp", ["image/webp"]],
      ["svg", ["image/svg+xml"]],
    ]),
  },
  file: {
    maxBytes: 10 * MB,
    sizeError: "Files can be up to 10 MB.",
    extensions: new Map([
      ["pdf", ["application/pdf"]],
      ["txt", ["text/plain"]],
      ["md", ["text/markdown"]],
      ["json", ["application/json"]],
      ["yaml", ["application/x-yaml", "text/yaml"]],
      ["yml", ["application/x-yaml", "text/yaml"]],
      ["xml", ["application/xml", "text/xml"]],
      ["csv", ["text/csv"]],
      ["toml", ["application/toml"]],
      ["ini", ["text/plain"]],
    ]),
  },
};

/** The largest upload any file type accepts, in bytes. */
export const MAX_UPLOAD_BYTES = Math.max(
  ...FILE_ITEM_TYPES.map((type) => UPLOAD_CONSTRAINTS[type].maxBytes),
);

/**
 * What a browser reports when it doesn't recognize an extension - common for
 * `.md`, `.yaml`, `.toml` and `.ini`. The extension alone decides then.
 */
const GENERIC_MIME_TYPES = new Set(["", "application/octet-stream"]);

/** The original name is stored and shown, so it's capped like a filesystem name. */
const MAX_FILE_NAME_LENGTH = 255;

/** "Report.PDF" -> "pdf". Empty when there's no extension, or for a dotfile like ".env". */
export function getFileExtension(fileName: string): string {
  const dot = fileName.lastIndexOf(".");

  return dot > 0 ? fileName.slice(dot + 1).toLowerCase() : "";
}

/** The extensions a type accepts, for a file input's `accept`: ".png,.jpg,...". */
export function getUploadAccept(typeName: FileItemType): string {
  return [...UPLOAD_CONSTRAINTS[typeName].extensions.keys()].map((ext) => `.${ext}`).join(",");
}

/** ".png, .jpg, .jpeg, .gif, .webp or .svg" */
function listExtensions(typeName: FileItemType): string {
  const extensions = [...UPLOAD_CONSTRAINTS[typeName].extensions.keys()].map((ext) => `.${ext}`);

  return `${extensions.slice(0, -1).join(", ")} or ${extensions.at(-1)}`;
}

/** The parts of a `File` the checks need, so the server and browser share them. */
export interface UploadCandidate {
  name: string;
  size: number;
  /** The MIME type the browser reported, often empty for text formats. */
  type: string;
}

export type UploadValidation =
  | { success: true; contentType: string }
  | { success: false; error: string };

/**
 * Checks a file against its type's extension, MIME type and size rules. On
 * success, returns the canonical content type to store and serve it as.
 */
export function validateUpload(typeName: FileItemType, file: UploadCandidate): UploadValidation {
  const { extensions, maxBytes, sizeError } = UPLOAD_CONSTRAINTS[typeName];
  const mimeTypes = extensions.get(getFileExtension(file.name));

  if (!mimeTypes) {
    return { success: false, error: `Choose a ${listExtensions(typeName)} file.` };
  }

  const reported = file.type.toLowerCase();
  if (!GENERIC_MIME_TYPES.has(reported) && !mimeTypes.includes(reported)) {
    return { success: false, error: "This file's contents don't match its extension." };
  }

  if (file.name.length > MAX_FILE_NAME_LENGTH) {
    return { success: false, error: "File names can be up to 255 characters." };
  }

  if (file.size === 0) {
    return { success: false, error: "This file is empty." };
  }

  if (file.size > maxBytes) {
    return { success: false, error: sizeError };
  }

  return { success: true, contentType: mimeTypes[0] };
}

/**
 * The canonical content type for a stored file's name, used when serving it.
 * Anything unrecognized is served as a download-only binary.
 */
export function getContentTypeForFileName(fileName: string): string {
  const extension = getFileExtension(fileName);

  for (const typeName of FILE_ITEM_TYPES) {
    const mimeTypes = UPLOAD_CONSTRAINTS[typeName].extensions.get(extension);
    if (mimeTypes) {
      return mimeTypes[0];
    }
  }

  return "application/octet-stream";
}

/** Whether a stored file is an image, so it can be shown inline as a preview. */
export function isImageFileName(fileName: string): boolean {
  return UPLOAD_CONSTRAINTS.image.extensions.has(getFileExtension(fileName));
}

const MAX_KEY_NAME_LENGTH = 100;

/**
 * "My Notes (v2).md" -> "My-Notes-v2-.md": only letters, digits, dots,
 * underscores and dashes, at most 100 characters, keeping the extension.
 */
export function sanitizeFileName(fileName: string): string {
  const safe = fileName
    // "é" -> "e" plus a combining accent, which is then dropped.
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .replace(/[^\w.-]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^[-.]+/, "");

  return safe.slice(-MAX_KEY_NAME_LENGTH) || "file";
}

/**
 * Where an upload is stored in R2: under the owner's id, then a random id so
 * two uploads of the same name never collide, then a safe form of the name.
 */
export function buildFileKey(userId: string, uploadId: string, fileName: string): string {
  return `${userId}/${uploadId}-${sanitizeFileName(fileName)}`;
}

/** RFC 5987 encoding, which unlike encodeURIComponent also escapes ' ( ) *. */
function encodeRfc5987(value: string): string {
  return encodeURIComponent(value).replace(
    /['()*]/g,
    (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`,
  );
}

/**
 * A `Content-Disposition` header carrying the original file name: an ASCII
 * fallback for old clients plus the exact UTF-8 name for everyone else.
 */
export function contentDisposition(type: "inline" | "attachment", fileName: string): string {
  const fallback = fileName.replace(/[^\x20-\x7e]|["\\]/g, "_");

  return `${type}; filename="${fallback}"; filename*=UTF-8''${encodeRfc5987(fileName)}`;
}

/** The download proxy's path for an item's file; `download` forces a save. */
export function getItemFileUrl(itemId: string, download = false): string {
  return `/api/items/${itemId}/file${download ? "?download=1" : ""}`;
}
