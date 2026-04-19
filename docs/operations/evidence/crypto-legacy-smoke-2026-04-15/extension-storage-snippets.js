const LEGACY_VERIFIER_V1 = {
  version: 1,
  salt: "AQIDBAUGBwgJCgsM",
  check: "716ba384",
};

const LEGACY_VAULT_PLAINTEXT_ITEM = {
  id: "legacy-plaintext-1",
  item_type: "login",
  title: "Legacy Plaintext Smoke",
  encrypted_payload: {
    schema_version: 1,
    username: "legacy@example.com",
    password_ciphertext: "hunter2",
    notes: "legacy plaintext smoke",
    website_url: "https://example.com/login",
  },
  favorite: false,
  source: "manual",
  last_used_at: null,
  created_at: "2026-04-15T00:00:00.000Z",
  updated_at: "2026-04-15T00:00:00.000Z",
};

const LEGACY_VAULT_V2_ITEM = {
  ...LEGACY_VAULT_PLAINTEXT_ITEM,
  id: "legacy-v2-1",
  title: "Legacy V2 Envelope Smoke",
  encrypted_payload: {
    ...LEGACY_VAULT_PLAINTEXT_ITEM.encrypted_payload,
    password_ciphertext: JSON.stringify({
      version: 2,
      cipher: "xor-stream-v1",
      encryptedPayload: "NCg0LwUTbA==",
      keyDerivation: "unlock-passphrase-v1",
      unlockSalt: "AQIDBAUGBwgJCgsM",
      unlockTag: "2d384e02",
    }),
    notes: "legacy v2 envelope smoke",
  },
};

async function writeLegacyState(items) {
  await chrome.storage.local.set({
    "unuvault.extension.master-password-verifier": JSON.stringify(
      LEGACY_VERIFIER_V1,
    ),
    "unuvault.extension.popup-vault-items": JSON.stringify(items),
  });
}

globalThis.seedLegacyPlaintextSmoke = async function seedLegacyPlaintextSmoke() {
  await writeLegacyState([LEGACY_VAULT_PLAINTEXT_ITEM]);
  return chrome.storage.local.get([
    "unuvault.extension.master-password-verifier",
    "unuvault.extension.popup-vault-items",
  ]);
};

globalThis.seedLegacyV2EnvelopeSmoke = async function seedLegacyV2EnvelopeSmoke() {
  await writeLegacyState([LEGACY_VAULT_V2_ITEM]);
  return chrome.storage.local.get([
    "unuvault.extension.master-password-verifier",
    "unuvault.extension.popup-vault-items",
  ]);
};

globalThis.readLegacySmokeState = async function readLegacySmokeState() {
  return chrome.storage.local.get([
    "unuvault.extension.master-password-verifier",
    "unuvault.extension.popup-vault-items",
  ]);
};

globalThis.clearLegacySmokeState = async function clearLegacySmokeState() {
  await chrome.storage.local.remove([
    "unuvault.extension.master-password-verifier",
    "unuvault.extension.popup-vault-items",
  ]);
};
