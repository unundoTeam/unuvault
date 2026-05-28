import { execFileSync, spawn, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import http from "node:http";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "../..");
const extensionRoot = join(repoRoot, "apps/browser-extension");
const extensionDist = join(extensionRoot, "dist");
const macPackageRoot = join(repoRoot, "apps/macos/App");
const macAppPath = join(macPackageRoot, ".build/debug/UnuVaultMacCompanion");
const chromePath =
  process.env.CHROME_BIN ??
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const bridgeToken = "local-dev-bridge-token";
const profileId = "personal";
const bridgePort = 17666;
const credentialId = "github-login";
const proofDate = new Date().toISOString().slice(0, 10);
const exportRoot =
  process.env.UNUVAULT_PROOF_EXPORT_DIR ??
  "/Users/yuchen/Design/unu/unuvault/exports";
const approvalScreenshot = join(
  exportRoot,
  `${proofDate}-mac-companion-menu-approval-real-app-full.png`,
);
const filledPageScreenshot = join(
  exportRoot,
  `${proofDate}-mac-companion-filled-page-real-app.png`,
);

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function delay(ms) {
  return new Promise((resolveDelay) => {
    setTimeout(resolveDelay, ms);
  });
}

function startLoginPageServer() {
  const server = http.createServer((_request, response) => {
    response.writeHead(200, {
      "content-type": "text/html; charset=utf-8",
    });
    response.end(`<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>UnuVault real menu approval smoke</title>
    <style>
      body { font-family: system-ui, sans-serif; margin: 32px; }
      label { display: block; margin-bottom: 12px; }
      input { display: block; margin-top: 4px; min-width: 260px; padding: 8px; }
    </style>
  </head>
  <body>
    <form>
      <label>Username <input id="username" autocomplete="username" /></label>
      <label>Password <input id="password" type="password" autocomplete="current-password" /></label>
    </form>
  </body>
</html>`);
  });

  return new Promise((resolveServer, reject) => {
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      assert(typeof address === "object" && address, "Login page server did not bind.");
      resolveServer({
        close: () => new Promise((resolveClose) => server.close(resolveClose)),
        origin: `http://127.0.0.1:${address.port}`,
        url: `http://127.0.0.1:${address.port}/login`,
      });
    });
    server.on("error", reject);
  });
}

class CdpPipeClient {
  constructor(process) {
    this.nextId = 1;
    this.pending = new Map();
    this.buffer = "";
    this.readStream = process.stdio[4];
    this.writeStream = process.stdio[3];

    this.readStream.setEncoding("utf8");
    this.readStream.on("data", (chunk) => {
      this.buffer += chunk;

      let separatorIndex = this.buffer.indexOf("\0");
      while (separatorIndex !== -1) {
        const rawMessage = this.buffer.slice(0, separatorIndex);
        this.buffer = this.buffer.slice(separatorIndex + 1);
        separatorIndex = this.buffer.indexOf("\0");

        if (!rawMessage) {
          continue;
        }

        this.handleMessage(JSON.parse(rawMessage));
      }
    });
  }

  handleMessage(message) {
    if (!message.id) {
      return;
    }

    const pending = this.pending.get(message.id);
    if (!pending) {
      return;
    }

    this.pending.delete(message.id);

    if (message.error) {
      pending.reject(new Error(`${pending.method}: ${message.error.message}`));
      return;
    }

    pending.resolve(message.result);
  }

  send(method, params = {}, sessionId = undefined) {
    const id = this.nextId;
    this.nextId += 1;

    const message = {
      id,
      method,
      params,
    };

    if (sessionId) {
      message.sessionId = sessionId;
    }

    return new Promise((resolveSend, reject) => {
      this.pending.set(id, {
        method,
        resolve: resolveSend,
        reject,
      });
      this.writeStream.write(`${JSON.stringify(message)}\0`);
    });
  }
}

async function waitForCdp(client) {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    try {
      await client.send("Browser.getVersion");
      return;
    } catch {
      await delay(100);
    }
  }

  throw new Error("Chrome CDP pipe did not become ready.");
}

async function attachToTarget(client, targetId) {
  const { sessionId } = await client.send("Target.attachToTarget", {
    flatten: true,
    targetId,
  });
  await client.send("Page.enable", {}, sessionId);
  await client.send("Runtime.enable", {}, sessionId);
  return sessionId;
}

async function evaluate(client, sessionId, expression) {
  const result = await client.send(
    "Runtime.evaluate",
    {
      awaitPromise: true,
      expression,
      returnByValue: true,
    },
    sessionId,
  );

  if (result.exceptionDetails) {
    throw new Error(JSON.stringify(result.exceptionDetails));
  }

  return result.result?.value;
}

