import { Layers } from "lucide-react";

import { PreviewSearchDemo } from "@/components/home/PreviewSearchDemo";
import { PREVIEW_COLLECTIONS, PREVIEW_TYPE_COUNTS } from "@/lib/homepage";
import { getItemTypePlural, getItemTypeStyleByName } from "@/lib/item-types";
import { cn } from "@/lib/utils";

const NAV_ROW_CLASS =
  "flex min-w-0 items-center justify-center gap-1.5 rounded-[5px] px-1.5 py-0.75 whitespace-nowrap text-muted-foreground md:justify-start";

/**
 * The hero's "...with DevStash" panel: a miniature of the dashboard. The sidebar
 * is static; the search bar and cards are the `PreviewSearchDemo` island. Below
 * `md` the sidebar shrinks to an icon rail, like the app's.
 */
export function DashboardPreview() {
  return (
    <div
      role="img"
      aria-label="The DevStash dashboard: item types and collections in a sidebar, a search bar, and recent snippets, prompts, commands, notes, images and links as color-coded cards"
      className="flex h-75 overflow-hidden rounded-xl border bg-card text-[10px] leading-[1.3] select-none sm:h-80"
    >
      <div className="flex shrink-0 flex-col gap-0.5 border-r bg-background px-1.5 py-3 md:w-[30%] md:max-w-31 md:px-2">
        <span className="mb-2 flex items-center justify-center gap-1.5 px-1.5 text-[11px] font-bold md:justify-start">
          <Layers className="size-2.75 shrink-0" />
          <span className="hidden md:inline">DevStash</span>
        </span>

        {PREVIEW_TYPE_COUNTS.map(({ typeName, count }, i) => {
          const { icon: Icon, colorClass } = getItemTypeStyleByName(typeName);
          return (
            <span key={typeName} className={cn(NAV_ROW_CLASS, i === 0 && "bg-muted text-foreground")}>
              <Icon className={cn("size-2.75 shrink-0", colorClass)} />
              <span className="hidden md:inline">{getItemTypePlural(typeName)}</span>
              <em className="ml-auto hidden text-[9px] text-muted-foreground/70 not-italic md:inline">
                {count}
              </em>
            </span>
          );
        })}

        <div className="mt-2.5 flex flex-col gap-0.5 md:mt-2">
          <span className="mb-0.5 hidden px-1.5 text-[8px] font-bold tracking-widest text-muted-foreground/70 uppercase md:block">
            Collections
          </span>
          {PREVIEW_COLLECTIONS.map(({ name, typeName }) => (
            <span key={name} className={cn(NAV_ROW_CLASS, "max-md:py-1.5")}>
              <i
                className={cn(
                  "size-1.5 shrink-0 rounded-full",
                  getItemTypeStyleByName(typeName).dotClass,
                )}
              />
              <span className="hidden truncate md:inline">{name}</span>
            </span>
          ))}
        </div>
      </div>

      <PreviewSearchDemo />
    </div>
  );
}
