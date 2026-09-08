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
        <section id="resultPanel"><p id="resultKicker"></p><h2 id="resultTitle"></h2><div id="resultDetail"></div><button id="retryButton">RETRY</button><button id="changeTimeButton">CHANGE TIME</button></section>
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

    await import("../../../public/run/game.js?run-game-test");
  });

  it("starts local BGM from the time-selection gesture", async () => {
    document.querySelector(".time-button").click();

    await vi.waitFor(() => expect(audio.startBgm).toHaveBeenCalledTimes(1));
    expect(document.getElementById("gameFrame")).toHaveAttribute("data-state", "INTRO");
  });

  it("keeps the v0.1.3 user-visible shell and runtime aligned", () => {
    const html = readFileSync(resolve("public/run/index.html"), "utf8");

    expect(html).toContain("Net Speed Run v0.1.3")
    expect(html).toContain("v0.1.3 GAMEPLAY TEST")
    expect(window.NetSpeedRun.version).toBe("0.1.3");
  });

  it("plays jump SE only for accepted jumps and suppresses double-jump and stumble input", () => {
    runFrame(10_000);
    runFrame(20_000);
    const canvas = document.getElementById("gameCanvas");
    expect(document.getElementById("gameFrame")).toHaveAttribute("data-state", "RUNNING");
    canvas.click();
    canvas.click();
    expect(audio.playJump).toHaveBeenCalledTimes(1);

    runFrame(21_000);
    runFrame(23_900);
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

    document.getElementById("retryButton").click();
    expect(audio.restartBgm).toHaveBeenCalledTimes(1);
    expect(document.getElementById("gameFrame")).toHaveAttribute("data-state", "COUNTDOWN");
    expect(document.getElementById("gameFrame")).toHaveAttribute("data-run-time-sec", "25.0");
  });

  it("toggles the in-memory SOUND state", () => {
    const toggle = document.getElementById("soundToggle");
    toggle.click();
    expect(audio.setEnabled).toHaveBeenCalledWith(false);
    expect(toggle).toHaveTextContent("SOUND: OFF");
    expect(window.localStorage.length).toBe(0);
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

});
