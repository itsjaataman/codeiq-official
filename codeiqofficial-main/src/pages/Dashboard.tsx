import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { StatCard } from "@/components/ui/stat-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { usePaymentAccess } from "@/hooks/usePaymentAccess";
import { supabase } from "@/integrations/supabase/client";
import { LeetCodeVerification } from "@/components/LeetCodeVerification";
import { LeetCodeGate } from "@/components/LeetCodeGate";
import { PaymentStatusBanner } from "@/components/PaymentStatusBanner";
import { LockedScreen } from "@/components/LockedScreen";
import {
  Code2,
  Flame,
  Trophy,
  TrendingUp,
  Clock,
  CheckCircle2,
  ArrowRight,
  BookOpen,
  RefreshCw,
  Loader2,
} from "lucide-react";

interface RecentActivity {
  id: string;
  problem_id: string;
  status: string;
  solved_at: string | null;
  problem: {
    title: string;
    difficulty: string;
    topic_id: string;
  } | null;
  topic_name?: string;
}

interface ReviewItem {
  id: string;
  problem_id: string;
  next_review_at: string;
  problem: {
    title: string;
    topic_id: string;
  } | null;
  topic_name?: string;
}

export default function Dashboard() {
  const { user, profile, loading } = useAuth();
  const { isLocked, paidFeaturesEnabled, isLoading: accessLoading } = usePaymentAccess();
  const navigate = useNavigate();

  // Fetch recent activity from database
  const { data: recentActivity = [] } = useQuery({
    queryKey: ["recent-activity", user?.id],
    queryFn: async () => {
      if (!user) return [];

      const { data: progress, error } = await supabase
        .from("user_problem_progress")
        .select(`
          id,
          problem_id,
          status,
          solved_at,
          problem:problems(title, difficulty, topic_id)
        `)
        .eq("user_id", user.id)
        .eq("status", "solved")
        .order("solved_at", { ascending: false })
        .limit(5);

      if (error) {
        console.error("Error fetching recent activity:", error);
        return [];
      }

      // Fetch topic names
      const topicIds = [...new Set((progress || []).map(p => p.problem?.topic_id).filter(Boolean))];
      const { data: topics } = await supabase
        .from("topics")
        .select("id, name")
        .in("id", topicIds);

      const topicMap = new Map(topics?.map(t => [t.id, t.name]) || []);

      return (progress || []).map(p => ({
        ...p,
        topic_name: p.problem?.topic_id ? topicMap.get(p.problem.topic_id) : undefined
      })) as RecentActivity[];
    },
    enabled: !!user,
  });

  // Fetch problems due for review
  const { data: reviewItems = [] } = useQuery({
    queryKey: ["review-today", user?.id],
    queryFn: async () => {
      if (!user) return [];

      const now = new Date();
      const tomorrow = new Date(now);
      tomorrow.setDate(tomorrow.getDate() + 1);

      const { data: progress, error } = await supabase
        .from("user_problem_progress")
        .select(`
          id,
          problem_id,
          next_review_at,
          problem:problems(title, topic_id)
        `)
        .eq("user_id", user.id)
        .not("next_review_at", "is", null)
        .lte("next_review_at", tomorrow.toISOString())
        .order("next_review_at", { ascending: true })
        .limit(5);

      if (error) {
        console.error("Error fetching review items:", error);
        return [];
      }

      // Fetch topic names
      const topicIds = [...new Set((progress || []).map(p => p.problem?.topic_id).filter(Boolean))];
      const { data: topics } = await supabase
        .from("topics")
        .select("id, name")
        .in("id", topicIds);

      const topicMap = new Map(topics?.map(t => [t.id, t.name]) || []);

      return (progress || []).map(p => ({
        ...p,
        topic_name: p.problem?.topic_id ? topicMap.get(p.problem.topic_id) : undefined
      })) as ReviewItem[];
    },
    enabled: !!user,
  });

  // Fetch activity data for heatmap
  const { data: activityData = [] } = useQuery({
    queryKey: ["activity-heatmap", user?.id],
    queryFn: async () => {
      if (!user) return [];

      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 35);

      const { data, error } = await supabase
        .from("user_problem_progress")
        .select("solved_at")
        .eq("user_id", user.id)
        .eq("status", "solved")
        .gte("solved_at", thirtyDaysAgo.toISOString());

      if (error) return [];

      // Count problems per day
      const counts = new Map<string, number>();
      (data || []).forEach(p => {
        if (p.solved_at) {
          const date = new Date(p.solved_at).toDateString();
          counts.set(date, (counts.get(date) || 0) + 1);
        }
      });

      // Generate last 35 days
      const days = [];
      for (let i = 34; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const count = counts.get(d.toDateString()) || 0;
        days.push({ date: d, count });
      }

      return days;
    },
    enabled: !!user,
  });

  // Redirect if not authenticated
  useEffect(() => {
    if (!loading && !user) {
      navigate("/auth");
    }
  }, [user, loading, navigate]);

  if (loading || accessLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return null;
  }

  // Show locked screen if trial expired and no paid plan
  if (paidFeaturesEnabled && isLocked) {
    return (
      <DashboardLayout title="Dashboard" subtitle="Access Locked">
        <LockedScreen 
          title="Your Trial Has Expired"
          description="Your free trial has ended. Upgrade to a paid plan to continue accessing all features and resume your learning journey."
        />
      </DashboardLayout>
    );
  }

  const stats = {
    totalSolved: profile?.total_solved ?? 0,
    easy: profile?.easy_solved ?? 0,
    medium: profile?.medium_solved ?? 0,
    hard: profile?.hard_solved ?? 0,
    ranking: profile?.leetcode_ranking ?? 0,
    contestRating: profile?.contest_rating ?? 0,
    streak: profile?.current_streak ?? 0,
    bestStreak: profile?.best_streak ?? 0,
  };

  const getDueLabel = (dateStr: string) => {
    const date = new Date(dateStr);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const reviewDate = new Date(date);
    reviewDate.setHours(0, 0, 0, 0);

    if (reviewDate <= today) return "Today";
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    if (reviewDate <= tomorrow) return "Tomorrow";
    return "Upcoming";
  };

  const todayReviewCount = reviewItems.filter(r => getDueLabel(r.next_review_at) === "Today").length;

  return (
    <LeetCodeGate>
    <DashboardLayout title="Dashboard" subtitle={`Welcome back, ${profile?.full_name ?? user.email?.split("@")[0]}!`}>
      {/* Payment Status Banner */}
      <PaymentStatusBanner />

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard
          title="Problems Solved"
          value={stats.totalSolved}
          subtitle="Total on LeetCode"
          icon={Code2}
          variant="primary"
        />
        <StatCard
          title="Current Streak"
          value={`${stats.streak} days`}
          subtitle={`Best: ${stats.bestStreak} days`}
          icon={Flame}
          variant="warning"
        />
        <StatCard
          title="Ranking"
          value={stats.ranking > 0 ? `#${stats.ranking.toLocaleString()}` : "N/A"}
          subtitle="Global ranking"
          icon={Trophy}
          variant="success"
        />
        <StatCard
          title="Contest Rating"
          value={stats.contestRating || "N/A"}
          subtitle="LeetCode contests"
          icon={TrendingUp}
          variant="info"
        />
      </div>

      {/* Main Content Grid */}
      <div className="grid lg:grid-cols-3 gap-6">
        {/* Left Column - Progress */}
        <div className="lg:col-span-2 space-y-6">
          {/* Difficulty Breakdown */}
          <div className="bg-card rounded-xl border border-border shadow-card p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-foreground">Difficulty Breakdown</h2>
              <Badge variant="secondary">
                <TrendingUp className="h-3 w-3 mr-1" />
                Track your progress
              </Badge>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center p-4 rounded-lg bg-easy/10 border border-easy/20">
                <div className="text-3xl font-bold text-easy">{stats.easy}</div>
                <div className="text-sm text-muted-foreground">Easy</div>
                <div className="mt-2 h-2 bg-easy/20 rounded-full overflow-hidden">
                  <div className="h-full bg-easy rounded-full" style={{ width: stats.totalSolved > 0 ? `${(stats.easy / stats.totalSolved) * 100}%` : "0%" }} />
                </div>
              </div>
              <div className="text-center p-4 rounded-lg bg-medium/10 border border-medium/20">
                <div className="text-3xl font-bold text-medium">{stats.medium}</div>
                <div className="text-sm text-muted-foreground">Medium</div>
                <div className="mt-2 h-2 bg-medium/20 rounded-full overflow-hidden">
                  <div className="h-full bg-medium rounded-full" style={{ width: stats.totalSolved > 0 ? `${(stats.medium / stats.totalSolved) * 100}%` : "0%" }} />
                </div>
              </div>
              <div className="text-center p-4 rounded-lg bg-hard/10 border border-hard/20">
                <div className="text-3xl font-bold text-hard">{stats.hard}</div>
                <div className="text-sm text-muted-foreground">Hard</div>
                <div className="mt-2 h-2 bg-hard/20 rounded-full overflow-hidden">
                  <div className="h-full bg-hard rounded-full" style={{ width: stats.totalSolved > 0 ? `${(stats.hard / stats.totalSolved) * 100}%` : "0%" }} />
                </div>
              </div>
            </div>
          </div>

          {/* Recent Activity */}
          <div className="bg-card rounded-xl border border-border shadow-card p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-foreground">Recent Activity</h2>
              <Button variant="ghost" size="sm" className="gap-1" onClick={() => navigate("/topics")}>
                View All <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
            {recentActivity.length > 0 ? (
              <div className="space-y-3">
                {recentActivity.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between p-3 rounded-lg hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <CheckCircle2 className="h-5 w-5 text-success" />
                      <div>
                        <p className="font-medium text-foreground">{item.problem?.title || "Unknown"}</p>
                        <p className="text-xs text-muted-foreground">{item.topic_name || "Unknown topic"}</p>
                      </div>
                    </div>
                    <Badge
                      variant={
                        item.problem?.difficulty === "easy"
                          ? "easy"
                          : item.problem?.difficulty === "medium"
                          ? "medium"
                          : "hard"
                      }
                    >
                      {item.problem?.difficulty ? item.problem.difficulty.charAt(0).toUpperCase() + item.problem.difficulty.slice(1) : "N/A"}
                    </Badge>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <Code2 className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>No solved problems yet</p>
                <Button variant="link" size="sm" onClick={() => navigate("/topics")}>
                  Start practicing
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* Right Column - Quick Actions & Reviews */}
        <div className="space-y-6">
          {/* LeetCode Verification */}
          <LeetCodeVerification />

          {/* Quick Actions */}
          <div className="bg-card rounded-xl border border-border shadow-card p-6">
            <h2 className="text-lg font-semibold text-foreground mb-4">Quick Actions</h2>
            <div className="space-y-3">
              <Button variant="default" className="w-full justify-start gap-3" onClick={() => navigate("/topics")}>
                <BookOpen className="h-4 w-4" />
                Continue Learning
              </Button>
              <Button variant="outline" className="w-full justify-start gap-3" onClick={() => navigate("/revision")}>
                <RefreshCw className="h-4 w-4" />
                Review Session
              </Button>
            </div>
          </div>

          {/* Review Today */}
          <div className="bg-card rounded-xl border border-border shadow-card p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-foreground">Review Today</h2>
              <Badge variant="warning">
                <Clock className="h-3 w-3 mr-1" />
                {todayReviewCount} due
              </Badge>
            </div>
            {reviewItems.length > 0 ? (
              <>
                <div className="space-y-3">
                  {reviewItems.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-start justify-between p-3 rounded-lg bg-muted/30 border border-border"
                    >
                      <div>
                        <p className="font-medium text-foreground text-sm">{item.problem?.title || "Unknown"}</p>
                        <p className="text-xs text-muted-foreground">{item.topic_name || "Unknown topic"}</p>
                      </div>
                      <Badge variant={getDueLabel(item.next_review_at) === "Today" ? "warning" : "secondary"} className="text-xs">
                        {getDueLabel(item.next_review_at)}
                      </Badge>
                    </div>
                  ))}
                </div>
                <Button variant="ghost" size="sm" className="w-full mt-4 gap-1" onClick={() => navigate("/revision")}>
                  Start Review Session <ArrowRight className="h-4 w-4" />
                </Button>
              </>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">
                No problems due for review
              </p>
            )}
          </div>

          {/* Activity Heatmap */}
          <div className="bg-card rounded-xl border border-border shadow-card p-6">
            <h2 className="text-lg font-semibold text-foreground mb-4">Activity Heatmap</h2>
            <div className="grid grid-cols-7 gap-1">
              {activityData.map((day, i) => {
                const intensity = day.count === 0 ? 0 : day.count >= 3 ? 3 : day.count;
                return (
                  <div
                    key={i}
                    title={`${day.date.toDateString()}: ${day.count} solved`}
                    className={`h-4 w-4 rounded-sm ${
                      intensity === 0
                        ? "bg-muted"
                        : intensity === 1
                        ? "bg-primary/30"
                        : intensity === 2
                        ? "bg-primary/60"
                        : "bg-primary"
                    }`}
                  />
                );
              })}
            </div>
            <div className="flex items-center justify-end gap-2 mt-3 text-xs text-muted-foreground">
              <span>Less</span>
              <div className="flex gap-0.5">
                <div className="h-3 w-3 rounded-sm bg-muted" />
                <div className="h-3 w-3 rounded-sm bg-primary/30" />
                <div className="h-3 w-3 rounded-sm bg-primary/60" />
                <div className="h-3 w-3 rounded-sm bg-primary" />
              </div>
              <span>More</span>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
    </LeetCodeGate>
  );
}
