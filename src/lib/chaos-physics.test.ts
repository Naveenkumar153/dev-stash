import { describe, expect, it } from "vitest";

import {
  advanceChaos,
  CHAOS_PHYSICS,
  collideBodies,
  createChaosBodies,
  getChaosTransform,
  getFrameSteps,
  keepInside,
  repelFromPointer,
  settleSpeed,
  type ChaosBody,
} from "@/lib/chaos-physics";

const BOUNDS = { width: 400, height: 300 };

function body(overrides: Partial<ChaosBody> = {}): ChaosBody {
  return {
    w: 50,
    h: 50,
    x: 100,
    y: 100,
    vx: 0,
    vy: 0,
    tilt: 0,
    swing: 10,
    phase: 0,
    wobble: 1,
    ...overrides,
  };
}

const speed = (b: ChaosBody) => Math.hypot(b.vx, b.vy);

describe("createChaosBodies", () => {
  const seeds = Array.from({ length: 11 }, (_, i) => ({
    width: 56,
    height: 56,
    isLabel: i >= 8,
  }));

  it("places every body inside the box at cruise speed", () => {
    const bodies = createChaosBodies(seeds, BOUNDS);
    for (const b of bodies) {
      expect(b.x).toBeGreaterThanOrEqual(0);
      expect(b.y).toBeGreaterThanOrEqual(0);
      expect(b.x).toBeLessThanOrEqual(BOUNDS.width - b.w);
      expect(b.y).toBeLessThanOrEqual(BOUNDS.height - b.h);
      expect(speed(b)).toBeCloseTo(CHAOS_PHYSICS.cruiseSpeed);
    }
  });

  it("tilts and swings labels less than icons", () => {
    const bodies = createChaosBodies(seeds, BOUNDS, () => 1);
    expect(bodies[0]).toMatchObject({ tilt: 14, swing: 10 });
    expect(bodies[8].tilt).toBeCloseTo(5.6);
    expect(bodies[8].swing).toBe(4);
  });

  it("spreads bodies over the grid's cells", () => {
    const bodies = createChaosBodies(seeds, BOUNDS, () => 0);
    expect(bodies.slice(0, 5).map((b) => [b.x, b.y])).toEqual([
      [0, 0],
      [100, 0],
      [200, 0],
      [300, 0],
      [0, 100],
    ]);
  });

  it("keeps a body larger than the box at the origin", () => {
    const [b] = createChaosBodies([{ width: 500, height: 400, isLabel: false }], BOUNDS, () => 0.5);
    expect([b.x, b.y]).toEqual([0, 0]);
  });
});

describe("getFrameSteps", () => {
  it("counts one frame on the first tick", () => {
    expect(getFrameSteps(1234, 0)).toBe(1);
  });

  it("converts elapsed time to 60fps frames", () => {
    expect(getFrameSteps(1000 + 1000 / 30, 1000)).toBeCloseTo(2);
  });

  it("caps a long stall", () => {
    expect(getFrameSteps(5000, 1000)).toBe(CHAOS_PHYSICS.maxFrameSteps);
  });
});

describe("keepInside", () => {
  it("clamps to the left and top walls and turns the body around", () => {
    const b = body({ x: -5, y: -5, vx: -1, vy: -1 });
    keepInside(b, BOUNDS);
    expect(b).toMatchObject({ x: 0, y: 0, vx: 1, vy: 1 });
  });

  it("clamps to the right and bottom walls and turns the body around", () => {
    const b = body({ x: 390, y: 290, vx: 1, vy: 1 });
    keepInside(b, BOUNDS);
    expect(b).toMatchObject({ x: 350, y: 250, vx: -1, vy: -1 });
  });

  it("leaves a body inside the box alone", () => {
    const b = body({ vx: 1, vy: -1 });
    keepInside(b, BOUNDS);
    expect(b).toMatchObject({ x: 100, y: 100, vx: 1, vy: -1 });
  });
});

