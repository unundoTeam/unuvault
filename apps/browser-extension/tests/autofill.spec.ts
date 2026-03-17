import { beforeEach, describe, expect, it, vi } from "vitest";
import { readAutofillStatus, shouldOfferAutofill } from "../src/content/autofill";

type SendMessage = (request: unknown) => Promise<unknown>;

function installChromeRuntimeMock(sendMessage?: SendMessage) {
  vi.stubGlobal("chrome", {
    runtime: {
      sendMessage:
        sendMessage ??
        vi.fn(async () => ({
          ok: true,
          autofillStatus: {
            status: "ready",
          },
        })),
    },
  });
}

describe("shouldOfferAutofill", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
    installChromeRuntimeMock();
  });

  it("returns true when a password field is detected", () => {
    expect(shouldOfferAutofill({ hasPasswordField: true })).toBe(true);
  });

  it("reads locked autofill status from background", async () => {
    installChromeRuntimeMock(
      vi.fn(async () => ({
        ok: true,
        autofillStatus: {
          status: "locked",
        },
      })),
    );

    await expect(readAutofillStatus()).resolves.toEqual({
      status: "locked",
    });
  });

  it("returns unavailable when the background call fails", async () => {
    installChromeRuntimeMock(
      vi.fn(async () => ({
        ok: false,
        error: "boom",
      })),
    );

    await expect(readAutofillStatus()).resolves.toEqual({
      status: "unavailable",
    });
  });
});
