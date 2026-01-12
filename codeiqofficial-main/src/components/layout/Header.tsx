import { Search, Crown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAppSettings } from "@/hooks/useAppSettings";
import { useAuth } from "@/contexts/AuthContext";
import { Link } from "react-router-dom";
import { NotificationDropdown } from "@/components/NotificationDropdown";

interface HeaderProps {
  title: string;
  subtitle?: string;
}

export function Header({ title, subtitle }: HeaderProps) {
  const { settings } = useAppSettings();
  const { profile } = useAuth();
  
  const paidFeaturesEnabled = settings.paid_features_enabled;
  const subscriptionPlan = profile?.subscription_plan ?? "free";
  const isPaidUser = ["basic", "pro", "pro+", "lifetime"].includes(subscriptionPlan);
  const showUpgradeButton = paidFeaturesEnabled && !isPaidUser;

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 px-6">
      <div>
        <h1 className="text-xl font-bold text-foreground">{title}</h1>
        {subtitle && (
          <p className="text-sm text-muted-foreground">{subtitle}</p>
        )}
      </div>

      <div className="flex items-center gap-4">
        {/* Search */}
        <div className="hidden md:flex items-center gap-2 rounded-lg bg-muted px-3 py-2">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search problems..."
            className="bg-transparent text-sm outline-none placeholder:text-muted-foreground w-48"
          />
        </div>

        {/* Upgrade Button - only show if paid features enabled */}
        {showUpgradeButton && (
          <Button variant="default" size="sm" className="hidden sm:flex gap-2" asChild>
            <Link to="/pricing">
              <Crown className="h-4 w-4" />
              Upgrade to Pro
            </Link>
          </Button>
        )}

        {/* Notifications */}
        <NotificationDropdown />
      </div>
    </header>
  );
}
