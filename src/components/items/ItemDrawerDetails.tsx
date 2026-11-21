import { Calendar, Download, ExternalLink, File as FileIcon, Folder, Tag } from "lucide-react";
import Image from "next/image";

import { ButtonLink } from "@/components/common/ButtonLink";
import { ExplainableCodeEditor } from "@/components/items/ExplainableCodeEditor";
import { MarkdownEditor } from "@/components/items/MarkdownEditor";
import { OptimizablePromptEditor } from "@/components/items/OptimizablePromptEditor";
import { TagList } from "@/components/items/TagList";
import { Badge } from "@/components/ui/badge";
import type { ContentSaved } from "@/hooks/use-optimize-prompt";
import { canOptimize } from "@/lib/ai-optimize";
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
      <dd className="text-right text-base">
        <time dateTime={iso}>{formatLongDate(new Date(iso))}</time>
      </dd>
    </>
  );
}

/** The collections an item is in, if any. Edit mode shows them in the Collections picker instead. */
function ItemCollectionsSection({
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
      <dl className="grid grid-cols-[auto_1fr] items-baseline gap-x-4 gap-y-2 text-sm">
        <DateRow label="Created" iso={createdAt} />
        <DateRow label="Updated" iso={updatedAt} />
      </dl>
    </DrawerSection>
  );
}

interface ItemContentProps {
  itemId: string;
  typeName: string;
  content: string;
  language: string | null;
  onContentSaved: ContentSaved;
}

/**
 * Read-only content: snippets and commands in the code editor with AI
 * Explain, prompts as rendered markdown with AI Optimize, notes as rendered
 * markdown, anything else as plain preformatted text.
 */
function ItemContent({
  itemId,
  typeName,
  content,
  language,
  onContentSaved,
}: Readonly<ItemContentProps>) {
  switch (getContentEditorKind(typeName)) {
    case "code":
      return <ExplainableCodeEditor itemId={itemId} content={content} language={language} />;
    case "markdown":
      return canOptimize(typeName) ? (
        <OptimizablePromptEditor itemId={itemId} content={content} onContentSaved={onContentSaved} />
      ) : (
        <MarkdownEditor value={content} readOnly ariaLabel="Content" />
      );
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
        <ButtonLink
          href={getItemFileUrl(itemId, true)}
          download={fileName}
          variant="outline"
          size="sm"
        >
          <Download aria-hidden />
          Download
        </ButtonLink>
      </div>
    </div>
  );
}

/**
 * The drawer body once the full item has loaded. Sections with nothing to show
 * are left out.
 */
export function ItemDrawerDetails({
  item,
  onContentSaved,
}: Readonly<{ item: ItemDetail; onContentSaved: ContentSaved }>) {
  return (
    <div className="flex flex-col gap-8">
      {item.description && (
        <DrawerSection title="Description">
          <p className="text-base leading-relaxed">{item.description}</p>
        </DrawerSection>
      )}

      {item.url && (
        <DrawerSection title="URL">
          <a
            href={item.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-start gap-2 text-base break-all text-type-link hover:underline"
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
          <ItemContent
            // A new item, or a saved edit, starts without the old explanation.
            key={`${item.id}:${item.updatedAt}`}
            itemId={item.id}
            typeName={item.typeName}
            content={item.content}
            language={item.language}
            onContentSaved={onContentSaved}
          />
        </DrawerSection>
      )}

      {item.tags.length > 0 && (
        <DrawerSection title="Tags" icon={<Tag aria-hidden className="size-4" />}>
          <TagList tags={item.tags} />
        </DrawerSection>
      )}

      <ItemCollectionsSection collections={item.collections} />
      <ItemDatesSection createdAt={item.createdAt} updatedAt={item.updatedAt} />
    </div>
  );
}
