import { useState, useCallback } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { useAdmin } from "@/hooks/useAdmin";
import { useTeacher } from "@/hooks/useTeacher";
import { useClassroomStudent } from "@/hooks/useClassroomStudent";
import { useAppSettings } from "@/hooks/useAppSettings";
import { usePaymentAccess } from "@/hooks/usePaymentAccess";
import codeiqLogo from "@/assets/codeiq-logo.png";
import codeiqOwl from "@/assets/codeiq-owl.gif";
import {
  LayoutDashboard,
  BookOpen,
  Building2,
  Trophy,
  BarChart3,
  Settings,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Flame,
  User,
  RefreshCw,
  Shuffle,
  Menu,
  X,
  Medal,
  Shield,
  Crown,
  GraduationCap,
  Users,
} from "lucide-react";

interface SidebarProps {
  className?: string;
}

const navigation = [
  { name: "My Progress", href: "/dashboard", icon: BarChart3 },
  { name: "Topic-wise", href: "/topics", icon: BookOpen },
  { name: "Company-wise", href: "/companies", icon: Building2, isPro: true },
  { name: "Revision", href: "/revision", icon: RefreshCw },
  { name: "Achievements", href: "/achievements", icon: Trophy },
  { name: "Leaderboard", href: "/leaderboard", icon: Medal },
];

const secondaryNav = [
  { name: "Settings", href: "/settings", icon: Settings },
];

