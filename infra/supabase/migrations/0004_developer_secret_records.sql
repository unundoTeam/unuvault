create table if not exists developer_secret_records (
  id uuid primary key default gen_random_uuid(),
  owner_account_id uuid not null,
  app_code text not null,
  target_env text not null,
  secret_kind text not null,
  ciphertext text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_account_id, app_code, target_env, secret_kind)
);

create index if not exists developer_secret_records_owner_account_idx
on developer_secret_records (owner_account_id);
