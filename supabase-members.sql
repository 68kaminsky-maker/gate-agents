-- פעולות המסד של ניהול הצוות בשער. כבר הורצו ב-Supabase (פרויקט gate-agents) ב-2026-11-21.
-- הקובץ הזה מחליף גרסה ישנה שהייתה כאן ולא נבדקה: היא צירפה אוטומטית כל מי שנכנס במייל.
-- בטוח להריץ שוב (create or replace). דורש שהטבלאות מ-setup.sql קיימות.

-- עדכון: כניסה של מוזמנים בלבד, רשימת המחוברים, והסרה של משתמש.
-- מריצים פעם אחת בפרויקט Supabase: SQL Editor > מדביקים > Run.
-- בטוח להריץ גם פעמיים. אותו קטע נמצא גם בסוף setup.sql.

-- עמודות חדשות בטבלת הצוות: מי המשתמש, ומתי נכנס לאחרונה
alter table public.members add column if not exists user_id uuid;
alter table public.members add column if not exists seen_at timestamptz;

-- מיילים שהוסרו מהמערכת. הם לא יוכלו להצטרף שוב עד שמוחקים אותם מכאן:
--   delete from public.blocked_emails where email = 'האימייל@כאן.com';
create table if not exists public.blocked_emails (
  email text primary key,
  created_at timestamptz not null default now()
);
alter table public.blocked_emails enable row level security;

-- נקראת בכל כניסה. מי שכבר בצוות: מתעדכן שנכנס. מוזמן חדש: מצטרף. מי שלא הוזמן: נעצר בהודעה ברורה.
-- אם עוד אין עסק בכלל, מחזירה false והאפליקציה יוצרת אותו (הנכנס הראשון הוא בעל העסק).
create or replace function public.join_workspace_on_login()
returns boolean language plpgsql security definer set search_path = public as $$
declare
  jwt_email text := auth.jwt() ->> 'email';
  ws uuid;
  was_invited boolean;
begin
  if jwt_email is null or auth.uid() is null then raise exception 'not signed in'; end if;

  update public.members set user_id = auth.uid(), seen_at = now() where lower(email) = lower(jwt_email);
  if found then return true; end if;

  select id into ws from public.workspaces order by created_at limit 1;
  if ws is null then return false; end if;

  if exists (select 1 from public.blocked_emails where email = lower(jwt_email)) then
    raise exception 'הגישה של המייל הזה הוסרה. פנו לבעל העסק.';
  end if;

  select (u.invited_at is not null) into was_invited from auth.users u where u.id = auth.uid();
  if not coalesce(was_invited, false) then
    raise exception 'המייל הזה לא הוזמן למערכת. בקשו מבעל העסק הזמנה.';
  end if;

  insert into public.members (workspace_id, email, role, user_id, seen_at)
  values (ws, jwt_email, 'member', auth.uid(), now())
  on conflict (workspace_id, email) do update set user_id = excluded.user_id, seen_at = excluded.seen_at;
  return true;
end;
$$;

-- רשימת המחוברים. רק לבעל העסק.
create or replace function public.list_members(p_workspace uuid)
returns table (uid uuid, email_addr text, member_role text, seen_at timestamptz)
language plpgsql security definer set search_path = public as $$
begin
  if public.my_role(p_workspace) is distinct from 'owner' then
    raise exception 'רק בעל העסק רואה את הרשימה.';
  end if;
  return query
    select m.user_id, m.email, m.role, m.seen_at
    from public.members m
    where m.workspace_id = p_workspace
    order by (m.role = 'owner') desc, m.created_at;
end;
$$;

