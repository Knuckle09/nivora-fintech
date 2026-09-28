create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  base_currency text not null default 'INR' check (base_currency = 'INR'),
  created_at timestamptz not null default now()
);

create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete cascade,
  name text not null,
  slug text not null,
  kind text not null check (kind in ('income', 'expense')),
  color text not null default 'ledger',
  icon text not null default 'circle',
  created_at timestamptz not null default now()
);

create unique index if not exists categories_global_slug_key
  on public.categories (slug) where user_id is null;
create unique index if not exists categories_owner_slug_key
  on public.categories (user_id, slug) where user_id is not null;

create table if not exists public.accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  account_type text not null check (account_type in ('checking', 'savings', 'investment', 'credit')),
  institution text not null,
  currency text not null default 'INR' check (currency = 'INR'),
  opening_balance_minor bigint not null default 0,
  color text not null default 'ledger',
  last_four text check (last_four is null or last_four ~ '^[0-9]{4}$'),
  sort_order smallint not null default 0,
  seed_key text,
  created_at timestamptz not null default now(),
  unique (id, user_id),
  unique (user_id, seed_key)
);

create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  account_id uuid not null,
  category_id uuid references public.categories (id) on delete set null,
  merchant text not null,
  description text not null default '',
  amount_minor bigint not null check (amount_minor <> 0),
  transaction_type text not null check (transaction_type in ('income', 'expense', 'transfer')),
  occurred_on date not null,
  transfer_group_id uuid,
  seed_key text,
  created_at timestamptz not null default now(),
  unique (user_id, seed_key),
  constraint transactions_account_owner_fkey
    foreign key (account_id, user_id) references public.accounts (id, user_id) on delete cascade,
  constraint transactions_amount_direction_check check (
    (transaction_type = 'income' and amount_minor > 0)
    or (transaction_type = 'expense' and amount_minor < 0)
    or transaction_type = 'transfer'
  )
);

create index if not exists transactions_user_date_idx
  on public.transactions (user_id, occurred_on desc, created_at desc);
create index if not exists transactions_account_date_idx
  on public.transactions (account_id, occurred_on desc);
create index if not exists transactions_category_date_idx
  on public.transactions (user_id, category_id, occurred_on desc)
  where transaction_type = 'expense';

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, nullif(new.raw_user_meta_data ->> 'full_name', ''))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.categories enable row level security;
alter table public.accounts enable row level security;
alter table public.transactions enable row level security;

create policy "profiles_read_own" on public.profiles
  for select to authenticated using (id = (select auth.uid()));
create policy "profiles_insert_own" on public.profiles
  for insert to authenticated with check (id = (select auth.uid()));
create policy "profiles_update_own" on public.profiles
  for update to authenticated using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

create policy "categories_read_available" on public.categories
  for select to authenticated using (user_id is null or user_id = (select auth.uid()));
create policy "categories_manage_own" on public.categories
  for all to authenticated using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "accounts_manage_own" on public.accounts
  for all to authenticated using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "transactions_read_own" on public.transactions
  for select to authenticated using (user_id = (select auth.uid()));
create policy "transactions_insert_own" on public.transactions
  for insert to authenticated with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.accounts a
      where a.id = account_id and a.user_id = (select auth.uid())
    )
    and (
      category_id is null or exists (
        select 1 from public.categories c
        where c.id = category_id
          and (c.user_id is null or c.user_id = (select auth.uid()))
      )
    )
  );
create policy "transactions_update_own" on public.transactions
  for update to authenticated using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.accounts a
      where a.id = account_id and a.user_id = (select auth.uid())
    )
    and (
      category_id is null or exists (
        select 1 from public.categories c
        where c.id = category_id
          and (c.user_id is null or c.user_id = (select auth.uid()))
      )
    )
  );
create policy "transactions_delete_own" on public.transactions
  for delete to authenticated using (user_id = (select auth.uid()));

create or replace view public.account_balances
with (security_invoker = true)
as
  select
    a.id,
    a.user_id,
    a.name,
    a.account_type,
    a.institution,
    a.currency,
    a.color,
    a.last_four,
    a.sort_order,
    a.opening_balance_minor,
    a.opening_balance_minor + coalesce(sum(t.amount_minor), 0) as balance_minor
  from public.accounts a
  left join public.transactions t
    on t.account_id = a.id and t.user_id = a.user_id
  group by a.id;

grant select on public.account_balances to authenticated;

grant usage on schema public to authenticated, service_role;
grant select, insert, update on public.profiles to authenticated;
grant select, insert, update, delete on public.categories to authenticated;
grant select, insert, update, delete on public.accounts to authenticated;
grant select, insert, update, delete on public.transactions to authenticated;
grant all privileges on public.profiles, public.categories, public.accounts, public.transactions to service_role;
grant select on public.account_balances to service_role;

create or replace function public.transaction_totals(p_start date, p_end_exclusive date)
returns table (income_minor numeric, spend_minor numeric)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    coalesce(sum(t.amount_minor) filter (where t.transaction_type = 'income'), 0),
    coalesce(sum(-t.amount_minor) filter (where t.transaction_type = 'expense'), 0)
  from public.transactions t
  where t.user_id = (select auth.uid())
    and t.occurred_on >= p_start
    and t.occurred_on < p_end_exclusive;
$$;

revoke all on function public.transaction_totals(date, date) from public, anon;
grant execute on function public.transaction_totals(date, date) to authenticated;

insert into public.categories (name, slug, kind, color, icon) values
  ('Salary', 'salary', 'income', 'ledger', 'briefcase'),
  ('Interest', 'interest', 'income', 'graphite', 'landmark'),
  ('Investments', 'investments', 'income', 'gold', 'chart'),
  ('Food & dining', 'food', 'expense', 'gold', 'utensils'),
  ('Transport', 'transport', 'expense', 'graphite', 'train'),
  ('Housing', 'housing', 'expense', 'ledger', 'house'),
  ('Shopping', 'shopping', 'expense', 'gold', 'bag'),
  ('Health', 'health', 'expense', 'ledger', 'heart'),
  ('Utilities', 'utilities', 'expense', 'graphite', 'bolt'),
  ('Entertainment', 'entertainment', 'expense', 'gold', 'ticket'),
  ('Travel', 'travel', 'expense', 'graphite', 'plane'),
  ('Education', 'education', 'expense', 'ledger', 'book'),
  ('Personal care', 'personal-care', 'expense', 'gold', 'sparkles'),
  ('Other', 'other', 'expense', 'graphite', 'circle')
on conflict (slug) where user_id is null do nothing;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
    and not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'transactions'
    ) then
    alter publication supabase_realtime add table public.transactions;
  end if;
end;
$$;
