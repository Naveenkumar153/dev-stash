import { describe, expect, it } from "vitest";

import {
  MAX_UPLOAD_BYTES,
  buildFileKey,
  contentDisposition,
  getContentTypeForFileName,
  getFileExtension,
  getItemFileUrl,
  getUploadAccept,
  isImageFileName,
  sanitizeFileName,
  validateUpload,
} from "@/lib/file-upload";

const MB = 1024 * 1024;
const IMAGE_EXTENSIONS = "Choose a .png, .jpg, .jpeg, .gif, .webp or .svg file.";
const FILE_EXTENSIONS =
  "Choose a .pdf, .txt, .md, .json, .yaml, .yml, .xml, .csv, .toml or .ini file.";
const MISMATCH = "This file's contents don't match its extension.";

describe("getFileExtension", () => {
  it.each([
    ["photo.png", "png"],
    ["Report.PDF", "pdf"],
    ["archive.tar.gz", "gz"],
    ["My Notes (v2).md", "md"],
  ])("reads %s as %s", (name, extension) => {
    expect(getFileExtension(name)).toBe(extension);
  });

  it.each(["README", ".env", ""])("finds no extension in %j", (name) => {
    expect(getFileExtension(name)).toBe("");
  });
});

describe("validateUpload", () => {
  const image = (overrides: Partial<{ name: string; size: number; type: string }> = {}) =>
    validateUpload("image", { name: "photo.png", size: 1024, type: "image/png", ...overrides });
  const file = (overrides: Partial<{ name: string; size: number; type: string }> = {}) =>
    validateUpload("file", { name: "notes.md", size: 1024, type: "text/markdown", ...overrides });

  it.each([
    ["photo.png", "image/png", "image/png"],
    ["photo.JPG", "image/jpeg", "image/jpeg"],
    ["photo.jpeg", "image/jpeg", "image/jpeg"],
    ["anim.gif", "image/gif", "image/gif"],
    ["photo.webp", "image/webp", "image/webp"],
    ["logo.svg", "image/svg+xml", "image/svg+xml"],
  ])("accepts the image %s and stores it as %s", (name, type, contentType) => {
    expect(image({ name, type })).toEqual({ success: true, contentType });
  });

  it.each([
    ["doc.pdf", "application/pdf", "application/pdf"],
    ["notes.txt", "text/plain", "text/plain"],
    ["notes.md", "text/markdown", "text/markdown"],
    ["data.json", "application/json", "application/json"],
    ["config.yaml", "text/yaml", "application/x-yaml"],
    ["config.yml", "application/x-yaml", "application/x-yaml"],
    ["feed.xml", "text/xml", "application/xml"],
    ["rows.csv", "text/csv", "text/csv"],
    ["config.toml", "application/toml", "application/toml"],
    ["settings.ini", "text/plain", "text/plain"],
  ])("accepts the file %s reported as %s and stores it as %s", (name, type, contentType) => {
    expect(file({ name, type })).toEqual({ success: true, contentType });
  });

  it.each(["", "application/octet-stream", "APPLICATION/OCTET-STREAM"])(
    "lets the extension decide when the browser reports %j",
    (type) => {
      expect(file({ name: "config.toml", type })).toEqual({
        success: true,
        contentType: "application/toml",
      });
    },
  );

  it("compares the reported type case-insensitively", () => {
    expect(image({ type: "IMAGE/PNG" })).toEqual({ success: true, contentType: "image/png" });
  });

  it("refuses an extension the type doesn't accept, listing the ones it does", () => {
    expect(image({ name: "script.sh", type: "" })).toEqual({ success: false, error: IMAGE_EXTENSIONS });
    expect(file({ name: "photo.png", type: "image/png" })).toEqual({
      success: false,
      error: FILE_EXTENSIONS,
    });
  });

  it("refuses a file with no extension", () => {
    expect(file({ name: "Makefile", type: "text/plain" })).toEqual({
      success: false,
      error: FILE_EXTENSIONS,
    });
  });

  it("refuses a reported type that doesn't match the extension", () => {
    expect(image({ name: "photo.png", type: "application/pdf" })).toEqual({
      success: false,
      error: MISMATCH,
    });
    // A real type, just for a different extension.
    expect(image({ name: "photo.png", type: "image/jpeg" })).toEqual({ success: false, error: MISMATCH });
  });

  it("refuses an empty file", () => {
    expect(file({ size: 0 })).toEqual({ success: false, error: "This file is empty." });
  });

  it("accepts an image of exactly 5 MB and refuses one byte more", () => {
    expect(image({ size: 5 * MB }).success).toBe(true);
    expect(image({ size: 5 * MB + 1 })).toEqual({ success: false, error: "Images can be up to 5 MB." });
  });

  it("accepts a file of exactly 10 MB and refuses one byte more", () => {
    expect(file({ size: 10 * MB }).success).toBe(true);
    expect(file({ size: 10 * MB + 1 })).toEqual({ success: false, error: "Files can be up to 10 MB." });
  });

  it("allows a file name of 255 characters and refuses a longer one", () => {
    expect(file({ name: `${"a".repeat(252)}.md` }).success).toBe(true);
    expect(file({ name: `${"a".repeat(253)}.md` })).toEqual({
      success: false,
      error: "File names can be up to 255 characters.",
    });
  });
});

