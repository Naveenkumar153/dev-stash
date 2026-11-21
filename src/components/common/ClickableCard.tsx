import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

/**
 * A card whose whole surface is one link or button: a stretched control
 * inside it covers the card. It highlights on hover, and shows the focus ring
 * around the whole card while the keyboard is on anything inside it.
 */
export function ClickableCard({ className, ...props }: React.ComponentProps<typeof Card>) {
  return (
    <Card
      className={cn(
        "relative transition-colors hover:bg-accent/50 has-focus-visible:ring-3 has-focus-visible:ring-ring/50",
        className,
      )}
      {...props}
    />
  );
}
