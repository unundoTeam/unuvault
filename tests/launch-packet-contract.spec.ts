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
  const headingLine = `${heading}\n`;
  const startIndex = document.indexOf(headingLine);

  if (startIndex === -1) {
    throw new Error(`Missing Markdown section: ${heading}`);
  }

  const headingLevel = heading.match(/^#+/u)?.[0].length;
  if (headingLevel === undefined) {
    throw new Error(`Invalid Markdown heading: ${heading}`);
  }

  const contentStart = startIndex + headingLine.length;
  const nextHeading = new RegExp(`^#{1,${headingLevel}}\\s`, "mu");
  const relativeEnd = document.slice(contentStart).search(nextHeading);

  return relativeEnd === -1
    ? document.slice(contentStart)
    : document.slice(contentStart, contentStart + relativeEnd);
}

describe("launch packet contract", () => {
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
    expect(requestedReviewScope).toContain(
      'A branch name, tag without resolved commit, range,\nhistorical SHA, or "latest main" is not an acceptable target.',
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

    expect(canonicalEncoding).toContain(
      'CLAIM_DOMAIN = ASCII("unuvault-pairing-claim-v2")',
    );
    expect(canonicalEncoding).toContain("P256_SPKI_DER");
    expect(canonicalEncoding).toContain(
      '`id-ecPublicKey` (`1.2.840.10045.2.1`) with\nthe named-curve parameter `prime256v1` (`1.2.840.10045.3.1.7`)',
    );
    expect(canonicalEncoding).toContain(
      "exactly the 65-byte\nANSI X9.63 uncompressed point `0x04 || X || Y`",
    );
    expect(canonicalEncoding).toContain("canonicalMacBaseURL");
    expect(canonicalEncoding).toContain(
      'Serialize exactly `scheme || ASCII("://") || host || ASCII(":") ||\n   shortestDecimal(port)`',
    );
    expect(canonicalEncoding).toMatch(
      /1\. `LP\(CLAIM_DOMAIN\)`\n2\. `LP\(NFC-UTF8\(inviteSessionId\)\)`\n3\. `LP\(u64be\(expiresAtEpochMilliseconds\)\)`\n4\. `LP\(ASCII\(canonicalMacBaseURL\)\)`\n5\. `LP\(canonicalTargetIdentityDER\)`\n6\. `LP\(NFC-UTF8\(targetDeviceId\)\)`\n7\. `LP\(NFC-UTF8\(targetDisplayName\)\)`\n8\. `LP\(clientNonce\)`/u,
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
      /LP\(HKDF_SALT_DOMAIN\) \|\|\nLP\(pairingSecret\)/u,
    );
    expect(targetBoundHandoff).toMatch(
      /LP\(HKDF_INFO_DOMAIN\) \|\|\nLP\(ALGORITHM_ID\) \|\|\nLP\(PAIRING_VERSION\) \|\|\nLP\(NFC-UTF8\(inviteSessionId\)\) \|\|\nLP\(NFC-UTF8\(claimId\)\) \|\|\nLP\(NFC-UTF8\(handoffId\)\) \|\|\nLP\(u64be\(expiresAtEpochMilliseconds\)\) \|\|\nLP\(canonicalTargetIdentityDER\) \|\|\nLP\(canonicalEphemeralPublicKeyDER\) \|\|\nLP\(clientNonce\)/u,
    );
    expect(targetBoundHandoff).toMatch(
      /LP\(HANDOFF_AAD_DOMAIN\) \|\|\nLP\(ALGORITHM_ID\) \|\|\nLP\(PAIRING_VERSION\) \|\|\nLP\(NFC-UTF8\(inviteSessionId\)\) \|\|\nLP\(NFC-UTF8\(claimId\)\) \|\|\nLP\(NFC-UTF8\(handoffId\)\) \|\|\nLP\(canonicalTargetIdentityDER\) \|\|\nLP\(u64be\(expiresAtEpochMilliseconds\)\) \|\|\nLP\(canonicalEphemeralPublicKeyDER\)/u,
    );
    expect(targetBoundHandoff).toContain(
      "The raw 12 bytes are passed to AES-GCM; the response field is\ntheir strict unpadded base64url spelling.",
    );
    expect(targetBoundHandoff).toContain(
      "strict unpadded\nbase64url of `ciphertext || tag`, with the 16-byte GCM authentication tag last",
    );
    expect(replayRejection).toContain(
      'RETRY_IDENTITY_DOMAIN = ASCII("unuvault-pairing-retry-identity-v2")',
    );
    expect(replayRejection).toMatch(
      /LP\(RETRY_IDENTITY_DOMAIN\) \|\|\nLP\(canonicalClaimTranscript\) \|\|\nLP\(claimAuthenticator\)/u,
    );
    expect(replayRejection).toContain("original authenticated `clientNonce`");
    expect(replayRejection).toContain(
      "canonical claim transcript and authenticator\nare each byte-identical to the reservation",
    );
    expect(replayRejection).toContain(
      "including its AES-GCM nonce, is reused byte-for-byte",
    );
    expect(replayRejection).toContain("terminal `handoff_consumed`");
  });
});
