/*
# Auto-create profile on signup

1. Changes
- Creates a `handle_new_user` function that inserts a row into `profiles` when a new auth.users row is created.
- Creates a trigger `on_auth_user_created` that fires after INSERT on auth.users.
- Username defaults to the email prefix (before @), with a random suffix for uniqueness.
*/

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  base_username text;
  final_username text;
  suffix text;
BEGIN
  base_username := split_part(new.email, '@', 1);
  suffix := substr(md5(random()::text), 1, 4);
  final_username := base_username || '_' || suffix;

  INSERT INTO public.profiles (id, username)
  VALUES (new.id, final_username);
  RETURN new;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
