import { supabase } from "@/integrations/supabase/client";

const ADMIN_SESSION_KEY = "dc_admin_session";
const IMPERSONATING_KEY = "dc_impersonating";

export interface ImpersonationInfo {
  display_name: string;
  user_id: string;
}

export const getImpersonation = (): ImpersonationInfo | null => {
  try {
    const raw = sessionStorage.getItem(IMPERSONATING_KEY);
    return raw ? (JSON.parse(raw) as ImpersonationInfo) : null;
  } catch {
    return null;
  }
};

/**
 * Sign the current admin in AS another user. The admin's own session is
 * stashed in sessionStorage so they can return with one click.
 */
export const startImpersonation = async (userId: string, displayName: string) => {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error("No active session");

  // Stash the admin session before it gets replaced
  sessionStorage.setItem(
    ADMIN_SESSION_KEY,
    JSON.stringify({
      access_token: session.access_token,
      refresh_token: session.refresh_token,
    })
  );

  const { data, error } = await supabase.functions.invoke("admin-impersonate", {
    body: { user_id: userId },
  });
  if (error) throw new Error(error.message);
  if (data?.error) throw new Error(data.error);
  if (!data?.token_hash) throw new Error("No sign-in token returned");

  const { error: otpError } = await supabase.auth.verifyOtp({
    type: "magiclink",
    token_hash: data.token_hash,
  });
  if (otpError) {
    sessionStorage.removeItem(ADMIN_SESSION_KEY);
    throw new Error(otpError.message);
  }

  sessionStorage.setItem(
    IMPERSONATING_KEY,
    JSON.stringify({ display_name: displayName, user_id: userId } satisfies ImpersonationInfo)
  );
};

/** Restore the stashed admin session and end impersonation. */
export const stopImpersonation = async () => {
  const raw = sessionStorage.getItem(ADMIN_SESSION_KEY);
  sessionStorage.removeItem(IMPERSONATING_KEY);
  sessionStorage.removeItem(ADMIN_SESSION_KEY);

  if (!raw) {
    // No stashed session (e.g. tab was reopened) — sign out fully
    await supabase.auth.signOut();
    return;
  }
  const saved = JSON.parse(raw);
  const { error } = await supabase.auth.setSession({
    access_token: saved.access_token,
    refresh_token: saved.refresh_token,
  });
  if (error) {
    // Stashed session expired — sign out so the admin can log back in
    await supabase.auth.signOut();
  }
};
