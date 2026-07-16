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
      /`unreserved` -> `authorizing` -> `sealing` -> `ready` -> `consumed`/u,
    );
    expect(replayRejection).toMatch(
      /exactly\s+one\s+in-memory\s+snapshot\s+read\s+after\s+the\s+`sealing`\s+transition/u,
    );
    expect(replayRejection).toContain("`handoff_response_not_ready`");
    expect(replayRejection).toMatch(
      /starts\s+only\s+when\s+the\s+durable\s+record\s+atomically\s+enters\s+`ready`/u,
    );
    expect(replayRejection).toMatch(
      /minimum\s+of\s+`readyAt \+ 30 seconds`\s+and\s+the\s+original\s+invitation\s+expiry/u,
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
      [
        markdownSection(
          recoveryDesign,
          "### Single Use, Persistent Replay Rejection, And No Downgrade",
        ),
        markdownSection(
          recoveryDesign,
          "### Terminal Cleanup And Bounded Recovery",
        ),
      ].join("\n"),
      markdownSection(recoveryPlan, "### Task 1: Recover The UnuVault Pairing Security Authority"),
      [
        markdownSection(protocol, "## Target-Claim Authentication"),
        markdownSection(protocol, "## Single Use And Persistent Replay Rejection"),
        markdownSection(protocol, "## Terminal Cleanup And Bounded Recovery"),
      ].join("\n"),
    ];

    const canonicalSecretLifecycle = normalizeWhitespace(
      "`claimAuthKey` is key-equivalent secret material. It is never logged, returned, or persisted in plaintext.",
    );
    const canonicalMacTerminalCleanup = normalizeWhitespace(
      "Fresh owner denial or cancellation; owner-authentication unavailability or `LAContext` evaluation or system error; invitation expiry; lock, revoke, lost-device state, or capability failure; snapshot or seal failure; and restart before `ready` are Mac terminal paths that clear `claimAuthKey` while preserving required terminal tombstones.",
    );
    const canonicalReadyWindowBehavior = normalizeWhitespace(
      "Before that deadline, the initial response, a byte-identical retry, a different valid authenticated retry identity, and an invalid authenticator do not transition `ready` to `consumed`, move `readyAt`, or shorten or extend the window.",
    );
    const canonicalReadyOnlyDeadlineTransition = normalizeWhitespace(
      "Once a record is `ready`, only reaching that immutable deadline may transition it, and the transition target is `consumed`.",
    );
    const canonicalReadyWindowCleanup = normalizeWhitespace(
      "At the immutable deadline, one atomic `ready` to `consumed` transition clears the retained sealed response, retry identity, and encrypted `claimAuthKey` and leaves only the minimum durable identifiers and consumed tombstone required for replay rejection.",
    );

    for (const authority of authorities) {
      const normalizedAuthority = normalizeWhitespace(authority);

      expect(authority).toMatch(
        /An\s+unauthenticated\s+or\s+malformed\s+request\s+receives\s+the\s+same\s+generic\s+authentication\s+failure,\s+with\s+no\s+state\s+disclosure\s+or\s+mutation\./u,
      );
      expect(authority).toMatch(
        /A\s+different\s+valid\s+authenticated\s+retry\s+identity\s+after\s+reservation\s+receives\s+terminal\s+`handoff_consumed`\s+and\s+cannot\s+mutate,\s+replace,\s+or\s+extend\s+the\s+reservation\./u,
      );
      expect(authority).toMatch(
        /Only\s+the\s+reserved\s+byte-identical\s+retry\s+may\s+observe\s+pending\s+or\s+ready\s+behavior\./u,
      );
      expect(authority).toMatch(
        /The\s+only\s+state-owning\s+terminal\s+mutations\s+are\s+fresh\s+owner\s+denial\s+or\s+cancellation;\s+owner-authentication\s+unavailability\s+or\s+`LAContext`\s+evaluation\s+or\s+system\s+error;\s+invitation\s+expiry;\s+lock,\s+revoke,\s+lost-device,\s+or\s+capability\s+invalidation;\s+internal\s+snapshot,\s+sealing,\s+or\s+persistence\s+failure;\s+restart\s+recovery\s+of\s+unfinished\s+pre-ready\s+work;\s+and\s+the\s+immutable\s+ready-window\s+deadline\s+transition\s+from\s+`ready`\s+to\s+`consumed`\./u,
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
      expect(normalizedAuthority).toContain(canonicalReadyOnlyDeadlineTransition);
      expect(normalizedAuthority).toContain(canonicalReadyWindowCleanup);
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
        "The ready retry window starts only at the atomic `ready` transition, with immutable deadline `min(readyAt + 30 seconds, original invitation expiry)`.",
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
});
