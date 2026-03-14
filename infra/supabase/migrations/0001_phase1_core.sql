create extension if not exists pgcrypto;

create table if not exists users_profile (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid not null unique,
  email text not null unique,
  display_name text,
  locale text not null default 'zh-CN',
  password_hint text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists vault_items (
  id uuid primary key default gen_random_uuid(),
  user_profile_id uuid not null references users_profile(id) on delete cascade,
  item_type text not null,
  title text not null,
  encrypted_payload jsonb not null,
  favorite boolean not null default false,
  source text not null default 'manual',
  last_used_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists device_sessions (
  id uuid primary key default gen_random_uuid(),
  user_profile_id uuid not null references users_profile(id) on delete cascade,
  device_name text not null,
  platform text not null,
  session_state text not null default 'active',
  ip_address inet,
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table if not exists import_jobs (
  id uuid primary key default gen_random_uuid(),
  user_profile_id uuid not null references users_profile(id) on delete cascade,
  source text not null,
  status text not null default 'pending',
  totals jsonb not null default '{}'::jsonb,
  duplicates jsonb not null default '[]'::jsonb,
  malformed_rows jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  finished_at timestamptz
);

create table if not exists activity_events (
  id uuid primary key default gen_random_uuid(),
  user_profile_id uuid not null references users_profile(id) on delete cascade,
  event_type text not null,
  risk_level text not null default 'info',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
