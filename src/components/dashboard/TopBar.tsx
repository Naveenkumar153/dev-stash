import { Plus, Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function TopBar() {
  return (
    <header className="flex h-14 shrink-0 items-center gap-4 border-b border-border px-4">
      <div className="relative flex-1 max-w-md">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input placeholder="Search items..." className="pl-8" />
      </div>
      <Button>
        <Plus />
        New Item
      </Button>
    </header>
  );
}
