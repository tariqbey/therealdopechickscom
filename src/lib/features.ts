/**
 * Platform feature registry (the Scrile "Addons" equivalent). Every feature has a
 * key, a group, and whether it is actually implemented in this codebase. Toggles are
 * stored in platform_settings.features as { [key]: boolean }. Built-in features
 * default ON; unimplemented ones are shown greyed out as "coming soon".
 */
export type FeatureGroup = "admin" | "platform" | "engagement" | "analytics";

export interface FeatureDef {
  key: string;
  name: string;
  description: string;
  group: FeatureGroup;
  implemented: boolean;
  defaultOn?: boolean;
  /** Where in the app it shows up, for the admin's reference. */
  where?: string;
}

export const FEATURES: FeatureDef[] = [
  // ---- Admin panel ----
  { key: "announcements", name: "Announcements", description: "Platform-wide banners visible to all creators and members, scheduled and targeted by audience.", group: "admin", implemented: true, defaultOn: true, where: "Admin → Announcements" },
  { key: "export_users", name: "Export User List", description: "Download a CSV of users: name, email, role, balances, sign-up and last-login dates.", group: "admin", implemented: true, defaultOn: true, where: "Admin → Users → Export CSV" },
  { key: "login_as_user", name: "Login as User", description: "Sign in as any user from the admin panel to see exactly what they see.", group: "admin", implemented: true, defaultOn: true, where: "Admin → Users" },
  { key: "post_verification", name: "Admin Content Wall (Post Verification)", description: "Creators' posts stay hidden until an admin approves them.", group: "admin", implemented: true, defaultOn: false, where: "Admin → Content Wall" },
  { key: "talent_agents", name: "Talent Agents", description: "A manager role that runs a creator's profile and activity on their behalf.", group: "admin", implemented: false },
  { key: "second_gateway", name: "Second Payment Gateway", description: "Let users pick between multiple payment processors at checkout.", group: "admin", implemented: false },

  // ---- Platform ----
  { key: "nsfw", name: "NSFW Mode", description: "Sensitive-content warning and 18+ confirmation before entering.", group: "platform", implemented: true, defaultOn: true, where: "Site-wide age gate" },
  { key: "age_verification", name: "ID / Age Verification", description: "Creators upload a government ID during application; admins approve.", group: "platform", implemented: true, defaultOn: true, where: "Admin → Security" },
  { key: "dark_mode", name: "Dark Mode", description: "The platform's native dark theme.", group: "platform", implemented: true, defaultOn: true },
  { key: "purchase_from_balance", name: "Purchase from Balance (BREAD)", description: "Users pay for posts, VR videos, calls and tips from their internal BREAD balance.", group: "platform", implemented: true, defaultOn: true },
  { key: "subscription_from_balance", name: "Subscription from Balance", description: "Subscribe to creators using BREAD instead of a card.", group: "platform", implemented: false },
  { key: "payout_request_tool", name: "Payout Request Tool", description: "Creators submit payout requests themselves; admins approve and pay.", group: "platform", implemented: true, defaultOn: true, where: "Settings → Payouts (creators), Admin → Payouts" },
  { key: "push_notifications", name: "Push Notifications", description: "Web push alerts for calls, messages and new content.", group: "platform", implemented: true, defaultOn: true, where: "Settings → Notifications" },
  { key: "discover_search", name: "Discover Page Search", description: "Search creators by name on the discover page.", group: "platform", implemented: true, defaultOn: true },
  { key: "creators_tab", name: "Creators Tab", description: "A curated creators directory with categories.", group: "platform", implemented: true, defaultOn: true, where: "Home → Featured / Categories" },
  { key: "hashtags", name: "Hashtags for Posts", description: "Tag posts so they're searchable.", group: "platform", implemented: false },
  { key: "liked_content", name: "Liked Content", description: "A single place for members to revisit everything they liked.", group: "platform", implemented: false },
  { key: "purchased_storage", name: "Purchased File Storage", description: "Gallery of everything a member has bought, grouped by creator.", group: "platform", implemented: true, defaultOn: true, where: "VR unlocks shown on profiles; Transactions page" },
  { key: "vault_management", name: "Vault Management", description: "Creators organise uploaded media in folders.", group: "platform", implemented: true, defaultOn: true, where: "Creator → Manage" },
  { key: "lists", name: "Lists", description: "Creators group followers into custom lists.", group: "platform", implemented: false },
  { key: "clickable_links", name: "Clickable External Links", description: "Allow links in bios and posts to be clickable.", group: "platform", implemented: false },
  { key: "invisible_mode", name: "Invisible Mode", description: "Creators hide their online status.", group: "platform", implemented: false },
  { key: "google_login", name: "Login via Google", description: "Sign in with a Google account.", group: "platform", implemented: false },
  { key: "x_login", name: "Login via X (Twitter)", description: "Sign in with an X account.", group: "platform", implemented: false },
  { key: "multiple_accounts", name: "Multiple Accounts", description: "Switch between profiles without logging out.", group: "platform", implemented: false },
  { key: "hide_brand", name: "Hide Platform Branding", description: "No third-party vendor branding anywhere. Already true: you own the code.", group: "platform", implemented: true, defaultOn: true },

  // ---- Engagement ----
  { key: "video_calls", name: "Paid Video Calls", description: "FaceTime-style 1-on-1 calls paid in BREAD, with auto refunds.", group: "engagement", implemented: true, defaultOn: true, where: "Creator profile → Video Call" },
  { key: "video_messages", name: "Video Messages", description: "Record and send short videos in chat.", group: "engagement", implemented: true, defaultOn: true, where: "Messages" },
  { key: "vr_videos", name: "VR180 / 360 Videos", description: "Immersive video with the built-in VR player and BREAD paywall.", group: "engagement", implemented: true, defaultOn: true, where: "Creator profile → VR Experiences" },
  { key: "ai_studio", name: "AI Studio", description: "AI image, character and video generation for creators.", group: "engagement", implemented: true, defaultOn: true, where: "/ai-studio" },
  { key: "tipping", name: "Tipping", description: "Fans tip creators on their profile and on posts.", group: "engagement", implemented: true, defaultOn: true, where: "Creator profile → Tip" },
  { key: "pinned_posts", name: "Pinned Posts", description: "Creators pin key posts to the top of their grid.", group: "engagement", implemented: true, defaultOn: true, where: "Creator → Manage → Pin" },
  { key: "welcome_messages", name: "Welcome Messages", description: "Automatic AI reply to the first message from a new fan.", group: "engagement", implemented: true, defaultOn: true, where: "Messages (AI auto-reply)" },
  { key: "public_comments", name: "Public Comments", description: "Comments visible to everyone under posts.", group: "engagement", implemented: false },
  { key: "stories", name: "Stories", description: "24-hour photo and video stories.", group: "engagement", implemented: false },
  { key: "fundraising", name: "Fundraising", description: "Creators set goals and show live progress on their profile.", group: "engagement", implemented: false },
  { key: "paid_events", name: "Paid Events", description: "Ticketed online events with refunds on cancellation.", group: "engagement", implemented: false },
  { key: "appointments", name: "Appointments", description: "Book online or offline time with a creator.", group: "engagement", implemented: false },
  { key: "voice_messages", name: "Voice Messages", description: "Paid voice notes in chat.", group: "engagement", implemented: false },
  { key: "scheduled_mass_messages", name: "Scheduled Mass Messages", description: "Pre-schedule messages to all subscribers.", group: "engagement", implemented: false },
  { key: "text_posts", name: "Text Posts", description: "Posts without media.", group: "engagement", implemented: false },
  { key: "calendar", name: "Calendar Link", description: "Creators link an external booking calendar.", group: "engagement", implemented: false },

  // ---- Analytics ----
  { key: "creator_statements", name: "Creator Statements", description: "Creators see their earnings history and totals.", group: "analytics", implemented: true, defaultOn: true, where: "Settings → Transaction History" },
  { key: "profile_like_stats", name: "Profile Like Stats", description: "Public like and post counts on creator profiles.", group: "analytics", implemented: true, defaultOn: true },
  { key: "mass_message_stats", name: "Mass Message Statistics", description: "Open and unlock stats per mass message.", group: "analytics", implemented: false },
];

export const FEATURE_GROUPS: { key: FeatureGroup; label: string }[] = [
  { key: "admin", label: "Admin panel" },
  { key: "platform", label: "Platform" },
  { key: "engagement", label: "Engagement" },
  { key: "analytics", label: "Analytics" },
];

export type FeatureMap = Record<string, boolean>;

export const resolveFeature = (map: FeatureMap | null | undefined, key: string): boolean => {
  const def = FEATURES.find((f) => f.key === key);
  if (!def || !def.implemented) return false;
  if (map && key in map) return !!map[key];
  return def.defaultOn ?? false;
};
