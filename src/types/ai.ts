/** Result of the `generateAutoTags` server action: the suggested tags, or why there are none. */
export interface GenerateAutoTagsResult {
  success: boolean;
  data: { tags: string[] } | null;
  error: string | null;
}

/** Result of the `generateDescription` server action: the description, or why there is none. */
export interface GenerateDescriptionResult {
  success: boolean;
  data: { description: string } | null;
  error: string | null;
}
