import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { FEATURES, resolveFeature, type FeatureMap } from "@/lib/features";

/** Shapes of the JSON blobs in platform_settings. */
export interface SiteSettings {
  site_name: string; company_name: string; company_address: string; meta_description: string;
  support_email: string; logo_url: string; favicon_url: string; watermark_enabled: boolean;
  watermark_format: "site_name" | "username"; ga_code: string;
}
export interface DesignSettings { primary: string; secondary: string; menu_type: "popup" | "full"; sidebar: "left" | "right" }
export interface PayoutSettings { creator_share_pct: number; referral_pct: number; payout_commission_pct: number; request_fee_credits: number; min_request_credits: number; methods: string[] }
export interface CurrencySettings { main: string; symbol: string; credit_name: string; rate_per_credit: number; available: string[] }
export interface SmtpSettings { host: string; port: number; login: string; password: string; from_email: string }
export interface DomainSettings { custom_domain: string }

export const DEFAULTS = {
  site: { site_name: "Dope Chicks", company_name: "", company_address: "", meta_description: "", support_email: "", logo_url: "", favicon_url: "", watermark_enabled: false, watermark_format: "site_name", ga_code: "" } as SiteSettings,
  design: { primary: "#a855f7", secondary: "#e6b422", menu_type: "popup", sidebar: "left" } as DesignSettings,
  payouts: { creator_share_pct: 80, referral_pct: 5, payout_commission_pct: 0, request_fee_credits: 0, min_request_credits: 100, methods: ["paypal", "bank", "crypto"] } as PayoutSettings,
  currency: { main: "USD", symbol: "$", credit_name: "BREAD", rate_per_credit: 0.1, available: ["USD"] } as CurrencySettings,
  smtp: { host: "", port: 587, login: "", password: "", from_email: "" } as SmtpSettings,
  domain: { custom_domain: "" } as DomainSettings,
  features: {} as FeatureMap,
};
export type SettingsKey = keyof typeof DEFAULTS;

type Cache = Partial<{ [K in SettingsKey]: (typeof DEFAULTS)[K] }>;
let cache: Cache = {};
let loaded = false;
let inflight: Promise<Cache> | null = null;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());

export async function loadSettings(force = false): Promise<Cache> {
  if (loaded && !force) return cache;
  if (inflight) return inflight;
  inflight = (async () => {
    const { data } = await supabase.from("platform_settings").select("key, value");
    const next: Cache = {};
    for (const row of (data as { key: string; value: unknown }[]) || []) {
      if (row.key in DEFAULTS) (next as Record<string, unknown>)[row.key] = { ...(DEFAULTS as Record<string, object>)[row.key], ...(row.value as object) };
    }
    cache = next; loaded = true; inflight = null; notify();
    return cache;
  })();
  return inflight;
}

export async function saveSetting<K extends SettingsKey>(key: K, value: (typeof DEFAULTS)[K]) {
  const { error } = await (supabase as any)
    .from("platform_settings")
    .upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: "key" });
  if (error) throw new Error(error.message);
  (cache as Record<string, unknown>)[key] = value;
  notify();
}

/** Read one settings blob (defaults until loaded). */
export function useSetting<K extends SettingsKey>(key: K): (typeof DEFAULTS)[K] {
  const [, tick] = useState(0);
  useEffect(() => {
    const l = () => tick((n) => n + 1);
    listeners.add(l);
    loadSettings();
    return () => { listeners.delete(l); };
  }, []);
  return ((cache as Record<string, unknown>)[key] as (typeof DEFAULTS)[K]) ?? DEFAULTS[key];
}

/** Feature toggles with implementation + default awareness. */
export function useFeatures() {
  const map = useSetting("features");
  const enabled = useCallback((key: string) => resolveFeature(map, key), [map]);
  return { enabled, map, all: FEATURES };
}

export const useFeature = (key: string) => useFeatures().enabled(key);

/** Price options for a given kind (deposit, post, …). */
export interface PriceOption { id: string; kind: string; label: string | null; credits: number; price_cents: number | null; stripe_price_id: string | null; is_popular: boolean; is_active: boolean; sort: number }
export function usePriceOptions(kind: string) {
  const [options, setOptions] = useState<PriceOption[]>([]);
  const [loading, setLoading] = useState(true);
  const reload = useCallback(async () => {
    const { data } = await (supabase as any).from("price_options").select("*").eq("kind", kind).order("sort");
    setOptions((data as PriceOption[]) || []);
    setLoading(false);
  }, [kind]);
  useEffect(() => { reload(); }, [reload]);
  return { options: options.filter((o) => o.is_active), allOptions: options, loading, reload };
}

export interface Category { id: string; name: string; slug: string; is_active: boolean; sort: number }
export function useCategories() {
  const [categories, setCategories] = useState<Category[]>([]);
  const reload = useCallback(async () => {
    const { data } = await (supabase as any).from("categories").select("*").order("sort");
    setCategories((data as Category[]) || []);
  }, []);
  useEffect(() => { reload(); }, [reload]);
  return { categories: categories.filter((c) => c.is_active), allCategories: categories, reload };
}

/** Convert hex (#rrggbb) to the "H S% L%" string Tailwind's HSL tokens expect. */
export function hexToHslTriplet(hex: string): string | null {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  const n = parseInt(m[1], 16);
  const r = ((n >> 16) & 255) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      default: h = (r - g) / d + 4;
    }
    h /= 6;
  }
  return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}
