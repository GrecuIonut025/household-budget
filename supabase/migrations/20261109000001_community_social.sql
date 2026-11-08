-- Global community social layer: published recipe feed, threaded comments,
-- reactions, grades, and in-app notifications (trigger-backed).

create type public.community_reaction_kind as enum ('like', 'useful', 'love');
create type public.notification_kind as enum (
  'reaction_post',
  'reaction_comment',
  'reaction_love',
  'comment_reply',
  'grade_up',
  'first_publish'
);

-- ---------------------------------------------------------------------------
-- Profiles: grade cache (global reactions received)
-- ---------------------------------------------------------------------------
alter table public.profiles
  add column if not exists community_grade smallint not null default 1
    check (community_grade between 1 and 10),
  add column if not exists community_reactions_received integer not null default 0
    check (community_reactions_received >= 0);

-- ---------------------------------------------------------------------------
-- Recipes: opt-in publish to the global community feed
-- ---------------------------------------------------------------------------
alter table public.recipes
  add column if not exists community_published_at timestamptz;

create index if not exists recipes_community_feed_idx
  on public.recipes (community_published_at desc, id desc)
  where community_published_at is not null;

-- Household members keep full access; every authenticated user can read published posts.
create policy recipes_select_community on public.recipes for select to authenticated
  using (community_published_at is not null);

