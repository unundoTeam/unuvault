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
const manualInputMenu = process.argv.includes("--manual-input-menu");
const saveThroughMenu =
  manualInputMenu || process.argv.includes("--save-through-menu");
const proofDate = new Date().toISOString().slice(0, 10);
const exportRoot =
  process.env.UNUVAULT_PROOF_EXPORT_DIR ??
  "/Users/yuchen/Design/unu/unuvault/exports";
const screenshotStem = saveThroughMenu
  ? manualInputMenu
    ? "mac-companion-manual-input"
    : "mac-companion-local-save"
  : "mac-companion-menu-approval";
const approvalScreenshot = join(
  exportRoot,
  `${proofDate}-${screenshotStem}-real-app-full.png`,
);
const filledPageScreenshot = join(
  exportRoot,
  `${proofDate}-${screenshotStem}-filled-page-real-app.png`,
);
const localSaveScreenshot = join(
  exportRoot,
  `${proofDate}-${screenshotStem}-form-real-app-full.png`,
);
const smokeTimeoutMs = Number.parseInt(
  process.env.UNUVAULT_MENU_SMOKE_TIMEOUT_MS ?? "180000",
  10,
);

const swiftClickSource = `
import CoreGraphics
import Foundation

let x = Double(CommandLine.arguments[1])!
let y = Double(CommandLine.arguments[2])!
let point = CGPoint(x: x, y: y)
let down = CGEvent(
    mouseEventSource: nil,
    mouseType: .leftMouseDown,
    mouseCursorPosition: point,
    mouseButton: .left
)
let up = CGEvent(
    mouseEventSource: nil,
    mouseType: .leftMouseUp,
    mouseCursorPosition: point,
    mouseButton: .left
)
down?.post(tap: .cghidEventTap)
Thread.sleep(forTimeInterval: 0.05)
up?.post(tap: .cghidEventTap)
`;

const swiftApprovalSource = `
import AppKit
import ApplicationServices
import Foundation

func copyAttribute(_ element: AXUIElement, _ attribute: String) -> AnyObject? {
    var value: AnyObject?
    let result = AXUIElementCopyAttributeValue(element, attribute as CFString, &value)
    return result == .success ? value : nil
}

func pointValue(_ value: AnyObject?) -> CGPoint? {
    guard let value else { return nil }
    let axValue = value as! AXValue
    var point = CGPoint.zero
    if AXValueGetType(axValue) == .cgPoint,
       AXValueGetValue(axValue, .cgPoint, &point) {
        return point
    }
    return nil
}

func sizeValue(_ value: AnyObject?) -> CGSize? {
    guard let value else { return nil }
    let axValue = value as! AXValue
    var size = CGSize.zero
    if AXValueGetType(axValue) == .cgSize,
       AXValueGetValue(axValue, .cgSize, &size) {
        return size
    }
    return nil
}

func collectButtons(_ element: AXUIElement, into buttons: inout [AXUIElement], depth: Int = 0) {
    if depth > 12 {
        return
    }

    if let role = copyAttribute(element, kAXRoleAttribute) as? String,
       role == kAXButtonRole {
        buttons.append(element)
    }

    if let windows = copyAttribute(element, kAXWindowsAttribute) as? [AXUIElement] {
        for window in windows {
            collectButtons(window, into: &buttons, depth: depth + 1)
        }
    }

    if let children = copyAttribute(element, kAXChildrenAttribute) as? [AXUIElement] {
        for child in children {
            collectButtons(child, into: &buttons, depth: depth + 1)
        }
    }
}

func targetButton(from buttons: [AXUIElement]) -> AXUIElement? {
    for button in buttons {
        let title = (copyAttribute(button, kAXTitleAttribute) as? String) ?? ""
        let description = (copyAttribute(button, kAXDescriptionAttribute) as? String) ?? ""
        if title == "Fill once" || description == "Fill once" {
            return button
        }
    }

    let positioned = buttons.compactMap { button -> (AXUIElement, CGPoint, CGSize)? in
        guard let position = pointValue(copyAttribute(button, kAXPositionAttribute)),
              let size = sizeValue(copyAttribute(button, kAXSizeAttribute)) else {
            return nil
        }
        return (button, position, size)
    }

    guard let bottomY = positioned.map({ $0.1.y }).max() else {
        return nil
    }

    return positioned
        .filter { $0.1.y < bottomY - 8 }
        .sorted { lhs, rhs in
            if lhs.1.y == rhs.1.y {
                return lhs.1.x > rhs.1.x
            }
            return lhs.1.y > rhs.1.y
        }
        .first?.0
}

func targetSummary(_ button: AXUIElement) -> String {
    let title = (copyAttribute(button, kAXTitleAttribute) as? String) ?? ""
    let position = pointValue(copyAttribute(button, kAXPositionAttribute)) ?? .zero
    let size = sizeValue(copyAttribute(button, kAXSizeAttribute)) ?? .zero
    return "button:title=\\(title):x=\\(Int(position.x)):y=\\(Int(position.y)):w=\\(Int(size.width)):h=\\(Int(size.height))"
}

let mode = CommandLine.arguments.dropFirst().first ?? "find"
let attempts = Int(CommandLine.arguments.dropFirst(2).first ?? "1") ?? 1
let app = NSWorkspace.shared.runningApplications.first { app in
    app.executableURL?.lastPathComponent == "UnuVaultMacCompanion" ||
        app.localizedName == "UnuVaultMacCompanion"
}

guard let app else {
    fputs("missing app\\n", stderr)
    exit(2)
}

let axApp = AXUIElementCreateApplication(app.processIdentifier)

for attempt in 0..<max(attempts, 1) {
    var buttons: [AXUIElement] = []
    collectButtons(axApp, into: &buttons)

    if let target = targetButton(from: buttons) {
        if mode == "press" {
            let result = AXUIElementPerformAction(target, kAXPressAction as CFString)
            if result != .success {
                fputs("press failed \\(result.rawValue)\\n", stderr)
                exit(4)
            }
        }
        print(targetSummary(target))
        exit(0)
    }

    if attempt < attempts - 1 {
        Thread.sleep(forTimeInterval: 0.1)
    }
}

fputs("missing target\\n", stderr)
exit(3)
`;

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

