"use client";

import { useEffect, useRef, type ComponentType, type SVGProps } from "react";
import { AppWindow, Bookmark, FileText, SquareTerminal } from "lucide-react";

import { GitHubMark, NotionMark, SlackMark, VsCodeMark } from "@/components/brand/BrandIcons";
import {
  advanceChaos,
  createChaosBodies,
  getChaosTransform,
  getFrameSteps,
  keepInside,
  type ChaosBody,
  type Point,
  type Size,
} from "@/lib/chaos-physics";
import { cn } from "@/lib/utils";

type ChaosItem = {
  /** Where the item sits before the animation takes over (and without JS). */
  initialClass: string;
} & (
  | { kind: "icon"; name: string; Icon: ComponentType<SVGProps<SVGSVGElement>> }
  | { kind: "label"; text: string }
);

const CHAOS_ITEMS: readonly ChaosItem[] = [
  { kind: "icon", name: "Notion", Icon: NotionMark, initialClass: "[transform:translate(18px,26px)_rotate(-8deg)]" },
  { kind: "icon", name: "GitHub", Icon: GitHubMark, initialClass: "[transform:translate(150px,40px)_rotate(6deg)]" },
  { kind: "icon", name: "Slack", Icon: SlackMark, initialClass: "[transform:translate(280px,22px)_rotate(12deg)]" },
  { kind: "icon", name: "VS Code", Icon: VsCodeMark, initialClass: "[transform:translate(60px,130px)_rotate(-14deg)]" },
  { kind: "icon", name: "Browser tabs", Icon: AppWindow, initialClass: "[transform:translate(210px,140px)_rotate(9deg)]" },
  { kind: "icon", name: "Terminal", Icon: SquareTerminal, initialClass: "[transform:translate(320px,160px)_rotate(-6deg)]" },
  { kind: "icon", name: "Text file", Icon: FileText, initialClass: "[transform:translate(30px,240px)_rotate(10deg)]" },
  { kind: "icon", name: "Bookmarks", Icon: Bookmark, initialClass: "[transform:translate(180px,246px)_rotate(-12deg)]" },
  { kind: "label", text: "untitled-3.txt", initialClass: "[transform:translate(110px,104px)_rotate(-4deg)]" },
  { kind: "label", text: "Bookmarks (347)", initialClass: "[transform:translate(250px,96px)_rotate(5deg)]" },
  { kind: "label", text: "final_v2_REAL.md", initialClass: "[transform:translate(250px,260px)_rotate(-3deg)]" },
];

const ITEM_BASE_CLASS = "absolute top-0 left-0 will-change-transform";

/**
 * The hero's "Your knowledge today..." box: tool icons and stray file names that
 * drift, bounce and flee the cursor. Physics lives in `@/lib/chaos-physics`;
 * this only measures, ticks and writes each item's transform. The loop pauses
 * while the box is off screen, the tab is hidden or reduced motion is on.
 */
export function ChaosIcons() {
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const box = boxRef.current;
    if (!box) return;

    const elements = Array.from(box.children) as HTMLElement[];
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const bounds: Size = { width: 0, height: 0 };
    // Laid out on the first real measurement, not on mount: the box can still
    // be 0px wide here, which would pile every item at the left edge.
    let bodies: ChaosBody[] = [];

    let pointer: Point | null = null;
    let frame = 0;
    let lastTime = 0;
    let inView = true;

    const render = (time: number) => {
      bodies.forEach((body, i) => {
        elements[i].style.transform = getChaosTransform(body, time);
      });
    };

    const tick = (time: number) => {
      advanceChaos(bodies, getFrameSteps(time, lastTime), pointer, bounds);
      lastTime = time;
      render(time);
      frame = requestAnimationFrame(tick);
    };

    const start = () => {
      if (frame || !bodies.length || reducedMotion.matches || !inView || document.hidden) return;
      lastTime = 0;
      frame = requestAnimationFrame(tick);
    };

    const stop = () => {
      cancelAnimationFrame(frame);
      frame = 0;
    };

    const onPointerMove = (event: PointerEvent) => {
      const rect = box.getBoundingClientRect();
      pointer = { x: event.clientX - rect.left, y: event.clientY - rect.top };
    };
    const onPointerLeave = () => {
      pointer = null;
    };
    const onVisibilityChange = () => (document.hidden ? stop() : start());
    const onMotionChange = () => {
      if (reducedMotion.matches) {
        stop();
        render(0);
      } else {
        start();
      }
    };

    const resizeObserver = new ResizeObserver(() => {
      bounds.width = box.clientWidth;
      bounds.height = box.clientHeight;
      if (!bounds.width || !bounds.height) return;

      if (bodies.length) {
        bodies.forEach((body) => keepInside(body, bounds));
      } else {
        bodies = createChaosBodies(
          elements.map((element, i) => ({
            width: element.offsetWidth,
            height: element.offsetHeight,
            isLabel: CHAOS_ITEMS[i]?.kind === "label",
          })),
          bounds,
        );
        start();
      }
      if (!frame) render(0);
    });
    const intersectionObserver = new IntersectionObserver(([entry]) => {
      inView = entry.isIntersecting;
      if (inView) start();
      else stop();
    });

    box.addEventListener("pointermove", onPointerMove);
    box.addEventListener("pointerleave", onPointerLeave);
    document.addEventListener("visibilitychange", onVisibilityChange);
    reducedMotion.addEventListener("change", onMotionChange);
    resizeObserver.observe(box);
    intersectionObserver.observe(box);

    return () => {
      stop();
      box.removeEventListener("pointermove", onPointerMove);
      box.removeEventListener("pointerleave", onPointerLeave);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      reducedMotion.removeEventListener("change", onMotionChange);
      resizeObserver.disconnect();
      intersectionObserver.disconnect();
    };
  }, []);

  return (
    <div
      ref={boxRef}
      role="img"
      aria-label="Scattered tools: Notion, GitHub, Slack, VS Code, browser tabs, terminal, text files and bookmarks"
      className="relative h-75 overflow-hidden rounded-xl border bg-card bg-[radial-gradient(circle_at_30%_20%,rgb(236_72_153/0.05),transparent_60%)] sm:h-80"
    >
      {CHAOS_ITEMS.map((item) =>
        item.kind === "icon" ? (
          <span
            key={item.name}
            title={item.name}
            className={cn(
              ITEM_BASE_CLASS,
              "grid size-14 place-items-center rounded-xl border bg-muted text-muted-foreground transition-colors hover:border-ring hover:text-foreground",
              item.initialClass,
            )}
          >
            <item.Icon aria-hidden className="size-7" />
          </span>
        ) : (
          <span
            key={item.text}
            aria-hidden
            className={cn(
              ITEM_BASE_CLASS,
              "rounded-md border border-dashed bg-muted/80 px-2 py-1 font-mono text-[11px] whitespace-nowrap text-muted-foreground/70",
              item.initialClass,
            )}
          >
            {item.text}
          </span>
        ),
      )}
    </div>
  );
}
