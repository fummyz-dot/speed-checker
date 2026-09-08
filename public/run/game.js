(() => {
  "use strict";

  const LOCAL_HOSTNAMES = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);
  const IS_LOCAL = LOCAL_HOSTNAMES.has(window.location.hostname);

  const GAME_VERSION = "0.1.3";

  const CONFIG = Object.freeze({
    courseLength: 1000,
    idealClearTimeSec: 43,
    jumpDurationSec: 0.8,
    jumpPeakMeters: 5.4,
    stumbleDurationSec: 0.7,
    obstacleLookAheadSec: 2.4,
    flyingWarningSec: 1.0,
    flyingSinkSec: 0.6,
    flyingLaunchSec: 0.36,
    flyingPeakMeters: 6.25,
    introDurationSec: 2.35,
    countdownDurationSec: 3.15,
    clearCelebrationDurationSec: 1.2,
    clearFlashDurationSec: 0.22,
    clearShakeDurationSec: 0.55,
    clearHorseEntryDelaySec: 0.42,
    clearHorseEntryDurationSec: 0.68,
    horseGaitCycleSec: 0.34,
    horseIdleCycleSec: 2.6,
    horseSettleStartProgress: 0.64,
    clearConfettiMin: 84,
    clearConfettiMax: 154,
    maxDevicePixelRatio: 2,
    playerCollisionWidthMeters: 1.3,
    playerCollisionHeightMeters: 2.8,
    simulationStepSec: 1 / 120,
    testRunTimes: Object.freeze([25, 35, 45, 50]),
  });

  const BASE_SPEED_MPS = CONFIG.courseLength / CONFIG.idealClearTimeSec;

  const STATES = Object.freeze({
    BOOT: "BOOT",
    TITLE: "TITLE",
    INTRO: "INTRO",
    COUNTDOWN: "COUNTDOWN",
    RUNNING: "RUNNING",
    PAUSED: "PAUSED",
    TIME_UP: "TIME_UP",
    CLEAR: "CLEAR",
  });

  const HORSE_POSES = Object.freeze({
    INTRO_STOP: "INTRO_STOP",
    CLEAR_ENTER: "CLEAR_ENTER",
    IDLE: "IDLE",
  });

  const HORSE_STANDING_LEGS = Object.freeze([
    Object.freeze([[-29, -39], [-34, -20], [-31, -2]]),
    Object.freeze([[24, -39], [22, -20], [24, -2]]),
    Object.freeze([[-17, -39], [-12, -19], [-10, -2]]),
    Object.freeze([[32, -39], [34, -19], [36, -2]]),
  ]);

  const HORSE_GAIT_KEYFRAMES = Object.freeze([
    Object.freeze([
      Object.freeze([[-29, -39], [-43, -20], [-51, -2]]),
      Object.freeze([[24, -39], [38, -22], [52, -2]]),
      Object.freeze([[-17, -39], [-5, -18], [2, -2]]),
      Object.freeze([[32, -39], [17, -17], [9, -2]]),
    ]),
    Object.freeze([
      Object.freeze([[-29, -39], [-35, -21], [-24, -2]]),
      Object.freeze([[24, -39], [20, -20], [28, -2]]),
      Object.freeze([[-17, -39], [-8, -20], [-18, -2]]),
      Object.freeze([[32, -39], [39, -20], [34, -2]]),
    ]),
    Object.freeze([
      Object.freeze([[-29, -39], [-12, -20], [2, -2]]),
      Object.freeze([[24, -39], [9, -20], [3, -2]]),
      Object.freeze([[-17, -39], [-35, -19], [-46, -2]]),
      Object.freeze([[32, -39], [44, -21], [51, -2]]),
    ]),
  ]);

  const COURSE_TEMPLATE = Object.freeze([
    { id: "lan-090", position: 90, type: "cable", widthM: 3.8, heightM: 1.35 },
    { id: "router-158", position: 158, type: "router", widthM: 2.7, heightM: 2.15 },
    { id: "lan-226", position: 226, type: "cable", widthM: 3.9, heightM: 1.4 },
    { id: "wifi-274", position: 274, type: "wifi", widthM: 2.9, heightM: 2.4 },
    { id: "cell-330", position: 330, type: "cell", widthM: 2.5, heightM: 3.45 },
    { id: "lan-386", position: 386, type: "cable", widthM: 4.0, heightM: 1.4 },
    { id: "wifi-430", position: 430, type: "wifi", widthM: 3.0, heightM: 2.45, candidate: true },
    { id: "lan-477", position: 477, type: "cable", widthM: 3.9, heightM: 1.4 },
    { id: "router-535", position: 535, type: "router", widthM: 2.8, heightM: 2.2, candidate: true },
    { id: "rack-586", position: 586, type: "rack", widthM: 3.0, heightM: 3.9 },
    { id: "lan-626", position: 626, type: "cable", widthM: 3.9, heightM: 1.4 },
    { id: "cell-671", position: 671, type: "cell", widthM: 2.5, heightM: 3.45, candidate: true },
    { id: "router-717", position: 717, type: "router", widthM: 2.8, heightM: 2.2 },
    { id: "wifi-760", position: 760, type: "wifi", widthM: 3.0, heightM: 2.45, candidate: true },
    { id: "lan-804", position: 804, type: "cable", widthM: 4.0, heightM: 1.4 },
    { id: "rack-848", position: 848, type: "rack", widthM: 3.0, heightM: 3.9, candidate: true },
    { id: "router-895", position: 895, type: "router", widthM: 2.8, heightM: 2.2 },
    { id: "cell-940", position: 940, type: "cell", widthM: 2.5, heightM: 3.45, candidate: true },
    { id: "lan-975", position: 975, type: "cable", widthM: 3.9, heightM: 1.4 },
  ]);

  const canvas = document.getElementById("gameCanvas");
  const frame = document.getElementById("gameFrame");
  const bootPanel = document.getElementById("bootPanel");
  const titlePanel = document.getElementById("titlePanel");
  const resultPanel = document.getElementById("resultPanel");
  const pausePanel = document.getElementById("pausePanel");
  const resultKicker = document.getElementById("resultKicker");
  const resultTitle = document.getElementById("resultTitle");
  const resultDetail = document.getElementById("resultDetail");
  const retryButton = document.getElementById("retryButton");
  const changeTimeButton = document.getElementById("changeTimeButton");
  const resumeButton = document.getElementById("resumeButton");
  const soundToggle = document.getElementById("soundToggle");
  const liveRegion = document.getElementById("liveRegion");
  const ctx = canvas.getContext("2d", { alpha: false });

  const viewport = {
    width: 1,
    height: 1,
    dpr: 1,
  };

  const game = {
    state: IS_LOCAL ? STATES.TITLE : STATES.BOOT,
    stateEnteredAt: performance.now(),
    introPlayed: false,
    selectedRunTimeSec: null,
    courseSeed: null,
    course: [],
    pause: {
      resumeState: null,
      elapsedInStateMs: 0,
    },
    celebration: {
      phase: "IDLE",
      confetti: [],
    },
    run: {
      elapsedMs: 0,
      lastTickNow: null,
      playerDistance: 0,
      jumpElapsedSec: null,
      stumbleRemainingSec: 0,
      shakeRemainingSec: 0,
      clearRemainingSec: 0,
    },
  };

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function lerp(start, end, amount) {
    return start + (end - start) * amount;
  }

  function easeOutCubic(value) {
    return 1 - Math.pow(1 - clamp(value, 0, 1), 3);
  }

  function easeInOutCubic(value) {
    const t = clamp(value, 0, 1);
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  }

  function easeOutBack(value) {
    const t = clamp(value, 0, 1);
    const overshoot = 1.7;
    return 1 + (overshoot + 1) * Math.pow(t - 1, 3) + overshoot * Math.pow(t - 1, 2);
  }

  function mulberry32(seed) {
    let value = seed >>> 0;
    return () => {
      value += 0x6d2b79f5;
      let result = value;
      result = Math.imul(result ^ (result >>> 15), result | 1);
      result ^= result + Math.imul(result ^ (result >>> 7), result | 61);
      return ((result ^ (result >>> 14)) >>> 0) / 4294967296;
    };
  }

  function createSeed() {
    if (window.crypto && window.crypto.getRandomValues) {
      const values = new Uint32Array(1);
      window.crypto.getRandomValues(values);
      return values[0];
    }
    return (Date.now() ^ Math.floor(performance.now() * 1000)) >>> 0;
  }

  function createCourse(seed) {
    const random = mulberry32(seed);
    const candidateIds = COURSE_TEMPLATE.filter((obstacle) => obstacle.candidate).map((obstacle) => obstacle.id);

    for (let index = candidateIds.length - 1; index > 0; index -= 1) {
      const swapIndex = Math.floor(random() * (index + 1));
      [candidateIds[index], candidateIds[swapIndex]] = [candidateIds[swapIndex], candidateIds[index]];
    }

    const flyingIds = new Set(candidateIds.slice(0, 4));
    return COURSE_TEMPLATE.map((obstacle) => ({
      ...obstacle,
      isFlying: flyingIds.has(obstacle.id),
      hasCollided: false,
    }));
  }

  function resetRun() {
    game.run.elapsedMs = 0;
    game.run.lastTickNow = null;
    game.run.playerDistance = 0;
    game.run.jumpElapsedSec = null;
    game.run.stumbleRemainingSec = 0;
    game.run.shakeRemainingSec = 0;
    game.run.clearRemainingSec = 0;
    game.celebration.phase = "IDLE";
    game.celebration.confetti = [];
    game.course.forEach((obstacle) => {
      obstacle.hasCollided = false;
    });
  }

  function setPanelVisibility(activePanel) {
    bootPanel.hidden = activePanel !== "boot";
    titlePanel.hidden = activePanel !== "title";
    resultPanel.hidden = activePanel !== "result";
    pausePanel.hidden = activePanel !== "pause";
  }

  function getAudio() {
    return window.NetSpeedRunAudio || null;
  }

  function callAudio(method, ...args) {
    try {
      return getAudio()?.[method]?.(...args);
    } catch {
      return undefined;
    }
  }

  function updateSoundToggle() {
    const enabled = getAudio()?.isEnabled?.() !== false;
    soundToggle.textContent = `SOUND: ${enabled ? "ON" : "OFF"}`;
    soundToggle.setAttribute("aria-pressed", String(enabled));
  }

  function renderResult(state) {
    if (state === STATES.CLEAR) {
      resultPanel.dataset.result = "clear";
      resultKicker.textContent = "COURSE COMPLETE";
      resultTitle.innerHTML = '<span class="result-title-prefix">NET SPEED RUN</span><span class="result-title-main">CLEAR</span>';
      resultDetail.innerHTML = `<span class="remaining-label">残り</span><strong class="remaining-time">${game.run.clearRemainingSec.toFixed(1)}秒</strong>`;
      liveRegion.textContent = `ゴール。クリア。残り${game.run.clearRemainingSec.toFixed(1)}秒。`;
      return;
    }

    const metersLeft = getGoalMeters();
    resultPanel.dataset.result = "time-up";
    resultKicker.textContent = "NET SPEED RUN";
    resultTitle.textContent = "TIME UP";
    resultDetail.innerHTML = `GOALまで<strong>あと ${metersLeft}m</strong>`;
    liveRegion.textContent = `タイムアップ。ゴールまであと${metersLeft}メートル。`;
  }

  function createClearConfetti() {
    const random = mulberry32(((game.courseSeed || 1) ^ 0xc1ea5eed) >>> 0);
    const palette = ["#ffe59a", "#ffc64f", "#ffffff", "#72efff", "#24c7ce", "#b8f8ff"];
    const particleCount = Math.round(
      clamp(
        viewport.width / 7 + viewport.height / 18,
        CONFIG.clearConfettiMin,
        CONFIG.clearConfettiMax,
      ),
    );

    return Array.from({ length: particleCount }, (_, index) => {
      const source = index % 3;
      const fromLeft = source === 0;
      const fromRight = source === 1;
      return {
        startX: fromLeft ? -0.04 : fromRight ? 1.04 : 0.08 + random() * 0.84,
        startY: source === 2 ? -0.05 : 0.32 + random() * 0.45,
        velocityX: fromLeft
          ? 0.35 + random() * 0.58
          : fromRight
            ? -(0.35 + random() * 0.58)
            : (random() - 0.5) * 0.34,
        velocityY: source === 2 ? 0.12 + random() * 0.3 : -(0.42 + random() * 0.48),
        gravity: 0.82 + random() * 0.45,
        size: 5 + random() * 7,
        rotation: random() * Math.PI * 2,
        spin: (random() - 0.5) * 13,
        color: palette[Math.floor(random() * palette.length)],
        ribbon: random() > 0.72,
      };
    });
  }

  function beginClearCelebration() {
    game.celebration.phase = "CELEBRATION";
    game.celebration.confetti = createClearConfetti();
    resultPanel.dataset.result = "clear";
    setPanelVisibility(null);
    liveRegion.textContent = "ゴール！";
  }

  function showClearResult() {
    if (game.state !== STATES.CLEAR || game.celebration.phase === "RESULT") return;
    game.celebration.phase = "RESULT";
    setPanelVisibility("result");
    renderResult(STATES.CLEAR);
    retryButton.focus({ preventScroll: true });
  }

  function transitionTo(nextState, now = performance.now(), details = {}) {
    game.state = nextState;
    game.stateEnteredAt = now;
    frame.dataset.state = nextState;

    if (details.elapsedInStateMs) {
      game.stateEnteredAt = now - details.elapsedInStateMs;
    }

    switch (nextState) {
      case STATES.BOOT:
        setPanelVisibility("boot");
        break;
      case STATES.TITLE:
        setPanelVisibility("title");
        break;
      case STATES.PAUSED:
        setPanelVisibility("pause");
        resumeButton.focus({ preventScroll: true });
        break;
      case STATES.CLEAR:
        callAudio("stopBgm", { fadeMs: 180 });
        beginClearCelebration();
        break;
      case STATES.TIME_UP:
        callAudio("stopBgm", { fadeMs: 180 });
        setPanelVisibility("result");
        renderResult(STATES.TIME_UP);
        retryButton.focus({ preventScroll: true });
        break;
      case STATES.RUNNING:
        setPanelVisibility(null);
        game.run.lastTickNow = now;
        canvas.focus({ preventScroll: true });
        break;
      default:
        setPanelVisibility(null);
        break;
    }
  }

  function startGame(runTimeSec, { retry = false } = {}) {
    if (!Number.isFinite(runTimeSec) || runTimeSec <= 0) {
      throw new TypeError("runTimeSec must be a positive number");
    }

    const now = performance.now();
    game.selectedRunTimeSec = runTimeSec;
    frame.dataset.runTimeSec = runTimeSec.toFixed(1);

    if (!retry || !game.course.length) {
      game.courseSeed = createSeed();
      game.course = createCourse(game.courseSeed);
    }

    resetRun();

    if (!game.introPlayed) {
      game.introPlayed = true;
      transitionTo(STATES.INTRO, now);
    } else {
      transitionTo(STATES.COUNTDOWN, now);
    }
  }

  function requestJump() {
    if (game.state !== STATES.RUNNING) return;
    if (game.run.jumpElapsedSec !== null || game.run.stumbleRemainingSec > 0) return;
    game.run.jumpElapsedSec = 0;
    callAudio("playJump");
  }

  function requestRetry() {
    if (game.selectedRunTimeSec === null) return;
    callAudio("restartBgm");
    startGame(game.selectedRunTimeSec, { retry: true });
  }

  function requestChangeTime() {
    callAudio("stopBgm");
    if (!IS_LOCAL) {
      window.location.assign("/");
      return;
    }
    game.course = [];
    game.courseSeed = null;
    transitionTo(STATES.TITLE);
    document.querySelector(".time-button")?.focus({ preventScroll: true });
  }

  function requestPause(now) {
    const pausableStates = [STATES.INTRO, STATES.COUNTDOWN, STATES.RUNNING];
    if (!pausableStates.includes(game.state)) return;

    if (game.state === STATES.RUNNING) {
      updateRunning(now);
      if (game.state !== STATES.RUNNING) return;
    }

    game.pause.resumeState = game.state;
    game.pause.elapsedInStateMs = now - game.stateEnteredAt;
    callAudio("pauseBgm");
    transitionTo(STATES.PAUSED, now);
  }

  function requestResume() {
    if (game.state !== STATES.PAUSED || document.hidden) return;
    const now = performance.now();
    const resumeState = game.pause.resumeState || STATES.RUNNING;
    const elapsedInStateMs = game.pause.elapsedInStateMs;
    game.pause.resumeState = null;
    game.pause.elapsedInStateMs = 0;
    callAudio("resumeBgm");
    transitionTo(resumeState, now, { elapsedInStateMs });
  }

  function getRemainingTimeSec() {
    if (game.selectedRunTimeSec === null) return 0;
    return Math.max(0, game.selectedRunTimeSec - game.run.elapsedMs / 1000);
  }

  function getGoalMeters() {
    const preciseDistance = CONFIG.courseLength - game.run.playerDistance;
    return Math.max(0, Math.ceil(preciseDistance - 0.000001));
  }

  function getJumpHeightMeters() {
    if (game.run.jumpElapsedSec === null) return 0;
    const progress = clamp(game.run.jumpElapsedSec / CONFIG.jumpDurationSec, 0, 1);
    return 4 * CONFIG.jumpPeakMeters * progress * (1 - progress);
  }

  function getObstaclePose(obstacle, playerDistance, now) {
    const pose = {
      bottomMeters: 0,
      sinkMeters: 0,
      jitterPx: 0,
      phase: "GROUND",
    };

    if (!obstacle.isFlying) return pose;

    const distanceAhead = obstacle.position - playerDistance;
    const warningDistance = BASE_SPEED_MPS * CONFIG.flyingWarningSec;
    const sinkDistance = BASE_SPEED_MPS * CONFIG.flyingSinkSec;
    const launchDistance = BASE_SPEED_MPS * CONFIG.flyingLaunchSec;

    if (distanceAhead <= warningDistance && distanceAhead > sinkDistance) {
      const progress = 1 - (distanceAhead - sinkDistance) / (warningDistance - sinkDistance);
      pose.phase = "SHAKE";
      pose.jitterPx = Math.sin(now * 0.075) * lerp(1.1, 3.0, progress);
    } else if (distanceAhead <= sinkDistance && distanceAhead > launchDistance) {
      const progress = 1 - (distanceAhead - launchDistance) / (sinkDistance - launchDistance);
      pose.phase = "SINK";
      pose.jitterPx = Math.sin(now * 0.11) * 2.8;
      pose.sinkMeters = 0.34 * Math.sin(progress * Math.PI * 0.5);
    } else if (distanceAhead <= launchDistance && distanceAhead >= -launchDistance) {
      const normalizedDistance = distanceAhead / launchDistance;
      pose.phase = "FLY";
      pose.bottomMeters = CONFIG.flyingPeakMeters * (1 - normalizedDistance * normalizedDistance);
    } else if (distanceAhead < -launchDistance) {
      pose.phase = "LANDED";
    }

    return pose;
  }

  function collidesWith(obstacle, previousDistance, currentDistance, jumpHeight, now) {
    const playerHalfWidth = CONFIG.playerCollisionWidthMeters / 2;
    const obstacleHalfWidth = (obstacle.widthM * 0.82) / 2;
    const leftEdge = obstacle.position - obstacleHalfWidth - playerHalfWidth;
    const rightEdge = obstacle.position + obstacleHalfWidth + playerHalfWidth;
    const horizontalOverlap = currentDistance >= leftEdge && previousDistance <= rightEdge;

    if (!horizontalOverlap) return false;

    const pose = getObstaclePose(obstacle, currentDistance, now);
    const playerBottom = jumpHeight + 0.12;
    const playerTop = playerBottom + CONFIG.playerCollisionHeightMeters;
    const obstacleBottom = pose.bottomMeters;
    const obstacleTop = obstacleBottom + obstacle.heightM;

    return playerTop > obstacleBottom + 0.16 && playerBottom < obstacleTop - 0.12;
  }

  function checkCollisions(previousDistance, currentDistance, now) {
    const jumpHeight = getJumpHeightMeters();

    for (const obstacle of game.course) {
      if (obstacle.hasCollided) continue;
      if (obstacle.position < previousDistance - 8 || obstacle.position > currentDistance + 8) continue;

      if (collidesWith(obstacle, previousDistance, currentDistance, jumpHeight, now)) {
        obstacle.hasCollided = true;
        game.run.stumbleRemainingSec = CONFIG.stumbleDurationSec;
        game.run.shakeRemainingSec = 0.22;
        return true;
      }
    }

    return false;
  }

  function advanceSimulation(deltaSec, now) {
    let remainingDelta = deltaSec;

    while (remainingDelta > 0.000001 && game.state === STATES.RUNNING) {
      const step = Math.min(CONFIG.simulationStepSec, remainingDelta);
      remainingDelta -= step;
      game.run.elapsedMs += step * 1000;

      if (game.run.jumpElapsedSec !== null) {
        game.run.jumpElapsedSec += step;
        if (game.run.jumpElapsedSec >= CONFIG.jumpDurationSec) {
          game.run.jumpElapsedSec = null;
        }
      }

      game.run.shakeRemainingSec = Math.max(0, game.run.shakeRemainingSec - step);

      let movementTime = step;
      if (game.run.stumbleRemainingSec > 0) {
        const stoppedTime = Math.min(movementTime, game.run.stumbleRemainingSec);
        game.run.stumbleRemainingSec -= stoppedTime;
        movementTime -= stoppedTime;
      }

      if (movementTime > 0) {
        const previousDistance = game.run.playerDistance;
        game.run.playerDistance = Math.min(
          CONFIG.courseLength,
          game.run.playerDistance + BASE_SPEED_MPS * movementTime,
        );
        checkCollisions(previousDistance, game.run.playerDistance, now);
      }

      if (game.run.playerDistance >= CONFIG.courseLength) {
        game.run.clearRemainingSec = getRemainingTimeSec();
        transitionTo(STATES.CLEAR, now);
        return;
      }
    }
  }

  function updateRunning(now) {
    if (game.run.lastTickNow === null) {
      game.run.lastTickNow = now;
      return;
    }

    const elapsedSinceFrameMs = Math.max(0, now - game.run.lastTickNow);
    game.run.lastTickNow = now;
    const totalRunTimeMs = game.selectedRunTimeSec * 1000;
    const timeAvailableMs = Math.max(0, totalRunTimeMs - game.run.elapsedMs);
    const activeDeltaMs = Math.min(elapsedSinceFrameMs, timeAvailableMs);

    if (activeDeltaMs > 0) {
      advanceSimulation(activeDeltaMs / 1000, now);
    }

    if (game.state === STATES.RUNNING && totalRunTimeMs - game.run.elapsedMs <= 0.05) {
      game.run.elapsedMs = totalRunTimeMs;
      transitionTo(STATES.TIME_UP, now);
    }
  }

  function update(now) {
    if (game.state === STATES.INTRO) {
      if (now - game.stateEnteredAt >= CONFIG.introDurationSec * 1000) {
        transitionTo(STATES.COUNTDOWN, now);
      }
      return;
    }

    if (game.state === STATES.COUNTDOWN) {
      if (now - game.stateEnteredAt >= CONFIG.countdownDurationSec * 1000) {
        transitionTo(STATES.RUNNING, now);
      }
      return;
    }

    if (game.state === STATES.RUNNING) {
      updateRunning(now);
      return;
    }

    if (
      game.state === STATES.CLEAR &&
      game.celebration.phase === "CELEBRATION" &&
      now - game.stateEnteredAt >= CONFIG.clearCelebrationDurationSec * 1000
    ) {
      showClearResult();
    }
  }

  function parseHexColor(hex) {
    const value = hex.replace("#", "");
    return {
      r: Number.parseInt(value.slice(0, 2), 16),
      g: Number.parseInt(value.slice(2, 4), 16),
      b: Number.parseInt(value.slice(4, 6), 16),
    };
  }

  function mixColor(first, second, amount) {
    const a = parseHexColor(first);
    const b = parseHexColor(second);
    const t = clamp(amount, 0, 1);
    return `rgb(${Math.round(lerp(a.r, b.r, t))} ${Math.round(lerp(a.g, b.g, t))} ${Math.round(lerp(a.b, b.b, t))})`;
  }

  function getBackgroundPalette(progress) {
    const stops = [
      { at: 0, top: "#163a50", bottom: "#72b8bd", horizon: "#b5d99c" },
      { at: 0.25, top: "#102d49", bottom: "#3e8298", horizon: "#71b1a7" },
      { at: 0.5, top: "#0b2140", bottom: "#445f87", horizon: "#66899a" },
      { at: 0.75, top: "#09162f", bottom: "#273b62", horizon: "#49627b" },
      { at: 1, top: "#120f2a", bottom: "#293861", horizon: "#685c86" },
    ];

    let start = stops[0];
    let end = stops[stops.length - 1];
    for (let index = 0; index < stops.length - 1; index += 1) {
      if (progress >= stops[index].at && progress <= stops[index + 1].at) {
        start = stops[index];
        end = stops[index + 1];
        break;
      }
    }
    const local = (progress - start.at) / Math.max(0.001, end.at - start.at);
    return {
      top: mixColor(start.top, end.top, local),
      bottom: mixColor(start.bottom, end.bottom, local),
      horizon: mixColor(start.horizon, end.horizon, local),
    };
  }

  function getCamera() {
    const playerX = viewport.width < 600 ? viewport.width * 0.22 : viewport.width * 0.205;
    const rightMargin = viewport.width < 600 ? 14 : 24;
    const lookAheadMeters = BASE_SPEED_MPS * CONFIG.obstacleLookAheadSec;
    const pixelsPerMeter = (viewport.width - playerX - rightMargin) / lookAheadMeters;
    return {
      playerX,
      pixelsPerMeter,
      verticalPixelsPerMeter: clamp(viewport.height / 33, 13, 21),
      groundY: viewport.height * (viewport.height < 540 ? 0.77 : 0.75),
      lookAheadMeters,
    };
  }

  function worldToX(worldPosition, camera) {
    return camera.playerX + (worldPosition - game.run.playerDistance) * camera.pixelsPerMeter;
  }

  function roundedRectPath(context, x, y, width, height, radius) {
    const safeRadius = Math.min(radius, width / 2, height / 2);
    context.beginPath();
    context.roundRect(x, y, width, height, safeRadius);
  }

  function drawBackground(now, camera) {
    const progress = clamp(game.run.playerDistance / CONFIG.courseLength, 0, 1);
    const palette = getBackgroundPalette(progress);
    const sky = ctx.createLinearGradient(0, 0, 0, camera.groundY);
    sky.addColorStop(0, palette.top);
    sky.addColorStop(0.72, palette.bottom);
    sky.addColorStop(1, palette.horizon);
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, viewport.width, camera.groundY);

    const glowX = lerp(viewport.width * 0.78, viewport.width * 0.2, progress);
    const glow = ctx.createRadialGradient(glowX, camera.groundY * 0.34, 3, glowX, camera.groundY * 0.34, viewport.height * 0.34);
    glow.addColorStop(0, `rgba(255, 232, 170, ${0.2 - progress * 0.08})`);
    glow.addColorStop(1, "rgba(255, 232, 170, 0)");
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, viewport.width, camera.groundY);

    drawDistantWorld(now, camera, progress);

    ctx.fillStyle = mixColor("#163744", "#11152a", progress);
    ctx.fillRect(0, camera.groundY, viewport.width, viewport.height - camera.groundY);

    const laneGradient = ctx.createLinearGradient(0, camera.groundY, 0, viewport.height);
    laneGradient.addColorStop(0, "rgba(93, 210, 218, 0.13)");
    laneGradient.addColorStop(1, "rgba(3, 10, 17, 0.58)");
    ctx.fillStyle = laneGradient;
    ctx.fillRect(0, camera.groundY, viewport.width, viewport.height - camera.groundY);

    ctx.strokeStyle = "rgba(145, 235, 239, 0.24)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, camera.groundY + 1);
    ctx.lineTo(viewport.width, camera.groundY + 1);
    ctx.stroke();

    const stripeOffset = -((game.run.playerDistance * camera.pixelsPerMeter) % 62);
    ctx.strokeStyle = `rgba(128, 220, 226, ${0.13 + progress * 0.08})`;
    ctx.lineWidth = 2;
    for (let x = stripeOffset - 80; x < viewport.width + 80; x += 62) {
      ctx.beginPath();
      ctx.moveTo(x, camera.groundY + 16);
      ctx.lineTo(x - 29, viewport.height);
      ctx.stroke();
    }

    ctx.fillStyle = "rgba(0, 0, 0, 0.12)";
    ctx.fillRect(0, viewport.height - Math.max(28, viewport.height * 0.055), viewport.width, viewport.height);
  }

  function drawDistantWorld(now, camera, progress) {
    const horizonY = camera.groundY;
    const scroll = game.run.playerDistance * camera.pixelsPerMeter * 0.2;

    if (progress < 0.34) {
      ctx.fillStyle = "rgba(7, 34, 42, 0.36)";
      for (let index = -1; index < 7; index += 1) {
        const x = index * 190 - (scroll % 190);
        ctx.fillRect(x, horizonY - 78, 142, 78);
        ctx.fillStyle = "rgba(206, 246, 226, 0.13)";
        for (let seat = 0; seat < 5; seat += 1) {
          ctx.fillRect(x + 13 + seat * 24, horizonY - 58, 11, 4);
        }
        ctx.fillStyle = "rgba(7, 34, 42, 0.36)";
      }
      ctx.strokeStyle = "rgba(235, 255, 233, 0.25)";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(0, horizonY - 25);
      ctx.lineTo(viewport.width, horizonY - 25);
      ctx.stroke();
    }

    if (progress > 0.13 && progress < 0.74) {
      ctx.strokeStyle = "rgba(101, 218, 235, 0.24)";
      ctx.fillStyle = "rgba(9, 39, 58, 0.42)";
      ctx.lineWidth = 3;
      for (let index = -1; index < 6; index += 1) {
        const x = index * 230 - ((scroll * 0.76) % 230);
        ctx.fillRect(x + 39, horizonY - 106, 13, 106);
        ctx.beginPath();
        ctx.moveTo(x + 45, horizonY - 106);
        ctx.lineTo(x + 16, horizonY - 40);
        ctx.moveTo(x + 45, horizonY - 106);
        ctx.lineTo(x + 76, horizonY - 40);
        ctx.stroke();
        for (let ring = 0; ring < 3; ring += 1) {
          ctx.beginPath();
          ctx.arc(x + 45, horizonY - 92, 22 + ring * 10, Math.PI * 1.16, Math.PI * 1.84);
          ctx.stroke();
        }
      }
    }

    if (progress > 0.5) {
      ctx.fillStyle = "rgba(5, 19, 36, 0.5)";
      const blockWidth = viewport.width < 600 ? 76 : 110;
      for (let index = -1; index < 12; index += 1) {
        const x = index * (blockWidth + 24) - ((scroll * 1.12) % (blockWidth + 24));
        const height = 86 + ((index + 12) % 3) * 24;
        ctx.fillRect(x, horizonY - height, blockWidth, height);
        ctx.fillStyle = "rgba(83, 221, 245, 0.16)";
        for (let row = 0; row < 4; row += 1) {
          ctx.fillRect(x + 12, horizonY - height + 16 + row * 17, blockWidth - 24, 4);
        }
        ctx.fillStyle = "rgba(5, 19, 36, 0.5)";
      }
    }

    if (progress > 0.8) {
      const pulse = 0.12 + Math.sin(now * 0.003) * 0.03;
      ctx.fillStyle = `rgba(255, 202, 87, ${pulse})`;
      ctx.fillRect(0, horizonY - 7, viewport.width, 7);
    }
  }

  function drawGoal(camera, now) {
    const x = worldToX(CONFIG.courseLength, camera);
    if (x < -70 || x > viewport.width + 90) return;

    const height = clamp(viewport.height * 0.34, 150, 220);
    const gateWidth = clamp(viewport.width * 0.13, 70, 130);
    const pulse = 0.82 + Math.sin(now * 0.008) * 0.1;

    ctx.save();
    ctx.translate(x, camera.groundY);
    ctx.shadowColor = `rgba(255, 211, 104, ${pulse})`;
    ctx.shadowBlur = 20;
    ctx.fillStyle = "#f8c954";
    ctx.fillRect(-gateWidth / 2, -height, 8, height);
    ctx.fillRect(gateWidth / 2 - 8, -height, 8, height);
    ctx.fillRect(-gateWidth / 2, -height, gateWidth, 12);
    ctx.shadowBlur = 0;

    ctx.fillStyle = "rgba(6, 18, 29, 0.92)";
    ctx.fillRect(-gateWidth / 2 + 8, -height + 12, gateWidth - 16, 31);
    ctx.fillStyle = "#fff4c3";
    ctx.font = "900 14px ui-sans-serif, system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("GOAL", 0, -height + 27);

    for (let index = 0; index < 6; index += 1) {
      ctx.fillStyle = index % 2 === 0 ? "#f7f8ed" : "#132536";
      ctx.fillRect(-4, -index * 14, 8, 14);
    }
    ctx.restore();
  }

  function drawObstacle(obstacle, camera, now) {
    const pose = getObstaclePose(obstacle, game.run.playerDistance, now);
    const x = worldToX(obstacle.position, camera) + pose.jitterPx;
    const width = clamp(obstacle.widthM * camera.pixelsPerMeter, 24, 60);
    const height = obstacle.heightM * camera.verticalPixelsPerMeter;
    const bottomY = camera.groundY - pose.bottomMeters * camera.verticalPixelsPerMeter + pose.sinkMeters * camera.verticalPixelsPerMeter;

    if (x < -width * 2 || x > viewport.width + width * 2) return;

    ctx.save();
    ctx.translate(x, bottomY);

    const shadowScale = clamp(1 - pose.bottomMeters / (CONFIG.flyingPeakMeters * 1.2), 0.25, 1);
    ctx.save();
    ctx.translate(0, pose.bottomMeters * camera.verticalPixelsPerMeter - pose.sinkMeters * camera.verticalPixelsPerMeter);
    ctx.scale(shadowScale, 1);
    ctx.fillStyle = `rgba(0, 0, 0, ${0.25 * shadowScale})`;
    ctx.beginPath();
    ctx.ellipse(0, 4, width * 0.56, 6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    if (pose.phase === "SHAKE" || pose.phase === "SINK") {
      ctx.strokeStyle = "rgba(255, 221, 132, 0.56)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(-width * 0.56, -height * 0.5, 5, Math.PI * 0.55, Math.PI * 1.45);
      ctx.arc(width * 0.56, -height * 0.5, 5, -Math.PI * 0.45, Math.PI * 0.45);
      ctx.stroke();
    }

    if (obstacle.type === "cable") drawCable(width, height);
    if (obstacle.type === "router") drawRouter(width, height, false);
    if (obstacle.type === "wifi") drawRouter(width, height, true);
    if (obstacle.type === "cell") drawCellTower(width, height);
    if (obstacle.type === "rack") drawServerRack(width, height);
    ctx.restore();
  }

  function drawCable(width, height) {
    ctx.strokeStyle = "#172431";
    ctx.lineWidth = Math.max(5, height * 0.18);
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.ellipse(-width * 0.08, -height * 0.44, width * 0.36, height * 0.34, -0.12, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = "#65dbe8";
    ctx.lineWidth = Math.max(2, height * 0.05);
    ctx.stroke();
    ctx.fillStyle = "#d9edf0";
    roundedRectPath(ctx, width * 0.24, -height * 0.52, width * 0.36, height * 0.4, 3);
    ctx.fill();
    ctx.fillStyle = "#d6ae4e";
    ctx.fillRect(width * 0.49, -height * 0.42, width * 0.16, height * 0.2);
  }

  function drawRouter(width, height, wifi) {
    ctx.strokeStyle = "#b8f3f6";
    ctx.lineWidth = 3;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(-width * 0.36, -height * 0.7);
    ctx.lineTo(-width * 0.52, -height * 1.08);
    ctx.moveTo(width * 0.36, -height * 0.7);
    ctx.lineTo(width * 0.52, -height * 1.08);
    ctx.stroke();

    ctx.fillStyle = wifi ? "#173e5d" : "#19333f";
    ctx.strokeStyle = wifi ? "#67e6ff" : "#9ecad1";
    ctx.lineWidth = 2;
    roundedRectPath(ctx, -width / 2, -height * 0.68, width, height * 0.66, 7);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = "#72f0bd";
    for (let index = 0; index < 3; index += 1) {
      ctx.beginPath();
      ctx.arc(-width * 0.27 + index * width * 0.18, -height * 0.26, 2.2, 0, Math.PI * 2);
      ctx.fill();
    }

    if (wifi) {
      ctx.strokeStyle = "rgba(157, 243, 255, 0.9)";
      ctx.lineWidth = 2;
      for (let ring = 0; ring < 2; ring += 1) {
        ctx.beginPath();
        ctx.arc(0, -height * 0.73, width * (0.18 + ring * 0.14), Math.PI * 1.18, Math.PI * 1.82);
        ctx.stroke();
      }
    }
  }

  function drawCellTower(width, height) {
    ctx.strokeStyle = "#b6d7df";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(-width * 0.38, 0);
    ctx.lineTo(0, -height);
    ctx.lineTo(width * 0.38, 0);
    ctx.moveTo(-width * 0.24, -height * 0.38);
    ctx.lineTo(width * 0.24, -height * 0.38);
    ctx.moveTo(-width * 0.13, -height * 0.68);
    ctx.lineTo(width * 0.13, -height * 0.68);
    ctx.stroke();
    ctx.fillStyle = "#54d8eb";
    roundedRectPath(ctx, -width * 0.32, -height * 0.94, width * 0.22, height * 0.34, 3);
    ctx.fill();
    roundedRectPath(ctx, width * 0.1, -height * 0.94, width * 0.22, height * 0.34, 3);
    ctx.fill();
    ctx.fillStyle = "#ffc95e";
    ctx.beginPath();
    ctx.arc(0, -height, 4, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawServerRack(width, height) {
    ctx.fillStyle = "#101d2b";
    ctx.strokeStyle = "#74dbea";
    ctx.lineWidth = 2;
    roundedRectPath(ctx, -width / 2, -height, width, height, 5);
    ctx.fill();
    ctx.stroke();
    for (let row = 0; row < 5; row += 1) {
      const y = -height + 8 + row * ((height - 13) / 5);
      ctx.fillStyle = "#26384a";
      ctx.fillRect(-width * 0.36, y, width * 0.72, Math.max(5, height * 0.09));
      ctx.fillStyle = row % 2 === 0 ? "#70f0b9" : "#ffca57";
      ctx.beginPath();
      ctx.arc(width * 0.23, y + Math.max(2.5, height * 0.045), 2, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawObstacles(camera, now) {
    const behindMeters = camera.playerX / camera.pixelsPerMeter + 10;
    for (const obstacle of game.course) {
      const relative = obstacle.position - game.run.playerDistance;
      if (relative < -behindMeters || relative > camera.lookAheadMeters + 10) continue;
      drawObstacle(obstacle, camera, now);
    }
  }

  function drawRunningJockeyLegs(runPhase, navy, bootNavy, turquoiseLight, racingWhite) {
    const leftKneeX = -7 - runPhase * 8;
    const leftFootX = -17 - runPhase * 12;
    const rightKneeX = 7 + runPhase * 8;
    const rightFootX = 17 + runPhase * 12;

    ctx.strokeStyle = navy;
    ctx.lineWidth = 12;
    ctx.beginPath();
    ctx.moveTo(-3, -30);
    ctx.lineTo(leftKneeX, -15);
    ctx.lineTo(leftFootX, -1);
    ctx.moveTo(3, -30);
    ctx.lineTo(rightKneeX, -15);
    ctx.lineTo(rightFootX, -1);
    ctx.stroke();

    ctx.strokeStyle = racingWhite;
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.moveTo(-3, -30);
    ctx.lineTo(leftKneeX, -15);
    ctx.moveTo(3, -30);
    ctx.lineTo(rightKneeX, -15);
    ctx.stroke();

    ctx.strokeStyle = bootNavy;
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.moveTo(leftKneeX, -16);
    ctx.lineTo(leftFootX, -1);
    ctx.moveTo(rightKneeX, -16);
    ctx.lineTo(rightFootX, -1);
    ctx.stroke();

    ctx.strokeStyle = turquoiseLight;
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(leftKneeX - 1, -14);
    ctx.lineTo(leftFootX - 1, -3);
    ctx.moveTo(rightKneeX - 1, -14);
    ctx.lineTo(rightFootX - 1, -3);
    ctx.stroke();

    ctx.strokeStyle = navy;
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(leftFootX - 2, -1);
    ctx.lineTo(leftFootX + 6, -1);
    ctx.moveTo(rightFootX - 2, -1);
    ctx.lineTo(rightFootX + 6, -1);
    ctx.stroke();
  }

  function drawMountedJockeyLegs(navy, bootNavy, turquoiseLight, racingWhite) {
    ctx.save();
    ctx.globalAlpha = 0.72;
    ctx.strokeStyle = racingWhite;
    ctx.lineWidth = 9;
    ctx.beginPath();
    ctx.moveTo(3, -31);
    ctx.lineTo(15, -17);
    ctx.stroke();
    ctx.strokeStyle = bootNavy;
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.moveTo(15, -17);
    ctx.lineTo(8, 1);
    ctx.stroke();
    ctx.restore();

    ctx.fillStyle = racingWhite;
    ctx.strokeStyle = navy;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.ellipse(0, -30, 9, 6, 0.08, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.strokeStyle = racingWhite;
    ctx.lineWidth = 10;
    ctx.beginPath();
    ctx.moveTo(-3, -30);
    ctx.lineTo(-17, -15);
    ctx.stroke();

    ctx.strokeStyle = bootNavy;
    ctx.lineWidth = 9;
    ctx.beginPath();
    ctx.moveTo(-17, -15);
    ctx.lineTo(-7, 4);
    ctx.stroke();
    ctx.strokeStyle = turquoiseLight;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(-15, -13);
    ctx.lineTo(-7, 2);
    ctx.stroke();
    ctx.strokeStyle = navy;
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(-9, 4);
    ctx.lineTo(0, 4);
    ctx.stroke();
  }

  function drawJockey(x, feetY, now, options = {}) {
    const scale = options.scale || clamp(viewport.height / 630, 0.78, 1.12);
    const running = Boolean(options.running);
    const mounted = Boolean(options.mounted);
    const stumbling = Boolean(options.stumbling);
    const runPhase = running ? Math.sin((game.run.elapsedMs / 1000) * 15) : 0;
    const bounce = running ? Math.abs(Math.cos((game.run.elapsedMs / 1000) * 15)) * 1.4 : 0;
    const lean = stumbling
      ? Math.sin(now * 0.045) * 0.17 + 0.34
      : mounted
        ? 0.15
        : running
          ? 0.16
          : 0.1;
    const navy = "#071827";
    const bootNavy = "#10283d";
    const turquoise = "#20c8d2";
    const turquoiseLight = "#7cf3f5";
    const racingWhite = "#f8fbf4";
    const skin = "#efbd94";
    const headX = 9.5;
    const headY = -67;
    const headRadius = 9.5;

    ctx.save();
    ctx.translate(x, feetY - bounce);
    ctx.scale(scale, scale);
    ctx.rotate(lean);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    if (mounted) {
      drawMountedJockeyLegs(navy, bootNavy, turquoiseLight, racingWhite);
    } else {
      drawRunningJockeyLegs(runPhase, navy, bootNavy, turquoiseLight, racingWhite);
    }

    const frontArmOffset = runPhase * 4;
    ctx.strokeStyle = navy;
    ctx.lineWidth = 11;
    ctx.beginPath();
    ctx.moveTo(-5, -53);
    ctx.lineTo(-16 - frontArmOffset, -41);
    ctx.lineTo(-7 - frontArmOffset, -33);
    ctx.moveTo(11, -54);
    ctx.lineTo(24 + frontArmOffset, -44);
    ctx.lineTo(18 + frontArmOffset, -34);
    ctx.stroke();

    ctx.strokeStyle = turquoise;
    ctx.lineWidth = 7;
    ctx.beginPath();
    ctx.moveTo(-5, -53);
    ctx.lineTo(-16 - frontArmOffset, -41);
    ctx.lineTo(-7 - frontArmOffset, -33);
    ctx.moveTo(11, -54);
    ctx.lineTo(24 + frontArmOffset, -44);
    ctx.lineTo(18 + frontArmOffset, -34);
    ctx.stroke();

    ctx.fillStyle = racingWhite;
    for (const hand of [
      [-7 - frontArmOffset, -33],
      [18 + frontArmOffset, -34],
    ]) {
      ctx.beginPath();
      ctx.arc(hand[0], hand[1], 3.8, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = navy;
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }

    ctx.fillStyle = skin;
    ctx.strokeStyle = navy;
    ctx.lineWidth = 2;
    roundedRectPath(ctx, headX - 4.5, headY + 5.5, 8, 12, 3);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = turquoise;
    ctx.strokeStyle = navy;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(-9, -55);
    ctx.quadraticCurveTo(1, -63, 13, -57);
    ctx.lineTo(11, -31);
    ctx.quadraticCurveTo(1, -27, -8, -31);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = racingWhite;
    ctx.beginPath();
    ctx.moveTo(-6, -54);
    ctx.lineTo(2, -59);
    ctx.lineTo(11, -54);
    ctx.lineTo(3, -46);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = navy;
    ctx.beginPath();
    ctx.moveTo(0, -48);
    ctx.lineTo(8, -41);
    ctx.lineTo(1, -35);
    ctx.lineTo(-6, -42);
    ctx.closePath();
    ctx.fill();

    ctx.save();
    ctx.translate(headX, headY);

    ctx.fillStyle = skin;
    ctx.strokeStyle = navy;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, headRadius, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.strokeStyle = navy;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(-9, -3);
    ctx.lineTo(11, -2);
    ctx.stroke();

    ctx.fillStyle = navy;
    ctx.strokeStyle = "#020a11";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-12, -5);
    ctx.quadraticCurveTo(-10, -17, 2, -18);
    ctx.quadraticCurveTo(12, -16, 12, -6);
    ctx.lineTo(6, -2);
    ctx.lineTo(-8, -3);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = turquoise;
    ctx.beginPath();
    ctx.moveTo(-9, -8);
    ctx.quadraticCurveTo(-6, -15, 2, -15);
    ctx.quadraticCurveTo(7, -14, 9, -8);
    ctx.lineTo(2, -6);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = racingWhite;
    ctx.beginPath();
    ctx.moveTo(-2, -16);
    ctx.lineTo(2, -17);
    ctx.lineTo(5, -7);
    ctx.lineTo(1, -6);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = navy;
    ctx.beginPath();
    ctx.moveTo(8, -7);
    ctx.lineTo(18, -4);
    ctx.lineTo(9, -2);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = "rgba(119, 239, 255, 0.92)";
    ctx.strokeStyle = racingWhite;
    ctx.lineWidth = 1.8;
    roundedRectPath(ctx, -4, -6, 15, 6, 2.5);
    ctx.fill();
    ctx.stroke();

    ctx.strokeStyle = navy;
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(3.5, -6);
    ctx.lineTo(3.5, 0);
    ctx.stroke();

    ctx.restore();
    ctx.restore();
  }

  function interpolateHorseLeg(first, second, amount) {
    return first.map((point, index) => [
      lerp(point[0], second[index][0], amount),
      lerp(point[1], second[index][1], amount),
    ]);
  }

  function getHorseGaitLegs(now) {
    const cycle = ((now / 1000) / CONFIG.horseGaitCycleSec) % 1;
    const framePosition = cycle * HORSE_GAIT_KEYFRAMES.length;
    const currentIndex = Math.floor(framePosition) % HORSE_GAIT_KEYFRAMES.length;
    const nextIndex = (currentIndex + 1) % HORSE_GAIT_KEYFRAMES.length;
    const blend = easeInOutCubic(framePosition - Math.floor(framePosition));

    return HORSE_GAIT_KEYFRAMES[currentIndex].map((leg, index) =>
      interpolateHorseLeg(leg, HORSE_GAIT_KEYFRAMES[nextIndex][index], blend),
    );
  }

  function drawHorseLeg(points, fillColor, outlineColor, farLeg = false) {
    ctx.save();
    ctx.globalAlpha = farLeg ? 0.76 : 1;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    ctx.strokeStyle = outlineColor;
    ctx.lineWidth = farLeg ? 9 : 10;
    ctx.beginPath();
    ctx.moveTo(points[0][0], points[0][1]);
    ctx.lineTo(points[1][0], points[1][1]);
    ctx.lineTo(points[2][0], points[2][1]);
    ctx.stroke();

    ctx.strokeStyle = fillColor;
    ctx.lineWidth = farLeg ? 5.2 : 6.2;
    ctx.stroke();

    ctx.strokeStyle = outlineColor;
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(points[2][0] - 2, points[2][1]);
    ctx.lineTo(points[2][0] + 6, points[2][1]);
    ctx.stroke();
    ctx.restore();
  }

  function drawHorse(x, groundY, now, options = {}) {
    const scale = options.scale || 1;
    const direction = options.direction === -1 ? -1 : 1;
    const pose = options.pose || HORSE_POSES.IDLE;
    const progress = clamp(options.progress ?? 1, 0, 1);
    const idlePhase = ((now / 1000) / CONFIG.horseIdleCycleSec) * Math.PI * 2;
    const gaitPhase = ((now / 1000) / CONFIG.horseGaitCycleSec) * Math.PI * 2;
    const settleProgress = easeInOutCubic(
      (progress - CONFIG.horseSettleStartProgress) /
        (1 - CONFIG.horseSettleStartProgress),
    );
    const movementAmount = pose === HORSE_POSES.IDLE ? 0 : 1 - settleProgress;
    const gaitLegs = getHorseGaitLegs(now);
    const legs = HORSE_STANDING_LEGS.map((standingLeg, index) =>
      interpolateHorseLeg(standingLeg, gaitLegs[index], movementAmount),
    );
    const idleLift = Math.sin(idlePhase) * 0.7;
    const gaitLift = 1.4 + Math.abs(Math.sin(gaitPhase)) * 2.2;
    const bodyLift = lerp(idleLift, gaitLift, movementAmount);
    const headNod = lerp(Math.sin(idlePhase * 0.72) * 0.8, Math.sin(gaitPhase) * 1.8, movementAmount);
    const tailSwing = lerp(Math.sin(idlePhase * 0.8) * 3.5, Math.sin(gaitPhase) * 8, movementAmount);
    const navy = "#071827";
    const navySoft = "#10283d";
    const turquoise = "#20c8d2";
    const turquoiseLight = "#7cf3f5";
    const racingWhite = "#f8fbf4";
    const chestnut = "#965337";
    const chestnutLight = "#c8784b";
    const chestnutShadow = "#653126";

    ctx.save();
    ctx.translate(x, groundY + 2);
    ctx.scale(scale, scale);
    ctx.fillStyle = `rgba(3, 13, 21, ${0.2 + movementAmount * 0.08})`;
    ctx.beginPath();
    ctx.ellipse(0, 0, 53 - movementAmount * 5, 6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    ctx.save();
    ctx.translate(x, groundY - bodyLift);
    ctx.scale(direction * scale, scale);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    ctx.strokeStyle = navy;
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.moveTo(-39, -57);
    ctx.bezierCurveTo(-54, -62 - tailSwing * 0.18, -68, -58 + tailSwing, -72, -42 + tailSwing * 0.4);
    ctx.stroke();
    ctx.strokeStyle = turquoise;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-44, -59);
    ctx.quadraticCurveTo(-59, -61 + tailSwing, -69, -44 + tailSwing * 0.4);
    ctx.stroke();

    drawHorseLeg(legs[0], chestnutShadow, navy, true);
    drawHorseLeg(legs[1], chestnutShadow, navy, true);
    drawHorseLeg(legs[2], chestnut, navy, false);
    drawHorseLeg(legs[3], chestnut, navy, false);

    ctx.fillStyle = chestnut;
    ctx.strokeStyle = navy;
    ctx.lineWidth = 3.2;
    ctx.beginPath();
    ctx.moveTo(-43, -54);
    ctx.bezierCurveTo(-39, -70, -18, -75, 6, -72);
    ctx.bezierCurveTo(29, -71, 43, -62, 43, -49);
    ctx.bezierCurveTo(43, -34, 24, -27, -4, -27);
    ctx.bezierCurveTo(-31, -27, -48, -36, -43, -54);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = chestnutLight;
    ctx.beginPath();
    ctx.ellipse(-17, -52, 19, 12, -0.08, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = chestnut;
    ctx.strokeStyle = navy;
    ctx.lineWidth = 3.2;
    ctx.beginPath();
    ctx.moveTo(24, -63);
    ctx.bezierCurveTo(33, -72, 37, -89 + headNod, 50, -93 + headNod);
    ctx.lineTo(64, -80 + headNod);
    ctx.bezierCurveTo(54, -70, 47, -54, 39, -41);
    ctx.lineTo(27, -44);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = navy;
    ctx.beginPath();
    ctx.moveTo(30, -66);
    ctx.lineTo(35, -81 + headNod);
    ctx.lineTo(40, -77 + headNod);
    ctx.lineTo(42, -90 + headNod);
    ctx.lineTo(47, -85 + headNod);
    ctx.lineTo(51, -96 + headNod);
    ctx.lineTo(56, -84 + headNod);
    ctx.lineTo(48, -72);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = chestnut;
    ctx.strokeStyle = navy;
    ctx.lineWidth = 3.2;
    ctx.beginPath();
    ctx.moveTo(47, -92 + headNod);
    ctx.bezierCurveTo(55, -99 + headNod, 68, -96 + headNod, 73, -88 + headNod);
    ctx.bezierCurveTo(80, -84 + headNod, 80, -77 + headNod, 73, -74 + headNod);
    ctx.lineTo(61, -73 + headNod);
    ctx.bezierCurveTo(54, -75 + headNod, 49, -82 + headNod, 47, -92 + headNod);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = chestnut;
    ctx.strokeStyle = navy;
    ctx.lineWidth = 2.6;
    ctx.beginPath();
    ctx.moveTo(52, -94 + headNod);
    ctx.lineTo(51, -106 + headNod);
    ctx.lineTo(59, -96 + headNod);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(62, -95 + headNod);
    ctx.lineTo(66, -106 + headNod);
    ctx.lineTo(69, -94 + headNod);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = navySoft;
    ctx.strokeStyle = turquoise;
    ctx.lineWidth = 2.4;
    roundedRectPath(ctx, -21, -71, 43, 23, 5);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = racingWhite;
    ctx.beginPath();
    ctx.moveTo(-13, -70);
    ctx.lineTo(-4, -70);
    ctx.lineTo(10, -49);
    ctx.lineTo(1, -49);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = turquoise;
    roundedRectPath(ctx, -15, -76, 34, 8, 4);
    ctx.fill();
    ctx.strokeStyle = navy;
    ctx.lineWidth = 2.3;
    ctx.stroke();

    ctx.strokeStyle = turquoiseLight;
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.moveTo(55, -91 + headNod);
    ctx.quadraticCurveTo(65, -87 + headNod, 75, -84 + headNod);
    ctx.moveTo(63, -74 + headNod);
    ctx.quadraticCurveTo(67, -83 + headNod, 66, -93 + headNod);
    ctx.stroke();

    ctx.fillStyle = racingWhite;
    ctx.beginPath();
    ctx.arc(64, -88 + headNod, 2.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = navy;
    ctx.beginPath();
    ctx.arc(64.8, -88 + headNod, 1.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(74, -78 + headNod, 1.6, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = turquoiseLight;
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.moveTo(-30, -45);
    ctx.quadraticCurveTo(-20, -35, -5, -33);
    ctx.stroke();

    ctx.restore();
  }

  function drawPlayer(camera, now) {
    const jumpHeight = getJumpHeightMeters();
    const feetY = camera.groundY - jumpHeight * camera.verticalPixelsPerMeter;
    const airborne = jumpHeight > 0.05;
    const shadowScale = clamp(1 - jumpHeight / 8, 0.35, 1);

    ctx.save();
    ctx.translate(camera.playerX, camera.groundY + 4);
    ctx.scale(shadowScale, 1);
    ctx.fillStyle = `rgba(0, 0, 0, ${0.32 * shadowScale})`;
    ctx.beginPath();
    ctx.ellipse(0, 0, 24, 6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    drawJockey(camera.playerX, feetY, now, {
      running: game.state === STATES.RUNNING && !airborne && game.run.stumbleRemainingSec <= 0,
      stumbling: game.run.stumbleRemainingSec > 0,
    });
  }

  function drawIntro(camera, now) {
    const elapsed = (now - game.stateEnteredAt) / 1000;
    const introTravelProgress = clamp(elapsed / 0.68, 0, 1);
    const stopProgress = easeOutCubic(introTravelProgress);
    const horseX = lerp(-130, viewport.width * 0.42, stopProgress);
    const horseScale = clamp(viewport.width / 850, 0.68, 1);
    drawHorse(horseX, camera.groundY, now, {
      scale: horseScale,
      direction: 1,
      pose: HORSE_POSES.INTRO_STOP,
      progress: introTravelProgress,
    });

    let jockeyX = horseX;
    const mountedFeetY = camera.groundY - 73 * horseScale;
    let jockeyFeetY = mountedFeetY;
    let mounted = true;

    if (elapsed >= 0.72) {
      const dismountProgress = easeInOutCubic((elapsed - 0.72) / 0.7);
      jockeyX = lerp(horseX, horseX - 56, dismountProgress);
      jockeyFeetY = lerp(mountedFeetY, camera.groundY, dismountProgress);
      mounted = dismountProgress < 0.86;
    }

    if (elapsed >= 1.42) {
      const walkProgress = easeInOutCubic((elapsed - 1.42) / 0.82);
      jockeyX = lerp(horseX - 56, camera.playerX, walkProgress);
      jockeyFeetY = camera.groundY;
      mounted = false;
    }

    drawJockey(jockeyX, jockeyFeetY, now, { mounted, running: elapsed > 1.42 });

    ctx.fillStyle = "rgba(244, 252, 255, 0.76)";
    ctx.font = `800 ${clamp(viewport.width * 0.025, 13, 20)}px ui-sans-serif, system-ui, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.letterSpacing = "0.12em";
    const introLabel = elapsed < 0.7 ? "RACE FINISH" : elapsed < 1.42 ? "DISMOUNT" : "TO THE START LINE";
    ctx.fillText(introLabel, viewport.width / 2, viewport.height * 0.19);
    ctx.letterSpacing = "0px";
  }

  function drawCountdown(now) {
    const elapsed = (now - game.stateEnteredAt) / 1000;
    let label = "3";
    let segmentProgress = elapsed / 0.78;
    if (elapsed >= 0.78 && elapsed < 1.56) {
      label = "2";
      segmentProgress = (elapsed - 0.78) / 0.78;
    } else if (elapsed >= 1.56 && elapsed < 2.34) {
      label = "1";
      segmentProgress = (elapsed - 1.56) / 0.78;
    } else if (elapsed >= 2.34) {
      label = "RUN!";
      segmentProgress = (elapsed - 2.34) / 0.81;
    }

    const scale = 0.82 + Math.sin(clamp(segmentProgress, 0, 1) * Math.PI) * 0.15;
    ctx.save();
    ctx.translate(viewport.width / 2, viewport.height * 0.38);
    ctx.scale(scale, scale);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = `950 ${label === "RUN!" ? clamp(viewport.width * 0.12, 54, 112) : clamp(viewport.width * 0.16, 70, 138)}px ui-sans-serif, system-ui, sans-serif`;
    ctx.shadowColor = label === "RUN!" ? "rgba(255, 202, 87, 0.72)" : "rgba(82, 231, 255, 0.66)";
    ctx.shadowBlur = 30;
    ctx.fillStyle = label === "RUN!" ? "#ffda78" : "#f4fdff";
    ctx.fillText(label, 0, 0);
    ctx.restore();
  }

  function drawHud() {
    if (![STATES.RUNNING, STATES.PAUSED].includes(game.state)) return;
    const padX = clamp(viewport.width * 0.035, 14, 32);
    const top = clamp(viewport.height * 0.04, 18, 30);
    const labelSize = clamp(viewport.width * 0.018, 11, 15);
    const valueSize = clamp(viewport.width * 0.044, 27, 43);
    const goalMeters = getGoalMeters();

    ctx.save();
    ctx.textBaseline = "top";
    ctx.fillStyle = "rgba(5, 17, 28, 0.58)";
    roundedRectPath(ctx, padX - 10, top - 8, 105, valueSize + labelSize + 21, 13);
    ctx.fill();
    roundedRectPath(ctx, viewport.width - padX - 111, top - 8, 121, valueSize + labelSize + 21, 13);
    ctx.fill();

    ctx.textAlign = "left";
    ctx.fillStyle = "rgba(218, 244, 248, 0.72)";
    ctx.font = `800 ${labelSize}px ui-sans-serif, system-ui, sans-serif`;
    ctx.fillText("TIME", padX, top);
    ctx.fillStyle = "#ffffff";
    ctx.font = `900 ${valueSize}px ui-sans-serif, system-ui, sans-serif`;
    ctx.fillText(getRemainingTimeSec().toFixed(1), padX, top + labelSize + 3);

    ctx.textAlign = "right";
    ctx.fillStyle = "rgba(218, 244, 248, 0.72)";
    ctx.font = `800 ${labelSize}px ui-sans-serif, system-ui, sans-serif`;
    ctx.fillText("GOAL", viewport.width - padX, top);
    ctx.fillStyle = "#ffffff";
    ctx.font = `900 ${valueSize}px ui-sans-serif, system-ui, sans-serif`;
    ctx.fillText(`${goalMeters}m`, viewport.width - padX, top + labelSize + 3);
    ctx.restore();
  }

  function drawTransientJumpHint() {
    if (game.state !== STATES.RUNNING || game.run.playerDistance > 72) return;
    const fade = clamp(1 - game.run.playerDistance / 72, 0, 1);
    ctx.save();
    ctx.globalAlpha = fade;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "rgba(238, 252, 255, 0.82)";
    ctx.font = `800 ${clamp(viewport.width * 0.022, 12, 18)}px ui-sans-serif, system-ui, sans-serif`;
    ctx.fillText("SPACE · CLICK · TAP  —  JUMP", viewport.width / 2, viewport.height * 0.18);
    ctx.restore();
  }

  function drawTitleScene(camera, now) {
    const horseScale = clamp(viewport.width / 960, 0.62, 1.02);
    const horseX = viewport.width < 600 ? viewport.width * 0.76 : viewport.width * 0.79;
    drawHorse(horseX, camera.groundY, now, {
      scale: horseScale,
      direction: 1,
      pose: HORSE_POSES.IDLE,
    });
    drawJockey(horseX + 2, camera.groundY - 70 * horseScale, now, {
      mounted: true,
      scale: horseScale * 0.9,
    });
  }

  function getClearElapsedSec(now) {
    return Math.max(0, (now - game.stateEnteredAt) / 1000);
  }

  function drawClearRadiance(now) {
    if (game.state !== STATES.CLEAR) return;

    const elapsed = getClearElapsedSec(now);
    const isCelebrating = game.celebration.phase === "CELEBRATION";
    const entrance = easeOutCubic(elapsed / 0.3);
    const intensity = isCelebrating ? 0.72 * entrance : 0.3;
    const centerX = viewport.width * 0.5;
    const centerY = viewport.height * 0.38;
    const outerRadius = Math.hypot(viewport.width, viewport.height) * 0.7;

    ctx.save();
    ctx.globalCompositeOperation = "screen";

    const glow = ctx.createRadialGradient(centerX, centerY, 8, centerX, centerY, outerRadius * 0.76);
    glow.addColorStop(0, `rgba(255, 244, 185, ${intensity})`);
    glow.addColorStop(0.28, `rgba(255, 196, 64, ${intensity * 0.52})`);
    glow.addColorStop(1, "rgba(255, 187, 58, 0)");
    ctx.fillStyle = glow;
    ctx.fillRect(-20, -20, viewport.width + 40, viewport.height + 40);

    ctx.translate(centerX, centerY);
    ctx.rotate(elapsed * 0.12);
    for (let index = 0; index < 24; index += 1) {
      const angle = (Math.PI * 2 * index) / 24;
      const halfWidth = index % 2 === 0 ? 0.052 : 0.026;
      ctx.fillStyle = index % 2 === 0
        ? `rgba(255, 226, 129, ${intensity * 0.27})`
        : `rgba(113, 238, 255, ${intensity * 0.16})`;
      ctx.beginPath();
      ctx.moveTo(Math.cos(angle - halfWidth) * 38, Math.sin(angle - halfWidth) * 38);
      ctx.lineTo(
        Math.cos(angle) * outerRadius,
        Math.sin(angle) * outerRadius,
      );
      ctx.lineTo(Math.cos(angle + halfWidth) * 38, Math.sin(angle + halfWidth) * 38);
      ctx.closePath();
      ctx.fill();
    }

    const ringProgress = (elapsed * 1.6) % 1;
    ctx.strokeStyle = `rgba(255, 241, 184, ${(1 - ringProgress) * intensity * 0.5})`;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(0, 0, lerp(38, outerRadius * 0.42, ringProgress), 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  function drawHorseReturn(camera, now) {
    if (game.state !== STATES.CLEAR) return;

    const elapsed = getClearElapsedSec(now);
    const entryProgress = clamp(
      (elapsed - CONFIG.clearHorseEntryDelaySec) / CONFIG.clearHorseEntryDurationSec,
      0,
      1,
    );
    const arrivalProgress = game.celebration.phase === "RESULT"
      ? 1
      : easeOutCubic(entryProgress);
    if (arrivalProgress <= 0) return;

    const horseScale = clamp(viewport.width / 900, 0.58, 0.94);
    const targetX = Math.min(
      viewport.width - 82 * horseScale,
      camera.playerX + 124 * horseScale,
    );
    const horseX = lerp(viewport.width + 92 * horseScale, targetX, arrivalProgress);

    if (arrivalProgress < 0.96) {
      ctx.save();
      ctx.fillStyle = `rgba(255, 231, 170, ${(1 - arrivalProgress) * 0.32})`;
      for (let index = 0; index < 5; index += 1) {
        const dustX = horseX - 45 * horseScale - index * 17 * horseScale;
        const dustY = camera.groundY - (index % 2) * 8;
        ctx.beginPath();
        ctx.arc(dustX, dustY, (5 + index * 1.5) * horseScale, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    drawHorse(horseX, camera.groundY, now, {
      scale: horseScale,
      direction: -1,
      pose: game.celebration.phase === "RESULT"
        ? HORSE_POSES.IDLE
        : HORSE_POSES.CLEAR_ENTER,
      progress: entryProgress,
    });
  }

  function drawClearConfetti(elapsed) {
    const fade = 1 - clamp((elapsed - 0.94) / 0.5, 0, 0.58);
    ctx.save();
    ctx.globalAlpha = fade;

    for (const particle of game.celebration.confetti) {
      const x = (particle.startX + particle.velocityX * elapsed) * viewport.width;
      const y =
        (particle.startY +
          particle.velocityY * elapsed +
          0.5 * particle.gravity * elapsed * elapsed) *
        viewport.height;
      const flip = Math.max(0.2, Math.abs(Math.cos(particle.rotation + particle.spin * elapsed)));

      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(particle.rotation + particle.spin * elapsed);
      ctx.fillStyle = particle.color;
      if (particle.ribbon) {
        ctx.fillRect(-particle.size * 0.25, -particle.size, particle.size * 0.5, particle.size * 2);
      } else {
        ctx.scale(flip, 1);
        ctx.fillRect(-particle.size / 2, -particle.size * 0.32, particle.size, particle.size * 0.64);
      }
      ctx.restore();
    }

    ctx.restore();
  }

  function drawClearCelebration(now) {
    if (game.state !== STATES.CLEAR || game.celebration.phase !== "CELEBRATION") return;

    const elapsed = getClearElapsedSec(now);
    const entrance = easeOutBack(elapsed / 0.34);
    const titleSize = clamp(viewport.width * 0.2, 70, 190);
    const titleY = viewport.height * 0.36;

    drawClearConfetti(elapsed);

    ctx.save();
    ctx.translate(viewport.width / 2, titleY);
    ctx.scale(entrance, entrance);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.lineJoin = "round";
    ctx.font = `950 ${titleSize}px ui-sans-serif, system-ui, sans-serif`;
    ctx.strokeStyle = "rgba(5, 15, 27, 0.92)";
    ctx.lineWidth = clamp(titleSize * 0.085, 7, 15);
    ctx.shadowColor = "rgba(255, 196, 53, 0.9)";
    ctx.shadowBlur = 38;
    ctx.strokeText("GOAL!", 0, 0);

    const titleGradient = ctx.createLinearGradient(0, -titleSize * 0.52, 0, titleSize * 0.52);
    titleGradient.addColorStop(0, "#ffffff");
    titleGradient.addColorStop(0.42, "#fff0a5");
    titleGradient.addColorStop(1, "#f7b72f");
    ctx.fillStyle = titleGradient;
    ctx.fillText("GOAL!", 0, 0);

    ctx.shadowBlur = 14;
    ctx.font = `900 ${clamp(viewport.width * 0.026, 13, 25)}px ui-sans-serif, system-ui, sans-serif`;
    ctx.letterSpacing = "0.22em";
    ctx.fillStyle = "#f8fdff";
    ctx.fillText("NET SPEED RUN", 0, titleSize * 0.63);
    ctx.letterSpacing = "0px";
    ctx.restore();

    const flash = 1 - clamp(elapsed / CONFIG.clearFlashDurationSec, 0, 1);
    if (flash > 0) {
      ctx.fillStyle = `rgba(255, 255, 238, ${flash * flash * 0.92})`;
      ctx.fillRect(0, 0, viewport.width, viewport.height);
    }
  }

  function render(now) {
    ctx.setTransform(viewport.dpr, 0, 0, viewport.dpr, 0, 0);
    ctx.clearRect(0, 0, viewport.width, viewport.height);

    if (game.state === STATES.BOOT) {
      ctx.fillStyle = "#07131f";
      ctx.fillRect(0, 0, viewport.width, viewport.height);
      return;
    }

    const camera = getCamera();

    const shakeStrength = game.run.shakeRemainingSec > 0 ? 5 * (game.run.shakeRemainingSec / 0.22) : 0;
    const clearShakeStrength =
      game.state === STATES.CLEAR && game.celebration.phase === "CELEBRATION"
        ? 8 * (1 - clamp(getClearElapsedSec(now) / CONFIG.clearShakeDurationSec, 0, 1))
        : 0;
    const combinedShake = shakeStrength + clearShakeStrength;
    const shakeX = Math.sin(now * 0.13) * combinedShake;
    const shakeY = Math.cos(now * 0.17) * combinedShake * 0.45;

    ctx.save();
    ctx.translate(shakeX, shakeY);
    drawBackground(now, camera);
    drawClearRadiance(now);

    if (game.state === STATES.TITLE) {
      drawTitleScene(camera, now);
    } else if (game.state === STATES.INTRO) {
      drawIntro(camera, now);
    } else {
      drawGoal(camera, now);
      drawObstacles(camera, now);
      drawHorseReturn(camera, now);
      drawPlayer(camera, now);
    }
    ctx.restore();

    if (game.state === STATES.COUNTDOWN) drawCountdown(now);
    drawClearCelebration(now);
    drawTransientJumpHint();
    drawHud();
  }

  function frameLoop(now) {
    update(now);
    render(now);
    requestAnimationFrame(frameLoop);
  }

  function resizeCanvas() {
    const rect = frame.getBoundingClientRect();
    const width = Math.max(1, Math.round(rect.width));
    const height = Math.max(1, Math.round(rect.height));
    const dpr = Math.min(window.devicePixelRatio || 1, CONFIG.maxDevicePixelRatio);

    viewport.width = width;
    viewport.height = height;
    viewport.dpr = dpr;
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
  }

  let localStartPending = false;
  document.querySelectorAll(".time-button").forEach((button) => {
    button.addEventListener("click", () => {
      const runTimeSec = Number(button.dataset.time);
      if (!IS_LOCAL || !CONFIG.testRunTimes.includes(runTimeSec) || localStartPending) return;
      localStartPending = true;
      void (async () => {
        try {
          await getAudio()?.start?.();
          callAudio("startBgm");
        } catch {
          // Audio is optional and must not block local gameplay.
        }
        startGame(runTimeSec);
        localStartPending = false;
      })();
    });
  });

  retryButton.addEventListener("click", requestRetry);
  changeTimeButton.addEventListener("click", requestChangeTime);
  resumeButton.addEventListener("click", requestResume);
  soundToggle.addEventListener("click", () => {
    const enabled = getAudio()?.isEnabled?.() !== false;
    callAudio("setEnabled", !enabled);
    updateSoundToggle();
  });

  canvas.addEventListener(
    "pointerdown",
    (event) => {
      if (event.pointerType === "mouse" && event.button !== 0) return;
      if (game.state !== STATES.RUNNING) return;
      event.preventDefault();
      requestJump();
    },
    { passive: false },
  );

  canvas.addEventListener("click", () => {
    requestJump();
  });

  canvas.addEventListener("contextmenu", (event) => event.preventDefault());

  window.addEventListener("keydown", (event) => {
    if (event.code !== "Space") return;
    if ([STATES.INTRO, STATES.COUNTDOWN, STATES.RUNNING, STATES.PAUSED].includes(game.state)) {
      event.preventDefault();
    }
    if (event.repeat) return;
    if (game.state === STATES.RUNNING) requestJump();
    if (game.state === STATES.PAUSED) requestResume();
  });

  document.addEventListener("visibilitychange", () => {
    if (document.hidden) requestPause(performance.now());
  });

  const resizeObserver = new ResizeObserver(resizeCanvas);
  resizeObserver.observe(frame);
  window.addEventListener("resize", resizeCanvas, { passive: true });

  window.NetSpeedRun = Object.freeze({
    version: GAME_VERSION,
    start(runTimeSec) {
      startGame(runTimeSec);
    },
  });

  updateSoundToggle();
  resizeCanvas();
  transitionTo(IS_LOCAL ? STATES.TITLE : STATES.BOOT, performance.now());
  requestAnimationFrame(frameLoop);
})();
