/**
 * Physics for the homepage hero's floating "chaos" items: they drift, bounce off
 * the walls and each other, and get pushed away from the cursor. Pure functions
 * over plain objects, so the animation loop in `ChaosIcons` only reads layout,
 * calls these and writes transforms. Speeds are in px per 60fps frame; `dt` is
 * the number of such frames since the last tick.
 *
 * Bodies are updated in place - the loop runs every frame, so it doesn't
 * allocate new objects for each one.
 */

export interface Size {
  width: number;
  height: number;
}

export interface Point {
  x: number;
  y: number;
}

export interface ChaosBodySeed extends Size {
  /** Text labels tilt and swing less than the icons. */
  isLabel: boolean;
}

export interface ChaosBody {
  w: number;
  h: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** Resting rotation, in degrees. */
  tilt: number;
  /** How far the rotation swings either side of `tilt`, in degrees. */
  swing: number;
  phase: number;
  wobble: number;
}

export const CHAOS_PHYSICS = {
  cruiseSpeed: 0.55,
  maxSpeed: 2.5,
  repelRadius: 120,
  repelForce: 0.35,
  friction: 0.95,
  /** Space kept between two bodies when they collide. */
  gap: 6,
  /** Cap on `dt`, so a stalled frame doesn't teleport the items. */
  maxFrameSteps: 3,
  /** The starting layout's grid. */
  columns: 4,
  rows: 3,
} as const;

const MAX_TILT = 14;
const LABEL_TILT_SCALE = 0.4;

type Random = () => number;

const between = (random: Random, min: number, max: number) => min + random() * (max - min);

const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(value, max));

/**
 * Spreads the items over a grid with some jitter, each heading in a random
 * direction at cruise speed. Collisions sort out any overlap.
 */
export function createChaosBodies(
  seeds: readonly ChaosBodySeed[],
  bounds: Size,
  random: Random = Math.random,
): ChaosBody[] {
  const cellW = bounds.width / CHAOS_PHYSICS.columns;
  const cellH = bounds.height / CHAOS_PHYSICS.rows;

  return seeds.map(({ width: w, height: h, isLabel }, i) => {
    const x = (i % CHAOS_PHYSICS.columns) * cellW + between(random, 0, Math.max(0, cellW - w));
    const y =
      Math.floor(i / CHAOS_PHYSICS.columns) * cellH + between(random, 0, Math.max(0, cellH - h));
    const angle = between(random, 0, Math.PI * 2);

    return {
      w,
      h,
      x: clamp(x, 0, Math.max(0, bounds.width - w)),
      y: clamp(y, 0, Math.max(0, bounds.height - h)),
      vx: Math.cos(angle) * CHAOS_PHYSICS.cruiseSpeed,
      vy: Math.sin(angle) * CHAOS_PHYSICS.cruiseSpeed,
      tilt: between(random, -MAX_TILT, MAX_TILT) * (isLabel ? LABEL_TILT_SCALE : 1),
      swing: isLabel ? 4 : 10,
      phase: between(random, 0, Math.PI * 2),
      wobble: between(random, 0.6, 1.2),
    };
  });
}

/** Frames elapsed since the last tick, capped; 1 on the first tick. */
export function getFrameSteps(time: number, lastTime: number): number {
  if (!lastTime) return 1;
  return Math.min((time - lastTime) / (1000 / 60), CHAOS_PHYSICS.maxFrameSteps);
}

/** Keeps a body inside the box, turning it around when it hits a wall. */
export function keepInside(body: ChaosBody, bounds: Size): void {
  const maxX = Math.max(0, bounds.width - body.w);
  const maxY = Math.max(0, bounds.height - body.h);

  if (body.x < 0) {
    body.x = 0;
    body.vx = Math.abs(body.vx);
  } else if (body.x > maxX) {
    body.x = maxX;
    body.vx = -Math.abs(body.vx);
  }

  if (body.y < 0) {
    body.y = 0;
    body.vy = Math.abs(body.vy);
  } else if (body.y > maxY) {
    body.y = maxY;
    body.vy = -Math.abs(body.vy);
  }
}

