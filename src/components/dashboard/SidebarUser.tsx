"use client";

import { Settings } from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { currentUser } from "@/lib/mock-data";
import { cn } from "@/lib/utils";

function getInitials(name: string) {
  return name
    .split(" ")
    .map((part) => part.charAt(0))
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

/** User area pinned to the bottom of the sidebar. Display only for now. */
export function SidebarUser({ collapsed }: Readonly<{ collapsed: boolean }>) {
  return (
    <div
      className={cn(
        "flex shrink-0 items-center gap-3 p-3",
        collapsed && "justify-center",
      )}
    >
      <Avatar>
        {currentUser.image && <AvatarImage src={currentUser.image} alt="" />}
        <AvatarFallback>{getInitials(currentUser.name)}</AvatarFallback>
      </Avatar>

      {!collapsed && (
        <>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{currentUser.name}</p>
            <p className="truncate text-xs text-muted-foreground">
              {currentUser.email}
            </p>
          </div>
          <Button variant="ghost" size="icon-sm" aria-label="Settings">
            <Settings />
          </Button>
        </>
      )}
    </div>
  );
}
