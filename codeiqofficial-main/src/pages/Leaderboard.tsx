import { useQuery } from "@tanstack/react-query";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { usePaymentAccess } from "@/hooks/usePaymentAccess";
import { useClassroomStudent } from "@/hooks/useClassroomStudent";
import { LockedScreen } from "@/components/LockedScreen";
import { LeaderboardSkeleton } from "@/components/LeaderboardSkeleton";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Trophy,
  Flame,
  Medal,
  Crown,
  TrendingUp,
  Code2,
  GraduationCap,
  Users,
  Target,
} from "lucide-react";

interface LeaderboardUser {
  id: string;
  user_id: string;
  full_name: string | null;
  avatar_url: string | null;
  total_solved: number;
  easy_solved: number;
  medium_solved: number;
  hard_solved: number;
  current_streak: number;
  best_streak: number;
  leetcode_username: string | null;
}

const rankStyles = [
  { bg: "bg-warning/10", border: "border-warning/30", text: "text-warning", icon: Crown },
  { bg: "bg-muted", border: "border-border", text: "text-muted-foreground", icon: Medal },
  { bg: "bg-primary/10", border: "border-primary/30", text: "text-primary", icon: Medal },
];

export default function Leaderboard() {
  const { user } = useAuth();
  const { isLocked, isLoading: paymentLoading, paidFeaturesEnabled } = usePaymentAccess();
  const { isClassroomStudent, classroom, teacher } = useClassroomStudent();

  // Fetch classroom leaderboard for classroom students
  const { data: classroomLeaderboard = [], isLoading: classroomLoading } = useQuery({
    queryKey: ["classroom-leaderboard-full", classroom?.id],
    queryFn: async () => {
      const { data: students, error } = await supabase
        .from("classroom_students")
        .select(`
          id,
          user_id,
          profiles:user_id (
            id,
            user_id,
            full_name,
            avatar_url,
            total_solved,
            easy_solved,
            medium_solved,
            hard_solved,
            current_streak,
            best_streak,
            leetcode_username
          )
        `)
        .eq("classroom_id", classroom?.id || "")
        .eq("is_active", true);

      if (error) throw error;

      // Transform data to match LeaderboardUser interface
      return (students || [])
        .map((s: any) => ({
          id: s.profiles?.id || s.id,
          user_id: s.user_id,
          full_name: s.profiles?.full_name || null,
          avatar_url: s.profiles?.avatar_url || null,
          total_solved: s.profiles?.total_solved || 0,
          easy_solved: s.profiles?.easy_solved || 0,
          medium_solved: s.profiles?.medium_solved || 0,
          hard_solved: s.profiles?.hard_solved || 0,
          current_streak: s.profiles?.current_streak || 0,
          best_streak: s.profiles?.best_streak || 0,
          leetcode_username: s.profiles?.leetcode_username || null,
        }))
        .sort((a: LeaderboardUser, b: LeaderboardUser) => b.total_solved - a.total_solved);
    },
    enabled: !!classroom?.id && isClassroomStudent,
  });

  // Fetch admin and teacher user IDs to exclude from leaderboard using RPC function
  const { data: excludedUserIds = [], isLoading: excludedLoading } = useQuery({
    queryKey: ["excluded-user-ids"],
    queryFn: async () => {
      const { data, error } = await supabase
        .rpc("get_excluded_leaderboard_user_ids");
      
      if (error) {
        console.error("Error fetching excluded user IDs:", error);
        return [];
      }
      return (data || []) as string[];
    },
    enabled: !isClassroomStudent,
  });

  const { data: problemsLeaderboard = [], isLoading: problemsLoading } = useQuery({
    queryKey: ["leaderboard", "problems", excludedUserIds],
    queryFn: async () => {
      let query = supabase
        .from("profiles")
        .select("id, user_id, full_name, avatar_url, total_solved, easy_solved, medium_solved, hard_solved, current_streak, best_streak, leetcode_username")
        .order("total_solved", { ascending: false })
        .limit(50); // Fetch more to filter out excluded users

      const { data, error } = await query;
      if (error) throw error;
      
      // Filter out admin and teacher users client-side
      const filtered = (data || []).filter(p => !excludedUserIds.includes(p.user_id));
      return filtered.slice(0, 20) as LeaderboardUser[];
    },
    enabled: !isClassroomStudent && !excludedLoading,
  });

  const { data: streakLeaderboard = [], isLoading: streakLoading } = useQuery({
    queryKey: ["leaderboard", "streak", excludedUserIds],
    queryFn: async () => {
      let query = supabase
        .from("profiles")
        .select("id, user_id, full_name, avatar_url, total_solved, easy_solved, medium_solved, hard_solved, current_streak, best_streak, leetcode_username")
        .order("best_streak", { ascending: false })
        .limit(50); // Fetch more to filter out excluded users

      const { data, error } = await query;
      if (error) throw error;
      
      // Filter out admin and teacher users client-side
      const filtered = (data || []).filter(p => !excludedUserIds.includes(p.user_id));
      return filtered.slice(0, 20) as LeaderboardUser[];
    },
    enabled: !isClassroomStudent && !excludedLoading,
  });

  // Fetch current user's rank if not in top 20
  const { data: userProblemsRank } = useQuery({
    queryKey: ["user-problems-rank", user?.id, excludedUserIds],
    queryFn: async () => {
      if (!user?.id) return null;
      
      // Don't show rank if user is admin/teacher
      if (excludedUserIds.includes(user.id)) return null;
      
      // Check if user is in top 20
      const isInTop20 = problemsLeaderboard.some(u => u.user_id === user.id);
      if (isInTop20) return null;

      // Get user's profile
      const { data: userProfile, error: profileError } = await supabase
        .from("profiles")
        .select("id, user_id, full_name, avatar_url, total_solved, easy_solved, medium_solved, hard_solved, current_streak, best_streak, leetcode_username")
        .eq("user_id", user.id)
        .single();

      if (profileError || !userProfile) return null;

      // Count users with more problems solved (excluding admins/teachers)
      const { data: betterProfiles } = await supabase
        .from("profiles")
        .select("user_id")
        .gt("total_solved", userProfile.total_solved || 0);

      const filteredCount = (betterProfiles || []).filter(p => !excludedUserIds.includes(p.user_id)).length;

      return {
        rank: filteredCount + 1,
        profile: userProfile as LeaderboardUser,
      };
    },
    enabled: !isClassroomStudent && !!user?.id && problemsLeaderboard.length > 0 && !excludedLoading,
  });

  const { data: userStreakRank } = useQuery({
    queryKey: ["user-streak-rank", user?.id, excludedUserIds],
    queryFn: async () => {
      if (!user?.id) return null;
      
      // Don't show rank if user is admin/teacher
      if (excludedUserIds.includes(user.id)) return null;
      
      // Check if user is in top 20
      const isInTop20 = streakLeaderboard.some(u => u.user_id === user.id);
      if (isInTop20) return null;

      // Get user's profile
      const { data: userProfile, error: profileError } = await supabase
        .from("profiles")
        .select("id, user_id, full_name, avatar_url, total_solved, easy_solved, medium_solved, hard_solved, current_streak, best_streak, leetcode_username")
        .eq("user_id", user.id)
        .single();

      if (profileError || !userProfile) return null;

      // Count users with better streak (excluding admins/teachers)
      const { data: betterProfiles } = await supabase
        .from("profiles")
        .select("user_id")
        .gt("best_streak", userProfile.best_streak || 0);

      const filteredCount = (betterProfiles || []).filter(p => !excludedUserIds.includes(p.user_id)).length;

      return {
        rank: filteredCount + 1,
        profile: userProfile as LeaderboardUser,
      };
    },
    enabled: !isClassroomStudent && !!user?.id && streakLeaderboard.length > 0 && !excludedLoading,
  });

  // Show locked screen if trial expired and no paid plan (moved after all hooks)
  if (paidFeaturesEnabled && isLocked && !paymentLoading) {
    return (
      <DashboardLayout title="Leaderboard" subtitle="See how you rank among others">
        <LockedScreen />
      </DashboardLayout>
    );
  }

  const getInitials = (name: string | null, username: string | null) => {
    if (name) return name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
    if (username) return username.slice(0, 2).toUpperCase();
    return "??";
  };

  const renderLeaderboardRow = (entry: LeaderboardUser, index: number, type: "problems" | "streak", customRank?: number) => {
    const isCurrentUser = entry.user_id === user?.id;
    const rank = customRank || index + 1;
    const isTopThree = rank <= 3;
    const style = isTopThree ? rankStyles[rank - 1] : null;

    return (
      <div
        key={entry.id}
        className={`flex items-center gap-4 p-4 rounded-xl transition-all animate-fade-in ${
          isCurrentUser
            ? "bg-primary/10 border-2 border-primary ring-2 ring-primary/20"
            : isTopThree
            ? `${style?.bg} border ${style?.border}`
            : "bg-card border border-border hover:border-primary/20"
        }`}
        style={{ animationDelay: `${index * 30}ms` }}
      >
        {/* Rank */}
        <div className={`flex h-10 w-10 items-center justify-center rounded-full font-bold ${
          isTopThree ? `${style?.bg} ${style?.text}` : isCurrentUser ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
        }`}>
          {isTopThree && style ? (
            <style.icon className="h-5 w-5" />
          ) : (
            <span className="text-sm">{rank}</span>
          )}
        </div>

        {/* User Info */}
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <Avatar className={`h-10 w-10 ${isCurrentUser ? "ring-2 ring-primary" : ""}`}>
            <AvatarImage src={entry.avatar_url || undefined} />
            <AvatarFallback className="bg-primary/10 text-primary text-sm">
              {getInitials(entry.full_name, entry.leetcode_username)}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className={`font-medium truncate ${isCurrentUser ? "text-primary" : "text-foreground"}`}>
              {entry.full_name || entry.leetcode_username || "Anonymous Coder"}
              {isCurrentUser && (
                <Badge variant="default" className="ml-2 text-[10px] py-0 px-1.5">You</Badge>
              )}
            </p>
            {entry.leetcode_username && (
              <p className="text-xs text-muted-foreground truncate">@{entry.leetcode_username}</p>
            )}
          </div>
        </div>

        {/* Stats */}
        {type === "problems" ? (
          <div className="flex items-center gap-4">
            <div className="hidden sm:flex items-center gap-2 text-xs">
              <Badge variant="easy" className="text-[10px]">{entry.easy_solved} E</Badge>
              <Badge variant="medium" className="text-[10px]">{entry.medium_solved} M</Badge>
              <Badge variant="hard" className="text-[10px]">{entry.hard_solved} H</Badge>
            </div>
            <div className="flex items-center gap-2 min-w-[80px] justify-end">
              <Code2 className="h-4 w-4 text-primary" />
              <span className="font-bold text-foreground">{entry.total_solved}</span>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-4">
            <div className="hidden sm:flex items-center gap-2 text-xs text-muted-foreground">
              <span>Current: {entry.current_streak} days</span>
            </div>
            <div className="flex items-center gap-2 min-w-[80px] justify-end">
              <Flame className="h-4 w-4 text-warning" />
              <span className="font-bold text-foreground">{entry.best_streak} days</span>
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderUserRankCard = (rankData: { rank: number; profile: LeaderboardUser } | null | undefined, type: "problems" | "streak") => {
    if (!rankData) return null;

    return (
      <div className="mt-6 pt-6 border-t border-dashed border-border">
        <div className="flex items-center gap-2 mb-3 text-muted-foreground">
          <Target className="h-4 w-4" />
          <span className="text-sm font-medium">Your Position</span>
        </div>
        {renderLeaderboardRow(rankData.profile, 0, type, rankData.rank)}
      </div>
    );
  };

  // Show classroom leaderboard for classroom students
  if (isClassroomStudent) {
    return (
      <DashboardLayout
        title="Classroom Leaderboard"
        subtitle={`${classroom?.name} • Teacher: ${teacher?.name}`}
      >
        {/* Classroom Stats Header */}
        <div className="bg-card rounded-xl border border-border shadow-card p-6 mb-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-success/10">
                <GraduationCap className="h-8 w-8 text-success" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-foreground">Classroom Rankings</h2>
                <p className="text-muted-foreground">Compete with your classmates</p>
              </div>
            </div>
            <div className="flex gap-6 text-center">
              <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary/10">
                <Users className="h-5 w-5 text-primary" />
                <div>
                  <div className="text-lg font-bold text-foreground">{classroomLeaderboard.length}</div>
                  <div className="text-xs text-muted-foreground">Students</div>
                </div>
              </div>
              <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-success/10">
                <TrendingUp className="h-5 w-5 text-success" />
                <div>
                  <div className="text-lg font-bold text-foreground">
                    {classroomLeaderboard.reduce((sum, u) => sum + u.total_solved, 0)}
                  </div>
                  <div className="text-xs text-muted-foreground">Total Solved</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Classroom Leaderboard */}
        <Tabs defaultValue="problems" className="w-full">
          <TabsList className="mb-6">
            <TabsTrigger value="problems" className="gap-2">
              <Code2 className="h-4 w-4" />
              Problems Solved
            </TabsTrigger>
            <TabsTrigger value="streak" className="gap-2">
              <Flame className="h-4 w-4" />
              Best Streak
            </TabsTrigger>
          </TabsList>

          <TabsContent value="problems">
            {classroomLoading ? (
              <LeaderboardSkeleton />
            ) : classroomLeaderboard.length === 0 ? (
              <div className="text-center py-20 text-muted-foreground">
                <Trophy className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No classmates on the leaderboard yet.</p>
                <p className="text-sm">Be the first to solve problems!</p>
              </div>
            ) : (
              <div className="space-y-3">
                {classroomLeaderboard.map((entry, index) =>
                  renderLeaderboardRow(entry, index, "problems")
                )}
              </div>
            )}
          </TabsContent>

          <TabsContent value="streak">
            {classroomLoading ? (
              <LeaderboardSkeleton />
            ) : classroomLeaderboard.length === 0 ? (
              <div className="text-center py-20 text-muted-foreground">
                <Flame className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No streak data yet.</p>
                <p className="text-sm">Start your streak today!</p>
              </div>
            ) : (
              <div className="space-y-3">
                {[...classroomLeaderboard]
                  .sort((a, b) => b.best_streak - a.best_streak)
                  .map((entry, index) =>
                    renderLeaderboardRow(entry, index, "streak")
                  )}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </DashboardLayout>
    );
  }

  // Show global leaderboard for regular users
  return (
    <DashboardLayout
      title="Leaderboard"
      subtitle="See how you stack up against other coders"
    >
      {/* Stats Header */}
      <div className="bg-card rounded-xl border border-border shadow-card p-6 mb-6">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-warning/10">
              <Trophy className="h-8 w-8 text-warning" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-foreground">Global Rankings</h2>
              <p className="text-muted-foreground">Compete with coders worldwide</p>
            </div>
          </div>
          <div className="flex gap-6 text-center">
            <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary/10">
              <Code2 className="h-5 w-5 text-primary" />
              <div>
                <div className="text-lg font-bold text-foreground">{problemsLeaderboard.length}</div>
                <div className="text-xs text-muted-foreground">Top Coders</div>
              </div>
            </div>
            <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-warning/10">
              <TrendingUp className="h-5 w-5 text-warning" />
              <div>
                <div className="text-lg font-bold text-foreground">
                  {problemsLeaderboard.reduce((sum, u) => sum + u.total_solved, 0)}
                </div>
                <div className="text-xs text-muted-foreground">Total Solved</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Leaderboard Tabs */}
      <Tabs defaultValue="problems" className="w-full">
        <TabsList className="mb-6">
          <TabsTrigger value="problems" className="gap-2">
            <Code2 className="h-4 w-4" />
            Problems Solved
          </TabsTrigger>
          <TabsTrigger value="streak" className="gap-2">
            <Flame className="h-4 w-4" />
            Best Streak
          </TabsTrigger>
        </TabsList>

        <TabsContent value="problems">
          {problemsLoading ? (
            <LeaderboardSkeleton />
          ) : problemsLeaderboard.length === 0 ? (
            <div className="text-center py-20 text-muted-foreground">
              <Trophy className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No users on the leaderboard yet.</p>
              <p className="text-sm">Be the first to solve problems!</p>
            </div>
          ) : (
            <>
              <div className="space-y-3">
                {problemsLeaderboard.map((entry, index) =>
                  renderLeaderboardRow(entry, index, "problems")
                )}
              </div>
              {renderUserRankCard(userProblemsRank, "problems")}
            </>
          )}
        </TabsContent>

        <TabsContent value="streak">
          {streakLoading ? (
            <LeaderboardSkeleton />
          ) : streakLeaderboard.length === 0 ? (
            <div className="text-center py-20 text-muted-foreground">
              <Flame className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No streak data yet.</p>
              <p className="text-sm">Start your streak today!</p>
            </div>
          ) : (
            <>
              <div className="space-y-3">
                {streakLeaderboard.map((entry, index) =>
                  renderLeaderboardRow(entry, index, "streak")
                )}
              </div>
              {renderUserRankCard(userStreakRank, "streak")}
            </>
          )}
        </TabsContent>
      </Tabs>
    </DashboardLayout>
  );
}