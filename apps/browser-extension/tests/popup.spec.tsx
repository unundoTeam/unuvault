// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createMasterPasswordVerifier } from "../../../packages/security/src/master-password-verifier";
import { App } from "../src/popup/App";

type ChromeStorageArea = {
  get(keys: string | string[] | Record<string, unknown>): Promise<Record<string, unknown>>;
  set(items: Record<string, unknown>): Promise<void>;
  remove(keys: string | string[]): Promise<void>;
};

function installChromeStorageMock(initialValue?: unknown) {
  const store = new Map<string, unknown>();

  if (initialValue !== undefined) {
    store.set("unuvault.extension.master-password-verifier", initialValue);
  }

  const storageArea: ChromeStorageArea = {
    async get(keys) {
      const key =
        typeof keys === "string"
          ? keys
          : Array.isArray(keys)
            ? keys[0]
            : Object.keys(keys)[0];

      return key ? { [key]: store.get(key) } : {};
    },
    async set(items) {
      Object.entries(items).forEach(([key, value]) => {
        store.set(key, value);
      });
    },
    async remove(keys) {
      const keyList = Array.isArray(keys) ? keys : [keys];

      keyList.forEach((key) => {
        store.delete(key);
      });
    },
  };

  vi.stubGlobal("chrome", {
    storage: {
      local: storageArea,
    },
  });
}

async function setMasterPassword(password: string, confirmation: string = password) {
  fireEvent.change(await screen.findByLabelText("Master password"), {
    target: { value: password },
  });
  fireEvent.change(screen.getByLabelText("Confirm master password"), {
    target: { value: confirmation },
  });
  fireEvent.click(screen.getByRole("button", { name: "Set master password" }));
}

async function unlockVault(password: string) {
  fireEvent.change(await screen.findByLabelText("Master password"), {
    target: { value: password },
  });
  fireEvent.click(screen.getByRole("button", { name: "Unlock vault" }));
}

describe("App", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
    installChromeStorageMock();
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("shows setup mode when no verifier exists", async () => {
    render(<App />);

    expect(await screen.findByRole("button", { name: "Set master password" })).toBeInTheDocument();
    expect(screen.getByLabelText("Master password")).toBeInTheDocument();
    expect(screen.getByLabelText("Confirm master password")).toBeInTheDocument();
  });

  it("unlocks immediately after setting the first master password", async () => {
    render(<App />);

    await setMasterPassword("correct horse");

    expect(await screen.findByText("Vault unlocked")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Lock vault" })).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Search vault")).toBeInTheDocument();
  });

  it("shows locked mode when a verifier exists", async () => {
    installChromeStorageMock(JSON.stringify(createMasterPasswordVerifier("correct horse")));

    render(<App />);

    expect(await screen.findByRole("button", { name: "Unlock vault" })).toBeInTheDocument();
    expect(screen.getByLabelText("Master password")).toBeInTheDocument();
    expect(screen.queryByLabelText("Confirm master password")).not.toBeInTheDocument();
  });

  it("shows an error for a wrong master password", async () => {
    installChromeStorageMock(JSON.stringify(createMasterPasswordVerifier("correct horse")));

    render(<App />);

    await unlockVault("wrong battery");

    expect(await screen.findByText("Wrong master password")).toBeInTheDocument();
    expect(screen.queryByText("Vault unlocked")).not.toBeInTheDocument();
  });

  it("returns to locked mode after remount", async () => {
    const firstRender = render(<App />);

    await setMasterPassword("correct horse");
    expect(await screen.findByText("Vault unlocked")).toBeInTheDocument();

    firstRender.unmount();
    render(<App />);

    expect(await screen.findByRole("button", { name: "Unlock vault" })).toBeInTheDocument();
    expect(screen.queryByText("Vault unlocked")).not.toBeInTheDocument();
  });
});