export function Sidebar({ className }: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [loadingLucky, setLoadingLucky] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { profile, signOut, user } = useAuth();
  const { isAdmin } = useAdmin();
  const { isTeacher } = useTeacher();
  const { isClassroomStudent } = useClassroomStudent();
  const { settings } = useAppSettings();
  const { isDomainWhitelisted, domainDiscount } = usePaymentAccess();

  const paidFeaturesEnabled = settings.paid_features_enabled;

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  const handleFeelingLucky = useCallback(async () => {
    if (!user) {
      toast.error("Please sign in to use this feature");
      navigate("/auth");
      return;
    }

    setLoadingLucky(true);
    try {
      // Get user's solved problems
      const { data: progress } = await supabase
        .from("user_problem_progress")
        .select("problem_id")
        .eq("user_id", user.id)
        .eq("status", "solved");

      const solvedIds = new Set(progress?.map(p => p.problem_id) || []);

      // Get all problems with leetcode links
      const { data: problems } = await supabase
        .from("problems")
        .select("id, title, leetcode_slug, difficulty")
        .not("leetcode_slug", "is", null);

      if (!problems || problems.length === 0) {
        toast.error("No problems available");
        return;
      }

      // Filter unsolved problems
      const unsolvedProblems = problems.filter(p => !solvedIds.has(p.id));

      if (unsolvedProblems.length === 0) {
        toast.success("Amazing! You've solved all problems!");
        return;
      }

      // Pick a random unsolved problem
      const randomProblem = unsolvedProblems[Math.floor(Math.random() * unsolvedProblems.length)];

      // Open in new tab
      window.open(`https://leetcode.com/problems/${randomProblem.leetcode_slug}`, "_blank");
      toast.success(`Good luck with "${randomProblem.title}"!`);
    } catch (error) {
      console.error("Error fetching random problem:", error);
      toast.error("Failed to get random problem");
    } finally {
      setLoadingLucky(false);
    }
  }, [user, navigate]);

  const currentStreak = profile?.current_streak ?? 0;
  const subscriptionPlan = profile?.subscription_plan ?? "free";
  const displayName = profile?.full_name ?? user?.email?.split("@")[0] ?? "Guest User";
  const isPaidUser = ["basic", "pro", "pro+", "lifetime"].includes(subscriptionPlan);
  const showUpgradeButton = paidFeaturesEnabled && !isPaidUser && !isDomainWhitelisted;

  // Determine plan display text
  const getPlanDisplayText = () => {
    if (isDomainWhitelisted && domainDiscount) {
      return `${domainDiscount}% Discount`;
    }
    if (subscriptionPlan === "free") {
      return "Free Trial";
    }
    return subscriptionPlan;
  };

  const SidebarContent = () => (
    <div className="flex h-full flex-col">
      {/* Logo */}
      <div className="flex h-16 items-center justify-between px-4 border-b border-sidebar-border">
        <Link to="/" className="flex items-center gap-3">
          {collapsed ? (
            <img src={codeiqOwl} alt="CodeIQ" className="h-9 w-9" />
          ) : (
            <img src={codeiqLogo} alt="CodeIQ" className="h-9" />
          )}
        </Link>
        {/* Desktop collapse button */}
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => setCollapsed(!collapsed)}
          className="hidden lg:flex text-sidebar-muted hover:text-sidebar-foreground hover:bg-sidebar-accent"
        >
          {collapsed ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <ChevronLeft className="h-4 w-4" />
          )}
        </Button>
        {/* Mobile close button */}
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => setMobileOpen(false)}
          className="lg:hidden text-sidebar-muted hover:text-sidebar-foreground hover:bg-sidebar-accent"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Streak Widget */}
      {!collapsed && (
        <div className="mx-4 mt-4 rounded-lg bg-gradient-to-r from-primary to-warning p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-card/20">
              <Flame className="h-5 w-5 text-card" />
            </div>
            <div>
              <p className="text-sm font-medium text-card/80">Current Streak</p>
              <p className="text-2xl font-bold text-card">{currentStreak} days</p>
            </div>
          </div>
        </div>
      )}

      {/* Navigation */}
      <nav className="flex-1 space-y-1 px-3 py-4">
        {navigation
          .filter((item) => {
            // Hide global leaderboard for classroom students (they have their own in My Classroom)
            if (item.href === "/leaderboard" && isClassroomStudent) return false;
            return true;
          })
          .map((item) => {
            const isActive = location.pathname === item.href;
            return (
              <Link
                key={item.name}
                to={item.href}
                onClick={() => setMobileOpen(false)}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200",
                  isActive
                    ? "bg-sidebar-accent text-sidebar-primary"
                    : "text-sidebar-muted hover:bg-sidebar-accent hover:text-sidebar-foreground"
                )}
              >
                <item.icon className={cn("h-5 w-5", isActive && "text-primary")} />
                {!collapsed && (
                  <>
                    <span className="flex-1">{item.name}</span>
                    {item.isPro && (
                      <span className="rounded bg-primary/20 px-1.5 py-0.5 text-[10px] font-bold text-primary">
                        PRO
                      </span>
                    )}
                  </>
                )}
              </Link>
            );
          })}

        {/* Random Problem Button */}
        <button
          onClick={() => {
            handleFeelingLucky();
            setMobileOpen(false);
          }}
          disabled={loadingLucky}
          className={cn(
            "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200",
            "text-sidebar-muted hover:bg-sidebar-accent hover:text-sidebar-foreground",
            loadingLucky && "opacity-50 cursor-wait"
          )}
        >
          <Shuffle className={cn("h-5 w-5", loadingLucky && "animate-spin")} />
          {!collapsed && <span>{loadingLucky ? "Finding..." : "I'm Feeling Lucky"}</span>}
        </button>

        {/* Upgrade Button for Free Users - only if paid features enabled */}
        {showUpgradeButton && !collapsed && (
          <Link
            to="/pricing"
            onClick={() => setMobileOpen(false)}
            className="mx-3 mt-2 flex items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-primary to-warning px-3 py-2.5 text-sm font-medium text-primary-foreground transition-all hover:opacity-90"
          >
            <Crown className="h-4 w-4" />
            Upgrade to Pro
          </Link>
        )}
        {showUpgradeButton && collapsed && (
          <Link
            to="/pricing"
            onClick={() => setMobileOpen(false)}
            className="mx-3 mt-2 flex items-center justify-center rounded-lg bg-gradient-to-r from-primary to-warning p-2.5 text-primary-foreground transition-all hover:opacity-90"
          >
            <Crown className="h-4 w-4" />
          </Link>
        )}
      </nav>

      {/* Secondary Navigation */}
      <div className="border-t border-sidebar-border px-3 py-4 space-y-1">
        {isTeacher && (
          <Link
            to="/teacher"
            onClick={() => setMobileOpen(false)}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200",
              location.pathname.startsWith("/teacher")
                ? "bg-sidebar-accent text-sidebar-primary"
                : "text-sidebar-muted hover:bg-sidebar-accent hover:text-sidebar-foreground"
            )}
          >
            <GraduationCap className="h-5 w-5" />
            {!collapsed && <span>Teacher Panel</span>}
          </Link>
        )}
        {isClassroomStudent && (
          <Link
            to="/student"
            onClick={() => setMobileOpen(false)}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200",
              location.pathname === "/student"
                ? "bg-sidebar-accent text-sidebar-primary"
                : "text-sidebar-muted hover:bg-sidebar-accent hover:text-sidebar-foreground"
            )}
          >
            <Users className="h-5 w-5" />
            {!collapsed && <span>My Classroom</span>}
          </Link>
        )}
        {isAdmin && (
          <Link
            to="/admin"
            onClick={() => setMobileOpen(false)}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200",
              location.pathname === "/admin"
                ? "bg-sidebar-accent text-sidebar-primary"
                : "text-sidebar-muted hover:bg-sidebar-accent hover:text-sidebar-foreground"
            )}
          >
            <Shield className="h-5 w-5" />
            {!collapsed && <span>Admin Panel</span>}
          </Link>
        )}
        {secondaryNav.map((item) => {
          const isActive = location.pathname === item.href;
          return (
            <Link
              key={item.name}
              to={item.href}
              onClick={() => setMobileOpen(false)}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200",
                isActive
                  ? "bg-sidebar-accent text-sidebar-primary"
                  : "text-sidebar-muted hover:bg-sidebar-accent hover:text-sidebar-foreground"
              )}
            >
              <item.icon className="h-5 w-5" />
              {!collapsed && <span>{item.name}</span>}
            </Link>
          );
        })}
      </div>

      {/* User Profile */}
      <div className="border-t border-sidebar-border p-4">
        <div className={cn("flex items-center gap-3", collapsed && "justify-center")}>
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-sidebar-accent">
            {profile?.avatar_url ? (
              <img
                src={profile.avatar_url}
                alt="Avatar"
                className="h-10 w-10 rounded-full object-cover"
              />
            ) : (
              <User className="h-5 w-5 text-sidebar-muted" />
            )}
          </div>
          {!collapsed && (
            <div className="flex-1 min-w-0">
              <p className="truncate text-sm font-medium text-sidebar-foreground">
                {displayName}
              </p>
              <p className="truncate text-xs text-sidebar-muted capitalize">
                {getPlanDisplayText()}
              </p>
            </div>
          )}
          {!collapsed && (
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={handleSignOut}
              className="text-sidebar-muted hover:text-sidebar-foreground hover:bg-sidebar-accent"
            >
              <LogOut className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile Menu Button */}
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setMobileOpen(true)}
        className="fixed top-4 left-4 z-50 lg:hidden bg-card shadow-md hover:bg-accent"
      >
        <Menu className="h-5 w-5" />
      </Button>

      {/* Mobile Overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-foreground/50 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Mobile Sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 w-64 transform bg-sidebar transition-transform duration-300 lg:hidden",
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <SidebarContent />
      </aside>

      {/* Desktop Sidebar */}
      <aside
        className={cn(
          "hidden lg:flex fixed inset-y-0 left-0 z-40 flex-col bg-sidebar transition-all duration-300",
          collapsed ? "w-20" : "w-64",
          className
        )}
      >
        <SidebarContent />
      </aside>
    </>
  );
}
