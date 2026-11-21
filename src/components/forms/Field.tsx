import { Label } from "@/components/ui/label";

/** The props that tie a control to its field's label, hint and error. */
export interface FieldControlProps {
  id: string;
  "aria-invalid"?: true;
  "aria-describedby"?: string;
}

interface FieldProps {
  id: string;
  label: string;
  /** Shown at the end of the label row, e.g. a "Forgot password?" link or an AI button. */
  labelAside?: React.ReactNode;
  error?: string;
  hint?: string;
  /** Renders the control, given the props that tie it to the label, hint and error. */
  children: (control: FieldControlProps) => React.ReactNode;
}

/**
 * A labelled control with its hint and validation message wired up for screen
 * readers. The control comes from `children`, so any input, textarea, select
 * or editor can sit in it. No hooks, so server components can use it too.
 */
export function Field({ id, label, labelAside, error, hint, children }: Readonly<FieldProps>) {
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const describedBy = [hint && hintId, error && errorId].filter(Boolean).join(" ");

  return (
    <div className="grid gap-2">
      {labelAside ? (
        <div className="flex min-h-6 items-center justify-between gap-2">
          <Label htmlFor={id}>{label}</Label>
          {labelAside}
        </div>
      ) : (
        <Label htmlFor={id}>{label}</Label>
      )}
      {children({
        id,
        "aria-invalid": error ? true : undefined,
        "aria-describedby": describedBy || undefined,
      })}
      {hint && (
        <p id={hintId} className="text-xs text-muted-foreground">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
