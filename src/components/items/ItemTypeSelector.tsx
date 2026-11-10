import { useId } from "react";

import { Label } from "@/components/ui/label";
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
    <div className="grid gap-2">
      <Label htmlFor={id}>Type</Label>
      <Select
        value={value}
        // A selection is always required, so a cleared value is ignored.
        onValueChange={(next) => next && onChange(next)}
        disabled={disabled}
      >
        <SelectTrigger id={id} className="h-9 w-full">
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
    </div>
  );
}

/** A type's colored icon and label, shown in the trigger and in each option. */
function ItemTypeOption({ type }: { type: CreatableItemType }) {
  const { icon: Icon, colorClass } = getItemTypeStyleByName(type);

  return (
    <>
      <Icon aria-hidden className={cn("size-4", colorClass)} />
      {getItemTypeLabel(type)}
    </>
  );
}