-- הסרת משתמש. רק בעל העסק, ואי אפשר להסיר את בעל העסק.
create or replace function public.remove_member(p_workspace uuid, p_user uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  target_email text;
  target_role text;
begin
  if public.my_role(p_workspace) is distinct from 'owner' then
    raise exception 'רק בעל העסק יכול להסיר משתמשים.';
  end if;
  select m.email, m.role into target_email, target_role
    from public.members m where m.workspace_id = p_workspace and m.user_id = p_user;
  if target_email is null then raise exception 'המשתמש לא נמצא.'; end if;
  if target_role = 'owner' then raise exception 'אי אפשר להסיר את בעל העסק.'; end if;
  delete from public.members where workspace_id = p_workspace and user_id = p_user;
  insert into public.blocked_emails (email) values (lower(target_email)) on conflict do nothing;
end;
$$;

-- רק מי שמחובר יכול לקרוא לפעולות האלה
revoke all on function public.join_workspace_on_login() from public, anon;
revoke all on function public.list_members(uuid) from public, anon;
revoke all on function public.remove_member(uuid, uuid) from public, anon;
grant execute on function public.join_workspace_on_login() to authenticated;
grant execute on function public.list_members(uuid) to authenticated;
grant execute on function public.remove_member(uuid, uuid) to authenticated;

-- מרענן את הרשימה שמסד הנתונים מחזיק, כדי שיכיר את הפעולות החדשות מיד
notify pgrst, 'reload schema';

-- עדכון: הזמנת משתמש מתוך האפליקציה.
-- מריצים פעם אחת בפרויקט Supabase: SQL Editor > מדביקים > Run.
-- בטוח להריץ גם פעמיים. אותו קטע נמצא גם בסוף setup.sql.

-- מזהה קבוע לכל שורת צוות, גם למוזמן שעוד לא נכנס (בשביל כפתור "הסרה")
alter table public.members add column if not exists member_key uuid not null default gen_random_uuid();

-- הזמנה: בעל העסק מוסיף מייל לצוות. כשהאדם נכנס במייל הזה הוא מצטרף לבד.
-- אם המייל הוסר בעבר, ההסרה מתבטלת.
create or replace function public.invite_member(p_workspace uuid, p_email text)
returns void language plpgsql security definer set search_path = public as $$
declare
  clean text := lower(btrim(p_email));
begin
  if public.my_role(p_workspace) is distinct from 'owner' then
    raise exception 'רק בעל העסק יכול להזמין.';
  end if;
  if clean is null or clean !~ '^\S+@\S+\.\S+$' then
    raise exception 'כתובת המייל לא תקינה.';
  end if;
  insert into public.members (workspace_id, email, role)
  values (p_workspace, clean, 'member')
  on conflict (workspace_id, email) do nothing;
  delete from public.blocked_emails where email = clean;
end;
$$;

-- הרשימה כוללת עכשיו גם מוזמנים שעוד לא נכנסו (seen_at ריק)
create or replace function public.list_members(p_workspace uuid)
returns table (uid uuid, email_addr text, member_role text, seen_at timestamptz)
language plpgsql security definer set search_path = public as $$
begin
  if public.my_role(p_workspace) is distinct from 'owner' then
    raise exception 'רק בעל העסק רואה את הרשימה.';
  end if;
  return query
    select m.member_key, m.email, m.role, m.seen_at
    from public.members m
    where m.workspace_id = p_workspace
    order by (m.role = 'owner') desc, m.created_at;
end;
$$;

-- הסרה לפי המזהה הקבוע (עובד גם למוזמן שעוד לא נכנס)
create or replace function public.remove_member(p_workspace uuid, p_user uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  target_email text;
  target_role text;
begin
  if public.my_role(p_workspace) is distinct from 'owner' then
    raise exception 'רק בעל העסק יכול להסיר משתמשים.';
  end if;
  select m.email, m.role into target_email, target_role
    from public.members m
    where m.workspace_id = p_workspace and (m.member_key = p_user or m.user_id = p_user)
    limit 1;
  if target_email is null then raise exception 'המשתמש לא נמצא.'; end if;
  if target_role = 'owner' then raise exception 'אי אפשר להסיר את בעל העסק.'; end if;
  delete from public.members
    where workspace_id = p_workspace and (member_key = p_user or user_id = p_user);
  insert into public.blocked_emails (email) values (lower(target_email)) on conflict do nothing;
end;
$$;

revoke all on function public.invite_member(uuid, text) from public, anon;
grant execute on function public.invite_member(uuid, text) to authenticated;

notify pgrst, 'reload schema';
