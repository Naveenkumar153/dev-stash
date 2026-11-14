import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";

const REMARK_PLUGINS = [remarkGfm];

/**
 * Links leave the app in a new tab; in-page anchors such as footnotes stay put.
 * react-markdown's default `urlTransform` empties unsafe URLs such as
 * `javascript:`, and those render as plain text with no `href`.
 */
const COMPONENTS: Components = {
  // `node` is react-markdown's syntax tree node, pulled out so it isn't put on the DOM.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  a: ({ node, href, children, ...props }) => {
    if (!href) return <a {...props}>{children}</a>;

    const external = !href.startsWith("#");

    return (
      <a
        href={href}
        {...(external && { target: "_blank", rel: "noopener noreferrer" })}
        {...props}
      >
        {children}
      </a>
    );
  },
};

/**
 * Renders GitHub Flavored Markdown (tables, task lists, strikethrough,
 * autolinks). Raw HTML in the source is shown as text, never rendered.
 * Styled by the `.markdown-preview` class on the container.
 */
export function MarkdownPreview({ value }: Readonly<{ value: string }>) {
  return (
    <ReactMarkdown remarkPlugins={REMARK_PLUGINS} components={COMPONENTS}>
      {value}
    </ReactMarkdown>
  );
}
