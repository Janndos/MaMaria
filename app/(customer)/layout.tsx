import { currentUser } from "@/lib/auth";
import { MobileShell } from "@/components/mobile-shell";

export const dynamic = "force-dynamic";

export default async function CustomerLayout({ children }: { children: React.ReactNode }) {
  const user = await currentUser();
  return (
    <MobileShell user={user ? { name: user.full_name, role: user.role } : null}>
      {children}
    </MobileShell>
  );
}
