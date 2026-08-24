import { MobileNavigation } from "@/src/components/mobile-navigation";
import { SiteHeader } from "@/src/components/site-header";
import { requireAuth } from "@/src/lib/auth";

export const dynamic = "force-dynamic";

export default async function ProtectedLayout({ children }: { children: React.ReactNode }) {
  await requireAuth();
  return (
    <>
      <SiteHeader />
      <main className="app-main">{children}</main>
      <MobileNavigation />
    </>
  );
}
