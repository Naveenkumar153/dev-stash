import {
  Code,
  File,
  FolderOpen,
  Search,
  Sparkles,
  Terminal,
  type LucideIcon,
} from "lucide-react";

import {
  DASHBOARD_PATH,
  REGISTER_PATH,
  SIGN_IN_PATH,
} from "@/lib/auth-redirect";

/**
 * Content and rules for the marketing homepage (`src/app/page.tsx`). Copy lives
 * here as data so each section maps over it instead of repeating markup. No
 * server-only imports: the client islands read it too.
 */

export interface HomeLink {
  label: string;
  href: string;
}

export const FEATURES_ANCHOR = "features";
export const PRICING_ANCHOR = "pricing";

export const SECTION_LINKS: readonly HomeLink[] = [
  { label: "Features", href: `/#${FEATURES_ANCHOR}` },
  { label: "Pricing", href: `/#${PRICING_ANCHOR}` },
];

const DASHBOARD_ACTION: HomeLink = { label: "Go to Dashboard", href: DASHBOARD_PATH };

/**
 * Where a "get started" button leads: registration when signed out, under the
 * button's own label, and the dashboard when signed in.
 */
export function getStartAction(isSignedIn: boolean, signedOutLabel: string): HomeLink {
  return isSignedIn ? DASHBOARD_ACTION : { label: signedOutLabel, href: REGISTER_PATH };
}

export interface FooterColumn {
  title: string;
  links: readonly HomeLink[];
}

/** The footer's link columns. Only pages that exist are linked. */
export function getFooterColumns(isSignedIn: boolean): FooterColumn[] {
  const account: HomeLink[] = isSignedIn
    ? [
        { label: "Dashboard", href: DASHBOARD_PATH },
        { label: "Profile", href: "/profile" },
        { label: "Settings", href: "/settings" },
      ]
    : [
        { label: "Sign In", href: SIGN_IN_PATH },
        { label: "Register", href: REGISTER_PATH },
      ];

  return [
    { title: "Product", links: SECTION_LINKS },
    { title: "Account", links: account },
  ];
}

export interface HomeFeature {
  title: string;
  description: string;
  /** Item type whose color the card takes. */
  typeName: string;
  icon: LucideIcon;
  /** Keyboard shortcut shown after the description. */
  shortcut?: string;
}

export const FEATURES: readonly HomeFeature[] = [
  {
    title: "Code Snippets",
    description:
      "Save reusable code with syntax highlighting, language detection, and instant copy. Never rewrite the same function twice.",
    typeName: "snippet",
    icon: Code,
  },
  {
    title: "AI Prompts",
    description:
      "Store and organize your best prompts for ChatGPT, Claude, and other AI tools. Build a personal prompt library.",
    typeName: "prompt",
    icon: Sparkles,
  },
  {
    title: "Instant Search",
    description:
      "Find anything in milliseconds. Search across all your items by content, tags, titles, or type with",
    typeName: "note",
    icon: Search,
    shortcut: "⌘K",
  },
  {
    title: "Commands",
    description:
      "Keep your most-used terminal commands at your fingertips. No more digging through bash history.",
    typeName: "command",
    icon: Terminal,
  },
  {
    title: "Files & Docs",
    description:
      "Upload and manage files, images, and documents. Keep your project assets organized alongside your code.",
    typeName: "file",
    icon: File,
  },
  {
    title: "Collections",
    description:
      "Group related items into collections. Organize by project, topic, or workflow for quick access.",
    typeName: "link",
    icon: FolderOpen,
  },
];

export const AI_CAPABILITIES: readonly string[] = [
  "Auto-tag suggestions based on content",
  "AI-generated summaries for long snippets",
  '"Explain This Code" one-click breakdowns',
  "Prompt optimizer for better AI results",
];

export const AI_GENERATED_TAGS: readonly string[] = [
  "react",
  "hooks",
  "debounce",
  "typescript",
  "performance",
];

export type CodeTokenKind = "keyword" | "function" | "type";
export type CodeToken = string | { text: string; kind: CodeTokenKind };

const keyword = (text: string): CodeToken => ({ text, kind: "keyword" });
const fn = (text: string): CodeToken => ({ text, kind: "function" });
const type = (text: string): CodeToken => ({ text, kind: "type" });

/** The AI section's editor mockup, one array of tokens per line. */
export const AI_CODE_SAMPLE: readonly (readonly CodeToken[])[] = [
  [keyword("export function"), " ", fn("useDebounce"), "<", type("T"), ">("],
  ["  value: ", type("T"), ","],
  ["  delay: ", type("number")],
  ["): ", type("T"), " {"],
  ["  ", keyword("const"), " [debounced, setDebounced] ="],
  ["    ", fn("useState"), "(value);"],
  [],
  ["  ", fn("useEffect"), "(() => {"],
  ["    ", keyword("const"), " t = ", fn("setTimeout"), "(() =>"],
  ["      ", fn("setDebounced"), "(value), delay);"],
  ["    ", keyword("return"), " () => ", fn("clearTimeout"), "(t);"],
  ["  }, [value, delay]);"],
  [],
  ["  ", keyword("return"), " debounced;"],
  ["}"],
];

