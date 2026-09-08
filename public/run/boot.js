export const RUN_TICKET_STORAGE_KEY = "net-speed-run-ticket-v1";

const LOCAL_HOSTNAMES = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);
const VERIFY_TIMEOUT_MS = 8000;

const isExactObject = (value, keys) => {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const valueKeys = Object.keys(value);
  return valueKeys.length === keys.length && keys.every((key) => Object.hasOwn(value, key));
};

export const isLocalRunHost = (hostname) => LOCAL_HOSTNAMES.has(hostname);

export const removeStoredRunTicket = (storage) => {
  try {
    storage.removeItem(RUN_TICKET_STORAGE_KEY);
  } catch {
    // Storage can be unavailable in privacy-restricted browser contexts.
  }
};

export const loadStoredRunTicket = (storage, nowMs = Date.now()) => {
  let raw;
  try {
    raw = storage.getItem(RUN_TICKET_STORAGE_KEY);
  } catch {
    return null;
  }
  if (raw === null) return null;

  try {
    const value = JSON.parse(raw);
    if (isExactObject(value, ["version", "ticket", "expiresAtMs"])
      && value.version === 1
      && typeof value.ticket === "string"
      && value.ticket.length > 0
      && typeof value.expiresAtMs === "number"
      && Number.isSafeInteger(value.expiresAtMs)
      && value.expiresAtMs > nowMs) {
      return value;
    }
  } catch {
    // Invalid values are removed below.
  }
  removeStoredRunTicket(storage);
  return null;
};

const isValidRunTime = (value) =>
  typeof value === "number"
  && Number.isFinite(value)
  && value >= 25
  && value <= 50
  && Number.isInteger(Math.round(value * 10))
  && Math.abs(value * 10 - Math.round(value * 10)) < 1e-9;

const parseVerifyResponse = (value, responseOk, nowMs) => {
  if (responseOk
    && isExactObject(value, ["ok", "runTimeSec", "expiresAtMs"])
    && value.ok === true
    && isValidRunTime(value.runTimeSec)
    && typeof value.expiresAtMs === "number"
    && Number.isSafeInteger(value.expiresAtMs)
    && value.expiresAtMs > nowMs) {
    return { status: "verified", runTimeSec: value.runTimeSec };
  }

  if (isExactObject(value, ["ok", "code"]) && value.ok === false) {
    if (value.code === "INVALID_RUN_TICKET" || value.code === "RUN_TICKET_EXPIRED") {
      return { status: "invalid" };
    }
    if (value.code === "SERVICE_UNAVAILABLE") return { status: "unavailable" };
  }
  return { status: "unavailable" };
};

const showBootError = ({ bootPanel, bootMessage, returnLink }) => {
  bootPanel.hidden = false;
  bootPanel.setAttribute("role", "alert");
  bootMessage.textContent = "ゲームを準備できませんでした。時間をおいて、測定画面からもう一度お試しください。";
  returnLink.hidden = false;
};

export const bootstrapProductionRun = async ({
  hostname,
  storage,
  fetchImpl,
  locationController,
  gameApi,
  bootPanel,
  bootMessage,
  returnLink,
  nowMs = Date.now(),
}) => {
  if (isLocalRunHost(hostname)) return { status: "local" };

  const stored = loadStoredRunTicket(storage, nowMs);
  if (stored === null) {
    locationController.replace("/");
    return { status: "redirected" };
  }

  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), VERIFY_TIMEOUT_MS);
  let parsed;
  try {
    const response = await fetchImpl("/api/run-ticket/verify", {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      credentials: "omit",
      cache: "no-store",
      signal: controller.signal,
      body: JSON.stringify({ ticket: stored.ticket }),
    });
    let body;
    try {
      body = await response.json();
    } catch {
      parsed = { status: "unavailable" };
    }
    if (parsed === undefined) parsed = parseVerifyResponse(body, response.ok, nowMs);
  } catch {
    parsed = { status: "unavailable" };
  } finally {
    window.clearTimeout(timeout);
  }

  if (parsed.status === "verified") {
    gameApi.start(parsed.runTimeSec);
    return parsed;
  }
  if (parsed.status === "invalid") {
    removeStoredRunTicket(storage);
    locationController.replace("/");
    return { status: "redirected" };
  }

  showBootError({ bootPanel, bootMessage, returnLink });
  return { status: "unavailable" };
};

const startBrowserBoot = () => {
  const bootPanel = document.getElementById("bootPanel");
  const bootMessage = document.getElementById("bootMessage");
  const returnLink = document.getElementById("bootReturnLink");
  if (!bootPanel || !bootMessage || !returnLink) return;
  if (!window.NetSpeedRun) {
    if (document.readyState !== "complete") {
      window.addEventListener("load", startBrowserBoot, { once: true });
    }
    return;
  }

  void bootstrapProductionRun({
    hostname: window.location.hostname,
    storage: window.sessionStorage,
    fetchImpl: window.fetch.bind(window),
    locationController: window.location,
    gameApi: window.NetSpeedRun,
    bootPanel,
    bootMessage,
    returnLink,
  });
};

if (typeof document !== "undefined" && document.getElementById("gameFrame")) {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", startBrowserBoot, { once: true });
  } else {
    startBrowserBoot();
  }
}
