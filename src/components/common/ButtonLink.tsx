import type { VariantProps } from "class-variance-authority";
import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ButtonLinkProps
  extends Omit<React.ComponentProps<"a">, "href">,
    VariantProps<typeof buttonVariants> {
  href: string;
  /**
   * Makes it a download link: a plain `<a download>` rather than `next/link`,
   * which would try to navigate to the file. The value names the saved file.
   */
  download?: string;
}

/**
 * A link that looks like a button. Base UI's `Button` rendered as a link
 * (`nativeButton={false}`) adds `role="button"`, which tells screen readers
 * it's a button, so links get `buttonVariants` on a plain link instead. No
 * hooks, so server components can use it too.
 */
export function ButtonLink({
  href,
  variant,
  size,
  className,
  download,
  ...props
}: Readonly<ButtonLinkProps>) {
  const classes = cn(buttonVariants({ variant, size }), className);

  if (download !== undefined) {
    return <a href={href} download={download} className={classes} {...props} />;
  }

  return <Link href={href} className={classes} {...props} />;
}
