// DevStash homepage prototype: nav, scroll reveal, pricing toggle, the
// floating "chaos" items in the hero and the dashboard preview's search demo.
(() => {
  "use strict";

  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  /* Footer year */
  for (const el of document.querySelectorAll("[data-year]")) {
    el.textContent = String(new Date().getFullYear());
  }

  /* Navbar: more opaque once the page scrolls */
  const nav = document.querySelector("[data-nav]");
  if (nav) {
    const updateNav = () => nav.classList.toggle("nav--scrolled", window.scrollY > 12);
    updateNav();
    window.addEventListener("scroll", updateNav, { passive: true });
  }

  /* Scroll reveal */
  const revealEls = document.querySelectorAll(".reveal");
  if (!("IntersectionObserver" in window) || reducedMotion.matches) {
    revealEls.forEach((el) => el.classList.add("is-visible"));
  } else {
    const revealObserver = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          entry.target.classList.add("is-visible");
          revealObserver.unobserve(entry.target);
        }
      },
      { threshold: 0.15, rootMargin: "0px 0px -40px 0px" },
    );
    revealEls.forEach((el) => revealObserver.observe(el));
  }

  initPricingToggle();
  initChaos();
  initPreviewSearch();

  /* Pricing: monthly / yearly */
  function initPricingToggle() {
    const toggle = document.querySelector("[data-billing-toggle]");
    const amount = document.querySelector("[data-pro-amount]");
    const billed = document.querySelector("[data-pro-billed]");
    const labels = document.querySelectorAll("[data-billing-label]");
    if (!toggle || !amount || !billed) return;

    const setYearly = (yearly) => {
      toggle.setAttribute("aria-checked", String(yearly));
      amount.textContent = yearly ? "$6" : "$8";
      billed.textContent = yearly ? "billed $72/year" : "billed monthly";
      labels.forEach((label) => {
        const isYearlyLabel = label.dataset.billingLabel === "yearly";
        label.classList.toggle("is-active", isYearlyLabel === yearly);
      });
      amount.classList.remove("is-changing");
      // Force a reflow so the swap animation restarts on every toggle.
      void amount.offsetWidth;
      amount.classList.add("is-changing");
    };

    toggle.addEventListener("click", () => {
      setYearly(toggle.getAttribute("aria-checked") !== "true");
    });
    labels.forEach((label) => {
      label.addEventListener("click", () => setYearly(label.dataset.billingLabel === "yearly"));
    });

    labels.forEach((label) => {
      label.classList.toggle("is-active", label.dataset.billingLabel === "monthly");
    });
  }

  /* Hero chaos: items drift, bounce off the walls and each other, and flee the cursor */
  function initChaos() {
    const box = document.querySelector("[data-chaos]");
    if (!box) return;

    const CRUISE_SPEED = 0.55; // px per frame at 60fps
    const MAX_SPEED = 2.5;
    const REPEL_RADIUS = 120;
    const REPEL_FORCE = 0.35;
    const FRICTION = 0.95;
    const GAP = 6;

    const els = Array.from(box.querySelectorAll(".chaos__icon, .chaos__label"));
    let width = box.clientWidth;
    let height = box.clientHeight;
    let pointer = null;
    let frame = 0;
    let lastTime = 0;
    let inView = true;

    const random = (min, max) => min + Math.random() * (max - min);

    // Spread the items over a 4 x 3 grid with some jitter; collisions sort out the rest.
    const bodies = els.map((el, i) => {
      const w = el.offsetWidth || 56;
      const h = el.offsetHeight || 56;
      const cellW = width / 4;
      const cellH = height / 3;
      const x = (i % 4) * cellW + random(0, Math.max(0, cellW - w));
      const y = Math.floor(i / 4) * cellH + random(0, Math.max(0, cellH - h));
      const angle = random(0, Math.PI * 2);
      const isLabel = el.classList.contains("chaos__label");
      return {
        el,
        w,
        h,
        x: Math.max(0, Math.min(x, width - w)),
        y: Math.max(0, Math.min(y, height - h)),
        vx: Math.cos(angle) * CRUISE_SPEED,
        vy: Math.sin(angle) * CRUISE_SPEED,
        tilt: random(-14, 14) * (isLabel ? 0.4 : 1),
        swing: isLabel ? 4 : 10,
        phase: random(0, Math.PI * 2),
        wobble: random(0.6, 1.2),
      };
    });

    const render = (body, time) => {
      const seconds = time / 1000;
      const rotate = body.tilt + Math.sin(seconds * body.wobble + body.phase) * body.swing;
      const scale = 1 + Math.sin(seconds * body.wobble * 1.6 + body.phase) * 0.07;
      body.el.style.transform =
        `translate(${body.x.toFixed(1)}px, ${body.y.toFixed(1)}px) ` +
        `rotate(${rotate.toFixed(2)}deg) scale(${scale.toFixed(3)})`;
    };

    const step = (body, dt) => {
      if (pointer) {
        const dx = body.x + body.w / 2 - pointer.x;
        const dy = body.y + body.h / 2 - pointer.y;
        const dist = Math.hypot(dx, dy);
        if (dist > 0 && dist < REPEL_RADIUS) {
          const push = (1 - dist / REPEL_RADIUS) * REPEL_FORCE * dt;
          body.vx += (dx / dist) * push;
          body.vy += (dy / dist) * push;
        }
      }

      // Bleed off extra speed from a push, but never stop drifting.
      let speed = Math.hypot(body.vx, body.vy);
      if (speed > CRUISE_SPEED) {
        const damped = Math.max(CRUISE_SPEED, speed * Math.pow(FRICTION, dt));
        body.vx *= damped / speed;
        body.vy *= damped / speed;
        speed = damped;
      }
      if (speed > MAX_SPEED) {
        body.vx *= MAX_SPEED / speed;
        body.vy *= MAX_SPEED / speed;
      }

      body.x += body.vx * dt;
      body.y += body.vy * dt;
      keepInside(body);
    };

    const keepInside = (body) => {
      const maxX = width - body.w;
      const maxY = height - body.h;
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
    };

    // Box-to-box collision: push an overlapping pair apart along the axis they
    // overlap least on and swap their speeds on that axis (equal-mass bounce).
    const collide = (a, b) => {
      const dx = b.x + b.w / 2 - (a.x + a.w / 2);
      const dy = b.y + b.h / 2 - (a.y + a.h / 2);
      const overlapX = (a.w + b.w) / 2 + GAP - Math.abs(dx);
      const overlapY = (a.h + b.h) / 2 + GAP - Math.abs(dy);
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
    };

    const tick = (time) => {
      // Normalise to 60fps frames; cap so a background tab doesn't teleport items.
      const dt = lastTime ? Math.min((time - lastTime) / (1000 / 60), 3) : 1;
      lastTime = time;
      for (const body of bodies) step(body, dt);
      for (let i = 0; i < bodies.length; i++) {
        for (let j = i + 1; j < bodies.length; j++) collide(bodies[i], bodies[j]);
      }
      for (const body of bodies) {
        keepInside(body);
        render(body, time);
      }
      frame = requestAnimationFrame(tick);
    };

    const start = () => {
      if (frame || reducedMotion.matches || !inView || document.hidden) return;
      lastTime = 0;
      frame = requestAnimationFrame(tick);
    };

    const stop = () => {
      cancelAnimationFrame(frame);
      frame = 0;
    };

    const renderStill = () => bodies.forEach((body) => render(body, 0));

    box.addEventListener("pointermove", (event) => {
      const rect = box.getBoundingClientRect();
      pointer = { x: event.clientX - rect.left, y: event.clientY - rect.top };
    });
    box.addEventListener("pointerleave", () => {
      pointer = null;
    });

    if ("ResizeObserver" in window) {
      new ResizeObserver(() => {
        width = box.clientWidth;
        height = box.clientHeight;
        bodies.forEach(keepInside);
        if (!frame) renderStill();
      }).observe(box);
    }

    if ("IntersectionObserver" in window) {
      new IntersectionObserver(([entry]) => {
        inView = entry.isIntersecting;
        if (inView) start();
        else stop();
      }).observe(box);
    }

    document.addEventListener("visibilitychange", () => {
      if (document.hidden) stop();
      else start();
    });

    reducedMotion.addEventListener("change", () => {
      if (reducedMotion.matches) {
        stop();
        renderStill();
      } else {
        start();
      }
    });

    renderStill();
    start();
  }

  /* Dashboard preview: types a search and filters the cards, on a loop */
  function initPreviewSearch() {
    const preview = document.querySelector("[data-preview]");
    const visual = preview?.closest(".hero__visual");
    const query = preview?.querySelector("[data-preview-query]");
    const count = preview?.querySelector("[data-preview-count]");
    const search = preview?.querySelector(".preview__search");
    if (!preview || !visual || !query || !count || !search) return;

    const QUERY = "debounce";
    const cards = Array.from(preview.querySelectorAll(".preview__card")).map((el) => ({
      el,
      text: el.textContent.toLowerCase(),
    }));

    let inView = true;
    if ("IntersectionObserver" in window) {
      new IntersectionObserver(([entry]) => {
        inView = entry.isIntersecting;
      }).observe(preview);
    }

    const isActive = () => inView && !document.hidden && !reducedMotion.matches;

    // Resolves once the demo may run: hero revealed, on screen, tab visible, motion allowed.
    const whenActive = async () => {
      while (!isActive() || !visual.classList.contains("is-visible")) await sleep(400);
    };

    const filter = (text) => {
      const term = text.trim().toLowerCase();
      let matches = 0;
      for (const card of cards) {
        const match = !term || card.text.includes(term);
        if (match) matches++;
        card.el.classList.toggle("is-dimmed", !match);
        card.el.classList.toggle("is-match", Boolean(term) && match);
      }
      count.textContent = term
        ? `${matches} result${matches === 1 ? "" : "s"}`
        : `${cards.length} items`;
    };

    const setQuery = (text) => {
      query.textContent = text;
      filter(text);
    };

    const run = async () => {
      await whenActive();
      await sleep(2200); // let the cards settle in first
      for (;;) {
        await whenActive();
        search.classList.add("is-typing");
        await sleep(500);
        for (let i = 1; i <= QUERY.length; i++) {
          setQuery(QUERY.slice(0, i));
          await sleep(120 + Math.random() * 80);
        }
        await sleep(2600);
        for (let i = QUERY.length - 1; i >= 0; i--) {
          setQuery(QUERY.slice(0, i));
          await sleep(45);
        }
        search.classList.remove("is-typing");
        await sleep(3500);
      }
    };

    reducedMotion.addEventListener("change", () => {
      if (reducedMotion.matches) {
        search.classList.remove("is-typing");
        setQuery("");
      }
    });

    run();
  }
})();
