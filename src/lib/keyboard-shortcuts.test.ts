import { describe, expect, it } from "vitest";

import { isApplePlatform, isPaletteShortcut, type ShortcutKeyEvent } from "@/lib/keyboard-shortcuts";

function press(key: string, modifiers: Partial<Omit<ShortcutKeyEvent, "key">> = {}): ShortcutKeyEvent {
  return { key, metaKey: false, ctrlKey: false, altKey: false, shiftKey: false, ...modifiers };
}

describe("isApplePlatform", () => {
  it("recognizes macOS and iOS from either platform API", () => {
    for (const platform of ["macOS", "MacIntel", "iPhone", "iPad", "iPod"]) {
      expect(isApplePlatform(platform)).toBe(true);
    }
  });

  it("treats other and unknown platforms as non-Apple", () => {
    for (const platform of ["Windows", "Win32", "Linux x86_64", "Android", "", null, undefined]) {
      expect(isApplePlatform(platform)).toBe(false);
    }
  });
});

describe("isPaletteShortcut", () => {
  it("takes Cmd+K on Apple platforms, in either case", () => {
    expect(isPaletteShortcut(press("k", { metaKey: true }), true)).toBe(true);
    expect(isPaletteShortcut(press("K", { metaKey: true }), true)).toBe(true);
  });

  it("leaves Ctrl+K alone on Apple platforms, where it deletes to the end of the line", () => {
    expect(isPaletteShortcut(press("k", { ctrlKey: true }), true)).toBe(false);
  });

  it("takes Ctrl+K elsewhere and leaves the Windows key alone", () => {
    expect(isPaletteShortcut(press("k", { ctrlKey: true }), false)).toBe(true);
    expect(isPaletteShortcut(press("k", { metaKey: true }), false)).toBe(false);
  });

  it("ignores K with extra or no modifiers, and other keys", () => {
    expect(isPaletteShortcut(press("k", { metaKey: true, ctrlKey: true }), true)).toBe(false);
    expect(isPaletteShortcut(press("k", { metaKey: true, shiftKey: true }), true)).toBe(false);
    expect(isPaletteShortcut(press("k", { ctrlKey: true, altKey: true }), false)).toBe(false);
    expect(isPaletteShortcut(press("k"), true)).toBe(false);
    expect(isPaletteShortcut(press("j", { metaKey: true }), true)).toBe(false);
  });
});
