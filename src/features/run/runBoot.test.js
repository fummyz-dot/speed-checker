import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  bootstrapProductionRun,
  loadStoredRunTicket,
  redirectRestoredProductionRun,
  RUN_TICKET_STORAGE_KEY,
} from "../../../public/run/boot.js";

const nowMs = 1_700_000_000_000;
const stored = { version: 1, ticket: "signed-ticket", expiresAtMs: nowMs + 60_000 };

const jsonResponse = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

const setup = (response) => {
  document.body.innerHTML = `
    <section id="bootPanel" hidden><p id="bootMessage"></p><button id="startRunButton" hidden>START RUN</button><a id="bootReturnLink" href="/" hidden>戻る</a></section>
  `;
  sessionStorage.setItem(RUN_TICKET_STORAGE_KEY, JSON.stringify(stored));
  return {
    hostname: "netspeedrace.com",
    storage: sessionStorage,
    fetchImpl: vi.fn().mockResolvedValue(response),
    locationController: { replace: vi.fn() },
    gameApi: { start: vi.fn() },
    audioApi: { start: vi.fn().mockResolvedValue(true), startBgm: vi.fn() },
    bootPanel: document.getElementById("bootPanel"),
    bootMessage: document.getElementById("bootMessage"),
    startButton: document.getElementById("startRunButton"),
    returnLink: document.getElementById("bootReturnLink"),
    nowMs,
  };
};