function runAppleScript(source, options = {}) {
  const result = spawnSync("osascript", ["-"], {
    encoding: "utf8",
    input: source,
    killSignal: "SIGKILL",
    timeout: options.timeout ?? 10_000,
  });

  if (result.status !== 0) {
    throw new Error(
      `osascript failed:\n${result.stdout}\n${result.stderr}${result.error ? `\n${result.error.message}` : ""}`,
    );
  }

  return result.stdout.trim();
}

function clickScreenPoint(x, y) {
  const result = spawnSync("swift", ["-", String(x), String(y)], {
    encoding: "utf8",
    input: swiftClickSource,
  });

  if (result.status !== 0) {
    throw new Error(
      `swift click helper failed:\n${result.stdout}\n${result.stderr}`,
    );
  }
}

function runApprovalHelper(mode, attempts = 1) {
  const result = spawnSync("swift", ["-", mode, String(attempts)], {
    encoding: "utf8",
    input: swiftApprovalSource,
    killSignal: "SIGKILL",
    timeout: Math.max(45_000, attempts * 500 + 20_000),
  });

  if (result.status !== 0) {
    throw new Error(
      `approval helper failed (${mode}):\n${result.stdout}\n${result.stderr}${result.error ? `\n${result.error.message}` : ""}`,
    );
  }

  return result.stdout.trim();
}

async function waitForNativeApprovalButton() {
  return runApprovalHelper("find", 45);
}

