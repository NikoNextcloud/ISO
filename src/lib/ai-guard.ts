import { createHash } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { NextRequest } from "next/server";
import type { AiVisualRequest } from "@/lib/cloudflare-ai";

type CachedVisual = { dataUrl: string; model: string };
type AiContext = { client: SupabaseClient | null; userId: string };

const WINDOW_MS = 15 * 60 * 1000;
const MAX_GENERATIONS = 10;
const memoryCache = new Map<string, { value: CachedVisual; expiresAt: number }>();
const reviewMemoryCache = new Map<string, { value: unknown; expiresAt: number }>();
const memoryEvents = new Map<string, number[]>();

export function aiRequestHash(input: AiVisualRequest) {
  const normalized = {
    type: input.type?.trim() ?? "",
    prompt: input.prompt?.trim() ?? "",
    companyName: input.companyName?.trim() ?? "",
    standard: input.standard?.trim() ?? "",
    accent: input.accent?.trim() ?? "",
    layout: input.layout?.trim() ?? ""
  };
  return createHash("sha256").update(JSON.stringify(normalized)).digest("hex");
}

export function aiReviewRequestHash(input: unknown) {
  return createHash("sha256").update(JSON.stringify(input)).digest("hex");
}

export async function createAiContext(request: NextRequest): Promise<AiContext> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!url || !key || !token) return { client: null, userId: request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local-user" };
  const client = createClient(url, key, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false }
  });
  const user = await client.auth.getUser(token);
  return { client, userId: user.data.user?.id ?? "unknown-user" };
}

export async function readCachedVisual(context: AiContext, hash: string) {
  const local = memoryCache.get(hash);
  if (local && local.expiresAt > Date.now()) return local.value;
  if (local) memoryCache.delete(hash);
  if (!context.client || context.userId === "unknown-user") return null;
  const result = await context.client.storage.from("ai-visual-cache").download(`${context.userId}/${hash}.json`);
  if (result.error) return null;
  try {
    const value = JSON.parse(await result.data.text()) as CachedVisual;
    if (!value.dataUrl || !value.model) return null;
    memoryCache.set(hash, { value, expiresAt: Date.now() + 60 * 60 * 1000 });
    return value;
  } catch {
    return null;
  }
}

export async function saveCachedVisual(context: AiContext, hash: string, value: CachedVisual) {
  memoryCache.set(hash, { value, expiresAt: Date.now() + 60 * 60 * 1000 });
  if (!context.client || context.userId === "unknown-user") return;
  const payload = new Blob([JSON.stringify(value)], { type: "application/json" });
  await context.client.storage.from("ai-visual-cache").upload(`${context.userId}/${hash}.json`, payload, { contentType: "application/json", upsert: true });
}

export async function readCachedReview<T>(context: AiContext, hash: string): Promise<T | null> {
  const local = reviewMemoryCache.get(hash);
  if (local && local.expiresAt > Date.now()) return local.value as T;
  if (local) reviewMemoryCache.delete(hash);
  if (!context.client || context.userId === "unknown-user") return null;
  const result = await context.client.storage.from("ai-visual-cache").download(`${context.userId}/reviews/${hash}.json`);
  if (result.error) return null;
  try {
    const value = JSON.parse(await result.data.text()) as T;
    reviewMemoryCache.set(hash, { value, expiresAt: Date.now() + 6 * 60 * 60 * 1000 });
    return value;
  } catch {
    return null;
  }
}

export async function saveCachedReview<T>(context: AiContext, hash: string, value: T) {
  reviewMemoryCache.set(hash, { value, expiresAt: Date.now() + 6 * 60 * 60 * 1000 });
  if (!context.client || context.userId === "unknown-user") return;
  const payload = new Blob([JSON.stringify(value)], { type: "application/json" });
  await context.client.storage.from("ai-visual-cache").upload(`${context.userId}/reviews/${hash}.json`, payload, { contentType: "application/json", upsert: true });
}

export async function consumeAiGeneration(context: AiContext, hash: string) {
  const since = new Date(Date.now() - WINDOW_MS).toISOString();
  if (context.client && context.userId !== "unknown-user") {
    const countResult = await context.client.from("ai_generation_events").select("id", { count: "exact", head: true }).gte("created_at", since);
    if (!countResult.error) {
      if ((countResult.count ?? 0) >= MAX_GENERATIONS) return { allowed: false, retryAfter: Math.ceil(WINDOW_MS / 1000) };
      const inserted = await context.client.from("ai_generation_events").insert({ owner_id: context.userId, request_hash: hash });
      if (!inserted.error) return { allowed: true, remaining: Math.max(0, MAX_GENERATIONS - (countResult.count ?? 0) - 1) };
    }
  }

  const now = Date.now();
  const recent = (memoryEvents.get(context.userId) ?? []).filter((time) => time > now - WINDOW_MS);
  if (recent.length >= MAX_GENERATIONS) return { allowed: false, retryAfter: Math.ceil((recent[0] + WINDOW_MS - now) / 1000) };
  recent.push(now);
  memoryEvents.set(context.userId, recent);
  return { allowed: true, remaining: MAX_GENERATIONS - recent.length };
}