/** Pushes a body away from the pointer, harder the closer it is. */
export function repelFromPointer(body: ChaosBody, pointer: Point | null, dt: number): void {
  if (!pointer) return;

  const dx = body.x + body.w / 2 - pointer.x;
  const dy = body.y + body.h / 2 - pointer.y;
  const dist = Math.hypot(dx, dy);
  if (dist === 0 || dist >= CHAOS_PHYSICS.repelRadius) return;

  const push = (1 - dist / CHAOS_PHYSICS.repelRadius) * CHAOS_PHYSICS.repelForce * dt;
  body.vx += (dx / dist) * push;
  body.vy += (dy / dist) * push;
}

/**
 * Bleeds off speed gained from a push, never dropping below cruise speed (so the
 * items keep drifting) and never above the maximum.
 */
export function settleSpeed(body: ChaosBody, dt: number): void {
  const speed = Math.hypot(body.vx, body.vy);
  if (speed <= CHAOS_PHYSICS.cruiseSpeed) return;

  const damped = Math.max(
    CHAOS_PHYSICS.cruiseSpeed,
    speed * Math.pow(CHAOS_PHYSICS.friction, dt),
  );
  const target = Math.min(damped, CHAOS_PHYSICS.maxSpeed);
  body.vx *= target / speed;
  body.vy *= target / speed;
}

/**
 * Box-to-box collision: pushes an overlapping pair apart along the axis they
 * overlap least on, and swaps their speeds on that axis if they are closing
 * (an equal-mass bounce).
 */
export function collideBodies(a: ChaosBody, b: ChaosBody): void {
  const dx = b.x + b.w / 2 - (a.x + a.w / 2);
  const dy = b.y + b.h / 2 - (a.y + a.h / 2);
  const overlapX = (a.w + b.w) / 2 + CHAOS_PHYSICS.gap - Math.abs(dx);
  const overlapY = (a.h + b.h) / 2 + CHAOS_PHYSICS.gap - Math.abs(dy);
  if (overlapX <= 0 || overlapY <= 0) return;

  if (overlapX < overlapY) {
    const dir = dx < 0 ? -1 : 1;
    a.x -= (dir * overlapX) / 2;
    b.x += (dir * overlapX) / 2;
    if ((a.vx - b.vx) * dir > 0) [a.vx, b.vx] = [b.vx, a.vx];
  } else {
    const dir = dy < 0 ? -1 : 1;
    a.y -= (dir * overlapY) / 2;
    b.y += (dir * overlapY) / 2;
    if ((a.vy - b.vy) * dir > 0) [a.vy, b.vy] = [b.vy, a.vy];
  }
}

/** Advances every body by `dt` frames: forces, movement, collisions, walls. */
export function advanceChaos(
  bodies: ChaosBody[],
  dt: number,
  pointer: Point | null,
  bounds: Size,
): void {
  for (const body of bodies) {
    repelFromPointer(body, pointer, dt);
    settleSpeed(body, dt);
    body.x += body.vx * dt;
    body.y += body.vy * dt;
    keepInside(body, bounds);
  }

  for (let i = 0; i < bodies.length; i++) {
    for (let j = i + 1; j < bodies.length; j++) collideBodies(bodies[i], bodies[j]);
  }

  for (const body of bodies) keepInside(body, bounds);
}

/** CSS transform for a body at `time` ms: position plus a gentle rotation and pulse. */
export function getChaosTransform(body: ChaosBody, time: number): string {
  const seconds = time / 1000;
  const rotate = body.tilt + Math.sin(seconds * body.wobble + body.phase) * body.swing;
  const scale = 1 + Math.sin(seconds * body.wobble * 1.6 + body.phase) * 0.07;

  return (
    `translate(${body.x.toFixed(1)}px, ${body.y.toFixed(1)}px) ` +
    `rotate(${rotate.toFixed(2)}deg) scale(${scale.toFixed(3)})`
  );
}
