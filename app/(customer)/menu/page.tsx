import { redirect } from "next/navigation";

// Browsing and ordering are now one page (`/meniu`). Keep this path working for
// old links, bookmarks and QR codes.
export default function MenuRedirect() { redirect("/meniu"); }
