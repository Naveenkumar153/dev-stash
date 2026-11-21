import { Field } from "@/components/forms/Field";
import { Input } from "@/components/ui/input";

interface FormFieldProps extends React.ComponentProps<typeof Input> {
  /** Used as both the input's `id` and its form `name`. */
  id: string;
  label: string;
  error?: string;
  hint?: string;
  /** Shown at the end of the label row, e.g. a "Forgot password?" link. */
  labelAside?: React.ReactNode;
}

/** A labelled input: `Field` around an `Input` named after its id. */
export function FormField({ id, label, error, hint, labelAside, ...props }: FormFieldProps) {
  return (
    <Field id={id} label={label} error={error} hint={hint} labelAside={labelAside}>
      {(control) => <Input name={id} {...control} {...props} />}
    </Field>
  );
}
