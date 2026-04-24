// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  attemptAutofillForCurrentPage,
  readAutofillCandidates,
  readAutofillFillData,
  readAutofillStatus,
  shouldOfferAutofill,
} from "../src/content/autofill";

type SendMessage = (request: { type?: string }) => Promise<unknown>;

const defaultCandidate = {
  hasPassword: true,
  id: "item-1",
  title: "GitHub",
  username: "alice@example.com",
  websiteOrigin: "https://github.com",
  websiteUrl: "https://github.com/login",
};

const defaultFillData = {
  username: "alice@example.com",
  password: "hunter2",
};

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

function createAutofillMessageHandler(input?: {
  autofillCandidates?: unknown;
  autofillFillData?: unknown;
}) {
  return vi.fn(async (request: { type?: string }) => {
    if (request.type === "read_autofill_candidates") {
      return {
        ok: true,
        autofillCandidates: input?.autofillCandidates ?? {
          status: "ready",
          matches: [defaultCandidate],
        },
      };
    }

    if (request.type === "read_autofill_fill_data") {
      return {
        ok: true,
        autofillFillData: input?.autofillFillData ?? {
          status: "ready",
          fillData: defaultFillData,
        },
      };
    }

    return {
      ok: true,
      autofillStatus: {
        status: "ready",
      },
    };
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

  it("requests autofill candidates without exposing pageUrl in the request body", async () => {
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

  it("requests autofill fill data without exposing pageUrl in the request body", async () => {
    const sendMessage = vi.fn(async () => ({
      ok: true,
      autofillFillData: {
        status: "ready",
        fillData: {
          username: "alice@example.com",
          password: "hunter2",
        },
      },
    }));

    installChromeRuntimeMock(sendMessage);

    await expect(readAutofillFillData("https://github.com/login")).resolves.toEqual({
      status: "ready",
      fillData: {
        username: "alice@example.com",
        password: "hunter2",
      },
    });

    expect(sendMessage).toHaveBeenCalledWith({
      type: "read_autofill_fill_data",
    });
  });

  it("fills a username field when exactly one candidate matches", async () => {
    document.body.innerHTML = '<form><input autocomplete="username" /></form>';
    const input = document.querySelector("input");

    if (!(input instanceof HTMLInputElement)) {
      throw new Error("expected username input");
    }

    markInputVisible(input);

    installChromeRuntimeMock(createAutofillMessageHandler());

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

    installChromeRuntimeMock(createAutofillMessageHandler());

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
      createAutofillMessageHandler({
        autofillCandidates: {
          status: "ready",
          matches: [
            defaultCandidate,
            {
              ...defaultCandidate,
              id: "item-2",
              title: "GitHub alt",
              username: "bob@example.com",
              websiteUrl: "https://github.com/session",
            },
          ],
        },
      }),
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

  it("fills both username and password when fill data is ready", async () => {
    document.body.innerHTML =
      '<form><input autocomplete="username" /><input type="password" /></form>';
    const inputs = Array.from(document.querySelectorAll("input"));

    if (
      !(inputs[0] instanceof HTMLInputElement) ||
      !(inputs[1] instanceof HTMLInputElement)
    ) {
      throw new Error("expected username and password inputs");
    }

    markInputVisible(inputs[0]);
    markInputVisible(inputs[1]);

    installChromeRuntimeMock(createAutofillMessageHandler());

    await expect(
      attemptAutofillForCurrentPage({
        document,
        pageUrl: "https://github.com/login",
      }),
    ).resolves.toEqual({
      status: "filled",
      filledUsername: true,
      filledPassword: true,
    });

    expect(inputs[0].value).toBe("alice@example.com");
    expect(inputs[1].value).toBe("hunter2");
  });

  it("fills only the password when only a password field exists", async () => {
    document.body.innerHTML = '<form><input type="password" /></form>';
    const input = document.querySelector("input");

    if (!(input instanceof HTMLInputElement)) {
      throw new Error("expected password input");
    }

    markInputVisible(input);

    installChromeRuntimeMock(createAutofillMessageHandler());

    await expect(
      attemptAutofillForCurrentPage({
        document,
        pageUrl: "https://github.com/login",
      }),
    ).resolves.toEqual({
      status: "filled",
      filledUsername: false,
      filledPassword: true,
    });

    expect(input.value).toBe("hunter2");
  });

  it("returns no_fillable_fields when no safe username field exists", async () => {
    document.body.innerHTML =
      '<form><input type="hidden" /><input type="password" readonly /></form>';

    installChromeRuntimeMock(createAutofillMessageHandler());

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
      createAutofillMessageHandler({
        autofillCandidates: {
          status: "locked",
          matches: [],
        },
      }),
    );

    await expect(
      attemptAutofillForCurrentPage({
        document,
        pageUrl: "https://github.com/login",
      }),
    ).resolves.toEqual({
      status: "locked",
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

  it("does not mutate the DOM when fill data reports multiple_matches", async () => {
    document.body.innerHTML =
      '<form><input autocomplete="username" /><input type="password" /></form>';
    const inputs = Array.from(document.querySelectorAll("input"));

    if (
      !(inputs[0] instanceof HTMLInputElement) ||
      !(inputs[1] instanceof HTMLInputElement)
    ) {
      throw new Error("expected username and password inputs");
    }

    markInputVisible(inputs[0]);
    markInputVisible(inputs[1]);

    installChromeRuntimeMock(
      createAutofillMessageHandler({
        autofillCandidates: {
          status: "ready",
          matches: [
            defaultCandidate,
            {
              ...defaultCandidate,
              id: "item-2",
              title: "GitHub alt",
              username: "bob@example.com",
              websiteUrl: "https://github.com/session",
            },
          ],
        },
      }),
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

    expect(inputs[0].value).toBe("");
    expect(inputs[1].value).toBe("");
  });

  it("fills the username for a passwordless exact-origin match", async () => {
    document.body.innerHTML = '<form><input autocomplete="username" /></form>';
    const input = document.querySelector("input");

    if (!(input instanceof HTMLInputElement)) {
      throw new Error("expected username input");
    }

    markInputVisible(input);

    const sendMessage = createAutofillMessageHandler({
      autofillCandidates: {
        status: "ready",
        matches: [
          {
            ...defaultCandidate,
            hasPassword: false,
          },
        ],
      },
    });

    installChromeRuntimeMock(sendMessage);

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
    expect(sendMessage).toHaveBeenCalledTimes(1);
    expect(sendMessage).toHaveBeenCalledWith({
      type: "read_autofill_candidates",
    });
  });

  it("returns no_password when only a password field exists for a passwordless match", async () => {
    document.body.innerHTML = '<form><input type="password" /></form>';
    const input = document.querySelector("input");

    if (!(input instanceof HTMLInputElement)) {
      throw new Error("expected password input");
    }

    markInputVisible(input);

    installChromeRuntimeMock(
      createAutofillMessageHandler({
        autofillCandidates: {
          status: "ready",
          matches: [
            {
              ...defaultCandidate,
              hasPassword: false,
            },
          ],
        },
      }),
    );

    await expect(
      attemptAutofillForCurrentPage({
        document,
        pageUrl: "https://github.com/login",
      }),
    ).resolves.toEqual({
      status: "no_password",
    });

    expect(input.value).toBe("");
  });

  it("maps malformed fill-data responses to unavailable", async () => {
    installChromeRuntimeMock(
      vi.fn(async () => ({
        ok: true,
        autofillCandidates: {
          status: "ready",
          matches: [],
        },
      })),
    );

    await expect(
      readAutofillFillData("https://github.com/login"),
    ).resolves.toEqual({
      status: "unavailable",
    });
  });
});
