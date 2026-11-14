"use client";

import { Copy } from "lucide-react";

import { Button } from "@/components/ui/button";
import { copyPendingText } from "@/lib/clipboard";
import { fetchItemCopyText } from "@/lib/item-copy";

interface QuickCopyButtonProps {
  itemId: string;
  itemTitle: string;
}

/**
 * A card's copy icon: copies the item's content, or a link's URL, without
 * opening the drawer. Cards don't load content, so it's fetched on click. The
 * button sits above the card's stretched title button (relative z-10).
 */
export function QuickCopyButton({ itemId, itemTitle }: Readonly<QuickCopyButtonProps>) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-xs"
      aria-label={`Copy ${itemTitle}`}
      className="relative z-10 shrink-0 text-muted-foreground hover:text-foreground"
      onClick={() => void copyPendingText(fetchItemCopyText(itemId))}
    >
      <Copy aria-hidden />
    </Button>
  );
}