export type BillingPeriod = "monthly" | "yearly";

/** Pro's list prices in dollars, per `context/project-overview.md`. */
export const PRO_PRICES = { monthly: 8, yearly: 72 } as const;

function formatDollars(amount: number): string {
  return Number.isInteger(amount) ? `$${amount}` : `$${amount.toFixed(2)}`;
}

/** Pro's per-month amount and billing note for a billing period. */
export function getProPrice(period: BillingPeriod): { amount: string; billed: string } {
  if (period === "yearly") {
    return {
      amount: formatDollars(PRO_PRICES.yearly / 12),
      billed: `billed ${formatDollars(PRO_PRICES.yearly)}/year`,
    };
  }
  return { amount: formatDollars(PRO_PRICES.monthly), billed: "billed monthly" };
}

/** How much yearly billing saves over twelve monthly payments, in whole percent. */
export function getYearlySavingsPercent(): number {
  return Math.round((1 - PRO_PRICES.yearly / (PRO_PRICES.monthly * 12)) * 100);
}

export interface PlanFeature {
  label: string;
  included: boolean;
}

export const FREE_PLAN_FEATURES: readonly PlanFeature[] = [
  { label: "50 items", included: true },
  { label: "3 collections", included: true },
  { label: "Snippets, Prompts, Commands, Notes, Links", included: true },
  { label: "Basic search", included: true },
  { label: "File & image uploads", included: false },
  { label: "AI features", included: false },
];

export const PRO_PLAN_FEATURES: readonly PlanFeature[] = [
  { label: "Unlimited items", included: true },
  { label: "Unlimited collections", included: true },
  { label: "All item types including Files & Images", included: true },
  { label: "AI auto-tagging & summaries", included: true },
  { label: 'AI "Explain This Code"', included: true },
  { label: "Data export (JSON/ZIP)", included: true },
];

/** The hero's dashboard preview: sidebar type rows with made-up counts. */
export const PREVIEW_TYPE_COUNTS: readonly { typeName: string; count: number }[] = [
  { typeName: "snippet", count: 24 },
  { typeName: "prompt", count: 12 },
  { typeName: "command", count: 18 },
  { typeName: "note", count: 9 },
  { typeName: "file", count: 6 },
  { typeName: "image", count: 4 },
  { typeName: "link", count: 15 },
];

export const PREVIEW_COLLECTIONS: readonly { name: string; typeName: string }[] = [
  { name: "React Patterns", typeName: "snippet" },
  { name: "DevOps", typeName: "command" },
];

export interface PreviewCard {
  title: string;
  typeName: string;
  /** A line of code (monospace) or a short description. */
  detail: string;
  isCode: boolean;
  tags: readonly string[];
}

export const PREVIEW_CARDS: readonly PreviewCard[] = [
  {
    title: "useDebounce hook",
    typeName: "snippet",
    detail: "useDebounce(q, 300)",
    isCode: true,
    tags: ["react", "hooks"],
  },
  {
    title: "Code review prompt",
    typeName: "prompt",
    detail: "Review this diff for bugs…",
    isCode: false,
    tags: ["ai", "review"],
  },
  {
    title: "Start containers",
    typeName: "command",
    detail: "docker compose up -d",
    isCode: true,
    tags: ["docker"],
  },
  {
    title: "API auth notes",
    typeName: "note",
    detail: "JWT in httpOnly cookies",
    isCode: false,
    tags: ["auth"],
  },
  {
    title: "hero-banner.png",
    typeName: "image",
    detail: "1920 × 1080 · 248 KB",
    isCode: false,
    tags: ["design"],
  },
  {
    title: "Tailwind v4 docs",
    typeName: "link",
    detail: "tailwindcss.com/docs",
    isCode: false,
    tags: ["css"],
  },
];

/** The query the preview's search demo types out. */
export const PREVIEW_QUERY = "debounce";

/** Whether a preview card matches the demo's query (case-insensitive; blank matches all). */
export function previewCardMatches(card: PreviewCard, query: string): boolean {
  const term = query.trim().toLowerCase();
  if (!term) return true;
  return [card.title, card.detail, ...card.tags].join(" ").toLowerCase().includes(term);
}

/** The preview's count line: "6 items" while blank, "1 result" while searching. */
export function formatPreviewCount(query: string, matches: number, total: number): string {
  if (!query.trim()) return `${total} items`;
  return `${matches} result${matches === 1 ? "" : "s"}`;
}
