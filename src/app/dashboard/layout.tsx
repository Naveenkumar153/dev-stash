import { TopBar } from "@/components/dashboard/TopBar";

export default function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="flex min-h-svh">
      {/* Placeholder - the real sidebar lands in phase 2. */}
      <aside className="hidden w-64 shrink-0 border-r border-border bg-sidebar p-4 md:block">
        <h2 className="text-lg font-semibold">Sidebar</h2>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar />
        <main className="flex-1 p-4 sm:p-6">{children}</main>
      </div>
    </div>
  );
}
