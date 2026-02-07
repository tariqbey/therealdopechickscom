
-- Update handle_new_user to set new users as pending
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.profiles (user_id, display_name, approval_status)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)), 'pending');
  
  INSERT INTO public.wallets (user_id, balance)
  VALUES (NEW.id, 100);
  
  INSERT INTO public.wallet_transactions (user_id, amount, type, description)
  VALUES (NEW.id, 100, 'bonus', 'Welcome bonus - 100 free BREAD');
  
  RETURN NEW;
END;
$function$;
