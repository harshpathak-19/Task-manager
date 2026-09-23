-- Run this in Supabase: Dashboard > SQL Editor > New query

-- 1. Profiles table (mirrors auth.users, holds the fields we can
--    query easily and reference with foreign keys).
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text,
  created_at timestamptz not null default now()
);

-- 2. Auto-create a profile row whenever someone signs up via Supabase
--    Auth (i.e. right after Google OAuth completes).
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, new.raw_user_meta_data->>'full_name');
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- 3. Tasks table
create table if not exists tasks (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text default '',
  status text not null default 'pending' check (status in ('pending', 'completed')),
  created_by uuid not null references profiles(id),
  assigned_to uuid references profiles(id),
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

-- 4. Row Level Security
--    (The Flask backend uses the service-role key and bypasses these,
--    doing its own checks instead — see backend/app.py. RLS here is
--    what protects the tables if the frontend ever talks to Supabase
--    directly, e.g. for realtime subscriptions.)
alter table profiles enable row level security;
alter table tasks enable row level security;

create policy "profiles are viewable by authenticated users"
  on profiles for select
  to authenticated
  using (true);

create policy "users can view their own or assigned tasks"
  on tasks for select
  to authenticated
  using (auth.uid() = created_by or auth.uid() = assigned_to);
