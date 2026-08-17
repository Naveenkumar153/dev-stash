// Mock data for dashboard UI. Single source of truth until a database is wired up.

export type ContentType = "text" | "url" | "file";

export interface User {
  id: string;
  name: string;
  email: string;
  image?: string;
  isPro: boolean;
}

export interface ItemType {
  id: string;
  name: string;
  icon: string; // lucide-react icon name
  color: string;
  isSystem: boolean;
}

export interface Collection {
  id: string;
  name: string;
  description?: string;
  isFavorite: boolean;
  itemCount: number;
  createdAt: string;
}

export interface Item {
  id: string;
  title: string;
  contentType: ContentType;
  content?: string;
  url?: string;
  fileUrl?: string;
  fileName?: string;
  fileSize?: number;
  description?: string;
  isFavorite: boolean;
  isPinned: boolean;
  language?: string;
  tags: string[];
  itemTypeId: string;
  collectionIds: string[];
  createdAt: string;
}

export const currentUser: User = {
  id: "user-1",
  name: "John Doe",
  email: "john@example.com",
  isPro: false,
};

export const itemTypes: ItemType[] = [
  { id: "type-snippet", name: "Snippet", icon: "Code", color: "#3b82f6", isSystem: true },
  { id: "type-prompt", name: "Prompt", icon: "Sparkles", color: "#8b5cf6", isSystem: true },
  { id: "type-command", name: "Command", icon: "Terminal", color: "#f97316", isSystem: true },
  { id: "type-note", name: "Note", icon: "StickyNote", color: "#fde047", isSystem: true },
  { id: "type-file", name: "File", icon: "File", color: "#6b7280", isSystem: true },
  { id: "type-image", name: "Image", icon: "Image", color: "#ec4899", isSystem: true },
  { id: "type-link", name: "Link", icon: "Link", color: "#10b981", isSystem: true },
];

export const collections: Collection[] = [
  {
    id: "collection-react-patterns",
    name: "React Patterns",
    description: "Common React patterns and hooks",
    isFavorite: true,
    itemCount: 12,
    createdAt: "2026-01-02",
  },
  {
    id: "collection-python-snippets",
    name: "Python Snippets",
    description: "Useful Python code snippets",
    isFavorite: false,
    itemCount: 8,
    createdAt: "2026-01-03",
  },
  {
    id: "collection-context-files",
    name: "Context Files",
    description: "AI context files for projects",
    isFavorite: true,
    itemCount: 5,
    createdAt: "2026-01-04",
  },
  {
    id: "collection-interview-prep",
    name: "Interview Prep",
    description: "Technical interview preparation",
    isFavorite: false,
    itemCount: 24,
    createdAt: "2026-01-05",
  },
  {
    id: "collection-git-commands",
    name: "Git Commands",
    description: "Frequently used git commands",
    isFavorite: true,
    itemCount: 15,
    createdAt: "2026-01-06",
  },
  {
    id: "collection-ai-prompts",
    name: "AI Prompts",
    description: "Curated AI prompts for coding",
    isFavorite: false,
    itemCount: 18,
    createdAt: "2026-01-07",
  },
];

export const items: Item[] = [
  {
    id: "item-1",
    title: "useAuth Hook",
    contentType: "text",
    content: "export function useAuth() {\n  // ...\n}",
    description: "Custom authentication hook for React applications",
    isFavorite: true,
    isPinned: true,
    language: "typescript",
    tags: ["react", "auth", "hooks"],
    itemTypeId: "type-snippet",
    collectionIds: ["collection-react-patterns"],
    createdAt: "2026-01-15",
  },
  {
    id: "item-2",
    title: "API Error Handling Pattern",
    contentType: "text",
    content: "async function fetchWithRetry(url: string) {\n  // ...\n}",
    description: "Fetch wrapper with exponential backoff retry logic",
    isFavorite: false,
    isPinned: true,
    language: "typescript",
    tags: ["api", "error-handling"],
    itemTypeId: "type-snippet",
    collectionIds: ["collection-react-patterns", "collection-interview-prep"],
    createdAt: "2026-01-12",
  },
  {
    id: "item-3",
    title: "Undo Last Commit",
    contentType: "text",
    content: "git reset --soft HEAD~1",
    description: "Undo the last commit but keep the changes staged",
    isFavorite: false,
    isPinned: false,
    tags: ["git"],
    itemTypeId: "type-command",
    collectionIds: ["collection-git-commands"],
    createdAt: "2026-01-10",
  },
  {
    id: "item-4",
    title: "Explain This Code",
    contentType: "text",
    content: "Explain what the following code does, step by step:\n\n{code}",
    description: "Prompt for getting a plain-language code walkthrough",
    isFavorite: true,
    isPinned: false,
    tags: ["ai", "explain"],
    itemTypeId: "type-prompt",
    collectionIds: ["collection-ai-prompts"],
    createdAt: "2026-01-09",
  },
  {
    id: "item-5",
    title: "List Comprehension Cheatsheet",
    contentType: "text",
    content: "squares = [x**2 for x in range(10)]",
    description: "Quick reference for Python list comprehensions",
    isFavorite: false,
    isPinned: false,
    language: "python",
    tags: ["python"],
    itemTypeId: "type-snippet",
    collectionIds: ["collection-python-snippets"],
    createdAt: "2026-01-08",
  },
  {
    id: "item-6",
    title: "Big O Cheat Sheet",
    contentType: "url",
    url: "https://www.bigocheatsheet.com",
    description: "Reference for time and space complexity of algorithms",
    isFavorite: false,
    isPinned: false,
    tags: ["algorithms", "reference"],
    itemTypeId: "type-link",
    collectionIds: ["collection-interview-prep"],
    createdAt: "2026-01-07",
  },
  {
    id: "item-7",
    title: "Sprint Retro Notes",
    contentType: "text",
    content: "- Ship the drawer UI\n- Investigate flaky tests",
    description: "Notes from the last sprint retrospective",
    isFavorite: false,
    isPinned: false,
    tags: ["notes"],
    itemTypeId: "type-note",
    collectionIds: [],
    createdAt: "2026-01-06",
  },
  {
    id: "item-8",
    title: "Project System Prompt",
    contentType: "file",
    fileUrl: "https://example-r2.dev/context/system-prompt.md",
    fileName: "system-prompt.md",
    fileSize: 4096,
    description: "System prompt used for the AI context of this project",
    isFavorite: false,
    isPinned: false,
    tags: ["ai", "context"],
    itemTypeId: "type-file",
    collectionIds: ["collection-context-files"],
    createdAt: "2026-01-05",
  },
];
