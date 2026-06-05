import { execFileSync, spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import http from "node:http";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "../..");
const macPackageRoot = join(repoRoot, "apps/macos/App");
const chromePath =
  process.env.CHROME_BIN ??
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const bridgeToken = "local-dev-bridge-token";
const profileId = "personal";
const bridgePort = 17666;
const webHarnessPort = 3001;
const credentialId = "web-save-to-mac-smoke";
const credentialTitle = "github.com";
const credentialUsername = "web-smoke-user";
const credentialPassword = "web-smoke-password";

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

function credentialPayload(origin) {
  return {
    source: "web-account-unlocked-vault",
    credentials: [
      {
        id: credentialId,
        title: credentialTitle,
        username: credentialUsername,
        website_url: `${origin}/login`,
        profile_id: profileId,
        password: credentialPassword,
      },
    ],
  };
}

function startWebHarnessServer() {
  const origin = `http://127.0.0.1:${webHarnessPort}`;
  const server = http.createServer((_request, response) => {
    response.writeHead(200, {
      "content-type": "text/html; charset=utf-8",
    });
    response.end(`<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>UnuVault web-save-to-mac-smoke</title>
    <style>
      body {
        color: #111827;
        font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        margin: 32px;
        max-width: 520px;
      }
      button {
        background: #111827;
        border: 0;
        border-radius: 8px;
        color: white;
        font: inherit;
        font-weight: 700;
        min-height: 44px;
        padding: 0 18px;
      }
      pre {
        background: #f3f4f6;
        border: 1px solid #d1d5db;
        border-radius: 8px;
        min-height: 80px;
        padding: 12px;
        white-space: pre-wrap;
      }
    </style>
  </head>
  <body>
    <h1>Web vault import smoke</h1>
    <button id="save-to-mac" type="button">Save to this Mac</button>
    <pre id="status">idle</pre>
    <script>
      const bridgeToken = ${JSON.stringify(bridgeToken)};
      const bridgePort = ${JSON.stringify(bridgePort)};
      const payload = ${JSON.stringify(credentialPayload(origin))};
      const status = document.querySelector("#status");
      const button = document.querySelector("#save-to-mac");

      button.addEventListener("click", async () => {
        window.__unuvaultSmokeResult = null;
        status.textContent = "saving";

        try {
          const response = await fetch(
            "http://127.0.0.1:" + bridgePort + "/v1/local-vault/import",
            {
              body: JSON.stringify(payload),
              headers: {
                authorization: "Bearer " + bridgeToken,
                "content-type": "application/json",
              },
              method: "POST",
            },
          );
          const body = await response.json();
          window.__unuvaultSmokeResult = {
            body,
            ok: response.ok,
            status: response.status,
          };
          status.textContent = JSON.stringify(window.__unuvaultSmokeResult, null, 2);
        } catch (error) {
          window.__unuvaultSmokeResult = {
            error: error instanceof Error ? error.message : String(error),
            ok: false,
            status: 0,
          };
          status.textContent = JSON.stringify(window.__unuvaultSmokeResult, null, 2);
        }
      });
    </script>
  </body>
</html>`);
  });

  return new Promise((resolveServer, reject) => {
    server.listen(webHarnessPort, "127.0.0.1", () => {
      resolveServer({
        close: () => new Promise((resolveClose) => server.close(resolveClose)),
        origin,
        url: `${origin}/login`,
      });
    });
    server.on("error", (error) => {
      reject(
        new Error(
          `Could not bind web-save-to-mac-smoke harness at ${origin}: ${error.message}`,
        ),
      );
    });
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

function killExistingCompanionProcesses() {
  for (const processName of ["UnuVaultMacCompanion", "MacCompanionSmokeHost"]) {
    try {
      execFileSync("pkill", ["-x", processName], { stdio: "ignore" });
    } catch {
      // Missing process is fine.
    }
  }
}

function startSmokeHost({ locked, origin }) {
  const smokeHost = spawn(
    "swift",
    ["run", "--package-path", macPackageRoot, "MacCompanionSmokeHost"],
    {
      cwd: repoRoot,
      env: {
        ...process.env,
        UNUVAULT_MAC_COMPANION_SMOKE_LOCKED: locked ? "1" : "0",
        UNUVAULT_MAC_COMPANION_SMOKE_ORIGIN: origin,
        UNUVAULT_MAC_COMPANION_SMOKE_PORT: String(bridgePort),
        UNUVAULT_MAC_COMPANION_SMOKE_PROFILE_ID: profileId,
        UNUVAULT_MAC_COMPANION_SMOKE_TOKEN: bridgeToken,
      },
      stdio: ["ignore", "pipe", "pipe"],
    },
  );

  smokeHost.stdout.on("data", (chunk) => {
    process.stdout.write(chunk);
  });
  smokeHost.stderr.on("data", (chunk) => {
    process.stderr.write(chunk);
  });

  return smokeHost;
}

async function stopProcess(processToStop) {
  if (!processToStop || processToStop.exitCode !== null) {
    return;
  }

  processToStop.kill();
  await Promise.race([
    new Promise((resolveExit) => processToStop.once("exit", resolveExit)),
    delay(1500),
  ]);

  if (processToStop.exitCode === null) {
    processToStop.kill("SIGKILL");
  }
}

async function waitForProcessExit(processToWait, timeoutMs = 3000) {
  if (!processToWait || processToWait.exitCode !== null) {
    return;
  }

  await Promise.race([
    new Promise((resolveExit) => processToWait.once("exit", resolveExit)),
    delay(timeoutMs),
  ]);

  if (processToWait.exitCode === null) {
    processToWait.kill("SIGKILL");
    await Promise.race([
      new Promise((resolveExit) => processToWait.once("exit", resolveExit)),
      delay(1000),
    ]);
  }
}

async function removeDirectoryWithRetry(directory) {
  let lastError = null;

  for (let attempt = 0; attempt < 8; attempt += 1) {
    try {
      await rm(directory, { force: true, recursive: true });
      return;
    } catch (error) {
      lastError = error;
      await delay(150);
    }
  }

  throw lastError;
}

async function waitForMacCompanionReady(expectedState) {
  const url = `http://127.0.0.1:${bridgePort}/status`;

  for (let attempt = 0; attempt < 120; attempt += 1) {
    try {
      const response = await fetch(url);
      const payload = await response.json();

      if (
        response.ok &&
        payload.ok === true &&
        payload.state === expectedState
      ) {
        return payload;
      }
    } catch {
      // Keep polling while Swift builds and the loopback listener starts.
    }

    await delay(150);
  }

  throw new Error(
    `MacCompanionSmokeHost did not become ${expectedState} on ${url}.`,
  );
}

async function clickSaveToMac(client, pageSessionId) {
  await evaluate(
    client,
    pageSessionId,
    `(() => {
      window.__unuvaultSmokeResult = null;
      document.querySelector("#save-to-mac").click();
      return document.querySelector("#save-to-mac").textContent;
    })();`,
  );

  for (let attempt = 0; attempt < 80; attempt += 1) {
    const result = await evaluate(
      client,
      pageSessionId,
      `window.__unuvaultSmokeResult`,
    );

    if (result) {
      return result;
    }

    await delay(100);
  }

  throw new Error("Save to this Mac button did not produce an import receipt.");
}

async function getMetadata(origin) {
  const response = await fetch(
    `http://127.0.0.1:${bridgePort}/v1/credentials?origin=${encodeURIComponent(
      `${origin}/login`,
    )}&profileId=${encodeURIComponent(profileId)}`,
    {
      headers: {
        authorization: `Bearer ${bridgeToken}`,
      },
    },
  );
  const payload = await response.json();

  return { payload, status: response.status };
}

async function requestRelease(origin) {
  const response = await fetch(
    `http://127.0.0.1:${bridgePort}/v1/credentials/release`,
    {
      body: JSON.stringify({
        id: credentialId,
        origin: `${origin}/login`,
        profileId,
        reason: "fill-active-page",
      }),
      headers: {
        authorization: `Bearer ${bridgeToken}`,
        "content-type": "application/json",
      },
      method: "POST",
    },
  );
  const payload = await response.json();

  return { payload, status: response.status };
}

async function claimCredential(origin) {
  const response = await fetch(
    `http://127.0.0.1:${bridgePort}/v1/credentials/claim`,
    {
      body: JSON.stringify({
        id: credentialId,
        origin: `${origin}/login`,
        profileId,
      }),
      headers: {
        authorization: `Bearer ${bridgeToken}`,
        "content-type": "application/json",
      },
      method: "POST",
    },
  );
  const payload = await response.json();

  return { payload, status: response.status };
}

async function waitForApprovedClaim(origin) {
  let lastResult = null;

  for (let attempt = 0; attempt < 40; attempt += 1) {
    lastResult = await claimCredential(origin);

    if (lastResult.status === 200) {
      return lastResult;
    }

    await delay(100);
  }

  throw new Error(
    `Approved claim did not become available: ${JSON.stringify(lastResult)}`,
  );
}

async function main() {
  assert(existsSync(chromePath), `Chrome binary not found at ${chromePath}`);
  killExistingCompanionProcesses();

  execFileSync("swift", ["build", "--package-path", macPackageRoot], {
    cwd: repoRoot,
    stdio: "inherit",
  });

  const webHarness = await startWebHarnessServer();
  const tempRoot = await mkdtemp(join(tmpdir(), "unuvault-web-save-to-mac-smoke-"));
  const chromeProfile = join(tempRoot, "chrome-profile");
  await mkdir(chromeProfile, { recursive: true });

  const chrome = spawn(
    chromePath,
    [
      `--user-data-dir=${chromeProfile}`,
      "--remote-debugging-pipe",
      "--no-default-browser-check",
      "--no-first-run",
      "--window-size=900,700",
      webHarness.url,
    ],
    {
      cwd: repoRoot,
      stdio: ["ignore", "ignore", "pipe", "pipe", "pipe"],
    },
  );
  const cdp = new CdpPipeClient(chrome);
  let pageSessionId = null;
  let smokeHost = null;

  try {
    await waitForCdp(cdp);
    const { targetInfos } = await cdp.send("Target.getTargets");
    const pageTarget = targetInfos.find((target) => target.type === "page");
    assert(pageTarget, "Chrome did not open a page target.");
    pageSessionId = await attachToTarget(cdp, pageTarget.targetId);
    await cdp.send("Page.bringToFront", {}, pageSessionId);

    smokeHost = startSmokeHost({ locked: true, origin: webHarness.origin });
    await waitForMacCompanionReady("locked");

    const lockedImport = await clickSaveToMac(cdp, pageSessionId);
    assert(lockedImport.status === 423, "Locked import should return HTTP 423.");
    assert(
      lockedImport.body?.error === "vault_locked",
      "Locked import should return vault_locked.",
    );
    assert(
      !JSON.stringify(lockedImport).includes(credentialPassword),
      "Locked import response leaked plaintext password.",
    );
    await stopProcess(smokeHost);
    smokeHost = null;

    smokeHost = startSmokeHost({ locked: false, origin: webHarness.origin });
    await waitForMacCompanionReady("unlocked");

    const importReceipt = await clickSaveToMac(cdp, pageSessionId);
    assert(importReceipt.status === 200, "Unlocked import should return HTTP 200.");
    assert(importReceipt.body?.ok === true, "Unlocked import should return ok=true.");
    assert(
      importReceipt.body?.importedCredentialIds?.includes(credentialId),
      "Unlocked import receipt should include imported credential id.",
    );
    assert(
      !JSON.stringify(importReceipt).includes(credentialPassword),
      "Import receipt leaked plaintext password.",
    );

    const metadata = await getMetadata(webHarness.origin);
    assert(metadata.status === 200, "Imported credential metadata should be readable.");
    assert(
      metadata.payload?.credentials?.some((credential) => credential.id === credentialId),
      "Imported credential metadata should include the imported id.",
    );
    assert(
      !JSON.stringify(metadata).includes(credentialPassword),
      "Metadata response leaked plaintext password.",
    );

    const release = await requestRelease(webHarness.origin);
    assert(release.status === 409, "Release should require Mac-local approval.");
    assert(
      release.payload?.error === "approval_required",
      "Release should return approval_required before claim.",
    );
    assert(
      !JSON.stringify(release).includes(credentialPassword),
      "Release approval response leaked plaintext password.",
    );

    const claim = await waitForApprovedClaim(webHarness.origin);
    assert(claim.status === 200, "Approved claim should return HTTP 200.");
    assert(
      claim.payload?.credential?.username === credentialUsername,
      "Approved claim returned the wrong username.",
    );
    assert(
      claim.payload?.credential?.password === credentialPassword,
      "Approved claim returned the wrong password.",
    );

    const secondClaim = await claimCredential(webHarness.origin);
    assert(
      secondClaim.status === 404,
      "Second claim should fail after one-time release is consumed.",
    );
    assert(
      secondClaim.payload?.error === "credential_not_found",
      "Second claim should return credential_not_found.",
    );
    assert(
      !JSON.stringify(secondClaim).includes(credentialPassword),
      "Second claim response leaked plaintext password.",
    );

    console.log(
      JSON.stringify(
        {
          claim: "real native-process Web import",
          importedCredentialId: credentialId,
          lockedBoundary: "vault_locked",
          oneTimeClaim: "credential_not_found",
          status: "passed",
          surface: "web-save-to-mac-smoke",
        },
        null,
        2,
      ),
    );
  } finally {
    await stopProcess(smokeHost);
    try {
      await cdp.send("Browser.close");
    } catch {
      chrome.kill();
    }
    await waitForProcessExit(chrome);
    await webHarness.close();
    await removeDirectoryWithRetry(tempRoot);
    killExistingCompanionProcesses();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
