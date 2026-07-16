import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

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

describe("launch packet contract", () => {
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
    expect(handoff).not.toMatch(
      /current launch gate is the internal iterative review loop|completed for current scope|cleared for current scope|current launch policy|current internal iterative gate|Launch checklist updated to separate the current internal iterative review gate/iu,
    );
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
    expect(canonicalEncoding).toContain(
      "canonical dotted-decimal IPv4, bracketed RFC 5952 IPv6, or a canonical DNS A-label host",
    );
    expect(canonicalEncoding).toContain(
      "Endpoint reachability, address-family support, and private-versus-public address admission are separate implementation/security policy",
    );
    expect(canonicalEncoding).toContain(
      "Scoped IPv6 endpoints require a separate endpoint-selection rule",
    );
    expect(canonicalEncoding).toContain(
      "IPv4-embedded IPv6 addresses always use the eight 16-bit hexadecimal fields as input to the same RFC 5952 algorithm",
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
    expect(targetBoundHandoff).toContain(
      "The Mac generates both identifiers with a cryptographically secure random number generator",
    );
    expect(targetBoundHandoff).toContain(
      "strict unpadded base64url of exactly 32 raw bytes",
    );
    expect(targetBoundHandoff).toContain(
      "collision with any live, terminal, or retained tombstone record",
    );
    expect(targetBoundHandoff).toContain("at most 8 independent draws");
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
    expect(replayRejection).toContain("original authenticated `clientNonce`");
    expect(replayRejection).toMatch(
      /canonical claim transcript and authenticator\s+are each byte-identical to the reservation/u,
    );
    expect(replayRejection).toContain(
      "including its AES-GCM nonce, is reused byte-for-byte",
    );
    expect(replayRejection).toContain("terminal `handoff_consumed`");
    expect(replayRejection).toContain(
      "atomically creates the durable reservation before fresh owner authorization",
    );
    expect(replayRejection).toMatch(
      /`unreserved` -> `authorizing` -> `sealing` -> `ready` -> `consumed`/u,
    );
    expect(replayRejection).toContain(
      "exactly one in-memory snapshot read after the `sealing` transition",
    );
    expect(replayRejection).toContain("`handoff_response_not_ready`");
    expect(replayRejection).toContain(
      "starts only when the durable record atomically enters `ready`",
    );
    expect(replayRejection).toContain(
      "minimum of `readyAt + 30 seconds` and the original invitation expiry",
    );
    expect(replayRejection).toContain(
      "If either `claimId` or `handoffId` already exists in the consumed-ID store",
    );
    expect(replayRejection).toContain(
      "No V2 failure state permits a V1 whole-vault downgrade",
    );
    expect(terminalCleanup).toContain(
      "An unauthenticated or different authenticated request does not mutate the reserved workflow",
    );
    expect(terminalCleanup).not.toContain(
      "invalid authenticated request clears pending capability",
    );
    expect(terminalCleanup).toContain(
      "A deployment rollback disables new whole-vault transfer and preserves every durable reservation and consumed-ID tombstone",
    );
  });
});