async function triggerAutofill(client, popupSessionId) {
  const expression = `
    (async () => await new Promise((resolve, reject) => {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        const queryError = chrome.runtime.lastError;
        if (queryError) {
          reject(new Error(queryError.message));
          return;
        }

        const tabId = tabs[0]?.id;
        if (!tabId) {
          reject(new Error("No active tab id."));
          return;
        }

        chrome.tabs.sendMessage(
          tabId,
          { type: "attempt_autofill_for_current_page" },
          (response) => {
            const messageError = chrome.runtime.lastError;
            if (messageError) {
              reject(new Error(messageError.message));
              return;
            }

            resolve(response);
          },
        );
      });
    }))()
  `;

  let lastError = null;
  for (let attempt = 0; attempt < 40; attempt += 1) {
    try {
      return await evaluate(client, popupSessionId, expression);
    } catch (error) {
      lastError = error;
      await delay(250);
    }
  }

  throw lastError ?? new Error("Autofill trigger failed.");
}

function runAppleScript(source) {
  const result = spawnSync("osascript", ["-"], {
    encoding: "utf8",
    input: source,
  });

  if (result.status !== 0) {
    throw new Error(
      `osascript failed:\n${result.stdout}\n${result.stderr}`,
    );
  }

  return result.stdout.trim();
}

function openNativeMenu() {
  runAppleScript(`
tell application "System Events"
  tell process "UnuVaultMacCompanion"
    if not (exists window 1) then click menu bar item 1 of menu bar 2
  end tell
end tell
`);
}

function clickNativeApprovalButton() {
  return runAppleScript(`
tell application "System Events"
  tell process "UnuVaultMacCompanion"
    if not (exists window 1) then click menu bar item 1 of menu bar 2
    delay 0.2
    tell group 1 of window 1
      set buttonCount to count of buttons
      if buttonCount < 1 then error "No native approval buttons found."
      set targetButton to button buttonCount
      click targetButton
      return buttonCount as text
    end tell
  end tell
end tell
`);
}

async function waitForMacCompanionReady() {
  const url = `http://127.0.0.1:${bridgePort}/status`;

  for (let attempt = 0; attempt < 100; attempt += 1) {
    try {
      const response = await fetch(url);
      const payload = await response.json();

      if (response.ok && payload.ok === true && payload.state === "unlocked") {
        return payload;
      }
    } catch {
      // Keep polling while the SwiftUI app and loopback listener start.
    }

    await delay(150);
  }

  throw new Error("UnuVaultMacCompanion loopback bridge did not become ready.");
}

async function claimAgain(origin) {
  const response = await fetch(`http://127.0.0.1:${bridgePort}/v1/credentials/claim`, {
    body: JSON.stringify({
      id: credentialId,
      origin,
      profileId,
    }),
    headers: {
      authorization: `Bearer ${bridgeToken}`,
      "content-type": "application/json",
    },
    method: "POST",
  });
  const payload = await response.json();

  return {
    payload,
    status: response.status,
  };
}

async function capturePageScreenshot(client, sessionId, outputPath) {
  const screenshot = await client.send(
    "Page.captureScreenshot",
    {
      captureBeyondViewport: false,
      format: "png",
    },
    sessionId,
  );
  await writeFile(outputPath, Buffer.from(screenshot.data, "base64"));
}

function stableExtensionKey() {
  return createHash("sha256").update(extensionDist).digest("hex").slice(0, 32);
}

function killExistingCompanionProcesses() {
  for (const processName of ["UnuVaultMacCompanion", "MacCompanionSmokeHost"]) {
    try {
      execFileSync("pkill", ["-x", processName], { stdio: "ignore" });
    } catch {
      // Missing process is fine.
    }
  }
}

