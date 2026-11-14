import { Calendar, Download, ExternalLink, File as FileIcon, Folder, Tag } from "lucide-react";
import Image from "next/image";

import { CodeEditor } from "@/components/items/CodeEditor";
import { MarkdownEditor } from "@/components/items/MarkdownEditor";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getItemFileUrl, isImageFileName } from "@/lib/file-upload";
import { formatFileSize, formatLongDate } from "@/lib/format";
import { getContentEditorKind, getItemTypeLabel } from "@/lib/item-types";
import type { ItemCollectionRef, ItemDetail } from "@/types/items";

interface DrawerSectionProps {
  title: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}

function DrawerSection({ title, icon, children }: Readonly<DrawerSectionProps>) {
  return (
    <section className="flex flex-col gap-3">
      <h3 className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
        {icon}
        {title}
      </h3>
      {children}
    </section>
  );
}

function DateRow({ label, iso }: Readonly<{ label: string; iso: string }>) {
  return (
    <>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right">
        <time dateTime={iso}>{formatLongDate(new Date(iso))}</time>
      </dd>
    </>
  );
}

/** The collections an item is in, if any. Shared by view and edit mode. */
export function ItemCollectionsSection({
  collections,
}: Readonly<{ collections: ItemCollectionRef[] }>) {
  if (collections.length === 0) {
    return null;
  }

  return (
    <DrawerSection title="Collections" icon={<Folder aria-hidden className="size-4" />}>
      <div className="flex flex-wrap gap-1.5">
        {collections.map((collection) => (
          <Badge key={collection.id} variant="outline">
            {collection.name}
          </Badge>
        ))}
      </div>
    </DrawerSection>
  );
}

/** Created and updated dates. Shared by view and edit mode. */
export function ItemDatesSection({
  createdAt,
  updatedAt,
}: Readonly<{ createdAt: string; updatedAt: string }>) {
  return (
    <DrawerSection title="Details" icon={<Calendar aria-hidden className="size-4" />}>
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
        <DateRow label="Created" iso={createdAt} />
        <DateRow label="Updated" iso={updatedAt} />
      </dl>
    </DrawerSection>
  );
}

interface ItemContentProps {
  typeName: string;
  content: string;
  language: string | null;
}

/**
 * Read-only content: snippets and commands in the code editor, notes and
 * prompts as rendered markdown, anything else as plain preformatted text.
 */
function ItemContent({ typeName, content, language }: Readonly<ItemContentProps>) {
  switch (getContentEditorKind(typeName)) {
    case "code":
      return <CodeEditor value={content} language={language} readOnly ariaLabel="Content" />;
    case "markdown":
      return <MarkdownEditor value={content} readOnly ariaLabel="Content" />;
    case "plain":
      return (
        <pre className="overflow-x-auto rounded-lg border border-border bg-muted/30 p-4 font-mono text-[13px] leading-relaxed">
          <code>{content}</code>
        </pre>
      );
  }
}

interface ItemFileProps {
  itemId: string;
  fileName: string;
  fileSize: number | null;
}

/**
 * A file or image item's file: a preview for images, then the name, size and
 * a Download button. Both go through the download proxy, never R2 directly.
 */
function ItemFile({ itemId, fileName, fileSize }: Readonly<ItemFileProps>) {
  return (
    <div className="flex flex-col gap-3">
      {isImageFileName(fileName) && (
        <div className="relative h-64 w-full overflow-hidden rounded-lg border border-border bg-muted/30">
          <Image
            src={getItemFileUrl(itemId)}
            alt={`Preview of ${fileName}`}
            fill
            unoptimized
            className="object-contain"
          />
        </div>
      )}

      <div className="flex items-center gap-3 rounded-lg border border-border bg-muted/30 p-3">
        <FileIcon aria-hidden className="size-5 shrink-0 text-muted-foreground" />
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-sm font-medium">{fileName}</span>
          {fileSize !== null && (
            <span className="text-xs text-muted-foreground">{formatFileSize(fileSize)}</span>
          )}
        </div>
        <Button
          variant="outline"
          size="sm"
          render={<a href={getItemFileUrl(itemId, true)} download={fileName} />}
          nativeButton={false}
        >
          <Download aria-hidden />
          Download
        </Button>
      </div>
    </div>
  );
}

/**
 * The drawer body once the full item has loaded. Sections with nothing to show
 * are left out.
 */
export function ItemDrawerDetails({ item }: Readonly<{ item: ItemDetail }>) {
  return (
    <div className="flex flex-col gap-8">
      {item.description && (
        <DrawerSection title="Description">
          <p className="text-sm leading-relaxed">{item.description}</p>
        </DrawerSection>
      )}

      {item.url && (
        <DrawerSection title="URL">
          <a
            href={item.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-start gap-2 text-sm break-all text-type-link hover:underline"
          >
            {item.url}
            <ExternalLink aria-hidden className="mt-0.5 size-3.5 shrink-0" />
            <span className="sr-only">(opens in a new tab)</span>
          </a>
        </DrawerSection>
      )}

      {item.fileName && (
        <DrawerSection title={getItemTypeLabel(item.typeName)}>
          <ItemFile itemId={item.id} fileName={item.fileName} fileSize={item.fileSize} />
        </DrawerSection>
      )}

      {item.content && (
        <DrawerSection title="Content">
          <ItemContent typeName={item.typeName} content={item.content} language={item.language} />
        </DrawerSection>
      )}

      {item.tags.length > 0 && (
        <DrawerSection title="Tags" icon={<Tag aria-hidden className="size-4" />}>
          <div className="flex flex-wrap gap-1.5">
            {item.tags.map((tag) => (
              <Badge key={tag} variant="secondary">
                {tag}
              </Badge>
            ))}
          </div>
        </DrawerSection>
      )}

      <ItemCollectionsSection collections={item.collections} />
      <ItemDatesSection createdAt={item.createdAt} updatedAt={item.updatedAt} />
    </div>
  );
}
