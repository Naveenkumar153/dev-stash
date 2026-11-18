import { Badge } from "@/components/ui/badge";

/** Marks an item type that a Pro subscription unlocks. */
export function ProBadge() {
  return (
    <Badge
      variant="outline"
      className="h-4 px-1.5 text-[10px] tracking-wide text-muted-foreground"
    >
      PRO
    </Badge>
  );
}
