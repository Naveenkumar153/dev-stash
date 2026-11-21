/** Result of the `generateAutoTags` server action: the suggested tags, or why there are none. */
export interface GenerateAutoTagsResult {
  success: boolean;
  data: { tags: string[] } | null;
  error: string | null;
}
