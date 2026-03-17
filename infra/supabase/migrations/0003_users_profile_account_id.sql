alter table users_profile
add column if not exists account_id uuid;

create unique index if not exists users_profile_account_id_key
on users_profile (account_id);
