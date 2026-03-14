export const phase1Tables = [
  "users_profile",
  "vault_items",
  "device_sessions",
  "import_jobs",
  "activity_events",
] as const;

export type Phase1Table = (typeof phase1Tables)[number];
