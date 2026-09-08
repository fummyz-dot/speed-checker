import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createNetSpeedRunAudio } from "../../../public/run/audio.js";

const createAudioParam = (initialValue = 0) => ({
  value: initialValue,
  cancelScheduledValues: vi.fn(),
  setValueAtTime: vi.fn(function setValueAtTime(value) { this.value = value; }),
  linearRampToValueAtTime: vi.fn(function linearRampToValueAtTime(value) { this.value = value; }),
  exponentialRampToValueAtTime: vi.fn(function exponentialRampToValueAtTime(value) { this.value = value; }),
});

const createAudioContext = () => {
  const oscillators = [];
  const gains = [];
  const context = {
    currentTime: 1,
    state: "running",
    destination: {},
    resume: vi.fn(async () => { context.state = "running"; }),
    suspend: vi.fn(async () => { context.state = "suspended"; }),
    createGain: vi.fn(() => {
      const gain = { gain: createAudioParam(), connect: vi.fn(), disconnect: vi.fn() };
      gains.push(gain);
      return gain;
    }),
    createOscillator: vi.fn(() => {
      const oscillator = {
        type: "sine",
        frequency: createAudioParam(),
        connect: vi.fn(),
        disconnect: vi.fn(),
        start: vi.fn(),
        stop: vi.fn(),
        onended: null,
      };
      oscillators.push(oscillator);
      return oscillator;
    }),
  };
  return { context, gains, oscillators };
};

describe("Net Speed Run Web Audio", () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
  });

  afterEach(() => vi.useRealTimers());

  it("starts no audio before the user gesture and starts the compact BGM afterward", async () => {
    const mock = createAudioContext();
    const AudioContextClass = vi.fn(function MockAudioContext() { return mock.context; });
    const audio = createNetSpeedRunAudio({ getAudioContextClass: () => AudioContextClass });

    expect(AudioContextClass).not.toHaveBeenCalled();
    expect(mock.context.createOscillator).not.toHaveBeenCalled();

    await expect(audio.start()).resolves.toBe(true);
    expect(audio.startBgm()).toBe(true);
    expect(AudioContextClass).toHaveBeenCalledTimes(1);
    expect(mock.context.createOscillator).toHaveBeenCalledTimes(2);
  });

  it("plays a jump effect only while sound is enabled", async () => {
    const mock = createAudioContext();
    const AudioContextClass = vi.fn(function MockAudioContext() { return mock.context; });
    const audio = createNetSpeedRunAudio({ getAudioContextClass: () => AudioContextClass });
    await audio.start();

    expect(audio.playJump()).toBe(true);
    expect(mock.context.createOscillator).toHaveBeenCalledTimes(1);
    audio.setEnabled(false);
    expect(audio.isEnabled()).toBe(false);
    expect(audio.playJump()).toBe(false);
    expect(mock.context.createOscillator).toHaveBeenCalledTimes(1);
    audio.setEnabled(true);
    expect(audio.isEnabled()).toBe(true);
  });

  it("pauses, resumes, restarts, and fades the BGM without persisting a preference", async () => {
    vi.useFakeTimers();
    const mock = createAudioContext();
    const AudioContextClass = vi.fn(function MockAudioContext() { return mock.context; });
    const audio = createNetSpeedRunAudio({ getAudioContextClass: () => AudioContextClass });
    await audio.start();
    audio.startBgm();

    audio.pauseBgm();
    expect(mock.context.suspend).toHaveBeenCalledTimes(1);
    await vi.waitFor(() => expect(mock.context.state).toBe("suspended"));

    audio.resumeBgm();
    await vi.waitFor(() => expect(mock.context.resume).toHaveBeenCalledTimes(1));
    expect(audio.restartBgm()).toBe(true);
    audio.stopBgm({ fadeMs: 180 });
    expect(mock.gains[1].gain.linearRampToValueAtTime).toHaveBeenCalledWith(0, 1.18);
    vi.advanceTimersByTime(180);
    expect(window.localStorage.length).toBe(0);
    expect(window.sessionStorage.length).toBe(0);
  });

  it("fails safely when AudioContext is unavailable", async () => {
    const audio = createNetSpeedRunAudio({ getAudioContextClass: () => undefined });

    await expect(audio.start()).resolves.toBe(false);
    expect(audio.startBgm()).toBe(false);
    expect(audio.playJump()).toBe(false);
  });
});
