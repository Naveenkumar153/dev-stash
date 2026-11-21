"use client";

import { Pin } from "lucide-react";

import { toggleItemPin } from "@/actions/items";
import { Button } from "@/components/ui/button";
import { useOptimisticToggle } from "@/hooks/use-optimistic-toggle";
import { PIN_UPDATE_FAILED } from "@/lib/action-result";
import { cn } from "@/lib/utils";

const PIN_MESSAGES = { on: "Item pinned", off: "Item unpinned" };

interface PinToggleProps {
  itemId: string;
  isPinned: boolean;
  /** Runs with the saved state, so the drawer's copy of the item follows. */
  onSaved: (isPinned: boolean) => void;
  /** Classes for the "Pin" label, e.g. to show it only from `sm`. */
  labelClassName?: string;
}

/**
 * The drawer's Pin button. `aria-pressed` carries the state and the pin fills
 * while it's on; the change shows at once and falls back if the save fails.
 */
export function PinToggle({
  itemId,
  isPinned,
  onSaved,
  labelClassName,
}: Readonly<PinToggleProps>) {
  const { value: pinned, toggle } = useOptimisticToggle(
    isPinned,
    (next) => toggleItemPin(itemId, next),
    { messages: PIN_MESSAGES, failedMessage: PIN_UPDATE_FAILED, onSaved },
  );

  return (
    <Button type="button" variant="ghost" aria-pressed={pinned} onClick={toggle}>
      <Pin aria-hidden className={cn(pinned && "fill-current")} />
      <span className={labelClassName}>Pin</span>
    </Button>
  );
}
