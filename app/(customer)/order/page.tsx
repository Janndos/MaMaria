import { redirect } from "next/navigation";

// Merged into `/meniu` (browsing and ordering are the same task). Kept as a
// redirect for old links.
export default function OrderRedirect() { redirect("/meniu"); }