describe("MAX_UPLOAD_BYTES", () => {
  it("is the largest type limit, the file type's 10 MB", () => {
    expect(MAX_UPLOAD_BYTES).toBe(10 * MB);
  });
});

describe("getUploadAccept", () => {
  it("lists each accepted extension for the file input", () => {
    expect(getUploadAccept("image")).toBe(".png,.jpg,.jpeg,.gif,.webp,.svg");
    expect(getUploadAccept("file")).toBe(".pdf,.txt,.md,.json,.yaml,.yml,.xml,.csv,.toml,.ini");
  });
});

describe("getContentTypeForFileName", () => {
  it.each([
    ["photo.PNG", "image/png"],
    ["logo.svg", "image/svg+xml"],
    ["Release Notes (v2).pdf", "application/pdf"],
    ["config.yml", "application/x-yaml"],
    ["settings.ini", "text/plain"],
  ])("serves %s as %s", (name, contentType) => {
    expect(getContentTypeForFileName(name)).toBe(contentType);
  });

  it.each(["page.html", "script.js", "README", "x.constructor", "x.__proto__"])(
    "serves the unrecognized %s as a binary download",
    (name) => {
      expect(getContentTypeForFileName(name)).toBe("application/octet-stream");
    },
  );
});

describe("isImageFileName", () => {
  it.each(["photo.png", "photo.JPEG", "logo.svg"])("treats %s as an image", (name) => {
    expect(isImageFileName(name)).toBe(true);
  });

  it.each(["doc.pdf", "notes.md", "png", "photo.png.html"])("doesn't treat %s as an image", (name) => {
    expect(isImageFileName(name)).toBe(false);
  });
});

describe("sanitizeFileName", () => {
  it("keeps letters, digits, dots, underscores and dashes", () => {
    expect(sanitizeFileName("my_file-v1.2.png")).toBe("my_file-v1.2.png");
  });

  it("replaces runs of anything else with a single dash", () => {
    expect(sanitizeFileName("Release Notes (v2).md")).toBe("Release-Notes-v2-.md");
    expect(sanitizeFileName("a  /  b.txt")).toBe("a-b.txt");
  });

  it("strips accents and drops characters with no ASCII form", () => {
    expect(sanitizeFileName("café résumé.pdf")).toBe("cafe-resume.pdf");
    // The dashes left behind are leading, so they go too.
    expect(sanitizeFileName("日本語.txt")).toBe("txt");
  });

  it("removes leading dots and dashes, so a path or dotfile can't come through", () => {
    expect(sanitizeFileName("../../etc/passwd")).toBe("etc-passwd");
    expect(sanitizeFileName(".env")).toBe("env");
  });

  it("caps the name at 100 characters, keeping the end with the extension", () => {
    const safe = sanitizeFileName(`${"a".repeat(150)}.json`);

    expect(safe).toHaveLength(100);
    expect(safe.endsWith(".json")).toBe(true);
  });

  it("falls back to 'file' when nothing usable is left", () => {
    expect(sanitizeFileName("...")).toBe("file");
    expect(sanitizeFileName("")).toBe("file");
  });
});

describe("buildFileKey", () => {
  it("stores the upload under its owner, then the upload id and a safe name", () => {
    expect(buildFileKey("user-1", "8f14e45f", "Release Notes (v2).pdf")).toBe(
      "user-1/8f14e45f-Release-Notes-v2-.pdf",
    );
  });

  it("can't leave the owner's folder, whatever the name", () => {
    expect(buildFileKey("user-1", "id", "../../user-2/x.png")).toBe("user-1/id-user-2-x.png");
  });
});

describe("contentDisposition", () => {
  it("names a plain ASCII file the same way in both forms", () => {
    expect(contentDisposition("attachment", "gradient.png")).toBe(
      `attachment; filename="gradient.png"; filename*=UTF-8''gradient.png`,
    );
  });

  it("percent-encodes the UTF-8 name, including ' ( ) * which encodeURIComponent leaves", () => {
    expect(contentDisposition("inline", "Bob's notes (v2)*.md")).toBe(
      `inline; filename="Bob's notes (v2)*.md"; filename*=UTF-8''Bob%27s%20notes%20%28v2%29%2A.md`,
    );
  });

  it("replaces non-ASCII characters, quotes and backslashes in the fallback", () => {
    expect(contentDisposition("attachment", 'résumé "final"\\.pdf')).toBe(
      `attachment; filename="r_sum_ _final__.pdf"; filename*=UTF-8''r%C3%A9sum%C3%A9%20%22final%22%5C.pdf`,
    );
  });

  it("keeps a header-breaking newline out of the header", () => {
    const header = contentDisposition("attachment", "a\r\nSet-Cookie: x=1.txt");

    expect(header).not.toMatch(/[\r\n]/);
  });
});

describe("getItemFileUrl", () => {
  it("points at the download proxy, with ?download=1 to force a save", () => {
    expect(getItemFileUrl("cmitem1")).toBe("/api/items/cmitem1/file");
    expect(getItemFileUrl("cmitem1", true)).toBe("/api/items/cmitem1/file?download=1");
  });
});
