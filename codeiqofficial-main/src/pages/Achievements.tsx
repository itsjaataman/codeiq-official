import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Badge } from "@/components/ui/badge";
import { usePaymentAccess } from "@/hooks/usePaymentAccess";
import { LockedScreen } from "@/components/LockedScreen";
import {
  Trophy,
  Lock,
  Star,
  Flame,
  Target,
  Zap,
  Award,
  Medal,
  Crown,
  Loader2,
} from "lucide-react";
import { useAchievements } from "@/hooks/useAchievements";
import { format } from "date-fns";

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  Star,
  Flame,
  Target,
  Zap,
  Award,
  Medal,
  Crown,
  Trophy,
};

const rarityColors = {
  Common: "text-muted-foreground",
  Uncommon: "text-success",
  Rare: "text-info",
  Epic: "text-primary",
  Legendary: "text-warning",
};

export default function Achievements() {
  const { achievements, unlockedCount, totalCount, rarityCounts, isLoading } = useAchievements();
  const { isLocked, isLoading: paymentLoading, paidFeaturesEnabled } = usePaymentAccess();

  // Show locked screen if trial expired and no paid plan
  if (paidFeaturesEnabled && isLocked && !paymentLoading) {
    return (
      <DashboardLayout title="Achievements" subtitle="Track your milestones and earn badges">
        <LockedScreen />
      </DashboardLayout>
    );
  }

  if (isLoading) {
    return (
      <DashboardLayout
        title="Achievements"
        subtitle="Track your milestones and earn badges"
      >
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout
      title="Achievements"
      subtitle="Track your milestones and earn badges"
    >
      {/* Stats Header */}
      <div className="bg-card rounded-xl border border-border shadow-card p-6 mb-6">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
              <Trophy className="h-8 w-8 text-primary" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-foreground">
                {unlockedCount} / {totalCount}
              </h2>
              <p className="text-muted-foreground">Achievements Unlocked</p>
            </div>
          </div>
          <div className="flex gap-6 text-center">
            <div>
              <div className="text-xl font-bold text-foreground">{rarityCounts.Common}</div>
              <div className="text-xs text-muted-foreground">Common</div>
            </div>
            <div>
              <div className="text-xl font-bold text-success">{rarityCounts.Uncommon}</div>
              <div className="text-xs text-muted-foreground">Uncommon</div>
            </div>
            <div>
              <div className="text-xl font-bold text-info">{rarityCounts.Rare}</div>
              <div className="text-xs text-muted-foreground">Rare</div>
            </div>
            <div>
              <div className="text-xl font-bold text-primary">{rarityCounts.Epic}</div>
              <div className="text-xs text-muted-foreground">Epic</div>
            </div>
            <div>
              <div className="text-xl font-bold text-warning">{rarityCounts.Legendary}</div>
              <div className="text-xs text-muted-foreground">Legendary</div>
            </div>
          </div>
        </div>
      </div>

      {/* Achievements Grid */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {achievements.map((achievement) => {
          const IconComponent = iconMap[achievement.icon] || Star;
          
          return (
            <div
              key={achievement.id}
              className={`relative bg-card rounded-xl border shadow-card p-6 transition-all duration-300 ${
                achievement.unlocked
                  ? "border-primary/30 hover:shadow-orange hover:-translate-y-1"
                  : "border-border opacity-70 grayscale"
              }`}
            >
              {/* Rarity Badge */}
              <Badge
                variant="secondary"
                className={`absolute top-3 right-3 text-[10px] ${
                  rarityColors[achievement.rarity as keyof typeof rarityColors]
                }`}
              >
                {achievement.rarity}
              </Badge>

              {/* Icon */}
              <div
                className={`flex h-14 w-14 items-center justify-center rounded-xl mb-4 ${
                  achievement.unlocked
                    ? "bg-primary/10 text-primary"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                {achievement.unlocked ? (
                  <IconComponent className="h-7 w-7" />
                ) : (
                  <Lock className="h-7 w-7" />
                )}
              </div>

              {/* Content */}
              <h3 className="font-semibold text-foreground mb-1">
                {achievement.name}
              </h3>
              <p className="text-sm text-muted-foreground mb-3">
                {achievement.description}
              </p>

              {/* Progress or Unlocked Date */}
              {achievement.unlocked ? (
                <p className="text-xs text-success">
                  Unlocked {achievement.unlockedAt ? format(new Date(achievement.unlockedAt), "MMM d, yyyy") : ""}
                </p>
              ) : (
                <div>
                  <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                    <span>Progress</span>
                    <span>
                      {achievement.progress}/{achievement.total}
                    </span>
                  </div>
                  <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary/50 rounded-full transition-all"
                      style={{
                        width: `${(achievement.progress / achievement.total) * 100}%`,
                      }}
                    />
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </DashboardLayout>
  );
}