describe("repelFromPointer", () => {
  it("pushes a nearby body away from the pointer", () => {
    const b = body();
    repelFromPointer(b, { x: 100, y: 125 }, 1); // left of the body's center
    expect(b.vx).toBeGreaterThan(0);
    expect(b.vy).toBe(0);
  });

  it("pushes harder the closer the pointer is", () => {
    const near = body();
    const far = body();
    repelFromPointer(near, { x: 115, y: 125 }, 1);
    repelFromPointer(far, { x: 60, y: 125 }, 1);
    expect(near.vx).toBeGreaterThan(far.vx);
  });

  it("ignores a pointer outside the radius, on the center, or absent", () => {
    for (const pointer of [{ x: 125 - CHAOS_PHYSICS.repelRadius, y: 125 }, { x: 125, y: 125 }, null]) {
      const b = body();
      repelFromPointer(b, pointer, 1);
      expect([b.vx, b.vy]).toEqual([0, 0]);
    }
  });
});

describe("settleSpeed", () => {
  it("leaves a body at or below cruise speed alone", () => {
    const b = body({ vx: CHAOS_PHYSICS.cruiseSpeed });
    settleSpeed(b, 1);
    expect(b.vx).toBe(CHAOS_PHYSICS.cruiseSpeed);
  });

  it("slows a pushed body without dropping below cruise speed", () => {
    const b = body({ vx: 1 });
    settleSpeed(b, 1);
    expect(b.vx).toBeCloseTo(0.95);

    const slow = body({ vx: 0.56 });
    settleSpeed(slow, 3);
    expect(slow.vx).toBeCloseTo(CHAOS_PHYSICS.cruiseSpeed);
  });

  it("caps the speed, keeping the direction", () => {
    const b = body({ vx: 30, vy: 40 });
    settleSpeed(b, 1);
    expect(speed(b)).toBeCloseTo(CHAOS_PHYSICS.maxSpeed);
    expect(b.vx / b.vy).toBeCloseTo(0.75);
  });
});

describe("collideBodies", () => {
  it("separates an overlapping pair along the shallower axis and swaps closing speeds", () => {
    const a = body({ x: 100, vx: 1 });
    const b = body({ x: 140, vx: -1 });
    collideBodies(a, b);
    // Needed 56px apart (50 + gap 6), were 40: each moves 8px.
    expect([a.x, b.x]).toEqual([92, 148]);
    expect([a.vx, b.vx]).toEqual([-1, 1]);
  });

  it("separates vertically when that overlap is smaller", () => {
    const a = body({ y: 100, vy: 1 });
    const b = body({ x: 110, y: 150, vy: 0 });
    collideBodies(a, b);
    expect([a.y, b.y]).toEqual([97, 153]);
    expect([a.vy, b.vy]).toEqual([0, 1]);
  });

  it("keeps the speeds of a pair already moving apart", () => {
    const a = body({ x: 100, vx: -1 });
    const b = body({ x: 140, vx: 1 });
    collideBodies(a, b);
    expect([a.vx, b.vx]).toEqual([-1, 1]);
  });

  it("ignores bodies further apart than the gap", () => {
    const a = body({ x: 100 });
    const b = body({ x: 157 });
    collideBodies(a, b);
    expect([a.x, b.x]).toEqual([100, 157]);
  });
});

describe("advanceChaos", () => {
  it("moves bodies by their speed and keeps them inside", () => {
    const moving = body({ vx: 0.4, vy: 0.2 }); // under cruise speed, so not damped
    const atWall = body({ x: 349.5, y: 0, vx: 0.5, vy: 0 });
    advanceChaos([moving, atWall], 2, null, BOUNDS);
    expect(moving.x).toBeCloseTo(100.8);
    expect(moving.y).toBeCloseTo(100.4);
    expect(atWall).toMatchObject({ x: 350, vx: -0.5 });
  });

  it("leaves no pair overlapping after a collision", () => {
    const a = body({ x: 100 });
    const b = body({ x: 120 });
    advanceChaos([a, b], 1, null, BOUNDS);
    expect(b.x - a.x).toBeGreaterThanOrEqual(b.w + CHAOS_PHYSICS.gap);
  });
});

describe("getChaosTransform", () => {
  it("writes position, rotation and scale", () => {
    expect(getChaosTransform(body({ x: 12.345, y: 6, tilt: -8 }), 0)).toBe(
      "translate(12.3px, 6.0px) rotate(-8.00deg) scale(1.000)",
    );
  });

  it("swings and pulses over time", () => {
    const quarterTurn = (Math.PI / 2) * 1000; // sin(seconds * wobble) = 1
    expect(getChaosTransform(body({ tilt: 2 }), quarterTurn)).toContain("rotate(12.00deg)");
  });
});
