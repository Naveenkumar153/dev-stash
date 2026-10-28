/** A form-level error, such as a failed sign-in or a taken email. */
export function FormMessage({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <p
      role="alert"
      className="rounded-lg border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive"
    >
      {children}
    </p>
  );
}
