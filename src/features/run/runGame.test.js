import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { beforeAll, describe, expect, it, vi } from "vitest";

const createCanvasContext = () => new Proxy({}, {
  get(target, property) {
    if (property === "createLinearGradient" || property === "createRadialGradient") {
      return () => ({ addColorStop: vi.fn() });
    }
    if (!(property in target)) target[property] = vi.fn();
    return target[property];
  },
  set(target, property, value) {
    target[property] = value;
    return true;
  },
});

const TEST_COURSE_DAY = "2026-10-12";
const MS_PER_METER = 43; // 1000 m course at the 43 s ideal pace

describe("Net Speed Run game audio integration", () => {
  const animationFrames = [];
  let audioEnabled = true;
  const audio = {
    start: vi.fn().mockResolvedValue(true),
    startBgm: vi.fn(),
    pauseBgm: vi.fn(),
    resumeBgm: vi.fn(),
    restartBgm: vi.fn(),
    stopBgm: vi.fn(),
    playJump: vi.fn(),
    setEnabled: vi.fn((enabled) => { audioEnabled = enabled; }),
    isEnabled: vi.fn(() => audioEnabled),
  };

  const runFrame = (now) => {
    const callback = animationFrames.shift();
    expect(callback).toBeTypeOf("function");
    callback(now);
  };

  beforeAll(async () => {
    document.body.innerHTML = `
      <div id="gameFrame">
        <canvas id="gameCanvas"></canvas>
        <section id="bootPanel"></section>
        <section id="titlePanel"><button class="time-button" data-time="25">25</button></section>
        <section id="resultPanel"><p id="resultKicker"></p><h2 id="resultTitle"></h2><p data-course-day hidden></p><div id="resultDetail"></div><div id="resultBest" hidden></div><button id="retryButton">RETRY</button><button id="changeTimeButton">CHANGE TIME</button><a id="shareResultLink" href="https://x.com/intent/post">結果をXでシェア</a></section>
        <section id="pausePanel"><button id="resumeButton">RESUME</button></section>
        <button id="soundToggle">SOUND: ON</button>
        <div id="liveRegion"></div>
      </div>
    `;
    const frame = document.getElementById("gameFrame");
    const canvas = document.getElementById("gameCanvas");
    frame.getBoundingClientRect = () => ({ width: 960, height: 600 });
    canvas.getContext = () => createCanvasContext();
    vi.stubGlobal("ResizeObserver", class ResizeObserver {
      observe() {}
    });
    vi.stubGlobal("requestAnimationFrame", vi.fn((callback) => {
      animationFrames.push(callback);
      return animationFrames.length;
    }));
    vi.spyOn(performance, "now").mockReturnValue(0);
    window.NetSpeedRunAudio = audio;
    // Local hosts may pin the course day, which keeps the obstacle timing below deterministic.
    window.history.replaceState(null, "", `/?day=${TEST_COURSE_DAY}`);

    await import("../../../public/run/game.js?run-game-test");
  });

  it("starts local BGM from the time-selection gesture", async () => {
    document.querySelector(".time-button").click();

    await vi.waitFor(() => expect(audio.startBgm).toHaveBeenCalledTimes(1));
    expect(document.getElementById("gameFrame")).toHaveAttribute("data-state", "INTRO");
  });

  it("keeps the v0.2.0 user-visible shell and runtime aligned", () => {
    const html = readFileSync(resolve("public/run/index.html"), "utf8");

    expect(html).toContain("Net Speed Run v0.2.0")
    expect(html).toContain("v0.2.0 GAMEPLAY TEST")
    expect(window.NetSpeedRun.version).toBe("0.2.0");
  });

  it("plays jump SE only for accepted jumps and suppresses double-jump and stumble input", () => {
    runFrame(10_000);
    runFrame(20_000);
    const canvas = document.getElementById("gameCanvas");
    expect(document.getElementById("gameFrame")).toHaveAttribute("data-state", "RUNNING");
    canvas.click();
    canvas.click();
    expect(audio.playJump).toHaveBeenCalledTimes(1);

    // Reach the first obstacle without jumping again: the stumble blocks the next jump input.
    const firstObstacle = window.NetSpeedRun.courseForDay(TEST_COURSE_DAY)[0].position;
    runFrame(21_000);
    runFrame(20_000 + firstObstacle * MS_PER_METER);
    canvas.click();
    expect(audio.playJump).toHaveBeenCalledTimes(1);
  });

  it("pauses, resumes, stops at TIME UP, and restarts BGM for RETRY", () => {
    Object.defineProperty(document, "hidden", { configurable: true, value: true });
    document.dispatchEvent(new Event("visibilitychange"));
    expect(audio.pauseBgm).toHaveBeenCalledTimes(1);
    expect(document.getElementById("gameFrame")).toHaveAttribute("data-state", "PAUSED");

    Object.defineProperty(document, "hidden", { configurable: true, value: false });
    document.getElementById("resumeButton").click();
    expect(audio.resumeBgm).toHaveBeenCalledTimes(1);

    runFrame(100_000);
    expect(document.getElementById("gameFrame")).toHaveAttribute("data-state", "TIME_UP");
    expect(audio.stopBgm).toHaveBeenCalledWith({ fadeMs: 180 });
    const timeUpPost = new URL(document.getElementById("shareResultLink").href).searchParams.get("text");
    expect(timeUpPost).toMatch(/GOALまであと\d+m/);
    expect(timeUpPost).toMatch(/のコースに挑戦しました/);
    expect(JSON.parse(window.localStorage.getItem("net-speed-run:daily-best:v1"))).toMatchObject({ clear: false });

    document.getElementById("retryButton").click();
    expect(audio.restartBgm).toHaveBeenCalledTimes(1);
    expect(document.getElementById("gameFrame")).toHaveAttribute("data-state", "COUNTDOWN");
    expect(document.getElementById("gameFrame")).toHaveAttribute("data-run-time-sec", "25.0");
  });

  it("toggles the in-memory SOUND state", () => {
    const storedKeys = window.localStorage.length;
    const toggle = document.getElementById("soundToggle");
    toggle.click();
    expect(audio.setEnabled).toHaveBeenCalledWith(false);
    expect(toggle).toHaveTextContent("SOUND: OFF");
    expect(window.localStorage.length).toBe(storedKeys);
    expect(window.sessionStorage.length).toBe(0);
  });

  it("fades the BGM at CLEAR", () => {
    audio.stopBgm.mockClear();
    document.getElementById("changeTimeButton").click();
    window.NetSpeedRun.start(100);
    runFrame(101_000);
    expect(document.getElementById("gameFrame")).toHaveAttribute("data-state", "RUNNING");
    runFrame(201_000);

    expect(document.getElementById("gameFrame")).toHaveAttribute("data-state", "CLEAR");
    expect(audio.stopBgm).toHaveBeenCalledWith({ fadeMs: 180 });
  });

  it("shares the CLEAR result on X with the hashtag and share URL but no raw score", () => {
    runFrame(202_300);
    runFrame(203_600);

    const link = document.getElementById("shareResultLink");
    const intentUrl = new URL(link.href);
    const text = intentUrl.searchParams.get("text");
    expect(intentUrl.origin + intentUrl.pathname).toBe("https://x.com/intent/post");
    expect(text).toMatch(/残り\d+\.\d秒でクリア（ゴールタイム \d+\.\d秒）/);
    expect(text).toMatch(/^Net Speed Run \d{1,2}\/\d{1,2}のコースでGOAL！/);
    expect(text).toContain("#NetSpeedRace");
    expect(text).toContain("https://netspeedrace.com/?s=x");
    expect(text).not.toMatch(/score|スコア/i);
  });


  it("labels today's course and records CLEAR as today's best over an earlier TIME UP", () => {
    const label = document.querySelector("[data-course-day]");
    expect(label).not.toHaveAttribute("hidden");
    expect(label.textContent).toMatch(/^(本日のコース 10\/12|10\/12のコース)$/);
    const best = JSON.parse(window.localStorage.getItem("net-speed-run:daily-best:v1"));
    expect(best).toMatchObject({ clear: true, stumbles: expect.any(Number) });
    expect(best.clearTimeSec).toBeGreaterThan(0);
    expect(document.getElementById("resultBest")).toHaveTextContent("本日のベスト更新！");
  });

  describe("daily course", () => {
    const course = (day) => window.NetSpeedRun.courseForDay(day);
    const days = Array.from({ length: 120 }, (_, index) =>
      new Date(Date.UTC(2026, 0, 1) + index * 86_400_000).toISOString().slice(0, 10));

    it("is the same for everyone on the same day and differs between days", () => {
      expect(course("2026-10-12")).toEqual(course("2026-10-12"));
      expect(course("2026-10-12")).not.toEqual(course("2026-10-13"));
      const layouts = new Set(days.map((day) => JSON.stringify(course(day))));
      expect(layouts.size).toBe(days.length);
    });

    it("keeps the v0.1 difficulty: 19 obstacles, 4 flying candidates, the same obstacle set", () => {
      const template = course("2026-10-12").map(({ type }) => type).sort();
      for (const day of days) {
        const obstacles = course(day);
        expect(obstacles).toHaveLength(19);
        expect(obstacles.filter((obstacle) => obstacle.isFlying)).toHaveLength(4);
        expect(obstacles.filter((obstacle) => obstacle.isFlying).every((obstacle) => obstacle.candidate)).toBe(true);
        expect(obstacles.map(({ type }) => type).sort()).toEqual(template);
      }
    });

    it("never places obstacles closer than the fixed course did, and stays inside the course", () => {
      const fixedPositions = [90, 158, 226, 274, 330, 386, 430, 477, 535, 586, 626, 671, 717, 760, 804, 848, 895, 940, 975];
      for (const day of days) {
        const positions = course(day).map(({ position }) => position);
        expect(positions[0]).toBeGreaterThanOrEqual(80);
        expect(positions.at(-1)).toBeLessThanOrEqual(980);
        positions.slice(1).forEach((position, index) => {
          const fixedGap = fixedPositions[index + 1] - fixedPositions[index];
          expect(position - positions[index]).toBeGreaterThanOrEqual(Math.min(fixedGap, 40));
        });
      }
    });
  });
});
