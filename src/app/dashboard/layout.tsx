import { redirect } from "next/navigation";

import { Sidebar } from "@/components/dashboard/Sidebar";
import { SidebarProvider } from "@/components/dashboard/SidebarProvider";
import { TopBar } from "@/components/dashboard/TopBar";
import { SIGN_IN_PATH } from "@/lib/auth-redirect";
import { getSidebarCollections } from "@/lib/db/collections";
import { getItemTypeCounts } from "@/lib/db/items";
import { getSessionUser } from "@/lib/db/user";

export default async function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const [user, itemTypes, collections] = await Promise.all([
    getSessionUser(),
    getItemTypeCounts(),
    getSidebarCollections(),
  ]);

  // The proxy already redirects signed-out requests; this also catches a
  // still-valid session whose user row has been deleted.
  if (!user) {
    redirect(SIGN_IN_PATH);
  }

  return (
    <SidebarProvider>
      <div className="flex h-svh overflow-hidden">
        <Sidebar itemTypes={itemTypes} collections={collections} user={user} />

        <div className="flex min-w-0 flex-1 flex-col">
          <TopBar />
          <main className="flex-1 overflow-y-auto p-4 sm:p-6">{children}</main>
        </div>
      </div>
    </SidebarProvider>
  );
}