function nativeApprovalDebugSummary() {
  try {
    return runApprovalHelper("find", 1);
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
}

function nativeTextFieldCenter(fieldIndex) {
  const center = runAppleScript(`
tell application "System Events"
  tell process "UnuVaultMacCompanion"
    tell group 1 of window 1
      set fieldPosition to position of text field ${fieldIndex}
      set fieldSize to size of text field ${fieldIndex}
      set centerX to ((item 1 of fieldPosition) + ((item 1 of fieldSize) / 2)) as integer
      set centerY to ((item 2 of fieldPosition) + ((item 2 of fieldSize) / 2)) as integer
      return (centerX as text) & tab & (centerY as text)
    end tell
  end tell
end tell
`);
  const [x, y] = center.split(/\s+/).map(Number);

  assert(
    Number.isFinite(x) && Number.isFinite(y),
    `Invalid native text field center: ${center}`,
  );

  return { x, y };
}

function pasteIntoFocusedNativeField(value) {
  runAppleScript(`
set the clipboard to ${JSON.stringify(value)}
tell application "System Events"
  keystroke "a" using command down
  delay 0.05
  keystroke "v" using command down
  delay 0.15
end tell
`);
}

function openNativeMenu() {
  runAppleScript(`
tell application "System Events"
  tell process "UnuVaultMacCompanion"
    set frontmost to true
    if not (exists window 1) then perform action "AXPress" of menu bar item 1 of menu bar 2
    delay 0.4
  end tell
end tell
`);
}

function openNativeLoginForm() {
  return runAppleScript(`
tell application "System Events"
  tell process "UnuVaultMacCompanion"
    if not (exists window 1) then perform action "AXPress" of menu bar item 1 of menu bar 2
    delay 0.2
    tell group 1 of window 1
      click button 2
      delay 0.6
      set focused of text field 1 to true
    end tell
  end tell
end tell
`);
}

function fillNativeLoginFormByMouse(origin) {
  for (const [fieldIndex, value] of [
    [1, origin],
    [2, "github.com"],
    [3, "mac-menu-user"],
    [4, "mac-menu-password"],
  ]) {
    const { x, y } = nativeTextFieldCenter(fieldIndex);
    clickScreenPoint(x, y);
    pasteIntoFocusedNativeField(value);
  }
}

function commitNativeLoginSaveAndUnlock() {
  return runAppleScript(`
tell application "System Events"
  tell process "UnuVaultMacCompanion"
    if not (exists window 1) then perform action "AXPress" of menu bar item 1 of menu bar 2
    delay 0.2
    tell group 1 of window 1
      click button 2
    end tell
    delay 0.4
    tell group 1 of window 1
      click button 1
    end tell
  end tell
end tell
`);
}

function clickNativeApprovalButton() {
  return runApprovalHelper("press", 1);
}

async function waitForMacCompanionReady(expectedState) {
  const url = `http://127.0.0.1:${bridgePort}/status`;

  for (let attempt = 0; attempt < 100; attempt += 1) {
    try {
      const response = await fetch(url);
      const payload = await response.json();

      if (
        response.ok &&
        payload.ok === true &&
        (!expectedState || payload.state === expectedState)
      ) {
        return payload;
      }
    } catch {
      // Keep polling while the SwiftUI app and loopback listener start.
    }

    await delay(150);
  }

  throw new Error(
    `UnuVaultMacCompanion loopback bridge did not become ready for state ${expectedState ?? "any"}.`,
  );
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

function killSmokeChildProcesses() {
  try {
    execFileSync("pkill", ["-P", String(process.pid)], { stdio: "ignore" });
  } catch {
    // Child processes may already be gone.
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
      UNUVAULT_MAC_COMPANION_PROOF_AUTOUNLOCK: saveThroughMenu ? "0" : "1",
      UNUVAULT_MAC_COMPANION_PROOF_CREDENTIAL_ID: credentialId,
      UNUVAULT_MAC_COMPANION_PROOF_LABEL: "github.com",
      ...(manualInputMenu
        ? {}
        : { UNUVAULT_MAC_COMPANION_PROOF_ORIGIN: loginPage.origin }),
      UNUVAULT_MAC_COMPANION_PROOF_PASSWORD: "mac-menu-password",
      UNUVAULT_MAC_COMPANION_PROOF_PREFILL_ADD_LOGIN:
        saveThroughMenu && !manualInputMenu ? "1" : "0",
      UNUVAULT_MAC_COMPANION_PROOF_PORT: String(bridgePort),
      UNUVAULT_MAC_COMPANION_PROOF_PROFILE_ID: profileId,
      UNUVAULT_MAC_COMPANION_PROOF_TOKEN: bridgeToken,
      UNUVAULT_MAC_COMPANION_PROOF_USERNAME: "mac-menu-user",
      UNUVAULT_MAC_COMPANION_PROOF_VAULT_DIR: vaultDirectory,
    },
    stdio: ["ignore", "pipe", "pipe"],
  });

  let chrome = null;
  let cdp = null;

  try {
    await waitForMacCompanionReady(saveThroughMenu ? "locked" : "unlocked");

    if (saveThroughMenu) {
      openNativeLoginForm();
      if (manualInputMenu) {
        fillNativeLoginFormByMouse(loginPage.origin);
      }
      await delay(300);
      execFileSync("screencapture", ["-x", localSaveScreenshot], {
        cwd: repoRoot,
        stdio: "inherit",
      });
      commitNativeLoginSaveAndUnlock();
      await waitForMacCompanionReady("unlocked");
    }

    chrome = spawn(
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
    cdp = new CdpPipeClient(chrome);

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
    try {
      await waitForNativeApprovalButton();
    } catch (error) {
      const nativeDebug = nativeApprovalDebugSummary();
      try {
        execFileSync("screencapture", ["-x", approvalScreenshot], {
          cwd: repoRoot,
          stdio: "ignore",
        });
      } catch {
        // Best-effort failure evidence only.
      }
      let autofillResponse = null;
      try {
        autofillResponse = await autofillPromise;
      } catch (autofillError) {
        autofillResponse = {
          error: autofillError instanceof Error ? autofillError.message : String(autofillError),
        };
      }
      throw new Error(
        `${error.message}; autofillResponse=${JSON.stringify(autofillResponse)}; nativeDebug=${JSON.stringify(nativeDebug)}`,
      );
    }
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
      `Unexpected autofill result: ${JSON.stringify({
        autofillResponse,
        filledValues,
        clickedButtonIndex,
        secondClaim,
      })}`,
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
          ...(saveThroughMenu ? { localSaveScreenshot } : {}),
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
    chrome?.kill("SIGTERM");
    macApp.kill("SIGTERM");
    await loginPage.close();
    await delay(500);
    chrome?.kill("SIGKILL");
    macApp.kill("SIGKILL");

    try {
      await rm(tempRoot, { force: true, recursive: true, maxRetries: 3, retryDelay: 200 });
    } catch (error) {
      console.warn(`Cleanup warning: ${(error instanceof Error && error.message) || error}`);
    }
  }
}

const smokeTimeout = setTimeout(() => {
  console.error(
    new Error(`Mac companion menu smoke timed out after ${smokeTimeoutMs}ms.`),
  );
  killSmokeChildProcesses();
  process.exit(124);
}, smokeTimeoutMs);

main()
  .then(() => {
    clearTimeout(smokeTimeout);
  })
  .catch((error) => {
    clearTimeout(smokeTimeout);
    console.error(error);
    process.exitCode = 1;
  });
