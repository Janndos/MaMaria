import { NextResponse } from "next/server";
import { AuthError } from "./auth";

export function jsonError(status: number, error: string) {
  return NextResponse.json({ error }, { status });
}

export async function handle<T>(fn: () => Promise<T>): Promise<NextResponse | T> {
  try {
    return await fn();
  } catch (e) {
    if (e instanceof AuthError) return jsonError(e.status, e.message);
    console.error(e);
    return jsonError(500, "Eroare internă. Încercați din nou.");
  }
}
