import { Calendar, ExternalLink, Folder, Tag } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { formatLongDate } from "@/lib/format";
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

/**
 * The drawer body once the full item has loaded. Sections with nothing to show
 * are left out. Content is plain preformatted text for now - the code editor
 * and syntax highlighting come later.
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

      {item.content && (
        <DrawerSection title="Content">
          <pre className="overflow-x-auto rounded-lg border border-border bg-muted/30 p-4 font-mono text-[13px] leading-relaxed">
            <code>{item.content}</code>
          </pre>
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
