import "server-only";
import { renderToBuffer } from "@react-pdf/renderer";
import type { ReactElement } from "react";
import type { ServerSupabase } from "@/lib/supabase/server";
import type { Institution } from "./common";

export async function pdfResponse(doc: ReactElement, filename: string, inline = true) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- react-pdf's DocumentProps typing
  const buf = await renderToBuffer(doc as any);
  return new Response(new Uint8Array(buf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${inline ? "inline" : "attachment"}; filename="${filename.replace(/[^a-z0-9_.-]+/gi, "_")}"`,
      "Cache-Control": "private, no-store",
    },
  });
}

export async function loadInstitution(supabase: ServerSupabase): Promise<Institution> {
  const { data } = await supabase.from("institution_settings").select("name, short_name, address, phone, email, marksheet_footer_note").single();
  return data ?? { name: "Damdei Christian College", short_name: "DCC", address: "Manipur, India", phone: null, email: null, marksheet_footer_note: "" };
}
