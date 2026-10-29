import "server-only";
import { getSession, can, type Session } from "./session";
import type { Permission } from "./permissions";
import { rateLimit } from "@/lib/rate-limit";

/** Route-handler guard: returns the session, or a 401/403/429 Response. */
export async function apiGuard(perms: Permission[], limitPerMinute = 30): Promise<Session | Response> {
  const session = await getSession();
  if (!session) return new Response("Unauthorised", { status: 401 });
  if (perms.length && !can(session, ...perms)) return new Response("Forbidden", { status: 403 });
  if (!rateLimit(`api:${session.userId}`, limitPerMinute)) return new Response("Too many requests", { status: 429 });
  return session;
}

export function qp(url: URL, key: string): string | undefined {
  const v = url.searchParams.get(key);
  return v && v.length < 200 ? v : undefined;
}
export const isUuid = (v: string | undefined): v is string => !!v && /^[0-9a-f-]{36}$/i.test(v);
