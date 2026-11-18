import { cn } from "@/lib/utils";

interface FormMessageProps {
  children: React.ReactNode;
  tone?: "error" | "success" | "info";
}

const TONE_CLASSES = {
  error: "border-destructive/50 bg-destructive/10 text-destructive",
  success: "border-emerald-500/50 bg-emerald-500/10 text-emerald-400",
  info: "border-border bg-muted/40 text-foreground",
} as const;

/** A form-level message, such as a failed sign-in, a taken email or a verified address. */
export function FormMessage({ children, tone = "error" }: Readonly<FormMessageProps>) {
  return (
    <p
      role={tone === "error" ? "alert" : "status"}
      className={cn("rounded-lg border px-3 py-2 text-sm", TONE_CLASSES[tone])}
    >
      {children}
    </p>
  );
}
