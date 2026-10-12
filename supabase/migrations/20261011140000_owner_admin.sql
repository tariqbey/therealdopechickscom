-- Owner asked (2026-10-11): grant the tbey2026 account the admin role, and widen the
-- sign-up auto-grant to the owner's other emails.
INSERT INTO public.user_roles (user_id, role)
VALUES ('45171c62-87ce-4b74-88ba-d9a824b59689', 'admin'::app_role)
ON CONFLICT (user_id, role) DO NOTHING;

CREATE OR REPLACE FUNCTION public.grant_owner_admin()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF lower(NEW.email) IN ('drpaydex@gmail.com', 'realjetsonlifeai@gmail.com', 'realjetsonlife@gmail.com') THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin'::app_role)
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;
