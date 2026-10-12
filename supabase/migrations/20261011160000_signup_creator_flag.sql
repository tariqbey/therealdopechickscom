-- Sign-up trigger ignored the is_creator / date_of_birth metadata the app sends,
-- so accounts created with "Creator account" checked (sign-up form, Admin → Add user)
-- landed as fans. Honor the metadata.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE
  v_creator boolean := COALESCE((NEW.raw_user_meta_data->>'is_creator')::boolean, false);
  v_dob date := NULLIF(NEW.raw_user_meta_data->>'date_of_birth', '')::date;
BEGIN
  INSERT INTO public.profiles (user_id, display_name, approval_status, is_creator, date_of_birth)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)),
          CASE WHEN v_creator THEN 'pending' ELSE 'approved' END, v_creator, v_dob);

  INSERT INTO public.wallets (user_id, balance) VALUES (NEW.id, 100);
  INSERT INTO public.wallet_transactions (user_id, amount, type, description)
  VALUES (NEW.id, 100, 'bonus', 'Welcome bonus - 100 free BREAD');
  RETURN NEW;
END;
$function$;
