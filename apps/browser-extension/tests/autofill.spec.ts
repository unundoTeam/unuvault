import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  readAutofillCandidates,
  readAutofillStatus,
  shouldOfferAutofill,
} from "../src/content/autofill";

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

  it("requests autofill candidates for a page URL", async () => {
    const sendMessage = vi.fn(async () => ({
      ok: true,
      autofillCandidates: {
        status: "ready",
        matches: [
          {
            hasPassword: true,
            id: "item-1",
            title: "GitHub",
            username: "alice@example.com",
            websiteOrigin: "https://github.com",
            websiteUrl: "https://github.com/login",
          },
        ],
      },
    }));

    installChromeRuntimeMock(sendMessage);

    await expect(
      readAutofillCandidates("https://github.com/login"),
    ).resolves.toEqual({
      status: "ready",
      matches: [
        {
          hasPassword: true,
          id: "item-1",
          title: "GitHub",
          username: "alice@example.com",
          websiteOrigin: "https://github.com",
          websiteUrl: "https://github.com/login",
        },
      ],
    });

    expect(sendMessage).toHaveBeenCalledWith({
      type: "read_autofill_candidates",
      pageUrl: "https://github.com/login",
    });
  });

  it("maps candidate failures to unavailable", async () => {
    installChromeRuntimeMock(
      vi.fn(async () => ({
        ok: false,
        error: "boom",
      })),
    );

    await expect(
      readAutofillCandidates("https://github.com/login"),
    ).resolves.toEqual({
      status: "unavailable",
    });
  });
});
