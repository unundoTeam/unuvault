// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  attemptAutofillForCurrentPage,
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

function markInputVisible(input: HTMLInputElement) {
  Object.defineProperty(input, "getClientRects", {
    configurable: true,
    value: () => [{ width: 120, height: 24 }],
  });
}

describe("shouldOfferAutofill", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
    document.body.innerHTML = "";
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

  it("fills a username field when exactly one candidate matches", async () => {
    document.body.innerHTML = '<form><input autocomplete="username" /></form>';
    const input = document.querySelector("input");

    if (!(input instanceof HTMLInputElement)) {
      throw new Error("expected username input");
    }

    markInputVisible(input);

    installChromeRuntimeMock(
      vi.fn(async () => ({
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
      })),
    );

    await expect(
      attemptAutofillForCurrentPage({
        document,
        pageUrl: "https://github.com/login",
      }),
    ).resolves.toEqual({
      status: "filled",
      filledUsername: true,
      filledPassword: false,
    });

    expect(input.value).toBe("alice@example.com");
  });

  it("dispatches input and change after filling the username", async () => {
    document.body.innerHTML = '<form><input autocomplete="username" /></form>';
    const form = document.querySelector("form");
    const input = document.querySelector("input");

    if (!(form instanceof HTMLFormElement) || !(input instanceof HTMLInputElement)) {
      throw new Error("expected autofill form");
    }

    markInputVisible(input);

    const inputListener = vi.fn();
    const changeListener = vi.fn();

    form.addEventListener("input", inputListener);
    form.addEventListener("change", changeListener);

    installChromeRuntimeMock(
      vi.fn(async () => ({
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
      })),
    );

    await attemptAutofillForCurrentPage({
      document,
      pageUrl: "https://github.com/login",
    });

    expect(inputListener).toHaveBeenCalledTimes(1);
    expect(changeListener).toHaveBeenCalledTimes(1);
  });

  it("returns multiple_matches and does not mutate the DOM when more than one candidate matches", async () => {
    document.body.innerHTML = '<form><input autocomplete="username" /></form>';
    const input = document.querySelector("input");

    if (!(input instanceof HTMLInputElement)) {
      throw new Error("expected username input");
    }

    markInputVisible(input);

    installChromeRuntimeMock(
      vi.fn(async () => ({
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
            {
              hasPassword: true,
              id: "item-2",
              title: "GitHub alt",
              username: "bob@example.com",
              websiteOrigin: "https://github.com",
              websiteUrl: "https://github.com/session",
            },
          ],
        },
      })),
    );

    await expect(
      attemptAutofillForCurrentPage({
        document,
        pageUrl: "https://github.com/login",
      }),
    ).resolves.toEqual({
      status: "multiple_matches",
      count: 2,
    });

    expect(input.value).toBe("");
  });

  it("returns no_fillable_fields when no safe username field exists", async () => {
    document.body.innerHTML = '<form><input type="password" /></form>';

    installChromeRuntimeMock(
      vi.fn(async () => ({
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
      })),
    );

    await expect(
      attemptAutofillForCurrentPage({
        document,
        pageUrl: "https://github.com/login",
      }),
    ).resolves.toEqual({
      status: "no_fillable_fields",
    });
  });

  it("passes through locked and unavailable states without mutating the DOM", async () => {
    document.body.innerHTML = '<form><input autocomplete="username" /></form>';
    const input = document.querySelector("input");

    if (!(input instanceof HTMLInputElement)) {
      throw new Error("expected username input");
    }

    markInputVisible(input);

    installChromeRuntimeMock(
      vi.fn(async () => ({
        ok: true,
        autofillCandidates: {
          status: "locked",
          matches: [],
        },
      })),
    );

    await expect(
      attemptAutofillForCurrentPage({
        document,
        pageUrl: "https://github.com/login",
      }),
    ).resolves.toEqual({
      status: "locked",
      matches: [],
    });

    expect(input.value).toBe("");

    installChromeRuntimeMock(
      vi.fn(async () => ({
        ok: false,
        error: "boom",
      })),
    );

    await expect(
      attemptAutofillForCurrentPage({
        document,
        pageUrl: "https://github.com/login",
      }),
    ).resolves.toEqual({
      status: "unavailable",
    });

    expect(input.value).toBe("");
  });
});
