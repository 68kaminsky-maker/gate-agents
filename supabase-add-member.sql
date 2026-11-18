-- הוספת משתמש למרחב העבודה, רק על ידי בעל העסק.
-- להריץ פעם אחת ב-Supabase: SQL Editor.
-- ההנחות: לטבלת members יש העמודות workspace_id, user_id, role, ותפקיד הבעלים נקרא 'owner'.
-- לפני ההרצה: להתאים לשמות האמיתיים מ-setup.sql אם הם שונים.
-- המשתמש חייב להיכנס למערכת פעם אחת לפני ההוספה, כדי שייווצר לו חשבון.

create or replace function public.add_member_by_email(p_workspace uuid, p_email text)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_uid uuid;
begin
  if not exists (
    select 1 from members m
    where m.workspace_id = p_workspace and m.user_id = auth.uid() and m.role = 'owner'
  ) then
    raise exception 'רק בעל העסק יכול להוסיף משתמשים';
  end if;

  select u.id into v_uid from auth.users u where lower(u.email) = lower(trim(p_email));
  if v_uid is null then
    raise exception 'המשתמש עדיין לא נכנס למערכת. שייכנס פעם אחת ואז תנסו שוב';
  end if;

  insert into members (workspace_id, user_id, role)
  select p_workspace, v_uid, 'editor'
  where not exists (
    select 1 from members m where m.workspace_id = p_workspace and m.user_id = v_uid
  );
end;
$$;

revoke all on function public.add_member_by_email(uuid, text) from public;
grant execute on function public.add_member_by_email(uuid, text) to authenticated;
