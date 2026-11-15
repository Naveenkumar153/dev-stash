import { describe, expect, it } from "vitest";

import { errorResponse } from "@/lib/api-response";

describe("errorResponse", () => {
  it("replies with the error in the { success, data, error } shape and the status", async () => {
    const response = errorResponse("This item doesn't exist or has been deleted.", 404);

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({
      success: false,
      data: null,
      error: "This item doesn't exist or has been deleted.",
    });
  });

  it("adds field errors and headers when given", async () => {
    const response = errorResponse("Choose a file to upload.", 400, {
      fieldErrors: { file: "Choose a file to upload." },
      headers: { "Retry-After": "60" },
    });

    expect(response.headers.get("Retry-After")).toBe("60");
    expect(await response.json()).toEqual({
      success: false,
      data: null,
      error: "Choose a file to upload.",
      fieldErrors: { file: "Choose a file to upload." },
    });
  });
});
