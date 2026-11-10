import { Skeleton } from "@/components/ui/skeleton";

/** Placeholder sections, shaped like the drawer body, while the item loads. */
export function ItemDrawerSkeleton() {
  return (
    <div aria-busy="true" className="flex flex-col gap-8">
      <span role="status" className="sr-only">
        Loading item details
      </span>

      <div className="flex flex-col gap-3">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-2/3" />
      </div>

      <div className="flex flex-col gap-3">
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-40 w-full rounded-lg" />
      </div>

      <div className="flex flex-col gap-3">
        <Skeleton className="h-4 w-16" />
        <div className="flex gap-1.5">
          <Skeleton className="h-5 w-14 rounded-4xl" />
          <Skeleton className="h-5 w-12 rounded-4xl" />
          <Skeleton className="h-5 w-16 rounded-4xl" />
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-full" />
      </div>
    </div>
  );
}
