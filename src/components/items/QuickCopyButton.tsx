"use client";

import { Copy } from "lucide-react";
import { useState } from "react";

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
 * button sits above the card's stretched title button (relative z-10). It's
 * disabled while a copy runs, so repeated clicks don't start parallel fetches.
 */
export function QuickCopyButton({ itemId, itemTitle }: Readonly<QuickCopyButtonProps>) {
  const [copying, setCopying] = useState(false);

  async function handleClick() {
    setCopying(true);
    try {
      await copyPendingText(fetchItemCopyText(itemId));
    } finally {
      setCopying(false);
    }
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-xs"
      aria-label={`Copy ${itemTitle}`}
      aria-busy={copying || undefined}
      disabled={copying}
      className="relative z-10 shrink-0 text-muted-foreground hover:text-foreground"
      onClick={() => void handleClick()}
    >
      <Copy aria-hidden />
    </Button>
  );
}
