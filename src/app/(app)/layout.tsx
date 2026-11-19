import { redirect } from "next/navigation";

import { ProAccessProvider } from "@/components/billing/ProAccessProvider";
import { EditorPreferencesProvider } from "@/components/editor/EditorPreferencesProvider";
import { Sidebar } from "@/components/dashboard/Sidebar";
import { SidebarProvider } from "@/components/dashboard/SidebarProvider";
import { TopBar } from "@/components/dashboard/TopBar";
import { ItemDrawerProvider } from "@/components/items/ItemDrawerProvider";
import { SearchPaletteProvider } from "@/components/search/SearchPaletteProvider";
import { SIGN_IN_PATH } from "@/lib/auth-redirect";
import { getSidebarCollections } from "@/lib/db/collections";
import { getEditorPreferences } from "@/lib/db/editor-preferences";
import { getItemTypeCounts } from "@/lib/db/items";
import { getSessionUser } from "@/lib/db/user";
import { isProGatingEnabled } from "@/lib/usage-limits";

/**
 * The signed-in app shell - sidebar, top bar and scrolling main area - shared by
 * every page in the (app) group: /dashboard and /items/[type].
 */
export default async function AppLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const [user, itemTypes, collections, editorPreferences] = await Promise.all([
    getSessionUser(),
    getItemTypeCounts(),
    getSidebarCollections(),
    getEditorPreferences(),
  ]);

  // The proxy already redirects signed-out requests; this also catches a
  // still-valid session whose user row has been deleted.
  if (!user) {
    redirect(SIGN_IN_PATH);
  }

  // What the server's gates check, so the dialog's prompt and the server agree.
  const hasProAccess = user.isPro || !isProGatingEnabled();

  return (
    <SidebarProvider>
      {/* The New Item dialog reads whether to offer uploads or an upgrade. */}
      <ProAccessProvider hasProAccess={hasProAccess}>
        {/* The Monaco editors in the drawer and dialogs read the user's settings from here. */}
        <EditorPreferencesProvider preferences={editorPreferences}>
          {/* One item drawer for the whole shell, opened by any item card. */}
          <ItemDrawerProvider>
            {/* The Cmd/Ctrl+K palette, inside the drawer provider so items open there. */}
            <SearchPaletteProvider>
              <div className="flex h-svh overflow-hidden">
                <Sidebar itemTypes={itemTypes} collections={collections} user={user} />

                <div className="flex min-w-0 flex-1 flex-col">
                  <TopBar isPro={user.isPro} />
                  <main className="flex-1 overflow-y-auto p-4 sm:p-6">{children}</main>
                </div>
              </div>
            </SearchPaletteProvider>
          </ItemDrawerProvider>
        </EditorPreferencesProvider>
      </ProAccessProvider>
    </SidebarProvider>
  );
}
