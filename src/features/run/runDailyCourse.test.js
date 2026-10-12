import { beforeAll, describe, expect, it, vi } from "vitest";

// Plays each daily course with a scripted perfect run: jump so the jump peaks over every
// ground obstacle, never jump for a flying one. Every course must be clearable without a stumble.
const createCanvasContext = () => new Proxy({}, {
  get(target, property) {
    if (property === "createLinearGradient" || property === "createRadialGradient") {
      return () => ({ addColorStop() {} });
    }
    // Plain no-ops: recording millions of draw calls would exhaust memory.
    if (!(property in target)) target[property] = () => ({ width: 0 });
    return target[property];
  },
  set(target, property, value) {
    target[property] = value;
    return true;
  },
});

const BASE_SPEED_MPS = 1000 / 43;
const HALF_JUMP_METERS = (0.8 / 2) * BASE_SPEED_MPS;
const FRAME_MS = 1000 / 120;

describe("Net Speed Run daily course playability", () => {
  const frames = [];
  let now = 0;

  const step = () => {
    now += FRAME_MS;
    const callback = frames.shift();
    callback(now);
  };

  beforeAll(async () => {
    document.body.innerHTML = `
      <div id="gameFrame">
        <canvas id="gameCanvas"></canvas>
        <section id="bootPanel"></section>
        <section id="titlePanel"></section>
        <section id="resultPanel"><p id="resultKicker"></p><h2 id="resultTitle"></h2><div id="resultDetail"></div><div id="resultBest"></div><button id="retryButton">RETRY</button><button id="changeTimeButton">CHANGE TIME</button><a id="shareResultLink" href="https://x.com/intent/post">share</a></section>
        <section id="pausePanel"><button id="resumeButton">RESUME</button></section>
        <button id="soundToggle">SOUND: ON</button>
        <div id="liveRegion"></div>
      </div>
    `;
    document.getElementById("gameFrame").getBoundingClientRect = () => ({ width: 960, height: 600 });
    document.getElementById("gameCanvas").getContext = () => createCanvasContext();
    vi.stubGlobal("ResizeObserver", class ResizeObserver { observe() {} });
    vi.stubGlobal("requestAnimationFrame", (callback) => frames.push(callback));
    vi.spyOn(performance, "now").mockImplementation(() => now);
    await import("../../../public/run/game.js?run-daily-course-test");
  });

  const playPerfectRun = (day, { jumpFlying = false, jump = true } = {}) => {
    window.history.replaceState(null, "", `/?day=${day}`);
    window.localStorage.clear();
    const course = window.NetSpeedRun.courseForDay(day);
    const jumpAtMeters = jump
      ? course.filter((obstacle) => jumpFlying || !obstacle.isFlying)
        .map((obstacle) => obstacle.position - HALF_JUMP_METERS)
      : [];
    const frame = document.getElementById("gameFrame");
    window.NetSpeedRun.start(60);

    let runningSince = null;
    while (!["CLEAR", "TIME_UP"].includes(frame.dataset.state)) {
      step();
      if (frame.dataset.state !== "RUNNING") continue;
      runningSince ??= now;
      const distance = ((now - runningSince) / 1000) * BASE_SPEED_MPS;
      if (jumpAtMeters.length > 0 && distance >= jumpAtMeters[0]) {
        jumpAtMeters.shift();
        document.getElementById("gameCanvas").click();
      }
    }
    for (let index = 0; index < 400 && frame.dataset.state === "CLEAR"; index += 1) step();
    return JSON.parse(window.localStorage.getItem("net-speed-run:daily-best:v1"));
  };

  it("clears 60 consecutive daily courses with zero stumbles", () => {
    const start = Date.UTC(2026, 9, 1);
    for (let index = 0; index < 60; index += 1) {
      const day = new Date(start + index * 86_400_000).toISOString().slice(0, 10);
      const result = playPerfectRun(day);
      expect({ day, ...result }).toMatchObject({ day, clear: true, stumbles: 0 });
      expect(result.clearTimeSec).toBeCloseTo(43, 0);
    }
  }, 120_000);

  it("is not trivially clearable: skipping jumps or jumping into flying obstacles stumbles", () => {
    expect(playPerfectRun("2026-10-12", { jump: false }).stumbles).toBe(15);
    expect(playPerfectRun("2026-10-12", { jumpFlying: true }).stumbles).toBeGreaterThan(0);
  }, 60_000);
});
