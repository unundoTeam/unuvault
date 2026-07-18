import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const prohibitedActiveAuthorityPattern =
  /current\s+launch\s+gate\s+is\s+the\s+internal\s+iterative\s+review\s+loop|completed\s+for\s+current\s+scope|cleared\s+for\s+current\s+scope|current\s+launch\s+policy|current\s+internal\s+iterative\s+gate|Launch\s+checklist\s+updated\s+to\s+separate\s+the\s+current\s+internal\s+iterative\s+review\s+gate/iu;

function readText(pathFromRepoRoot: string): string {
  return readFileSync(resolve(repoRoot, pathFromRepoRoot), "utf8");
}

function markdownPreamble(document: string): string {
  const firstSectionIndex = document.search(/^##\s/mu);
  return firstSectionIndex === -1 ? document : document.slice(0, firstSectionIndex);
}

function markdownSection(document: string, heading: string): string {
  const headingMatch = /^(#+) [^\r\n]+$/u.exec(heading);
  if (headingMatch === null) {
    throw new Error(`Invalid Markdown heading: ${heading}`);
  }

  const headingLevel = headingMatch[1].length;
  const normalizedDocument = document.replace(/\r\n?/gu, "\n");
  const escapedHeading = heading.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
  const matches = [
    ...normalizedDocument.matchAll(new RegExp(`^${escapedHeading}$`, "gmu")),
  ];

  if (matches.length === 0) {
    throw new Error(`Missing Markdown section: ${heading}`);
  }
  if (matches.length > 1) {
    throw new Error(`Duplicate Markdown section: ${heading}`);
  }

  const headingEnd = (matches[0].index ?? 0) + matches[0][0].length;
  const contentStart =
    normalizedDocument[headingEnd] === "\n" ? headingEnd + 1 : headingEnd;
  const nextHeading = new RegExp(`^#{1,${headingLevel}}\\s`, "mu");
  const relativeEnd = normalizedDocument.slice(contentStart).search(nextHeading);

  return relativeEnd === -1
    ? normalizedDocument.slice(contentStart)
    : normalizedDocument.slice(contentStart, contentStart + relativeEnd);
}

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/gu, " ").trim();
}

function fencedCodeBlocks(document: string, language: string): string[] {
  const normalizedDocument = document.replace(/\r\n?/gu, "\n");
  const blocks: string[] = [];
  const fencePattern = /^```([^\n]*)\n([\s\S]*?)^```[ \t]*$/gmu;

  for (const match of normalizedDocument.matchAll(fencePattern)) {
    if (match[1].trim() === language) {
      blocks.push(match[2]);
    }
  }

  return blocks;
}

function normalizeCode(value: string): string {
  return value.replace(/\s+/gu, "");
}

