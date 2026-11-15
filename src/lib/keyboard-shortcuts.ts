/** The parts of a `KeyboardEvent` a shortcut check reads. */
export interface ShortcutKeyEvent {
  key: string;
  metaKey: boolean;
  ctrlKey: boolean;
  altKey: boolean;
  shiftKey: boolean;
}

/**
 * Whether a platform string (`navigator.userAgentData.platform` or the older
 * `navigator.platform`) is macOS or iOS, where shortcuts use Cmd rather than
 * Ctrl.
 */
export function isApplePlatform(platform: string | null | undefined): boolean {
  return /mac|iphone|ipad|ipod/i.test(platform ?? "");
}

/**
 * Whether a key press opens or closes the command palette: Cmd+K on Apple
 * platforms, Ctrl+K everywhere else, with no other modifier. Each platform
 * accepts only its own key, so Ctrl+K on a Mac stays "delete to end of line"
 * in text fields.
 */
export function isPaletteShortcut(event: ShortcutKeyEvent, isApple: boolean): boolean {
  const modifier = isApple
    ? event.metaKey && !event.ctrlKey
    : event.ctrlKey && !event.metaKey;

  return modifier && !event.altKey && !event.shiftKey && event.key.toLowerCase() === "k";
}
