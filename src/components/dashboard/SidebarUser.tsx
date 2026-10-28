"use client";

import { useTransition } from "react";
import Link from "next/link";
import { LogOut, Settings, User } from "lucide-react";

import { signOutUser } from "@/actions/auth";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { UserAvatar } from "@/components/user/UserAvatar";
import { cn } from "@/lib/utils";
import type { SessionUser } from "@/types/auth";

interface SidebarUserProps {
  user: SessionUser;
  collapsed: boolean;
}

/** User area pinned to the bottom of the sidebar; the avatar opens the account menu. */
export function SidebarUser({ user, collapsed }: SidebarUserProps) {
  const [isSigningOut, startSignOut] = useTransition();

  return (
    <div
      className={cn(
        "flex shrink-0 items-center gap-3 p-3",
        collapsed && "justify-center",
      )}
    >
      <DropdownMenu>
        <DropdownMenuTrigger
          aria-label={collapsed ? `Account menu for ${user.name}` : undefined}
          className={cn(
            "flex min-w-0 items-center gap-3 rounded-lg text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/50 data-[popup-open]:opacity-80",
            !collapsed && "flex-1",
          )}
        >
          <UserAvatar name={user.name} image={user.image} />
          {!collapsed && (
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{user.name}</p>
              <p className="truncate text-xs text-muted-foreground">
                {user.email}
              </p>
            </div>
          )}
        </DropdownMenuTrigger>

        <DropdownMenuContent side="top" className="w-48">
          <DropdownMenuItem render={<Link href="/profile" />}>
            <User />
            Profile
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            variant="destructive"
            disabled={isSigningOut}
            onClick={() => startSignOut(() => signOutUser())}
          >
            <LogOut />
            Sign out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {!collapsed && (
        <Button variant="ghost" size="icon-sm" aria-label="Settings">
          <Settings />
        </Button>
      )}
    </div>
  );
}