describe("launch packet contract", () => {
  it("detects line-wrapped prohibited active-authority phrases", () => {
    const lineWrappedFixtures = [
      "current\nlaunch gate is the internal iterative review loop",
      "completed\nfor current scope",
      "cleared for\ncurrent scope",
      "current\nlaunch policy",
      "current internal\niterative gate",
      "Launch checklist updated to separate the current internal iterative\nreview gate",
    ];

    for (const fixture of lineWrappedFixtures) {
      expect(fixture).toMatch(prohibitedActiveAuthorityPattern);
    }
  });

  it("normalizes line endings and enforces exact unique Markdown sections", () => {
    expect(
      markdownSection("## Required\r\nbody\r## Other\r\nnext\r\n", "## Required"),
    ).toBe("body\n");
    expect(markdownSection("## Required", "## Required")).toBe("");
    expect(() => markdownSection("## Other\nbody\n", "## Required")).toThrow(
      "Missing Markdown section: ## Required",
    );
    expect(() =>
      markdownSection(
        "## Required\nfirst\n## Other\nbody\n## Required\nsecond\n",
        "## Required",
      ),
    ).toThrow("Duplicate Markdown section: ## Required");
    expect(() =>
      markdownSection("prefix ## Required\nbody\n", "## Required"),
    ).toThrow("Missing Markdown section: ## Required");
  });

  it("keeps historical crypto review evidence separate from the current cross-platform gate", () => {
    const request = readText("docs/operations/third-party-crypto-review-request.md");
    const gate = readText("docs/operations/crypto-review-gate.md");
    const exception = readText(
      "docs/operations/crypto-review-launch-exception.md",
    );
    const checklist = readText("docs/launch/phase1-launch-checklist.md");
    const architecture = readText("docs/architecture/0005-secure-password-crypto.md");
    const handoff = readText(
      "docs/operations/secure-crypto-pr-audit-handoff.md",
    );

    const requestStatus = markdownPreamble(request);
    const requestedReviewScope = markdownSection(
      request,
      "## Requested Review Scope",
    );
    const dispatchWorksheet = markdownSection(request, "## Dispatch Worksheet");
    const currentGate = markdownSection(gate, "## Current Gate State");
    const historicalException = markdownSection(
      exception,
      "## Historical Exception Status (2026-04-25)",
    );
    const historicalTarget = markdownSection(
      exception,
      "## Decision Owner And Review Target",
    );
    const currentChecklist = markdownSection(
      checklist,
      "## Carry-Forward Before GA/Public Launch",
    );
    const cryptoSubstrates = markdownSection(
      architecture,
      "## Two Crypto Substrates",
    );
    const residualRisks = markdownSection(architecture, "## Residual Risks");
    const currentFindings = markdownSection(
      handoff,
      "## Current Cross-Platform Preliminary Findings",
    );
    const historicalLoop = markdownSection(
      handoff,
      "## Historical PR #59 Internal Iterative Review Loop",
    );
    const historicalResult = markdownSection(
      handoff,
      "## Historical PR #59 Internal Iterative Review Result (2026-04-25)",
    );

    expect(requestStatus).toContain("dispatch state: `not dispatched`");
    expect(requestStatus).toContain(
      "exact merged implementation SHA: `not yet assigned`",
    );
    expect(requestStatus).toContain("historical PR `#59` target cannot substitute");
    expect(requestStatus).not.toMatch(
      /at or after\s+`46ae0c655deef0ef15cb0cd180b4844a32cac43d`/,
    );
    expect(requestStatus).not.toMatch(
      /exact merged implementation SHA: `(?!not yet assigned)[^`]+`/u,
    );
    expect(requestStatus.match(/^- [^:\n]+: `[^`]+`$/gmu)).toEqual([
      "- dispatch state: `not dispatched`",
      "- exact merged implementation SHA: `not yet assigned`",
      "- reviewer or vendor: `not assigned`",
      "- contact path: `not assigned`",
      "- verdict: `not available`",
    ]);
    expect(requestedReviewScope).toMatch(
      /A branch name, tag without resolved commit, range,\s+historical SHA, or "latest main" is not an acceptable target\./u,
    );
    expect(dispatchWorksheet).toContain("dispatch state: `not dispatched`");
    expect(dispatchWorksheet).toContain(
      "exact merged implementation SHA: `not yet assigned`",
    );
    expect(dispatchWorksheet).not.toMatch(
      /dispatch state: `(sent|dispatched|complete)`/u,
    );
    expect(dispatchWorksheet).not.toMatch(
      /exact merged implementation SHA: `(?!not yet assigned)[^`]+`/u,
    );
    expect(dispatchWorksheet.match(/^- [^:\n]+: `[^`]+`$/gmu)).toEqual([
      "- dispatch state: `not dispatched`",
      "- exact merged implementation SHA: `not yet assigned`",
      "- request owner: `yuchen`",
      "- reviewer or vendor: `not assigned`",
      "- contact path: `not assigned`",
      "- sent date: `not sent`",
      "- requested reply date: `not assigned`",
      "- tracking link: `not assigned`",
      "- recording owner: `yuchen`",
    ]);

    expect(currentGate).toContain(
      "Current cross-platform internal review status: `blocked pending remediation and exact-target re-review`",
    );
    expect(currentGate).toContain("Bounded Argon2 checkpoint: `resolved`");
    expect(currentGate).toContain(
      "Pairing target-claim authentication: `pending on main`",
    );
    expect(currentGate).toContain("Fresh Mac owner authorization: `pending on main`");
    expect(currentGate).toContain(
      "Restart-persistent iOS replay rejection: `pending on main`",
    );
    expect(currentGate).toContain(
      "Local bridge authorization: `separate open blocker`",
    );
    expect(currentGate.match(/^- [^:\n]+: `[^`]+`$/gmu)).toEqual([
      "- Current cross-platform internal review status: `blocked pending remediation and exact-target re-review`",
      "- Bounded Argon2 checkpoint: `resolved`",
      "- Pairing target-claim authentication: `pending on main`",
      "- Fresh Mac owner authorization: `pending on main`",
      "- Restart-persistent iOS replay rejection: `pending on main`",
      "- Local bridge authorization: `separate open blocker`",
      "- Exact merged implementation SHA: `not yet assigned`",
      "- Independent third-party review for the expanded scope: `not dispatched`",
    ]);
    expect(currentGate).not.toMatch(
      /Current cross-platform internal review status: `(cleared|approved|complete)`/u,
    );
    expect(currentGate).not.toMatch(
      /(?:at or after|latest main|46ae0c655deef0ef15cb0cd180b4844a32cac43d)/u,
    );

    expect(historicalException).toContain(
      "Third-party crypto review is deferred under this exception.",
    );
    expect(historicalTarget).toContain(
      "46ae0c655deef0ef15cb0cd180b4844a32cac43d",
    );
    expect(historicalTarget).toContain(
      "does not authorize the later native/cross-platform boundary",
    );

    expect(currentChecklist).toContain(
      "Current preliminary cross-platform review verdict: `blocked`",
    );
    expect(currentChecklist).toContain(
      "Historical PR `#59` clearance remains scoped to its recorded target",
    );
    expect(currentChecklist).not.toContain(
      "current GA/public-launch crypto gate as an internal",
    );
    expect(currentChecklist).not.toMatch(
      /Current preliminary cross-platform review verdict: `(cleared|approved|complete)`/u,
    );
    expect(
      currentChecklist.match(
        /^- Current preliminary cross-platform review verdict: `[^`]+`\.$/gmu,
      ),
    ).toEqual(["- Current preliminary cross-platform review verdict: `blocked`."]);

    expect(residualRisks).toContain(
      "Pairing V2 does not resolve local bridge authorization",
    );
    expect(cryptoSubstrates).not.toContain("share one crypto substrate");

    expect(currentFindings).toContain("Cross-platform preliminary verdict: `blocked`");
    expect(currentFindings).toContain(
      "No independent third-party verdict exists for the expanded scope",
    );
    expect(currentFindings).not.toMatch(
      /Cross-platform preliminary verdict: `(cleared|approved|complete)`/u,
    );
    expect(currentFindings).not.toMatch(
      /review (?:against|target(?: is|:))\s+(?:at or after|latest main)/iu,
    );
    expect(
      currentFindings.match(/^Cross-platform preliminary verdict: `[^`]+`\.$/gmu),
    ).toEqual(["Cross-platform preliminary verdict: `blocked`."]);
    expect(handoff).toMatch(
      /Document authority:[\s\S]*?the current expanded native\/cross-platform gate is[\s\S]*?`blocked`[\s\S]*?2026-04 PR[\s\S]*?`#59`[\s\S]*?historical JavaScript-substrate evidence only/iu,
    );
    for (const historicalSection of [historicalLoop, historicalResult]) {
      expect(historicalSection).toMatch(/historical PR `#59`/iu);
      expect(historicalSection).toMatch(/then-current[\s\S]*JavaScript substrate/iu);
      expect(historicalSection).toMatch(
        /does\s+not clear the current expanded native\/cross-platform gate/iu,
      );
    }
    expect(handoff).not.toMatch(prohibitedActiveAuthorityPattern);
  });

  it("pins interoperable pairing transcripts and bounded retry identity", () => {
    const protocol = readText(
      "docs/superpowers/specs/2026-07-10-authenticated-pairing-approval-design.md",
    );
    const canonicalEncoding = markdownSection(protocol, "## Canonical Encoding");
    const targetBoundHandoff = markdownSection(protocol, "## Target-Bound Handoff");
    const replayRejection = markdownSection(
      protocol,
      "## Single Use And Persistent Replay Rejection",
    );
    const terminalCleanup = markdownSection(
      protocol,
      "## Terminal Cleanup And Bounded Recovery",
    );

    expect(canonicalEncoding).toContain(
      'CLAIM_DOMAIN = ASCII("unuvault-pairing-claim-v2")',
    );
    expect(canonicalEncoding).toContain("P256_SPKI_DER");
    expect(canonicalEncoding).toMatch(
      /`id-ecPublicKey` \(`1\.2\.840\.10045\.2\.1`\) with\s+the named-curve parameter `prime256v1` \(`1\.2\.840\.10045\.3\.1\.7`\)/u,
    );
    expect(canonicalEncoding).toMatch(
      /exactly the 65-byte\s+ANSI X9\.63 uncompressed point `0x04 \|\| X \|\| Y`/u,
    );
    expect(canonicalEncoding).toContain("canonicalMacBaseURL");
    expect(canonicalEncoding).toMatch(
      /Serialize exactly `scheme \|\| ASCII\(":\/\/"\) \|\| host \|\| ASCII\(":"\) \|\|\s+shortestDecimal\(port\)`/u,
    );
    expect(canonicalEncoding).toMatch(
      /canonical\s+dotted-decimal\s+IPv4,\s+bracketed\s+RFC\s+5952\s+IPv6,\s+or\s+a\s+canonical\s+DNS\s+A-label\s+host/u,
    );
    expect(canonicalEncoding).toMatch(
      /Endpoint\s+reachability,\s+address-family\s+support,\s+and\s+private-versus-public\s+address\s+admission\s+are\s+separate\s+implementation\/security\s+policy/u,
    );
    expect(canonicalEncoding).toMatch(
      /Scoped\s+IPv6\s+endpoints\s+require\s+a\s+separate\s+endpoint-selection\s+rule/u,
    );
    expect(canonicalEncoding).toMatch(
      /IPv4-embedded\s+IPv6\s+addresses\s+always\s+use\s+the\s+eight\s+16-bit\s+hexadecimal\s+fields\s+as\s+input\s+to\s+the\s+same\s+RFC\s+5952\s+algorithm/u,
    );
    expect(canonicalEncoding).not.toMatch(
      /limited to RFC 1918|Reject .*IPv6|Reject .*public addresses/iu,
    );
    expect(canonicalEncoding).toMatch(
      /1\. `LP\(CLAIM_DOMAIN\)`\s+2\. `LP\(NFC-UTF8\(inviteSessionId\)\)`\s+3\. `LP\(u64be\(expiresAtEpochMilliseconds\)\)`\s+4\. `LP\(ASCII\(canonicalMacBaseURL\)\)`\s+5\. `LP\(canonicalTargetIdentityDER\)`\s+6\. `LP\(NFC-UTF8\(targetDeviceId\)\)`\s+7\. `LP\(NFC-UTF8\(targetDisplayName\)\)`\s+8\. `LP\(clientNonce\)`/u,
    );
    expect(targetBoundHandoff).toContain(
      'HKDF_SALT_DOMAIN = ASCII("unuvault-pairing-hkdf-salt-v2")',
    );
    expect(targetBoundHandoff).toContain(
      'HKDF_INFO_DOMAIN = ASCII("unuvault-pairing-handoff-key-v2")',
    );
    expect(targetBoundHandoff).toContain(
      'HANDOFF_AAD_DOMAIN = ASCII("unuvault-pairing-handoff-aad-v2")',
    );
    expect(targetBoundHandoff).toContain("AES_GCM_NONCE_BYTES = 12");
    expect(targetBoundHandoff).toMatch(
      /LP\(HKDF_SALT_DOMAIN\) \|\|\s+LP\(pairingSecret\)/u,
    );
    expect(targetBoundHandoff).toMatch(
      /LP\(HKDF_INFO_DOMAIN\) \|\|\s+LP\(ALGORITHM_ID\) \|\|\s+LP\(PAIRING_VERSION\) \|\|\s+LP\(NFC-UTF8\(inviteSessionId\)\) \|\|\s+LP\(claimId\) \|\|\s+LP\(handoffId\) \|\|\s+LP\(u64be\(expiresAtEpochMilliseconds\)\) \|\|\s+LP\(canonicalTargetIdentityDER\) \|\|\s+LP\(canonicalEphemeralPublicKeyDER\) \|\|\s+LP\(clientNonce\)/u,
    );
    expect(targetBoundHandoff).toMatch(
      /LP\(HANDOFF_AAD_DOMAIN\) \|\|\s+LP\(ALGORITHM_ID\) \|\|\s+LP\(PAIRING_VERSION\) \|\|\s+LP\(NFC-UTF8\(inviteSessionId\)\) \|\|\s+LP\(claimId\) \|\|\s+LP\(handoffId\) \|\|\s+LP\(canonicalTargetIdentityDER\) \|\|\s+LP\(u64be\(expiresAtEpochMilliseconds\)\) \|\|\s+LP\(canonicalEphemeralPublicKeyDER\)/u,
    );
    expect(targetBoundHandoff).toContain("CLAIM_ID_BYTES = 32");
    expect(targetBoundHandoff).toContain("HANDOFF_ID_BYTES = 32");
    expect(targetBoundHandoff).toMatch(
      /The\s+Mac\s+generates\s+both\s+identifiers\s+with\s+a\s+cryptographically\s+secure\s+random\s+number\s+generator/u,
    );
    expect(targetBoundHandoff).toMatch(
      /strict\s+unpadded\s+base64url\s+of\s+exactly\s+32\s+raw\s+bytes/u,
    );
    expect(targetBoundHandoff).toMatch(
      /collision\s+with\s+any\s+live,\s+terminal,\s+or\s+retained\s+tombstone\s+record/u,
    );
    expect(targetBoundHandoff).toMatch(/at\s+most\s+8\s+independent\s+draws/u);
    expect(targetBoundHandoff).toMatch(
      /The raw 12 bytes are passed to AES-GCM; the response field is\s+their strict unpadded base64url spelling\./u,
    );
    expect(targetBoundHandoff).toMatch(
      /strict unpadded\s+base64url of `ciphertext \|\| tag`, with the 16-byte GCM authentication tag last/u,
    );
    expect(replayRejection).toContain(
      'RETRY_IDENTITY_DOMAIN = ASCII("unuvault-pairing-retry-identity-v2")',
    );
    expect(replayRejection).toMatch(
      /LP\(RETRY_IDENTITY_DOMAIN\) \|\|\s+LP\(canonicalClaimTranscript\) \|\|\s+LP\(claimAuthenticator\)/u,
    );
    expect(replayRejection).toMatch(
      /original\s+authenticated\s+`clientNonce`/u,
    );
    expect(replayRejection).toMatch(
      /canonical claim transcript and authenticator\s+are each byte-identical to the reservation/u,
    );
    expect(replayRejection).toMatch(
      /including\s+its\s+AES-GCM\s+nonce,\s+is\s+reused\s+byte-for-byte/u,
    );
    expect(replayRejection).toContain("terminal `handoff_consumed`");
    expect(replayRejection).toMatch(
      /atomically\s+creates\s+the\s+durable\s+reservation\s+before\s+fresh\s+owner\s+authorization/u,
    );
    expect(replayRejection).toMatch(
      /`issued` -> `authorizing` -> `sealing` -> `ready` -> `consumed`/u,
    );
    expect(replayRejection).toMatch(
      /exactly\s+one\s+in-memory\s+snapshot\s+read\s+after\s+the\s+`sealing`\s+transition/u,
    );
    expect(replayRejection).toContain("`handoff_response_not_ready`");
    expect(replayRejection).toMatch(
      /begins\s+only\s+when\s+the\s+durable\s+reservation\s+atomically\s+transitions\s+to\s+`ready`/u,
    );
    expect(replayRejection).toMatch(
      /immutable\s+deadline\s+is\s+`min\(readyAt \+ 30 seconds, original invitation expiry\)`/u,
    );
    expect(replayRejection).toMatch(
      /If\s+either\s+`claimId`\s+or\s+`handoffId`\s+already\s+exists\s+in\s+the\s+consumed-ID\s+store/u,
    );
    expect(replayRejection).toMatch(
      /No\s+V2\s+failure\s+state\s+permits\s+a\s+V1\s+whole-vault\s+downgrade/u,
    );
    expect(terminalCleanup).toMatch(
      /An\s+unauthenticated\s+or\s+malformed\s+request\s+receives\s+the\s+same\s+generic\s+authentication\s+failure,\s+with\s+no\s+state\s+disclosure\s+or\s+mutation/u,
    );
    expect(terminalCleanup).not.toContain(
      "invalid authenticated request clears pending capability",
    );
    expect(terminalCleanup).toMatch(
      /A\s+deployment\s+rollback\s+disables\s+new\s+whole-vault\s+transfer\s+and\s+preserves\s+every\s+durable\s+reservation\s+and\s+consumed-ID\s+tombstone/u,
    );
  });

  it("aligns reservation anti-DoS, claim-auth-key, and terminal-cleanup authority", () => {
    const recoveryDesign = readText(
      "docs/superpowers/specs/2026-07-16-pairing-security-authority-recovery-design.md",
    );
    const recoveryPlan = readText(
      "docs/superpowers/plans/2026-07-16-pairing-security-authority-recovery.md",
    );
    const protocol = readText(
      "docs/superpowers/specs/2026-07-10-authenticated-pairing-approval-design.md",
    );

    const authorities = [
      {
        name: "recovery design",
        text: [
          markdownSection(
            recoveryDesign,
            "### Single Use, Persistent Replay Rejection, And No Downgrade",
          ),
          markdownSection(
            recoveryDesign,
            "### Terminal Cleanup And Bounded Recovery",
          ),
        ].join("\n"),
      },
      {
        name: "recovery plan",
        text: markdownSection(
          recoveryPlan,
          "### Task 1: Recover The UnuVault Pairing Security Authority",
        ),
      },
      {
        name: "current protocol",
        text: [
          markdownSection(protocol, "## Target-Claim Authentication"),
          markdownSection(
            protocol,
            "## Single Use And Persistent Replay Rejection",
          ),
          markdownSection(protocol, "## Terminal Cleanup And Bounded Recovery"),
        ].join("\n"),
      },
    ];

    const canonicalSecretLifecycle = normalizeWhitespace(
      "`claimAuthKey` is key-equivalent secret material. It is never logged, returned, or persisted in plaintext.",
    );
    const canonicalMacTerminalCleanup = normalizeWhitespace(
      "Every pre-ready terminal path above clears `claimAuthKey` and the reservation's other owned secret material while preserving required terminal tombstones; the ready-window deadline instead clears the retained sealed response, retry identity, and encrypted `claimAuthKey` while preserving the consumed tombstone.",
    );
    const canonicalReadyWindowBehavior = normalizeWhitespace(
      "Before the immutable deadline, processing the initial response, a byte-identical retry, a different valid authenticated retry identity, or an invalid authenticator does not by itself transition `ready` to `consumed` or `invalidated`, move `readyAt`, or shorten or extend the window.",
    );
    const canonicalReadySecurityInvalidation = normalizeWhitespace(
      "An independent trusted local lock, revoke, lost-device, or capability invalidation event during `ready` atomically transitions the reservation to `invalidated` immediately and clears the retained sealed response, retry identity, and encrypted `claimAuthKey`; security revocation takes priority over the recovery deadline.",
    );
    const canonicalReadyWindowCleanup = normalizeWhitespace(
      "At the immutable deadline, one atomic `ready` to `consumed` transition clears the retained sealed response, retry identity, and encrypted `claimAuthKey` and leaves only the minimum durable identifiers and consumed tombstone required for replay rejection.",
    );
    const canonicalReadyWindowDefinition = normalizeWhitespace(
      "The ready recovery window begins only when the durable reservation atomically transitions to `ready`; `readyAt` is the timestamp written by that same transaction, and the immutable deadline is `min(readyAt + 30 seconds, original invitation expiry)`.",
    );
    const canonicalTerminalMutationClassification = normalizeWhitespace(
      "The only state-owning terminal mutations are exclusive and classified as follows: fresh owner denial or cancellation records `denied`; invitation expiry records `expired`; owner-authentication unavailability or `LAContext` evaluation or system error records `invalidated`; lock, revoke, lost-device, or capability invalidation records `invalidated`, including an immediate atomic `ready` to `invalidated` transition for an independent trusted local lifecycle event; reservation identity, vault session identity, or authenticated-target recheck failure records `invalidated`, while expiry and lifecycle outcomes discovered by that recheck remain classified under their preceding categories; internal read or snapshot, key-derivation, sealing, persistence, or process failure before `ready` records `invalidated` when the worker can commit the terminal write; restart recovery records any live `issued`, unfinished `authorizing`, or unfinished `sealing` record as `invalidated` before claim handling or QR display, using the atomic issued-recovery rule; and reaching the immutable ready-window deadline transitions `ready` to `consumed` only if no prior security invalidation occurred.",
    );

    for (const { name, text: authority } of authorities) {
      const normalizedAuthority = normalizeWhitespace(authority);

      expect(authority).toMatch(
        /An\s+unauthenticated\s+or\s+malformed\s+request\s+receives\s+the\s+same\s+generic\s+authentication\s+failure,\s+with\s+no\s+state\s+disclosure\s+or\s+mutation\./u,
      );
      expect(authority).toMatch(
        /A\s+different\s+valid\s+authenticated\s+retry\s+identity\s+while\s+the\s+encrypted\s+`claimAuthKey`\s+verifier\s+exists\s+after\s+reservation\s+receives\s+terminal\s+`handoff_consumed`\s+and\s+cannot\s+mutate,\s+replace,\s+or\s+extend\s+the\s+reservation\./u,
      );
      expect(authority).toMatch(
        /Only\s+the\s+reserved\s+byte-identical\s+retry\s+may\s+observe\s+pending\s+or\s+ready\s+behavior\./u,
      );
      expect(authority).toMatch(
        /`claimAuthKey`\s+is\s+a\s+32-byte,\s+session-bound,\s+domain-separated\s+key\s+derived\s+from\s+the\s+raw\s+`pairingSecret`\s+with\s+HKDF-SHA256\./u,
      );
      expect(authority).toMatch(
        /`claimAuthenticator`\s*=\s*HMAC-SHA256\(`claimAuthKey`,\s*`canonicalClaimTranscript`\)/u,
      );
      expect(authority).toMatch(
        /encrypted\s+`claimAuthKey`[\s\S]{0,240}ready\s+retry\s+window/u,
      );
      expect(authority).toMatch(
        /raw\s+`pairingSecret`[\s\S]{0,200}cleared[\s\S]{0,120}`ready`/u,
      );
      expect(authority).toMatch(
        /At\s+the\s+immutable\s+deadline,[\s\S]{0,160}`ready`\s+to\s+`consumed`[\s\S]{0,200}clears[\s\S]{0,160}`claimAuthKey`/u,
      );
      expect(authority).toMatch(
        /owner-authentication\s+unavailability\s+or\s+`LAContext`\s+evaluation\s+or\s+system\s+error[\s\S]{0,200}`invalidated`/iu,
      );
      expect(normalizedAuthority).toContain(canonicalSecretLifecycle);
      expect(normalizedAuthority).toContain(canonicalMacTerminalCleanup);
      expect(normalizedAuthority).toContain(canonicalReadyWindowBehavior);
      expect(normalizedAuthority).toContain(canonicalReadySecurityInvalidation);
      expect(normalizedAuthority).toContain(canonicalReadyWindowCleanup);
      expect(normalizedAuthority, name).toContain(canonicalReadyWindowDefinition);
      expect(normalizedAuthority, name).toContain(
        canonicalTerminalMutationClassification,
      );
      expect(authority).not.toMatch(
        /(?:\bor\s+consume\b|\bconsume\s+or\b)/iu,
      );
      expect(authority).not.toMatch(
        /conflicting\s+target[\s\S]{0,120}(?:clear|invalidat)[\s\S]{0,80}(?:pending|reserved|reservation|workflow|capability|handoff)/iu,
      );
      expect(authority).not.toMatch(
        /invalid\s+authenticated\s+request[\s\S]{0,120}(?:clear|invalidat)[\s\S]{0,80}(?:pending|reserved|reservation|workflow|capability|handoff)/iu,
      );
      expect(authority).not.toMatch(
        /clear\s+pending\s+capabilities\/material\s+on[\s\S]{0,160}conflict/iu,
      );
    }

    const normalizedRecoveryDesign = normalizeWhitespace(recoveryDesign);
    expect(normalizedRecoveryDesign).not.toContain(
      normalizeWhitespace(
        "Before that deadline, the initial response, a byte-identical retry, a different valid authenticated retry identity, and an invalid authenticator",
      ),
    );

    const targetAuthentication = markdownSection(
      protocol,
      "## Target-Claim Authentication",
    );
    const replayRejection = markdownSection(
      protocol,
      "## Single Use And Persistent Replay Rejection",
    );
    const terminalCleanup = markdownSection(
      protocol,
      "## Terminal Cleanup And Bounded Recovery",
    );

    const recoveryPlanTask = markdownSection(
      recoveryPlan,
      "### Task 1: Recover The UnuVault Pairing Security Authority",
    );
    const normalizedRecoveryPlanTask = normalizeWhitespace(recoveryPlanTask);
    expect(normalizedRecoveryPlanTask).toContain(
      normalizeWhitespace(
        "During `authorizing` and `sealing`, only the reserved byte-identical retry may receive `handoff_response_not_ready`; no retry window exists before `ready`.",
      ),
    );
    expect(normalizedRecoveryPlanTask).toContain(
      normalizeWhitespace(
        "The ready recovery window begins only when the durable reservation atomically transitions to `ready`; `readyAt` is the timestamp written by that same transaction, and the immutable deadline is `min(readyAt + 30 seconds, original invitation expiry)`.",
      ),
    );

    expect(targetAuthentication).toContain(
      'CLAIM_AUTH_SALT_DOMAIN = ASCII("unuvault-pairing-claim-auth-salt-v2")',
    );
    expect(targetAuthentication).toContain(
      'CLAIM_AUTH_INFO_DOMAIN = ASCII("unuvault-pairing-claim-auth-key-v2")',
    );
    expect(targetAuthentication).toContain("CLAIM_AUTH_KEY_BYTES = 32");
    const claimAuthParameterBlocks = fencedCodeBlocks(
      targetAuthentication,
      "text",
    ).filter((block) => normalizeWhitespace(block).startsWith("claimAuthSalt ="));
    expect(claimAuthParameterBlocks.map(normalizeCode)).toEqual([
      normalizeCode(`
claimAuthSalt =
LP(CLAIM_AUTH_SALT_DOMAIN) ||
LP(PAIRING_VERSION) ||
LP(NFC-UTF8(inviteSessionId)) ||
LP(u64be(expiresAtEpochMilliseconds)) ||
LP(ASCII(canonicalMacBaseURL))

claimAuthInfo =
LP(CLAIM_AUTH_INFO_DOMAIN) ||
LP(PAIRING_VERSION)
`),
    ]);
    const claimAuthDerivationBlocks = fencedCodeBlocks(
      targetAuthentication,
      "text",
    ).filter((block) => normalizeWhitespace(block).startsWith("claimAuthKey ="));
    expect(claimAuthDerivationBlocks.map(normalizeCode)).toEqual([
      normalizeCode(`
claimAuthKey = HKDF-SHA256(
  IKM = pairingSecret,
  salt = claimAuthSalt,
  info = claimAuthInfo,
  L = CLAIM_AUTH_KEY_BYTES
)
claimAuthenticator = HMAC-SHA256(claimAuthKey, canonicalClaimTranscript)
`),
    ]);
    expect(targetAuthentication).toMatch(
      /The\s+claim-authentication\s+HKDF\s+and\s+the\s+handoff-encryption\s+HKDF\s+use\s+different\s+domain\s+constants,\s+input\s+keying\s+material,\s+salt,\s+and\s+info/u,
    );

    expect(targetAuthentication).toMatch(
      /The\s+Mac\s+owns\s+the\s+mutable\s+QR-secret\s+buffer\s+from\s+invite\s+and\s+claim\s+authentication\s+through\s+sealing/u,
    );
    expect(targetAuthentication).toMatch(
      /used\s+only\s+for\s+claim-authentication\s+HKDF\s+and\s+handoff-encryption\s+HKDF/u,
    );
    expect(targetAuthentication).toMatch(
      /never\s+logged\s+or\s+included\s+in\s+a\s+response\s+or\s+persistent\s+general\s+storage/u,
    );
    expect(terminalCleanup).toMatch(
      /At\s+the\s+atomic\s+`ready`\s+transition,[\s\S]{0,240}raw\s+`pairingSecret`[\s\S]{0,160}best-effort\s+cleared\s+immediately/u,
    );
    expect(terminalCleanup).toMatch(
      /not\s+retained\s+through\s+the\s+30-second\s+retry\s+window/u,
    );
    expect(terminalCleanup).toMatch(
      /At\s+the\s+immutable\s+deadline,[\s\S]{0,160}`ready`\s+to\s+`consumed`[\s\S]{0,240}clears[\s\S]{0,200}`claimAuthKey`[\s\S]{0,260}minimum\s+durable\s+identifiers\s+and\s+consumed\s+tombstone\s+required\s+for\s+replay\s+rejection/u,
    );
    expect(replayRejection).toMatch(
      /Ready\s+retry[\s\S]{0,240}encrypted\s+`claimAuthKey`[\s\S]{0,240}does\s+not\s+require\s+retaining\s+or\s+reconstructing\s+the\s+raw\s+`pairingSecret`\s+after\s+`ready`/u,
    );
    expect(terminalCleanup).toMatch(
      /The\s+iOS\s+scanner\s+or\s+parser\s+owns\s+the\s+received\s+secret\s+initially\s+and\s+transfers\s+ownership\s+exactly\s+once\s+to\s+the\s+pending\s+import\s+operation/u,
    );
    expect(terminalCleanup).toMatch(
      /holds\s+the\s+raw\s+secret\s+only\s+until\s+response\s+authentication\s+and\s+open\s+succeed\s+and\s+the\s+encrypted\s+received-vault\s+plus\s+both\s+consumed\s+IDs\s+commit\s+atomically,\s+then\s+clears\s+it\s+immediately/u,
    );
    expect(terminalCleanup).toMatch(
      /cancel,\s+parse,\s+authentication,\s+open,\s+import,\s+or\s+persistence\s+error,\s+expiry,\s+or\s+restart\s+before\s+commit\s+clears\s+every\s+owned\s+raw\s+or\s+derived\s+secret\s+and\s+requires\s+a\s+fresh\s+invite/u,
    );
    expect(terminalCleanup).toMatch(
      /best-effort\s+cleanup\s+of\s+owned\s+mutable\s+buffers,\s+not\s+guaranteed\s+zeroization\s+of\s+copies\s+created\s+by\s+the\s+Swift\s+runtime/u,
    );
  });

  it("makes trusted ready-state security invalidation immediate without request-driven mutation", () => {
    const authorities = [
      markdownSection(
        readText(
          "docs/superpowers/specs/2026-07-16-pairing-security-authority-recovery-design.md",
        ),
        "### Terminal Cleanup And Bounded Recovery",
      ),
      markdownSection(
        readText(
          "docs/superpowers/plans/2026-07-16-pairing-security-authority-recovery.md",
        ),
        "### Task 1: Recover The UnuVault Pairing Security Authority",
      ),
      markdownSection(
        readText(
          "docs/superpowers/specs/2026-07-10-authenticated-pairing-approval-design.md",
        ),
        "## Terminal Cleanup And Bounded Recovery",
      ),
    ];
    const requestOnlyRule = normalizeWhitespace(
      "Before the immutable deadline, processing the initial response, a byte-identical retry, a different valid authenticated retry identity, or an invalid authenticator does not by itself transition `ready` to `consumed` or `invalidated`, move `readyAt`, or shorten or extend the window.",
    );
    const securityInvalidationRule = normalizeWhitespace(
      "An independent trusted local lock, revoke, lost-device, or capability invalidation event during `ready` atomically transitions the reservation to `invalidated` immediately and clears the retained sealed response, retry identity, and encrypted `claimAuthKey`; security revocation takes priority over the recovery deadline.",
    );
    const normativeStateMachineRule = normalizeWhitespace(
      "The normative state machine permits `invalidated` from `authorizing` or `sealing` for the terminal owners classified below, and from `ready` only for an independent trusted local lock, revoke, lost-device, or capability invalidation event.",
    );
    const noOtherReadyInvalidationRule = normalizeWhitespace(
      "No other owner-authentication, internal, persistence, process, or request-processing outcome may transition `ready` early.",
    );

    for (const authority of authorities) {
      const normalizedAuthority = normalizeWhitespace(authority);
      expect(normalizedAuthority).toContain(requestOnlyRule);
      expect(normalizedAuthority).toContain(securityInvalidationRule);
      expect(normalizedAuthority).toContain(normativeStateMachineRule);
      expect(normalizedAuthority).toContain(noOtherReadyInvalidationRule);
    }

    const currentProtocolStateMachine = normalizeWhitespace(
      markdownSection(
        readText(
          "docs/superpowers/specs/2026-07-10-authenticated-pairing-approval-design.md",
        ),
        "## Single Use And Persistent Replay Rejection",
      ),
    );
    expect(currentProtocolStateMachine).toContain(normativeStateMachineRule);
    expect(currentProtocolStateMachine).not.toContain(
      normalizeWhitespace(
        "`denied`, `expired`, and `invalidated` are alternate terminal states from `authorizing` or `sealing`:",
      ),
    );
  });

  it("orders hostile-LAN claim validation before authenticated state lookup", () => {
    const authorities = [
      markdownSection(
        readText(
          "docs/superpowers/specs/2026-07-16-pairing-security-authority-recovery-design.md",
        ),
        "### Target-Claim Authentication",
      ),
      markdownSection(
        readText(
          "docs/superpowers/plans/2026-07-16-pairing-security-authority-recovery.md",
        ),
        "### Task 1: Recover The UnuVault Pairing Security Authority",
      ),
      markdownSection(
        readText(
          "docs/superpowers/specs/2026-07-10-authenticated-pairing-approval-design.md",
        ),
        "## Target-Claim Authentication",
      ),
    ];
    const orderedPipeline = [
      "Enforce the raw HTTP entity-body cap of 4096 octets. Reject `Content-Length` greater than 4096 before reading; for chunked or unknown-length input, use one fixed bounded buffer and fail closed when the 4097th octet arrives.",
      "Perform JSON parsing, schema validation, strict base64url decoding, and required-field checks.",
      "NFC-normalize text and enforce UTF-8 lengths of 1–128 bytes for `targetDeviceId` and 1–256 bytes for `targetDisplayName`.",
      "Parse the target P256 SPKI DER and require canonical DER by exact re-serialization before accepting the public key.",
      "Perform constant-shape verifier retrieval keyed only by the server-owned `inviteSessionId`: make one bounded indexed verifier-record read; decrypt the live encrypted `claimAuthKey` when present; for an absent, terminal, non-live, or missing record, substitute an independent 32-byte process-owned dummy key and continue through the same HMAC path. This step makes no reservation-lifecycle or state-dependent response decision, never returns or logs the candidate key, and never recreates a terminal verifier. It does not claim perfect constant-time storage I/O; it requires only a fixed bounded response and computation shape with one generic external result.",
      "Compute HMAC-SHA256 with the candidate key and compare the supplied authenticator in constant time.",
      "Only when the HMAC authenticates with a live verifier, load the full reservation state and apply the exact-retry, different-valid-retry, and ready-security-invalidation rules. A dummy-key or invalid-authenticator path returns the same generic authentication failure with no state disclosure or mutation.",
    ].map(normalizeWhitespace);
    const verifierBoundaryRule = normalizeWhitespace(
      "Verifier retrieval is a minimal capability-key lookup, not an authenticated business-state lookup; the latter occurs only after HMAC authentication succeeds with a live verifier.",
    );

    for (const authority of authorities) {
      const normalizedAuthority = normalizeWhitespace(authority);
      let previousStepEnd = -1;
      for (const step of orderedPipeline) {
        const stepStart = normalizedAuthority.indexOf(step);
        expect(stepStart).toBeGreaterThan(previousStepEnd);
        previousStepEnd = stepStart + step.length;
      }
      expect(normalizedAuthority).toContain(verifierBoundaryRule);
    }
  });

  it("requires a live verifier before any state-dependent retry response", () => {
    const authorities = [
      markdownSection(
        readText(
          "docs/superpowers/specs/2026-07-16-pairing-security-authority-recovery-design.md",
        ),
        "### Single Use, Persistent Replay Rejection, And No Downgrade",
      ),
      markdownSection(
        readText(
          "docs/superpowers/plans/2026-07-16-pairing-security-authority-recovery.md",
        ),
        "### Task 1: Recover The UnuVault Pairing Security Authority",
      ),
      markdownSection(
        readText(
          "docs/superpowers/specs/2026-07-10-authenticated-pairing-approval-design.md",
        ),
        "## Single Use And Persistent Replay Rejection",
      ),
    ];
    const liveVerifierRule = normalizeWhitespace(
      "While an encrypted `claimAuthKey` verifier exists in `authorizing`, `sealing`, or pre-deadline `ready`, the Mac authenticates the canonical request before selecting a state-dependent response: the reserved byte-identical identity receives only its allowed pending or ready behavior, while a different valid authenticated identity receives `handoff_consumed`.",
    );
    const noSessionLookupRule = normalizeWhitespace(
      "An `inviteSessionId` lookup alone never authorizes `handoff_consumed`.",
    );
    const terminalRule = normalizeWhitespace(
      "After `consumed`, `denied`, `expired`, or `invalidated` clears the verifier, every request receives the generic authentication failure with no state disclosure or mutation, even when its `inviteSessionId` matches a terminal tombstone.",
    );

    for (const authority of authorities) {
      const normalizedAuthority = normalizeWhitespace(authority);
      expect(normalizedAuthority).toContain(liveVerifierRule);
      expect(normalizedAuthority).toContain(noSessionLookupRule);
      expect(normalizedAuthority).toContain(terminalRule);
    }
  });

  it("resolves a failed or unknown first-claim CAS with one authoritative reread", () => {
    const authorities = [
      markdownSection(
        readText(
          "docs/superpowers/specs/2026-07-16-pairing-security-authority-recovery-design.md",
        ),
        "### Single Use, Persistent Replay Rejection, And No Downgrade",
      ),
      markdownSection(
        readText(
          "docs/superpowers/plans/2026-07-16-pairing-security-authority-recovery.md",
        ),
        "### Task 1: Recover The UnuVault Pairing Security Authority",
      ),
      markdownSection(
        readText(
          "docs/superpowers/specs/2026-07-10-authenticated-pairing-approval-design.md",
        ),
        "## Single Use And Persistent Replay Rejection",
      ),
    ];
    const casOutcomeRule = normalizeWhitespace(
      "If the first-claim compare-and-swap returns false, or its commit acknowledgement or outcome is unknown, the request performs exactly one authoritative durable reread before selecting any response; that reread, matching-generation and state validation, and state-dependent response selection execute inside one serializable transaction or record lock that is mutually exclusive with every revoke, lock, lost-device, capability, expiry, ready-window deadline, and terminal-cleanup compare-and-swap.",
    );
    const linearizationRule = normalizeWhitespace(
      "The transaction's reread-and-response-decision point is the linearization point: if a terminal or trusted-security transition linearizes first, the request returns the generic authentication failure; if authorized response selection linearizes first, that selected response is defined to precede any later revoke.",
    );
    const sendRule = normalizeWhitespace(
      "After leaving the transaction, send exactly the selected response without rereading or reselecting from an external stale snapshot; response transmission itself never holds the transaction or record lock.",
    );
    const matchingWinnerRule = normalizeWhitespace(
      "Only a winning reservation whose immutable verifier provenance ID and envelope generation both match the candidate invite envelope is a matching winner.",
    );
    const durableTruthRule = normalizeWhitespace(
      "When that single reread proves a matching winner, that reservation is the sole durable truth and the request applies the existing byte-identical or different-valid retry semantics to it.",
    );
    const failClosedRule = normalizeWhitespace(
      "If the reread finds no winning reservation, a terminal tombstone, a missing record, a verifier provenance or generation mismatch, or cannot prove the matching winner, the request returns the generic authentication failure with no mutation, state disclosure, or verifier reconstruction.",
    );
    const raceRule = normalizeWhitespace(
      "The same single-reread rule resolves invitation expiry, revoke, process restart, and persistence races; an unknown commit followed by a matching reservation uses that reservation as the only durable truth, and every other result fails closed.",
    );

    for (const authority of authorities) {
      const normalizedAuthority = normalizeWhitespace(authority);
      const rules = [
        casOutcomeRule,
        linearizationRule,
        matchingWinnerRule,
        durableTruthRule,
        failClosedRule,
        raceRule,
        sendRule,
      ];
      let previousRuleEnd = -1;
      for (const rule of rules) {
        const ruleStart = normalizedAuthority.indexOf(rule);
        expect(ruleStart).toBeGreaterThan(previousRuleEnd);
        previousRuleEnd = ruleStart + rule.length;
      }
      expect(normalizedAuthority).not.toMatch(
        /authenticated\s+losers\s+are\s+re-evaluated\s+against\s+the\s+winning\s+reservation/iu,
      );
      expect(normalizedAuthority).not.toContain(
        normalizeWhitespace(
          "the request performs exactly one authoritative durable reread before selecting any response. Only a winning reservation",
        ),
      );
    }
  });

  it("cleans every request-local verifier candidate after HMAC comparison", () => {
    const authorities = [
      markdownSection(
        readText(
          "docs/superpowers/specs/2026-07-16-pairing-security-authority-recovery-design.md",
        ),
        "### Target-Claim Authentication",
      ),
      markdownSection(
        readText(
          "docs/superpowers/plans/2026-07-16-pairing-security-authority-recovery.md",
        ),
        "### Task 1: Recover The UnuVault Pairing Security Authority",
      ),
      markdownSection(
        readText(
          "docs/superpowers/specs/2026-07-10-authenticated-pairing-approval-design.md",
        ),
        "## Target-Claim Authentication",
      ),
    ];
    const hmacRule = normalizeWhitespace(
      "Compute HMAC-SHA256 with the candidate key and compare the supplied authenticator in constant time.",
    );
    const allPathCleanupRule = normalizeWhitespace(
      "Every request path—live invite-envelope candidate, live reservation-verifier candidate, and dummy candidate for a missing, terminal, or non-live record—enters one defer/finally cleanup scope before HMAC comparison and best-effort clears its request-local candidate plaintext and reference after comparison or error.",
    );
    const dummyOwnershipRule = normalizeWhitespace(
      "Per-request cleanup never clears the process-owned dummy master buffer; it clears only the request-local candidate copy or reference, while the dummy master buffer remains mutable process-owned memory and is best-effort cleared only at process shutdown.",
    );
    const oldDummyOnlyRule = normalizeWhitespace(
      "Every missing, terminal, or non-live verifier path uses that key for the same HMAC computation, clears the request-local candidate reference after comparison, and best-effort clears the dummy buffer at process shutdown.",
    );

    for (const authority of authorities) {
      const normalizedAuthority = normalizeWhitespace(authority);
      const hmacStart = normalizedAuthority.indexOf(hmacRule);
      const cleanupStart = normalizedAuthority.indexOf(allPathCleanupRule);
      const ownershipStart = normalizedAuthority.indexOf(dummyOwnershipRule);
      expect(hmacStart).toBeGreaterThan(-1);
      expect(cleanupStart).toBeGreaterThan(hmacStart);
      expect(ownershipStart).toBeGreaterThan(cleanupStart);
      expect(normalizedAuthority).not.toContain(oldDummyOnlyRule);
    }
  });

  it("bootstraps an immutable verifier envelope and transfers its outer ownership exactly once", () => {
    const authorities = [
      readText(
        "docs/superpowers/specs/2026-07-16-pairing-security-authority-recovery-design.md",
      ),
      markdownSection(
        readText(
          "docs/superpowers/plans/2026-07-16-pairing-security-authority-recovery.md",
        ),
        "### Task 1: Recover The UnuVault Pairing Security Authority",
      ),
      readText(
        "docs/superpowers/specs/2026-07-10-authenticated-pairing-approval-design.md",
      ),
    ];
    const inviteBootstrapRule = normalizeWhitespace(
      "Before an invitation QR may be displayed or activated, the Mac derives the 32-byte `claimAuthKey` from the raw 32-byte `pairingSecret` and the immutable server-owned `PAIRING_VERSION`, NFC `inviteSessionId`, `expiresAtEpochMilliseconds`, and `canonicalMacBaseURL` using the byte-exact claim-authentication HKDF above.",
    );
    const issuanceTransactionRule = normalizeWhitespace(
      "One issuance durable transaction commits all issuance authority together: the outer lifecycle state `issued`, immutable verifier provenance ID and envelope generation, the unique encrypted verifier ciphertext ownership or reference, and every immutable transcript input required to authenticate the first claim.",
    );
    const envelopeRule = normalizeWhitespace(
      "The encrypted verifier envelope is keyed by `inviteSessionId`; its immutable authenticated plaintext payload contains exactly the 32-byte `claimAuthKey`, those immutable transcript inputs, the envelope format and version, and the same immutable verifier provenance ID and envelope generation, with no target-controlled field or mutable lifecycle state.",
    );
    const outerStateRule = normalizeWhitespace(
      "Mutable lifecycle state (`issued`, `authorizing`, `sealing`, `ready`, or terminal) and the exact request and retry metadata exist only in the outer durable record or columns controlled by atomic compare-and-swap; `issued/unreserved` is never inside the encrypted envelope payload.",
    );
    const atomicVisibilityRule = normalizeWhitespace(
      "No issuance component is visible independently; a failed or unknown commit keeps the QR hidden and inactive until one authoritative reread proves a complete, internally consistent `issued` record whose provenance, generation, ciphertext ownership, and transcript inputs all match.",
    );
    const recoveryRule = normalizeWhitespace(
      "If that reread cannot prove the complete record, activation fails closed and idempotent recovery removes every orphaned ciphertext, ownership reference, or incomplete outer record.",
    );
    const activationGateRule = normalizeWhitespace(
      "QR activation waits for the entire issuance transaction commit, never only the ciphertext or verifier-envelope commit.",
    );
    const crashInvariantRule = normalizeWhitespace(
      "Crash recovery must never leave verifier ciphertext without its owning `issued` record or an `issued` record without its verifier ciphertext.",
    );
    const retrievalRule = normalizeWhitespace(
      "Verifier retrieval obtains the live key and immutable transcript inputs from the encrypted invite envelope for a first claim or from the reservation verifier record after reservation; it reads no target-bound or business-lifecycle state before HMAC authentication.",
    );
    const transferRule = normalizeWhitespace(
      "After the first valid HMAC, one durable transaction atomically changes the outer state from `issued` to `authorizing`, binds the exact request and retry identity, allocates `claimId`, and moves the unique ownership or reference for the same immutable verifier ciphertext from the invite slot to the reservation slot without copying, re-deriving, or re-encrypting the key.",
    );
    const concurrencyRule = normalizeWhitespace(
      "Concurrent authenticated claims cannot create multiple reservations: exactly one compare-and-swap winner performs the ownership transfer, and every false or unknown outcome follows the single authoritative-reread rule; an invalid HMAC performs no mutation.",
    );
    const terminalCleanupRule = normalizeWhitespace(
      "Every terminal cleanup is one atomic, mutually exclusive, and idempotently recoverable transition that replaces the live outer record with a minimum tombstone containing no verifier and deletes the verifier ciphertext ownership or reference in the same commit.",
    );
    const restartCleanupRule = normalizeWhitespace(
      "Restart recovery may safely repeat that transition and must never leave both a live verifier and a terminal tombstone.",
    );
    const secretLifetimeRule = normalizeWhitespace(
      "Creating the encrypted verifier envelope neither transfers nor extends the raw `pairingSecret` lifetime: the Mac-owned mutable raw-secret buffer remains governed by the existing sealing and `ready` cleanup rules and is never reconstructed from the envelope.",
    );
    const dummyLifecycleRule = normalizeWhitespace(
      "At process startup, the Mac generates an independent 32-byte process-owned dummy key with a CSPRNG and retains it only in mutable memory; it is never logged, returned, or persisted.",
    );

    for (const authority of authorities) {
      const normalizedAuthority = normalizeWhitespace(authority);
      for (const orderedRules of [
        [
          inviteBootstrapRule,
          issuanceTransactionRule,
          envelopeRule,
          outerStateRule,
          atomicVisibilityRule,
          recoveryRule,
          activationGateRule,
          crashInvariantRule,
        ],
        [transferRule, concurrencyRule],
        [terminalCleanupRule, restartCleanupRule],
      ]) {
        let previousRuleEnd = -1;
        for (const rule of orderedRules) {
          const ruleStart = normalizedAuthority.indexOf(rule);
          expect(ruleStart).toBeGreaterThan(previousRuleEnd);
          previousRuleEnd = ruleStart + rule.length;
        }
      }
      expect(normalizedAuthority).toContain(retrievalRule);
      expect(normalizedAuthority).toContain(secretLifetimeRule);
      expect(normalizedAuthority).toContain(dummyLifecycleRule);
      expect(normalizedAuthority).not.toContain(
        normalizeWhitespace(
          "After the first valid claim, the reservation retains the `claimAuthKey` only in encrypted storage",
        ),
      );
      expect(normalizedAuthority).not.toContain(
        normalizeWhitespace(
          "derives the same `claimAuthKey`, and verifies the HMAC",
        ),
      );
      expect(normalizedAuthority).not.toContain(
        normalizeWhitespace("never returns, retains, or logs the dummy key"),
      );
      expect(normalizedAuthority).not.toContain(
        normalizeWhitespace(
          "its authenticated plaintext payload contains exactly the 32-byte `claimAuthKey`, those immutable transcript inputs, and an `issued/unreserved` marker",
        ),
      );
      expect(normalizedAuthority).not.toContain(
        normalizeWhitespace(
          "authenticated losers are re-evaluated against the winning reservation under the byte-identical or different-valid retry rules",
        ),
      );
      expect(normalizedAuthority).not.toContain(
        normalizeWhitespace(
          "The QR becomes visible and active only after that envelope commits",
        ),
      );
    }
  });

  it("invalidates every issued invite before restart claim handling or QR recovery", () => {
    const authorities = [
      markdownSection(
        readText(
          "docs/superpowers/specs/2026-07-16-pairing-security-authority-recovery-design.md",
        ),
        "### Target-Claim Authentication",
      ),
      markdownSection(
        readText(
          "docs/superpowers/plans/2026-07-16-pairing-security-authority-recovery.md",
        ),
        "### Task 1: Recover The UnuVault Pairing Security Authority",
      ),
      markdownSection(
        readText(
          "docs/superpowers/specs/2026-07-10-authenticated-pairing-approval-design.md",
        ),
        "## Target-Claim Authentication",
      ),
    ];
    const issuedRestartRule = normalizeWhitespace(
      "On Mac process startup or recovery, before enabling claim handling or redisplaying any QR, every live `issued` record enters one atomic, mutually exclusive, and idempotent terminal transition to `invalidated`; the same commit deletes the invite verifier ciphertext ownership or reference, hides and revokes the old QR, preserves only the minimum tombstone, and requires a fresh invite.",
    );
    const noSecretRecoveryRule = normalizeWhitespace(
      "Recovery never accepts a claim from the durable `claimAuthKey` of a recovered `issued` record and never persists, reconstructs, or substitutes the raw `pairingSecret`.",
    );
    const unknownCommitRule = normalizeWhitespace(
      "A failed or unknown recovery commit is resolved by one authoritative reread; if the record remains live `issued`, recovery repeats the same terminal transition, and claim handling and QR display stay disabled until the reread proves an `invalidated` tombstone with no verifier. At no intermediate or final durable point may a live verifier and terminal tombstone coexist.",
    );

    for (const authority of authorities) {
      const normalizedAuthority = normalizeWhitespace(authority);
      const issuedRestartStart = normalizedAuthority.indexOf(issuedRestartRule);
      const noSecretRecoveryStart = normalizedAuthority.indexOf(
        noSecretRecoveryRule,
      );
      const unknownCommitStart = normalizedAuthority.indexOf(unknownCommitRule);
      expect(issuedRestartStart).toBeGreaterThan(-1);
      expect(noSecretRecoveryStart).toBeGreaterThan(issuedRestartStart);
      expect(unknownCommitStart).toBeGreaterThan(noSecretRecoveryStart);
      expect(normalizedAuthority).not.toMatch(
        /restart\s+recovery\s+of\s+unfinished\s+`authorizing`\s+or\s+`sealing`\s+work/iu,
      );
    }

    const terminalAuthorities = [
      markdownSection(
        readText(
          "docs/superpowers/specs/2026-07-16-pairing-security-authority-recovery-design.md",
        ),
        "### Terminal Cleanup And Bounded Recovery",
      ),
      markdownSection(
        readText(
          "docs/superpowers/plans/2026-07-16-pairing-security-authority-recovery.md",
        ),
        "### Task 1: Recover The UnuVault Pairing Security Authority",
      ),
      markdownSection(
        readText(
          "docs/superpowers/specs/2026-07-10-authenticated-pairing-approval-design.md",
        ),
        "## Terminal Cleanup And Bounded Recovery",
      ),
    ];
    const exhaustiveOwnerRule = normalizeWhitespace(
      "restart recovery records any live `issued`, unfinished `authorizing`, or unfinished `sealing` record as `invalidated` before claim handling or QR display, using the atomic issued-recovery rule",
    );
    for (const authority of terminalAuthorities) {
      expect(normalizeWhitespace(authority)).toContain(exhaustiveOwnerRule);
    }
  });

  it("linearizes every sealed-response selection against terminal security transitions", () => {
    const authorities = [
      markdownSection(
        readText(
          "docs/superpowers/specs/2026-07-16-pairing-security-authority-recovery-design.md",
        ),
        "### Single Use, Persistent Replay Rejection, And No Downgrade",
      ),
      markdownSection(
        readText(
          "docs/superpowers/plans/2026-07-16-pairing-security-authority-recovery.md",
        ),
        "### Task 1: Recover The UnuVault Pairing Security Authority",
      ),
      markdownSection(
        readText(
          "docs/superpowers/specs/2026-07-10-authenticated-pairing-approval-design.md",
        ),
        "## Single Use And Persistent Replay Rejection",
      ),
    ];
    const allSelectionRule = normalizeWhitespace(
      "Every state-dependent response-selection path—the `sealing` to `ready` first sealed-response publication, each pre-deadline byte-identical `ready` retry, and the failed or unknown first-claim compare-and-swap reread path—executes inside one serializable transaction or record lock that is mutually exclusive with every trusted lock, revoke, lost-device, capability invalidation, expiry, ready-window deadline, and terminal-cleanup compare-and-swap.",
    );
    const validationRule = normalizeWhitespace(
      "Inside that transaction, the request rereads and validates the current state, verifier provenance and generation, the applicable invitation expiry or immutable ready deadline, and exact retry identity before selecting exact serialized response bytes; that response-selection decision is the linearization point.",
    );
    const orderingRule = normalizeWhitespace(
      "If a terminal or trusted-security transition linearizes first, no sealed response is selected or sent and the request returns the generic authentication failure; if response selection linearizes first, sending those selected bytes is strictly ordered before any later revoke or terminal transition.",
    );
    const firstPublicationRule = normalizeWhitespace(
      "For first publication, the same transaction persists `readyAt`, the immutable deadline, and the exact serialized sealed response, changes `sealing` to `ready`, and selects those exact response bytes from its durable write set. They become sendable only after the commit succeeds; a false or unknown outcome follows the existing authoritative-reread rule.",
    );
    const retryRule = normalizeWhitespace(
      "For each pre-deadline byte-identical `ready` retry, the transaction selects only the retained exact serialized response bytes from the validated durable `ready` record.",
    );
    const sendRule = normalizeWhitespace(
      "After the transaction, response transmission uses only the exact bytes selected inside it; it never rereads or reselects durable state, never sends a stale in-memory sealed response, and never holds the transaction or record lock during network I/O.",
    );

    for (const authority of authorities) {
      const normalizedAuthority = normalizeWhitespace(authority);
      const orderedRules = [
        allSelectionRule,
        validationRule,
        orderingRule,
        firstPublicationRule,
        retryRule,
        sendRule,
      ];
      let previousRuleEnd = -1;
      for (const rule of orderedRules) {
        const ruleStart = normalizedAuthority.indexOf(rule);
        expect(ruleStart).toBeGreaterThan(previousRuleEnd);
        previousRuleEnd = ruleStart + rule.length;
      }
      expect(normalizedAuthority).not.toContain(
        normalizeWhitespace(
          "Before publishing a response, one transaction rechecks expiry and the same reservation, persists the exact serialized sealed response plus `readyAt`, and changes `sealing` to `ready`.",
        ),
      );
      expect(normalizedAuthority).not.toMatch(
        /send(?:s|ing)?\s+(?:the\s+)?(?:sealed\s+)?response\s+from\s+(?:a|the)\s+stale\s+in-memory/iu,
      );
    }
  });

  it("keeps the tracked recovery design normative across reviewed amendments", () => {
    const recoveryDesign = normalizeWhitespace(
      markdownPreamble(
        readText(
          "docs/superpowers/specs/2026-07-16-pairing-security-authority-recovery-design.md",
        ),
      ),
    );
    const recoveryPlan = normalizeWhitespace(
      markdownPreamble(
        readText(
          "docs/superpowers/plans/2026-07-16-pairing-security-authority-recovery.md",
        ),
      ),
    );

    expect(recoveryDesign).toContain(
      normalizeWhitespace(
        "This tracked file is the normative Pairing security authority-recovery design. Historical commits are provenance only and cannot override later reviewed amendments to this file.",
      ),
    );
    expect(recoveryPlan).toContain(
      normalizeWhitespace(
        "Normative source design: `docs/superpowers/specs/2026-07-16-pairing-security-authority-recovery-design.md` as tracked on the current task branch; later reviewed amendments to that file remain authoritative.",
      ),
    );
    expect(recoveryPlan).toContain(
      normalizeWhitespace(
        "Commit `3af9dc50be9269f58f8e91407c68ba2a0d682e73` is a historical baseline only. It is not a standalone or current approved normative source and cannot override later amendments.",
      ),
    );
    expect(recoveryPlan).not.toMatch(
      /Approved\s+source\s+design:[\s\S]{0,240}`3af9dc50be9269f58f8e91407c68ba2a0d682e73`/iu,
    );
  });
});
