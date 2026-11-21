import { cn } from "@/lib/utils";

interface PageHeaderProps {
  /** The tile beside the title, usually an `IconTile` at `size="lg"`. */
  icon: React.ReactNode;
  title: React.ReactNode;
  /** The line under the title, e.g. a count. */
  subtitle?: React.ReactNode;
  /** Buttons at the end of the header. */
  actions?: React.ReactNode;
  /** Extra content under the subtitle, e.g. a description. */
  children?: React.ReactNode;
  /** Top-aligns the tile and actions, for a header with `children` below the title. */
  align?: "center" | "start";
}

/** A page's header: icon tile, the page's `h1`, a subtitle and its actions. */
export function PageHeader({
  icon,
  title,
  subtitle,
  actions,
  children,
  align = "center",
}: Readonly<PageHeaderProps>) {
  return (
    <header className={cn("flex gap-4", align === "center" ? "items-center" : "items-start")}>
      {icon}
      <div className="min-w-0 flex-1">
        <h1 className="font-heading text-3xl font-semibold wrap-anywhere">{title}</h1>
        {subtitle && <p className="mt-1 text-muted-foreground">{subtitle}</p>}
        {children}
      </div>
      {actions}
    </header>
  );
}
