const BGM_STEP_SEC = 0.2;
const BGM_NOTES = Object.freeze([164.81, 196, 220, 246.94, 220, 196, 174.61, 196]);
const MASTER_LEVEL = 0.72;
const BGM_LEVEL = 0.055;
const JUMP_LEVEL = 0.11;

const defaultAudioContextClass = () => window.AudioContext || window.webkitAudioContext;

export const createNetSpeedRunAudio = ({
  getAudioContextClass = defaultAudioContextClass,
  setTimer = window.setTimeout.bind(window),
  clearTimer = window.clearTimeout.bind(window),
} = {}) => {
  let context = null;
  let masterGain = null;
  let bgmGain = null;
  let bgmLoopTimer = null;
  let bgmStopTimer = null;
  let bgmPlaying = false;
  let bgmPaused = false;
  let enabled = true;
  const bgmOscillators = new Set();

  const setGainValue = (gain, value, atTime) => {
    gain.cancelScheduledValues(atTime);
    gain.setValueAtTime(value, atTime);
  };

  const ensureContext = () => {
    if (context && context.state !== "closed") return context;
    const AudioContextClass = getAudioContextClass();
    if (typeof AudioContextClass !== "function") return null;

    try {
      context = new AudioContextClass();
      masterGain = context.createGain();
      bgmGain = context.createGain();
      masterGain.gain.setValueAtTime(enabled ? MASTER_LEVEL : 0, context.currentTime);
      bgmGain.gain.setValueAtTime(BGM_LEVEL, context.currentTime);
      bgmGain.connect(masterGain);
      masterGain.connect(context.destination);
      return context;
    } catch {
      context = null;
      masterGain = null;
      bgmGain = null;
      return null;
    }
  };

  const clearLoopTimer = () => {
    if (bgmLoopTimer === null) return;
    clearTimer(bgmLoopTimer);
    bgmLoopTimer = null;
  };

  const clearStopTimer = () => {
    if (bgmStopTimer === null) return;
    clearTimer(bgmStopTimer);
    bgmStopTimer = null;
  };

  const stopBgmOscillators = () => {
    for (const oscillator of bgmOscillators) {
      try {
        oscillator.stop();
      } catch {
        // An oscillator may already have reached its scheduled stop time.
      }
      oscillator.disconnect();
    }
    bgmOscillators.clear();
  };

  const scheduleBgmPhrase = () => {
    if (!context || !bgmGain || !bgmPlaying || bgmPaused || context.state !== "running") return;

    const startAt = context.currentTime + 0.03;
    const phraseDuration = BGM_NOTES.length * BGM_STEP_SEC;
    const lead = context.createOscillator();
    const bass = context.createOscillator();
    lead.type = "triangle";
    bass.type = "square";

    BGM_NOTES.forEach((frequency, index) => {
      const noteAt = startAt + index * BGM_STEP_SEC;
      lead.frequency.setValueAtTime(frequency, noteAt);
      bass.frequency.setValueAtTime(frequency / 2, noteAt);
    });

    const leadGain = context.createGain();
    const bassGain = context.createGain();
    leadGain.gain.setValueAtTime(0.72, startAt);
    bassGain.gain.setValueAtTime(0.18, startAt);
    lead.connect(leadGain);
    bass.connect(bassGain);
    leadGain.connect(bgmGain);
    bassGain.connect(bgmGain);
    bgmOscillators.add(lead);
    bgmOscillators.add(bass);

    const cleanUp = (oscillator) => {
      bgmOscillators.delete(oscillator);
      oscillator.disconnect();
    };
    lead.onended = () => cleanUp(lead);
    bass.onended = () => cleanUp(bass);
    lead.start(startAt);
    bass.start(startAt);
    lead.stop(startAt + phraseDuration);
    bass.stop(startAt + phraseDuration);

    bgmLoopTimer = setTimer(() => {
      bgmLoopTimer = null;
      scheduleBgmPhrase();
    }, phraseDuration * 1000);
  };

  const start = async () => {
    const activeContext = ensureContext();
    if (!activeContext) return false;
    try {
      if (activeContext.state === "suspended") await activeContext.resume();
      return activeContext.state === "running";
    } catch {
      return false;
    }
  };

  const stopBgm = ({ fadeMs = 0 } = {}) => {
    bgmPlaying = false;
    bgmPaused = false;
    clearLoopTimer();
    clearStopTimer();
    if (!context || !bgmGain) {
      stopBgmOscillators();
      return;
    }

    const now = context.currentTime;
    bgmGain.gain.cancelScheduledValues(now);
    bgmGain.gain.setValueAtTime(bgmGain.gain.value, now);
    if (fadeMs > 0) {
      bgmGain.gain.linearRampToValueAtTime(0, now + fadeMs / 1000);
      bgmStopTimer = setTimer(() => {
        bgmStopTimer = null;
        stopBgmOscillators();
      }, fadeMs);
      return;
    }
    bgmGain.gain.setValueAtTime(0, now);
    stopBgmOscillators();
  };

  const startBgm = () => {
    if (!context || !bgmGain || context.state !== "running") return false;
    stopBgm();
    bgmPlaying = true;
    setGainValue(bgmGain.gain, BGM_LEVEL, context.currentTime);
    scheduleBgmPhrase();
    return true;
  };

  const pauseBgm = () => {
    if (!context || !bgmPlaying || bgmPaused) return;
    bgmPaused = true;
    clearLoopTimer();
    stopBgmOscillators();
    if (context.state === "running") void context.suspend().catch(() => {});
  };

  const resumeBgm = () => {
    if (!context || !bgmPlaying || !bgmPaused) return;
    bgmPaused = false;
    const resume = context.state === "suspended" ? context.resume() : Promise.resolve();
    void resume.then(scheduleBgmPhrase).catch(() => {});
  };

  const restartBgm = () => startBgm();

  const playJump = () => {
    if (!enabled || !context || !masterGain || context.state !== "running") return false;
    const startAt = context.currentTime;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = "square";
    oscillator.frequency.setValueAtTime(330, startAt);
    oscillator.frequency.exponentialRampToValueAtTime(660, startAt + 0.09);
    gain.gain.setValueAtTime(JUMP_LEVEL, startAt);
    gain.gain.exponentialRampToValueAtTime(0.0001, startAt + 0.13);
    oscillator.connect(gain);
    gain.connect(masterGain);
    oscillator.start(startAt);
    oscillator.stop(startAt + 0.14);
    return true;
  };

  const setEnabled = (nextEnabled) => {
    enabled = Boolean(nextEnabled);
    if (context && masterGain) {
      setGainValue(masterGain.gain, enabled ? MASTER_LEVEL : 0, context.currentTime);
    }
  };

  return Object.freeze({
    start,
    startBgm,
    pauseBgm,
    resumeBgm,
    restartBgm,
    stopBgm,
    playJump,
    setEnabled,
    isEnabled: () => enabled,
  });
};

if (typeof window !== "undefined") {
  window.NetSpeedRunAudio = createNetSpeedRunAudio();
}