describe("Net Speed Run production boot", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
    sessionStorage.clear();
    localStorage.clear();
  });

  it("consumes the verified ticket and waits for START RUN before audio and gameplay", async () => {
    const context = setup(jsonResponse({
      ok: true, runTimeSec: 39.7, expiresAtMs: nowMs + 60_000,
    }));

    await expect(bootstrapProductionRun(context)).resolves.toEqual({
      status: "ready", runTimeSec: 39.7,
    });
    expect(context.fetchImpl).toHaveBeenCalledWith("/api/run-ticket/verify", expect.objectContaining({
      method: "POST",
      credentials: "omit",
      cache: "no-store",
      body: JSON.stringify({ ticket: "signed-ticket" }),
    }));
    expect(context.gameApi.start).not.toHaveBeenCalled();
    expect(context.audioApi.start).not.toHaveBeenCalled();
    expect(context.startButton).not.toHaveAttribute("hidden");
    expect(sessionStorage.getItem(RUN_TICKET_STORAGE_KEY)).toBeNull();
    expect(localStorage.length).toBe(0);

    context.startButton.click();
    await vi.waitFor(() => expect(context.gameApi.start).toHaveBeenCalledWith(39.7));
    expect(context.audioApi.start).toHaveBeenCalledTimes(1);
    expect(context.audioApi.startBgm).toHaveBeenCalledTimes(1);
    context.startButton.click();
    expect(context.gameApi.start).toHaveBeenCalledTimes(1);
  });

  it.each([
    ["localhost"], ["127.0.0.1"], ["::1"], ["[::1]"],
  ])("leaves GAMEPLAY TEST unchanged on %s", async (hostname) => {
    const context = setup(jsonResponse({ ok: true, runTimeSec: 40, expiresAtMs: nowMs + 60_000 }));
    context.hostname = hostname;

    await expect(bootstrapProductionRun(context)).resolves.toEqual({ status: "local" });
    expect(context.fetchImpl).not.toHaveBeenCalled();
    expect(context.gameApi.start).not.toHaveBeenCalled();
    expect(context.locationController.replace).not.toHaveBeenCalled();
  });

  it("redirects without a ticket and does not start or verify", async () => {
    const context = setup(jsonResponse({}));
    sessionStorage.clear();

    await expect(bootstrapProductionRun(context)).resolves.toEqual({ status: "redirected" });
    expect(context.locationController.replace).toHaveBeenCalledWith("/");
    expect(context.fetchImpl).not.toHaveBeenCalled();
    expect(context.gameApi.start).not.toHaveBeenCalled();
  });

  it("redirects a reload after a successful verification consumed the ticket", async () => {
    const first = setup(jsonResponse({
      ok: true, runTimeSec: 39.7, expiresAtMs: nowMs + 60_000,
    }));
    await bootstrapProductionRun(first);

    const reloaded = setup(jsonResponse({}));
    sessionStorage.clear();
    await expect(bootstrapProductionRun(reloaded)).resolves.toEqual({ status: "redirected" });
    expect(reloaded.locationController.replace).toHaveBeenCalledWith("/");
    expect(reloaded.fetchImpl).not.toHaveBeenCalled();
  });

  it.each([
    ["invalid", { ok: false, code: "INVALID_RUN_TICKET" }],
    ["expired", { ok: false, code: "RUN_TICKET_EXPIRED" }],
  ])("removes and redirects a server-rejected %s ticket", async (_caseName, body) => {
    const context = setup(jsonResponse(body, 403));

    await expect(bootstrapProductionRun(context)).resolves.toEqual({ status: "redirected" });
    expect(sessionStorage.getItem(RUN_TICKET_STORAGE_KEY)).toBeNull();
    expect(context.locationController.replace).toHaveBeenCalledWith("/");
    expect(context.gameApi.start).not.toHaveBeenCalled();
  });

  it.each([
    ["service unavailable", jsonResponse({ ok: false, code: "SERVICE_UNAVAILABLE" }, 503)],
    ["malformed success", jsonResponse({ ok: true, runTimeSec: 99, expiresAtMs: nowMs + 60_000 })],
    ["extra response field", jsonResponse({ ok: true, runTimeSec: 40, expiresAtMs: nowMs + 60_000, score: 1 })],
  ])("shows a manual recovery path for %s without retrying or starting", async (_caseName, response) => {
    const context = setup(response);

    await expect(bootstrapProductionRun(context)).resolves.toEqual({ status: "unavailable" });
    expect(context.fetchImpl).toHaveBeenCalledTimes(1);
    expect(context.gameApi.start).not.toHaveBeenCalled();
    expect(context.locationController.replace).not.toHaveBeenCalled();
    expect(context.bootPanel).not.toHaveAttribute("hidden");
    expect(context.bootPanel).toHaveAttribute("role", "alert");
    expect(context.returnLink).not.toHaveAttribute("hidden");
    expect(context.startButton).toHaveAttribute("hidden");
    expect(sessionStorage.getItem(RUN_TICKET_STORAGE_KEY)).toBe(JSON.stringify(stored));
  });

  it("removes invalid and expired session values before redirecting", async () => {
    const context = setup(jsonResponse({}));
    sessionStorage.setItem(RUN_TICKET_STORAGE_KEY, JSON.stringify({ ...stored, expiresAtMs: nowMs }));

    expect(loadStoredRunTicket(sessionStorage, nowMs)).toBeNull();
    sessionStorage.setItem(RUN_TICKET_STORAGE_KEY, "{");
    await expect(bootstrapProductionRun(context)).resolves.toEqual({ status: "redirected" });
    expect(sessionStorage.getItem(RUN_TICKET_STORAGE_KEY)).toBeNull();
    expect(context.fetchImpl).not.toHaveBeenCalled();
  });

  it("does not use query parameters as a runtime or ticket source", async () => {
    window.history.replaceState({}, "", "/run/?time=45&score=999&ticket=raw");
    const context = setup(jsonResponse({}));
    sessionStorage.clear();

    await bootstrapProductionRun(context);
    expect(context.locationController.replace).toHaveBeenCalledWith("/");
    expect(context.fetchImpl).not.toHaveBeenCalled();
    expect(context.gameApi.start).not.toHaveBeenCalled();
  });

  it("continues gameplay when AudioContext startup fails", async () => {
    const context = setup(jsonResponse({
      ok: true, runTimeSec: 39.7, expiresAtMs: nowMs + 60_000,
    }));
    context.audioApi.start.mockRejectedValue(new Error("audio blocked"));

    await bootstrapProductionRun(context);
    context.startButton.click();

    await vi.waitFor(() => expect(context.gameApi.start).toHaveBeenCalledWith(39.7));
    expect(context.audioApi.startBgm).not.toHaveBeenCalled();
  });

  it("redirects a production BFCache restore but ignores normal pageshow and local development", () => {
    const locationController = { replace: vi.fn() };

    expect(redirectRestoredProductionRun({
      hostname: "netspeedrace.com", persisted: true, locationController,
    })).toBe(true);
    expect(locationController.replace).toHaveBeenCalledWith("/");

    locationController.replace.mockClear();
    expect(redirectRestoredProductionRun({
      hostname: "netspeedrace.com", persisted: false, locationController,
    })).toBe(false);
    expect(redirectRestoredProductionRun({
      hostname: "localhost", persisted: true, locationController,
    })).toBe(false);
    expect(locationController.replace).not.toHaveBeenCalled();
  });
});
