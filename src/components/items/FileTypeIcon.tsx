import { File } from "lucide-react";

import type { FileCategory } from "@/lib/file-filters";
import { cn } from "@/lib/utils";

/**
 * Each category's icon from public/icons/file-types, used as a CSS mask over
 * `bg-current` so it takes the color class like a lucide icon would. The SVGs
 * are single-color Font Awesome Free icons served unchanged, license comment
 * included. Full class strings, so Tailwind's scanner sees every URL.
 */
const FILE_TYPE_ICONS: Record<FileCategory, { maskClass: string; colorClass: string }> = {
  pdf: { maskClass: "mask-[url(/icons/file-types/pdf.svg)]", colorClass: "text-red-400" },
  document: {
    maskClass: "mask-[url(/icons/file-types/documents.svg)]",
    colorClass: "text-sky-400",
  },
  spreadsheet: {
    maskClass: "mask-[url(/icons/file-types/spreadsheets.svg)]",
    colorClass: "text-emerald-400",
  },
  data: { maskClass: "mask-[url(/icons/file-types/data.svg)]", colorClass: "text-amber-400" },
  config: { maskClass: "mask-[url(/icons/file-types/config.svg)]", colorClass: "text-slate-400" },
};

interface FileTypeIconProps {
  /** Null for "All types" and for a file outside every category. */
  category: FileCategory | null;
  /** Sizing, e.g. "size-4" or "size-5". */
  className?: string;
}

/** A file category's colored icon; a plain file icon when there is no category. */
export function FileTypeIcon({ category, className }: Readonly<FileTypeIconProps>) {
  if (!category) {
    return <File aria-hidden className={cn("shrink-0 text-muted-foreground", className)} />;
  }

  const { maskClass, colorClass } = FILE_TYPE_ICONS[category];

  return (
    <span
      aria-hidden
      className={cn(
        "inline-block shrink-0 bg-current mask-contain mask-center mask-no-repeat",
        maskClass,
        colorClass,
        className,
      )}
    />
  );
}
