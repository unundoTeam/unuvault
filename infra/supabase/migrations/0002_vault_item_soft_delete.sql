alter table vault_items
add column if not exists deleted_at timestamptz;
