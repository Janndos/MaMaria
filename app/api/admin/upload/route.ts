import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { parseXlsx, parseCsv } from "@/lib/parse";
import { handle, jsonError } from "@/lib/api";

export async function POST(req: NextRequest) {
  return handle(async () => {
    await requireAdmin();
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) return jsonError(400, "Atașați un fișier .xlsx sau .csv.");
    if (file.size > 5 * 1024 * 1024) return jsonError(400, "Fișierul depășește 5 MB.");
    const name = file.name.toLowerCase();
    const buf = Buffer.from(await file.arrayBuffer());
    let result;
    if (name.endsWith(".xlsx") || name.endsWith(".xls")) result = parseXlsx(buf);
    else if (name.endsWith(".csv") || name.endsWith(".txt")) result = parseCsv(buf.toString("utf-8"));
    else return jsonError(400, "Format neacceptat. Folosiți .xlsx sau .csv. Pentru imagini/PDF, introduceți meniul manual sau exportați în Excel.");
    return NextResponse.json(result);
  });
}
