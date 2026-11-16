import type { SVGProps } from "react";

/**
 * Third-party brand marks. Lucide dropped its brand icons, so these are inlined
 * rather than loaded from elsewhere. Notion, Slack and VS Code are simplified
 * outlines, enough to be recognized on the homepage.
 */
type IconProps = SVGProps<SVGSVGElement>;

const STROKE_PROPS = {
  fill: "none",
  stroke: "currentColor",
  strokeLinecap: "round",
  strokeLinejoin: "round",
} as const;

export function GitHubMark(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden fill="currentColor" {...props}>
      <path d="M12 .5C5.65.5.5 5.65.5 12a11.5 11.5 0 0 0 7.86 10.92c.58.1.79-.25.79-.56v-2c-3.2.7-3.87-1.37-3.87-1.37-.53-1.33-1.28-1.69-1.28-1.69-1.05-.71.08-.7.08-.7 1.16.08 1.77 1.19 1.77 1.19 1.03 1.77 2.7 1.26 3.36.96.1-.75.4-1.26.73-1.55-2.55-.29-5.24-1.28-5.24-5.68 0-1.26.45-2.28 1.19-3.09-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.17 1.18a11 11 0 0 1 5.77 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.59.23 2.76.11 3.05.74.81 1.19 1.83 1.19 3.09 0 4.41-2.69 5.38-5.26 5.67.41.36.78 1.06.78 2.14v3.17c0 .31.21.67.8.56A11.5 11.5 0 0 0 23.5 12C23.5 5.65 18.35.5 12 .5Z" />
    </svg>
  );
}

export function NotionMark(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden strokeWidth={1.6} {...STROKE_PROPS} {...props}>
      <rect x="3.5" y="3.5" width="17" height="17" rx="3" />
      <path d="M9 16.5V8l6 8.5V8" />
    </svg>
  );
}

export function SlackMark(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden strokeWidth={2.6} {...STROKE_PROPS} {...props}>
      <path d="M9.5 3.5v7.5M14.5 13v7.5M3.5 14.5H11M13 9.5h7.5" />
    </svg>
  );
}

export function VsCodeMark(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden strokeWidth={1.6} {...STROKE_PROPS} {...props}>
      <path d="M17 3.5 20.5 5.2v13.6L17 20.5" />
      <path d="M17 3.5v17" />
      <path d="M17 3.5 6.5 13 3.5 10.6" />
      <path d="M17 20.5 6.5 11 3.5 13.4" />
    </svg>
  );
}
