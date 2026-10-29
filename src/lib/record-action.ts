import type { ActionResult } from "@/lib/actions";

export type RecordAction = (values: Record<string, string | boolean>) => Promise<ActionResult<unknown>>;

/** Server actions validate their own input with zod, so a loosely typed form payload is safe to pass. */
export function asRecordAction<T>(fn: (input: T) => Promise<ActionResult<unknown>>): RecordAction {
  return fn as unknown as RecordAction;
}
