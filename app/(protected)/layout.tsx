import { Suspense } from "react";
import { MobileNavigation, MobileNavigationFallback } from "@/src/components/mobile-navigation";
import { SiteHeader } from "@/src/components/site-header";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <a className="skip-link" href="#main-content">
        本文へ移動
      </a>
      <SiteHeader />
      <main id="main-content" className="app-main" tabIndex={-1}>{children}</main>
      <Suspense fallback={<MobileNavigationFallback />}>
        <MobileNavigation />
      </Suspense>
    </>
  );
}
