-- ניהול חברים במרחב העבודה. להריץ פעם אחת ב-Supabase: SQL Editor.
-- הנחות שלא נבדקו מול setup.sql (הוא לא בריפו): לטבלת members יש workspace_id, user_id, role,
-- תפקיד הבעלים נקרא 'owner', ולטבלת auth.users יש email ו-last_sign_in_at (ברירת מחדל של סופאבייס).
-- אזהרה: כל מי שיכול להירשם במייל יקבל גישה למערכת. כדי לשלוט בכך, לכבות הרשמה חדשה
-- ב-Authentication > Providers > Email (Allow new users to sign up), ולהשאיר רק את הכניסה למשתמשים קיימים.

-- משתמש מחובר שאין לו מרחב מצטרף אוטומטית למרחב של הבעלים. מחזיר null אם עוד אין בעלים בכלל.
create or replace function public.join_workspace_on_login()
returns uuid
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_uid uuid := auth.uid();
  v_ws uuid;
begin
  if v_uid is null then
    raise exception 'לא מחובר';
  end if;

  select m.workspace_id into v_ws from members m where m.user_id = v_uid limit 1;
  if v_ws is not null then
    return v_ws;
  end if;

  select m.workspace_id into v_ws from members m where m.role = 'owner' limit 1;
  if v_ws is null then
    return null;
  end if;

  insert into members (workspace_id, user_id, role) values (v_ws, v_uid, 'editor');
  return v_ws;
end;
$$;

-- רשימת המחוברים למרחב, לבעל העסק בלבד.
create or replace function public.list_members(p_workspace uuid)
returns table (uid uuid, email_addr text, member_role text, seen_at timestamptz)
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if not exists (
    select 1 from members m
    where m.workspace_id = p_workspace and m.user_id = auth.uid() and m.role = 'owner'
  ) then
    raise exception 'רק בעל העסק יכול לראות את המשתמשים';
  end if;

  return query
    select m.user_id, u.email::text, m.role::text, u.last_sign_in_at
    from members m
    join auth.users u on u.id = m.user_id
    where m.workspace_id = p_workspace
    order by m.role, u.email;
end;
$$;

-- הסרת משתמש מהמרחב, לבעל העסק בלבד. לא מסירים בעלים ולא את עצמך.
create or replace function public.remove_member(p_workspace uuid, p_user uuid)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if not exists (
    select 1 from members m
    where m.workspace_id = p_workspace and m.user_id = auth.uid() and m.role = 'owner'
  ) then
    raise exception 'רק בעל העסק יכול להסיר משתמשים';
  end if;
  if p_user = auth.uid() then
    raise exception 'אי אפשר להסיר את עצמך';
  end if;
  delete from members m
  where m.workspace_id = p_workspace and m.user_id = p_user and m.role <> 'owner';
end;
$$;

revoke all on function public.join_workspace_on_login() from public;
revoke all on function public.list_members(uuid) from public;
revoke all on function public.remove_member(uuid, uuid) from public;
grant execute on function public.join_workspace_on_login() to authenticated;
grant execute on function public.list_members(uuid) to authenticated;
grant execute on function public.remove_member(uuid, uuid) to authenticated;
