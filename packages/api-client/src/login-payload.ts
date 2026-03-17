import type { VaultLoginPayload } from "./vault";

function parseWebsiteUrl(value: string): URL | null {
  const trimmedValue = value.trim();

  if (!trimmedValue) {
    return null;
  }

  const candidateValue = /^[a-zA-Z][a-zA-Z\d+\-.]*:\/\//.test(trimmedValue)
    ? trimmedValue
    : `https://${trimmedValue}`;

  try {
    return new URL(candidateValue);
  } catch {
    return null;
  }
}

export function normalizeVaultLoginPayload(payload: unknown): VaultLoginPayload {
  const value =
    payload !== null && typeof payload === "object"
      ? (payload as Partial<VaultLoginPayload>)
      : {};

  return {
    schema_version: 1,
    username: typeof value.username === "string" ? value.username : "",
    password_ciphertext:
      typeof value.password_ciphertext === "string" ? value.password_ciphertext : "",
    notes: typeof value.notes === "string" ? value.notes : "",
    website_url: normalizeVaultWebsiteUrl(value.website_url),
  };
}

export function normalizeVaultWebsiteUrl(value: unknown): string {
  if (typeof value !== "string") {
    return "";
  }

  return parseWebsiteUrl(value)?.toString() ?? "";
}

export function parseVaultWebsiteMetadata(websiteUrl: string): {
  websiteUrl: string;
  websiteOrigin: string;
  websiteHostname: string;
} {
  const normalizedWebsiteUrl = normalizeVaultWebsiteUrl(websiteUrl);
  const parsedUrl = parseWebsiteUrl(normalizedWebsiteUrl);

  return {
    websiteUrl: normalizedWebsiteUrl,
    websiteOrigin: parsedUrl?.origin ?? "",
    websiteHostname: parsedUrl?.hostname ?? "",
  };
}
