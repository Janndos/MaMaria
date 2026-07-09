import { redirect, notFound } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { AdminSidebar } from "./sidebar";

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await currentUser();
  // Not signed in → send to login (staff usability).
  if (!user) redirect("/login?next=/gestiune");
  // Signed in but not staff → behave as if the panel does not exist (avoids
  // confirming the path to a curious customer or a scanner with a stolen session).
  if (user.role !== "admin") notFound();
  return (
    <div className="flex min-h-dvh bg-canvas">
      <AdminSidebar adminName={user.full_name} />
      <div className="flex-1 min-w-0">
        <main className="mx-auto max-w-6xl px-6 py-8 lg:px-10">{children}</main>
      </div>
    </div>
  );
}
