import { Skeleton } from "@/components/ui/skeleton";

export function LeaderboardSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 10 }).map((_, i) => (
        <div
          key={i}
          className="flex items-center gap-4 p-4 rounded-xl bg-card border border-border animate-fade-in"
          style={{ animationDelay: `${i * 50}ms` }}
        >
          {/* Rank */}
          <Skeleton className="h-10 w-10 rounded-full" />

          {/* Avatar */}
          <Skeleton className="h-10 w-10 rounded-full" />

          {/* Name & username */}
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3 w-20" />
          </div>

          {/* Stats */}
          <div className="hidden sm:flex items-center gap-2">
            <Skeleton className="h-5 w-12 rounded-full" />
            <Skeleton className="h-5 w-12 rounded-full" />
            <Skeleton className="h-5 w-12 rounded-full" />
          </div>

          {/* Score */}
          <Skeleton className="h-6 w-16" />
        </div>
      ))}
    </div>
  );
}
