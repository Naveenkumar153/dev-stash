import { useId } from "react";

import { ProBadge } from "@/components/billing/ProBadge";
import { Field } from "@/components/forms/Field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  CREATABLE_ITEM_TYPES,
  getItemTypeLabel,
  getItemTypeStyleByName,
  isProItemType,
  type CreatableItemType,
} from "@/lib/item-types";
import { cn } from "@/lib/utils";

interface ItemTypeSelectorProps {
  value: CreatableItemType;
  onChange: (value: CreatableItemType) => void;
  disabled?: boolean;
}

/**
 * The New Item dialog's type picker: a dropdown of the creatable types, each
 * with its icon and label. The options come from `CREATABLE_ITEM_TYPES`, so a
 * new type only needs adding there.
 */
export function ItemTypeSelector({ value, onChange, disabled }: ItemTypeSelectorProps) {
  const id = useId();

  return (
    <Field id={id} label="Type">
      {(control) => (
        <Select
          value={value}
          // A selection is always required, so a cleared value is ignored.
          onValueChange={(next) => next && onChange(next)}
          disabled={disabled}
        >
          <SelectTrigger {...control} className="h-9 w-full">
            <SelectValue>{(type: CreatableItemType) => <ItemTypeOption type={type} />}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {CREATABLE_ITEM_TYPES.map((type) => (
              <SelectItem key={type} value={type}>
                <ItemTypeOption type={type} />
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    </Field>
  );
}

/**
 * A type's colored icon and label, shown in the trigger and in each option,
 * with the PRO badge on file and image.
 */
function ItemTypeOption({ type }: { type: CreatableItemType }) {
  const { icon: Icon, colorClass } = getItemTypeStyleByName(type);

  return (
    <>
      <Icon aria-hidden className={cn("size-4", colorClass)} />
      {getItemTypeLabel(type)}
      {isProItemType(type) && <ProBadge />}
    </>
  );
}
