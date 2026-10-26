-- Shared trips. The code is the key. No accounts.
create table if not exists shared_trips (
  code text primary key,
  trip jsonb not null,
  version integer not null default 1,
  updated_at timestamptz not null default now()
);
