"use client";

import { useId, useState, useTransition } from "react";
import { toast } from "sonner";

import { updateEditorPreferences } from "@/actions/editor-preferences";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  EDITOR_FONT_SIZES,
  EDITOR_TAB_SIZES,
  EDITOR_THEMES,
  EDITOR_THEME_LABELS,
  type EditorPreferences,
} from "@/lib/editor-preferences";
import { callAction } from "@/lib/action-call";

interface EditorPreferencesFormProps {
  initialPreferences: EditorPreferences;
}

/**
 * The editor settings. There is no Save button: every change saves straight
 * away, shows in the controls at once and rolls back with an error toast if the
 * save fails.
 */
export function EditorPreferencesForm({
  initialPreferences,
}: Readonly<EditorPreferencesFormProps>) {
  const [preferences, setPreferences] = useState(initialPreferences);
  const [, startSave] = useTransition();
  const ids = { fontSize: useId(), tabSize: useId(), theme: useId(), wordWrap: useId(), minimap: useId() };

  function save(change: Partial<EditorPreferences>) {
    const previous = preferences;
    const next = { ...preferences, ...change };
    setPreferences(next);

    startSave(async () => {
      const result = await callAction(() => updateEditorPreferences(next));
      if (result?.success) {
        toast.success("Editor preferences saved");
        return;
      }

      // Put back what the server still has, unless a newer change replaced it.
      setPreferences((current) => (current === next ? previous : current));
      if (result) {
        toast.error(result.error ?? Object.values(result.fieldErrors)[0] ?? "Couldn't save.");
      }
    });
  }

  return (
    <div className="grid gap-5">
      <Setting id={ids.fontSize} label="Font size" description="Text size in the code and Markdown editors.">
        <Select value={preferences.fontSize} onValueChange={(value) => value && save({ fontSize: value })}>
          <SelectTrigger id={ids.fontSize} className="w-32">
            <SelectValue>{(size: number) => `${size}px`}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {EDITOR_FONT_SIZES.map((size) => (
              <SelectItem key={size} value={size}>
                {size}px
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Setting>

      <Setting id={ids.tabSize} label="Tab size" description="Spaces per indent.">
        <Select value={preferences.tabSize} onValueChange={(value) => value && save({ tabSize: value })}>
          <SelectTrigger id={ids.tabSize} className="w-32">
            <SelectValue>{(size: number) => `${size} spaces`}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {EDITOR_TAB_SIZES.map((size) => (
              <SelectItem key={size} value={size}>
                {size} spaces
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Setting>

      <Setting id={ids.theme} label="Theme" description="Colors used for code.">
        <Select value={preferences.theme} onValueChange={(value) => value && save({ theme: value })}>
          <SelectTrigger id={ids.theme} className="w-40">
            <SelectValue>{(theme: keyof typeof EDITOR_THEME_LABELS) => EDITOR_THEME_LABELS[theme]}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {EDITOR_THEMES.map((theme) => (
              <SelectItem key={theme} value={theme}>
                {EDITOR_THEME_LABELS[theme]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Setting>

      <Setting id={ids.wordWrap} label="Word wrap" description="Wrap long lines instead of scrolling sideways.">
        <Switch
          id={ids.wordWrap}
          checked={preferences.wordWrap}
          onCheckedChange={(checked) => save({ wordWrap: checked })}
        />
      </Setting>

      <Setting id={ids.minimap} label="Minimap" description="Show a small overview of the file beside the code.">
        <Switch
          id={ids.minimap}
          checked={preferences.minimap}
          onCheckedChange={(checked) => save({ minimap: checked })}
        />
      </Setting>
    </div>
  );
}

interface SettingProps {
  id: string;
  label: string;
  description: string;
  children: React.ReactNode;
}

/** One row: the label and what it does on the left, its control on the right. */
function Setting({ id, label, description, children }: Readonly<SettingProps>) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="grid gap-0.5">
        <Label htmlFor={id}>{label}</Label>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      {children}
    </div>
  );
}
