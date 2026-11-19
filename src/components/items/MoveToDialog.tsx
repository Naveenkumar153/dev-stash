"use client";

import { ArrowLeft, ChevronRight, Folder } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useTransition, type TransitionStartFunction } from "react";
import { toast } from "sonner";

import { moveFolder, moveItem } from "@/actions/folders";
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
import { sortFolders } from "@/lib/file-filters";
import {
  ROOT_FOLDER_LABEL,
  getSubtreeIds,
  groupByParent,
  type FolderEntry,
} from "@/lib/folders";
import { callAction } from "@/lib/action-call";
import type { FolderResult, MoveItemResult } from "@/types/folders";

/** What's being moved: a folder, with everything in it, or one file. */
export interface MoveSubject {
  kind: "folder" | "file";
  id: string;
  /** The folder's name or the file's title, for the dialog's title. */
  name: string;
  /** Where it is now; null at the top level. */
  location: string | null;
}

interface MoveToDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Kept while the dialog animates out, so it still has content. */
  subject: MoveSubject | null;
  /** Every folder, to browse. */
  folders: readonly FolderEntry[];
}

/**
 * "Move to...": a drill-down folder picker starting where the subject is now.
 * Folders open with a click and "Move here" moves into the one shown. A folder
 * can't be opened or chosen as its own destination, which also keeps its
 * sub-folders out of reach; the server refuses that move too.
 */
export function MoveToDialog({ open, onOpenChange, subject, folders }: MoveToDialogProps) {
  const [pending, startTransition] = useTransition();

  function handleOpenChange(next: boolean) {
    if (!pending) {
      onOpenChange(next);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="gap-0 p-0">
        {subject && (
          // Keyed so a picker reopened for another row mid-exit-animation
          // starts at that row's location instead of keeping the last one.
          <MovePicker
            key={`${subject.kind}:${subject.id}`}
            subject={subject}
            folders={folders}
            pending={pending}
            startTransition={startTransition}
            onMoved={() => onOpenChange(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

interface MovePickerProps {
  subject: MoveSubject;
  folders: readonly FolderEntry[];
  pending: boolean;
  startTransition: TransitionStartFunction;
  onMoved: () => void;
}

function MovePicker({ subject, folders, pending, startTransition, onMoved }: MovePickerProps) {
  const router = useRouter();
  const [browsing, setBrowsing] = useState(subject.location);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const navigated = useRef(false);

  const byId = useMemo(() => new Map(folders.map((folder) => [folder.id, folder])), [folders]);
  const children = useMemo(() => groupByParent(folders), [folders]);
  // A folder can't go inside itself, so it and everything beneath it are out.
  const blocked = useMemo(
    () => new Set(subject.kind === "folder" ? getSubtreeIds(folders, subject.id) : []),
    [folders, subject],
  );

  const current = browsing === null ? null : byId.get(browsing);
  const currentName = current?.name ?? ROOT_FOLDER_LABEL;
  const listed = sortFolders(children.get(browsing) ?? [], { field: "name", direction: "asc" });
  const canMoveHere = browsing !== subject.location && !(browsing && blocked.has(browsing));

  // The clicked folder button unmounts on navigation, so focus moves to the
  // new location's name instead of dropping to the dialog.
  useEffect(() => {
    if (navigated.current) {
      headingRef.current?.focus();
    }
  }, [browsing]);

  function browse(folderId: string | null) {
    navigated.current = true;
    setBrowsing(folderId);
  }

  function handleMove() {
    startTransition(async () => {
      const result = await callAction<FolderResult | MoveItemResult>(() =>
        subject.kind === "folder"
          ? moveFolder({ folderId: subject.id, parentId: browsing })
          : moveItem({ itemId: subject.id, folderId: browsing }),
      );
      if (!result) {
        return;
      }

      if (!result.success) {
        toast.error(result.error ?? "Couldn't move it. Please try again.");
        return;
      }

      toast.success(`Moved to “${currentName}”`);
      onMoved();
      router.refresh();
    });
  }

  return (
    <>
      <DialogHeader className="p-6 pb-4">
        <DialogTitle className="wrap-break-word">Move &ldquo;{subject.name}&rdquo;</DialogTitle>
        <DialogDescription>Open the folder it should go in, then choose Move here.</DialogDescription>
      </DialogHeader>

      <div className="flex flex-col gap-2 px-6 pb-6">
        <div className="flex min-w-0 items-center gap-2">
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            disabled={browsing === null}
            onClick={() => browse(current?.parentId ?? null)}
            aria-label={`Back to ${
              current?.parentId ? byId.get(current.parentId)?.name : ROOT_FOLDER_LABEL
            }`}
          >
            <ArrowLeft aria-hidden />
          </Button>
          <h3
            ref={headingRef}
            tabIndex={-1}
            className="truncate text-sm font-medium outline-none"
          >
            {currentName}
          </h3>
        </div>

        <div className="max-h-64 overflow-y-auto rounded-lg ring-1 ring-foreground/10">
          {listed.length === 0 ? (
            <p className="px-3 py-6 text-center text-sm text-muted-foreground">
              No folders in here.
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {listed.map((folder) => (
                <li key={folder.id}>
                  <button
                    type="button"
                    disabled={blocked.has(folder.id)}
                    onClick={() => browse(folder.id)}
                    className="flex w-full items-center gap-3 px-3 py-2 text-left text-sm transition-colors outline-none hover:bg-accent/50 focus-visible:bg-accent/50 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:ring-inset disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-transparent"
                  >
                    <Folder aria-hidden className="size-4 shrink-0 fill-muted-foreground/30 text-muted-foreground" />
                    <span className="min-w-0 flex-1 truncate">{folder.name}</span>
                    {blocked.has(folder.id) ? (
                      <span className="text-xs text-muted-foreground">Moving</span>
                    ) : (
                      <ChevronRight aria-hidden className="size-4 shrink-0 text-muted-foreground" />
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <DialogFooter className="mx-0 mb-0 px-6">
        <DialogClose render={<Button type="button" variant="outline" disabled={pending} />}>
          Cancel
        </DialogClose>
        <Button type="button" disabled={pending || !canMoveHere} onClick={handleMove}>
          {pending ? "Moving..." : "Move here"}
        </Button>
      </DialogFooter>
    </>
  );
}
