alter table users_profile
add column if not exists account_id uuid;

update users_profile
set account_id = auth_user_id
where account_id is null;

alter table users_profile
alter column account_id set not null;

create unique index if not exists users_profile_account_id_key
on users_profile (account_id);
