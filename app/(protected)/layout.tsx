import { MobileNavigation } from "@/src/components/mobile-navigation";
import { SiteHeader } from "@/src/components/site-header";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SiteHeader />
      <main className="app-main">{children}</main>
      <MobileNavigation />
    </>
  );
}
