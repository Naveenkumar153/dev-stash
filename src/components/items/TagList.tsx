import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface TagListProps {
  tags: readonly string[];
  className?: string;
  /** Shown after the tags in the same wrapping row, e.g. a card's date and buttons. */
  children?: React.ReactNode;
}

/** An item's tags as a wrapping row of badges. */
export function TagList({ tags, className, children }: Readonly<TagListProps>) {
  return (
    <div className={cn("flex flex-wrap items-center gap-1.5", className)}>
      {tags.map((tag) => (
        <Badge key={tag} variant="secondary">
          {tag}
        </Badge>
      ))}
      {children}
    </div>
  );
}