-- ---------------------------------------------------------------------------
-- Comments (global; only on published recipes)
-- ---------------------------------------------------------------------------
create table public.community_comments (
  id uuid primary key default gen_random_uuid(),
  recipe_id uuid not null references public.recipes (id) on delete cascade,
  parent_id uuid references public.community_comments (id) on delete cascade,
  author_id uuid not null references public.profiles (id) on delete cascade default auth.uid(),
  body text not null check (char_length(btrim(body)) between 1 and 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index community_comments_recipe_idx
  on public.community_comments (recipe_id, created_at, id);
create index community_comments_parent_idx
  on public.community_comments (parent_id, created_at)
  where parent_id is not null;
create index community_comments_author_idx
  on public.community_comments (author_id);
create trigger community_comments_set_updated_at before update on public.community_comments
  for each row execute function public.set_updated_at();

create or replace function public.guard_community_comment_target()
returns trigger
language plpgsql
as $$
declare
  published timestamptz;
  parent_recipe uuid;
begin
  select r.community_published_at into published
  from public.recipes r where r.id = new.recipe_id;
  if published is null then
    raise exception 'comments only allowed on published community recipes'
      using errcode = 'check_violation';
  end if;
  if new.parent_id is not null then
    select c.recipe_id into parent_recipe
    from public.community_comments c where c.id = new.parent_id;
    if parent_recipe is null then
      raise exception 'parent comment not found' using errcode = 'foreign_key_violation';
    end if;
    if parent_recipe is distinct from new.recipe_id then
      raise exception 'parent comment must belong to the same recipe'
        using errcode = 'check_violation';
    end if;
  end if;
  return new;
end;
$$;
create trigger community_comments_guard_target
  before insert or update of recipe_id, parent_id on public.community_comments
  for each row execute function public.guard_community_comment_target();

create or replace function public.guard_community_comment_identity()
returns trigger
language plpgsql
as $$
begin
  if new.author_id is distinct from old.author_id or new.recipe_id is distinct from old.recipe_id then
    raise exception 'author_id and recipe_id of a comment are immutable'
      using errcode = 'insufficient_privilege';
  end if;
  return new;
end;
$$;
create trigger community_comments_guard_identity before update on public.community_comments
  for each row execute function public.guard_community_comment_identity();

-- Authors of published posts / commenters are visible for attribution.
create policy profiles_select_community on public.profiles for select to authenticated
  using (
    exists (
      select 1 from public.recipes r
      where r.created_by = profiles.id and r.community_published_at is not null
    )
    or exists (
      select 1 from public.community_comments c where c.author_id = profiles.id
    )
  );

-- ---------------------------------------------------------------------------
-- Reactions (post or comment)
-- ---------------------------------------------------------------------------
create table public.community_reactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade default auth.uid(),
  kind public.community_reaction_kind not null,
  recipe_id uuid references public.recipes (id) on delete cascade,
  comment_id uuid references public.community_comments (id) on delete cascade,
  created_at timestamptz not null default now(),
  check (
    (recipe_id is not null and comment_id is null)
    or (recipe_id is null and comment_id is not null)
  )
);
create unique index community_reactions_recipe_uniq
  on public.community_reactions (user_id, kind, recipe_id)
  where recipe_id is not null;
create unique index community_reactions_comment_uniq
  on public.community_reactions (user_id, kind, comment_id)
  where comment_id is not null;
create index community_reactions_recipe_idx
  on public.community_reactions (recipe_id) where recipe_id is not null;
create index community_reactions_comment_idx
  on public.community_reactions (comment_id) where comment_id is not null;
create index community_reactions_user_idx on public.community_reactions (user_id);

create or replace function public.guard_community_reaction_target()
returns trigger
language plpgsql
as $$
declare
  published timestamptz;
begin
  if new.recipe_id is not null then
    select r.community_published_at into published from public.recipes r where r.id = new.recipe_id;
    if published is null then
      raise exception 'reactions only allowed on published community recipes'
        using errcode = 'check_violation';
    end if;
  end if;
  return new;
end;
$$;
create trigger community_reactions_guard_target
  before insert on public.community_reactions
  for each row execute function public.guard_community_reaction_target();

-- ---------------------------------------------------------------------------
-- Notifications (recipient-scoped)
-- ---------------------------------------------------------------------------
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  kind public.notification_kind not null,
  actor_id uuid references public.profiles (id) on delete set null,
  recipe_id uuid references public.recipes (id) on delete set null,
  comment_id uuid references public.community_comments (id) on delete set null,
  payload jsonb not null default '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index notifications_user_created_idx
  on public.notifications (user_id, created_at desc, id desc);
create index notifications_user_unread_idx
  on public.notifications (user_id, created_at desc)
  where read_at is null;

-- ---------------------------------------------------------------------------
-- Grade helper (mirrors src/lib/community/grades.ts)
-- ---------------------------------------------------------------------------
create or replace function public.community_grade_from_count(n integer)
returns smallint
language sql
immutable
as $$
  select case
    when n is null or n < 10 then 1
    when n < 25 then 2
    when n < 50 then 3
    when n < 100 then 4
    when n < 175 then 5
    when n < 275 then 6
    when n < 400 then 7
    when n < 550 then 8
    when n < 750 then 9
    else 10
  end::smallint
$$;

create or replace function public.refresh_community_grade(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  received integer;
  old_grade smallint;
  new_grade smallint;
begin
  if p_user_id is null then return; end if;

  select
    (select count(*)::int from public.community_reactions cr
      join public.recipes r on r.id = cr.recipe_id
      where r.created_by = p_user_id)
    +
    (select count(*)::int from public.community_reactions cr
      join public.community_comments c on c.id = cr.comment_id
      where c.author_id = p_user_id)
  into received;

  received := coalesce(received, 0);
  new_grade := public.community_grade_from_count(received);

  select community_grade into old_grade from public.profiles where id = p_user_id;
  update public.profiles
    set community_reactions_received = received,
        community_grade = new_grade
    where id = p_user_id;

  if new_grade > coalesce(old_grade, 1) then
    insert into public.notifications (user_id, kind, payload)
    values (
      p_user_id,
      'grade_up',
      jsonb_build_object('grade', new_grade, 'from', coalesce(old_grade, 1), 'reactions', received)
    );
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- Notification helpers (batched: coalesce unread same kind/actor/target)
-- ---------------------------------------------------------------------------
create or replace function public.notify_community(
  p_user_id uuid,
  p_kind public.notification_kind,
  p_actor_id uuid,
  p_recipe_id uuid,
  p_comment_id uuid,
  p_payload jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  existing uuid;
begin
  if p_user_id is null or p_user_id = p_actor_id then
    return;
  end if;

  -- Coalesce recent unread duplicate (same kind + actor + targets) instead of flooding.
  select n.id into existing
  from public.notifications n
  where n.user_id = p_user_id
    and n.kind = p_kind
    and n.actor_id is not distinct from p_actor_id
    and n.recipe_id is not distinct from p_recipe_id
    and n.comment_id is not distinct from p_comment_id
    and n.read_at is null
    and n.created_at > now() - interval '24 hours'
  order by n.created_at desc
  limit 1;

  if existing is not null then
    update public.notifications
      set payload = coalesce(p_payload, '{}'::jsonb),
          created_at = now()
      where id = existing;
  else
    insert into public.notifications (user_id, kind, actor_id, recipe_id, comment_id, payload)
    values (p_user_id, p_kind, p_actor_id, p_recipe_id, p_comment_id, coalesce(p_payload, '{}'::jsonb));
  end if;
end;
$$;

create or replace function public.on_community_reaction()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  recipient uuid;
  recipe uuid;
  nkind public.notification_kind;
begin
  if tg_op = 'INSERT' then
    if new.recipe_id is not null then
      select r.created_by into recipient from public.recipes r where r.id = new.recipe_id;
      nkind := case when new.kind = 'love' then 'reaction_love'::public.notification_kind
                    else 'reaction_post'::public.notification_kind end;
      perform public.notify_community(
        recipient, nkind, new.user_id, new.recipe_id, null,
        jsonb_build_object('kind', new.kind::text)
      );
      perform public.refresh_community_grade(recipient);
    elsif new.comment_id is not null then
      select c.author_id, c.recipe_id into recipient, recipe
      from public.community_comments c where c.id = new.comment_id;
      nkind := case when new.kind = 'love' then 'reaction_love'::public.notification_kind
                    else 'reaction_comment'::public.notification_kind end;
      perform public.notify_community(
        recipient, nkind, new.user_id, recipe, new.comment_id,
        jsonb_build_object('kind', new.kind::text)
      );
      perform public.refresh_community_grade(recipient);
    end if;
  elsif tg_op = 'DELETE' then
    if old.recipe_id is not null then
      select r.created_by into recipient from public.recipes r where r.id = old.recipe_id;
      perform public.refresh_community_grade(recipient);
    elsif old.comment_id is not null then
      select c.author_id into recipient from public.community_comments c where c.id = old.comment_id;
      perform public.refresh_community_grade(recipient);
    end if;
  end if;
  return null;
end;
$$;
create trigger community_reactions_notify
  after insert or delete on public.community_reactions
  for each row execute function public.on_community_reaction();

create or replace function public.on_community_comment()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  parent_author uuid;
  parent_recipe uuid;
begin
  if new.parent_id is null then
    return new;
  end if;
  select c.author_id, c.recipe_id into parent_author, parent_recipe
  from public.community_comments c where c.id = new.parent_id;
  perform public.notify_community(
    parent_author, 'comment_reply', new.author_id, parent_recipe, new.id,
    jsonb_build_object('preview', left(new.body, 120))
  );
  return new;
end;
$$;
create trigger community_comments_notify
  after insert on public.community_comments
  for each row execute function public.on_community_comment();

create or replace function public.on_recipe_community_publish()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  prior_count integer;
begin
  if new.community_published_at is not null
     and (old.community_published_at is null) then
    select count(*)::int into prior_count
    from public.recipes r
    where r.created_by = new.created_by
      and r.community_published_at is not null
      and r.id <> new.id;
    if coalesce(prior_count, 0) = 0 and new.created_by is not null then
      insert into public.notifications (user_id, kind, recipe_id, payload)
      values (
        new.created_by,
        'first_publish',
        new.id,
        jsonb_build_object('title', new.title)
      );
      perform public.refresh_community_grade(new.created_by);
    end if;
  end if;
  return new;
end;
$$;
create trigger recipes_community_publish_notify
  after update of community_published_at on public.recipes
  for each row execute function public.on_recipe_community_publish();

-- ---------------------------------------------------------------------------
-- Keyset feed RPC (avoids giant one-shot fetches; bundles author fields)
-- ---------------------------------------------------------------------------
create or replace function public.community_feed_page(
  p_limit integer default 12,
  p_cursor_published_at timestamptz default null,
  p_cursor_id uuid default null
)
returns table (
  id uuid,
  household_id uuid,
  title text,
  description text,
  servings numeric,
  prep_minutes integer,
  cook_minutes integer,
  category text,
  tags text[],
  image_path text,
  is_favorite boolean,
  community_published_at timestamptz,
  created_by uuid,
  author_display_name text,
  author_avatar_path text,
  author_grade smallint,
  author_reactions_received integer,
  reaction_like integer,
  reaction_useful integer,
  reaction_love integer,
  comment_count integer
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  lim integer := greatest(1, least(coalesce(p_limit, 12), 30));
begin
  if auth.uid() is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;

  return query
  with page as (
    select r.*
    from public.recipes r
    where r.community_published_at is not null
      and (
        p_cursor_published_at is null
        or (r.community_published_at, r.id) < (p_cursor_published_at, p_cursor_id)
      )
    order by r.community_published_at desc, r.id desc
    limit lim
  )
  select
    p.id,
    p.household_id,
    p.title,
    p.description,
    p.servings,
    p.prep_minutes,
    p.cook_minutes,
    p.category,
    p.tags,
    p.image_path,
    p.is_favorite,
    p.community_published_at,
    p.created_by,
    coalesce(pr.display_name, ''),
    pr.avatar_path,
    coalesce(pr.community_grade, 1::smallint),
    coalesce(pr.community_reactions_received, 0),
    coalesce((select count(*)::int from public.community_reactions x where x.recipe_id = p.id and x.kind = 'like'), 0),
    coalesce((select count(*)::int from public.community_reactions x where x.recipe_id = p.id and x.kind = 'useful'), 0),
    coalesce((select count(*)::int from public.community_reactions x where x.recipe_id = p.id and x.kind = 'love'), 0),
    coalesce((select count(*)::int from public.community_comments c where c.recipe_id = p.id), 0)
  from page p
  left join public.profiles pr on pr.id = p.created_by
  order by p.community_published_at desc, p.id desc;
end;
$$;

revoke all on function public.community_feed_page(integer, timestamptz, uuid) from public, anon;
grant execute on function public.community_feed_page(integer, timestamptz, uuid) to authenticated, service_role;
revoke all on function public.community_grade_from_count(integer) from public, anon;
grant execute on function public.community_grade_from_count(integer) to authenticated, service_role;
revoke all on function public.refresh_community_grade(uuid) from public, anon;
grant execute on function public.refresh_community_grade(uuid) to service_role;
revoke all on function public.notify_community(uuid, public.notification_kind, uuid, uuid, uuid, jsonb) from public, anon;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.community_comments enable row level security;
alter table public.community_reactions enable row level security;
alter table public.notifications enable row level security;

create policy community_comments_select on public.community_comments for select to authenticated
  using (
    exists (
      select 1 from public.recipes r
      where r.id = community_comments.recipe_id and r.community_published_at is not null
    )
  );
create policy community_comments_insert on public.community_comments for insert to authenticated
  with check (author_id = auth.uid());
create policy community_comments_update on public.community_comments for update to authenticated
  using (author_id = auth.uid())
  with check (author_id = auth.uid());
create policy community_comments_delete on public.community_comments for delete to authenticated
  using (author_id = auth.uid());

create policy community_reactions_select on public.community_reactions for select to authenticated
  using (true);
create policy community_reactions_insert on public.community_reactions for insert to authenticated
  with check (user_id = auth.uid());
create policy community_reactions_delete on public.community_reactions for delete to authenticated
  using (user_id = auth.uid());

create policy notifications_select on public.notifications for select to authenticated
  using (user_id = auth.uid());
create policy notifications_update on public.notifications for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
-- Inserts only via security definer triggers; no client insert.
-- Deletes allowed for own rows (clear).
create policy notifications_delete on public.notifications for delete to authenticated
  using (user_id = auth.uid());

revoke all on table public.community_comments from anon;
revoke all on table public.community_reactions from anon;
revoke all on table public.notifications from anon;
grant select, insert, update, delete on table public.community_comments to authenticated;
grant select, insert, delete on table public.community_reactions to authenticated;
revoke update on table public.community_reactions from authenticated;
grant select, update, delete on table public.notifications to authenticated;