async function main() {
  assert(existsSync(chromePath), `Chrome binary not found at ${chromePath}`);
  await mkdir(exportRoot, { recursive: true });
  killExistingCompanionProcesses();

  execFileSync("corepack", ["pnpm", "--filter", "@unuvault/browser-extension", "build"], {
    cwd: repoRoot,
    stdio: "inherit",
  });
  execFileSync("swift", ["build", "--package-path", macPackageRoot], {
    cwd: repoRoot,
    stdio: "inherit",
  });

  const loginPage = await startLoginPageServer();
  const tempRoot = await mkdtemp(join(tmpdir(), "unuvault-menu-app-smoke-"));
  const chromeProfile = join(tempRoot, "chrome-profile");
  const vaultDirectory = join(tempRoot, "vault");
  await mkdir(chromeProfile, { recursive: true });
  await mkdir(vaultDirectory, { recursive: true });

  const macApp = spawn(macAppPath, {
    cwd: repoRoot,
    env: {
      ...process.env,
      UNUVAULT_MAC_COMPANION_PROOF: "1",
      UNUVAULT_MAC_COMPANION_PROOF_AUTOUNLOCK: "1",
      UNUVAULT_MAC_COMPANION_PROOF_CREDENTIAL_ID: credentialId,
      UNUVAULT_MAC_COMPANION_PROOF_LABEL: "github.com",
      UNUVAULT_MAC_COMPANION_PROOF_ORIGIN: loginPage.origin,
      UNUVAULT_MAC_COMPANION_PROOF_PASSWORD: "mac-menu-password",
      UNUVAULT_MAC_COMPANION_PROOF_PORT: String(bridgePort),
      UNUVAULT_MAC_COMPANION_PROOF_PROFILE_ID: profileId,
      UNUVAULT_MAC_COMPANION_PROOF_TOKEN: bridgeToken,
      UNUVAULT_MAC_COMPANION_PROOF_USERNAME: "mac-menu-user",
      UNUVAULT_MAC_COMPANION_PROOF_VAULT_DIR: vaultDirectory,
    },
    stdio: ["ignore", "pipe", "pipe"],
  });

  const chrome = spawn(
    chromePath,
    [
      `--user-data-dir=${chromeProfile}`,
      "--remote-debugging-pipe",
      "--enable-unsafe-extension-debugging",
      "--no-default-browser-check",
      "--no-first-run",
      "--window-size=900,700",
      "about:blank",
    ],
    {
      cwd: repoRoot,
      stdio: ["ignore", "ignore", "pipe", "pipe", "pipe"],
    },
  );

  const cdp = new CdpPipeClient(chrome);

  try {
    await waitForMacCompanionReady();
    await waitForCdp(cdp);

    const { id: extensionId } = await cdp.send("Extensions.loadUnpacked", {
      path: extensionDist,
    });

    const { targetId: pageTargetId } = await cdp.send("Target.createTarget", {
      url: loginPage.url,
    });
    const pageSessionId = await attachToTarget(cdp, pageTargetId);

    const { targetId: popupTargetId } = await cdp.send("Target.createTarget", {
      url: `chrome-extension://${extensionId}/popup.html`,
    });
    const popupSessionId = await attachToTarget(cdp, popupTargetId);

    await cdp.send("Page.bringToFront", {}, pageSessionId);

    const authState = {
      accessToken: bridgeToken,
      email: "smoke@example.com",
      profileId,
      signedInAt: new Date(0).toISOString(),
    };

    await evaluate(
      cdp,
      popupSessionId,
      `(async () => {
        await chrome.storage.local.set(${JSON.stringify({
        "unuvault.extension.auth-state": JSON.stringify(authState),
      })});
        return "seeded";
      })();`,
    );

    const autofillPromise = triggerAutofill(cdp, popupSessionId);
    await delay(750);
    openNativeMenu();
    await delay(400);
    execFileSync("screencapture", ["-x", approvalScreenshot], {
      cwd: repoRoot,
      stdio: "inherit",
    });
    const clickedButtonIndex = clickNativeApprovalButton();

    const autofillResponse = await autofillPromise;
    const filledValues = await evaluate(
      cdp,
      pageSessionId,
      `({
        username: document.querySelector("#username")?.value ?? "",
        password: document.querySelector("#password")?.value ?? "",
      })`,
    );
    const secondClaim = await claimAgain(loginPage.origin);
    await cdp.send("Page.bringToFront", {}, pageSessionId);
    await capturePageScreenshot(cdp, pageSessionId, filledPageScreenshot);

    assert(
      autofillResponse?.ok === true &&
        autofillResponse.result?.status === "filled" &&
        filledValues.username === "mac-menu-user" &&
        filledValues.password === "mac-menu-password",
      `Unexpected autofill result: ${JSON.stringify({ autofillResponse, filledValues })}`,
    );
    assert(
      secondClaim.status === 404 &&
        secondClaim.payload?.error === "credential_not_found",
      `Approved release was not single-use: ${JSON.stringify(secondClaim)}`,
    );

    console.log(
      JSON.stringify(
        {
          ok: true,
          approvalScreenshot,
          filledPageScreenshot,
          clickedButtonIndex,
          extensionId,
          extensionKey: stableExtensionKey(),
          filledValues,
          loginPage: loginPage.url,
          secondClaim,
        },
        null,
        2,
      ),
    );
  } finally {
    chrome.kill("SIGTERM");
    macApp.kill("SIGTERM");
    await loginPage.close();
    await delay(500);
    chrome.kill("SIGKILL");
    macApp.kill("SIGKILL");

    try {
      await rm(tempRoot, { force: true, recursive: true, maxRetries: 3, retryDelay: 200 });
    } catch (error) {
      console.warn(`Cleanup warning: ${(error instanceof Error && error.message) || error}`);
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
