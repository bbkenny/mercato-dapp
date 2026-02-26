-- Notifications table for key deal lifecycle events
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null check (type in (
    'deal_created',
    'deal_funded',
    'milestone_1_approved',
    'milestone_2_approved',
    'pyme_investor_deal_created',
    'pyme_investor_deal_complete'
  )),
  title text not null,
  body text,
  link_url text,
  link_label text,
  metadata jsonb default '{}',
  read_at timestamp with time zone,
  created_at timestamp with time zone default now()
);

create index idx_notifications_user_id on public.notifications(user_id);
create index idx_notifications_created_at on public.notifications(created_at desc);
create index idx_notifications_user_unread on public.notifications(user_id, read_at) where read_at is null;

alter table public.notifications enable row level security;

create policy "notifications_select_own" on public.notifications
  for select using (auth.uid() = user_id);

create policy "notifications_update_own" on public.notifications
  for update using (auth.uid() = user_id);

-- Service role or triggers insert; no direct client insert policy needed for MVP (we use triggers)
-- If app code will insert: create policy "notifications_insert_service" for insert with check (true); -- restrict as needed

-- Trigger: Deal created -> notify all investors
create or replace function notify_deal_created()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if NEW.status = 'seeking_funding' then
    insert into public.notifications (user_id, type, title, body, link_url, link_label, metadata)
    select
      p.id,
      'deal_created',
      'New deal available',
      'A new deal has been created: ' || coalesce(NEW.product_name, NEW.title) || '. Check the marketplace to fund it.',
      '/deals/' || NEW.id,
      'View deal',
      jsonb_build_object('deal_id', NEW.id, 'product_name', NEW.product_name)
    from public.profiles p
    where p.user_type = 'investor';
  end if;
  return NEW;
end;
$$;

create trigger deals_notify_created
  after insert on public.deals
  for each row
  execute function notify_deal_created();

-- Trigger: Deal funded -> notify supplier (owner of supplier company) and PyME
create or replace function notify_deal_funded()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  supplier_owner_id uuid;
begin
  if OLD.status != 'funded' and NEW.status = 'funded' then
    -- Notify PyME
    insert into public.notifications (user_id, type, title, body, link_url, link_label, metadata)
    values (
      NEW.pyme_id,
      'deal_funded',
      'Deal funded',
      'Your deal "' || coalesce(NEW.product_name, NEW.title) || '" has been funded. Ask the supplier to accept the initial milestone.',
      '/deals/' || NEW.id,
      'View deal',
      jsonb_build_object('deal_id', NEW.id, 'product_name', NEW.product_name)
    );

    -- Notify supplier (owner of supplier company)
    if NEW.supplier_id is not null then
      select owner_id into supplier_owner_id
      from public.supplier_companies
      where id = NEW.supplier_id;

      if supplier_owner_id is not null then
        insert into public.notifications (user_id, type, title, body, link_url, link_label, metadata)
        values (
          supplier_owner_id,
          'deal_funded',
          'Deal funded – accept initial milestone',
          'A deal "' || coalesce(NEW.product_name, NEW.title) || '" has been funded. Accept the initial milestone to unlock the first 50%.',
          '/deals/' || NEW.id,
          'Accept deal',
          jsonb_build_object('deal_id', NEW.id, 'product_name', NEW.product_name)
        );
      end if;
    end if;
  end if;
  return NEW;
end;
$$;

create trigger deals_notify_funded
  after update on public.deals
  for each row
  when (OLD.status is distinct from NEW.status)
  execute function notify_deal_funded();

-- Trigger: Milestone completed -> notify investor, PyME, supplier
create or replace function notify_milestone_approved()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  d record;
  supplier_owner_id uuid;
  completed_count int;
  notif_type text;
  notif_title text;
  notif_body text;
begin
  if NEW.status != 'completed' then
    return NEW;
  end if;

  select * into d from public.deals where id = NEW.deal_id;
  if d is null then return NEW; end if;

  -- Count completed milestones (including this one)
  select count(*) into completed_count
  from public.milestones
  where deal_id = NEW.deal_id and status = 'completed';

  if completed_count = 1 then
    notif_type := 'milestone_1_approved';
    notif_title := 'First milestone released';
    notif_body := 'The first milestone for deal "' || coalesce(d.product_name, d.title) || '" has been released to the supplier.';
  else
    notif_type := 'milestone_2_approved';
    notif_title := 'Second milestone released';
    notif_body := 'The second milestone for deal "' || coalesce(d.product_name, d.title) || '" has been released. Deal delivery complete.';
  end if;

  -- Notify investor
  if d.investor_id is not null then
    insert into public.notifications (user_id, type, title, body, link_url, link_label, metadata)
    values (
      d.investor_id,
      notif_type,
      notif_title,
      notif_body,
      '/deals/' || d.id,
      'View deal',
      jsonb_build_object('deal_id', d.id, 'milestone_id', NEW.id)
    );
  end if;

  -- Notify PyME
  insert into public.notifications (user_id, type, title, body, link_url, link_label, metadata)
  values (
    d.pyme_id,
    notif_type,
    notif_title,
    notif_body,
    '/deals/' || d.id,
    'View deal',
    jsonb_build_object('deal_id', d.id, 'milestone_id', NEW.id)
  );

  -- Notify supplier
  if d.supplier_id is not null then
    select owner_id into supplier_owner_id
    from public.supplier_companies
    where id = d.supplier_id;

    if supplier_owner_id is not null then
      insert into public.notifications (user_id, type, title, body, link_url, link_label, metadata)
      values (
        supplier_owner_id,
        notif_type,
        notif_title,
        notif_body,
        '/deals/' || d.id,
        'View deal',
        jsonb_build_object('deal_id', d.id, 'milestone_id', NEW.id)
      );
    end if;
  end if;

  return NEW;
end;
$$;

create trigger milestones_notify_approved
  after update on public.milestones
  for each row
  when (OLD.status is distinct from NEW.status and NEW.status = 'completed')
  execute function notify_milestone_approved();

-- PyME x Investor deal created / complete: no table yet; use app-level inserts when feature exists
-- Placeholder types already in check constraint above

-- Enable Realtime for live notification updates (optional; run if using Supabase Realtime)
-- alter publication supabase_realtime add table notifications;
