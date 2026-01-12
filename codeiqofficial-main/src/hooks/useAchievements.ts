import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useEffect } from "react";

interface Achievement {
  id: string;
  key: string;
  name: string;
  description: string;
  icon: string;
  rarity: string;
  requirement_type: string;
  requirement_value: number;
}

interface UserAchievement {
  id: string;
  achievement_id: string;
  unlocked_at: string;
}

interface Profile {
  total_solved: number;
  easy_solved: number;
  medium_solved: number;
  hard_solved: number;
  current_streak: number;
  best_streak: number;
}

export function useAchievements() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Fetch all achievements
  const { data: achievements = [], isLoading: achievementsLoading } = useQuery({
    queryKey: ["achievements"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("achievements")
        .select("*")
        .order("requirement_value", { ascending: true });
      
      if (error) throw error;
      return data as Achievement[];
    },
  });

  // Fetch user's unlocked achievements
  const { data: userAchievements = [], isLoading: userAchievementsLoading } = useQuery({
    queryKey: ["user-achievements", user?.id],
    queryFn: async () => {
      if (!user) return [];
      
      const { data, error } = await supabase
        .from("user_achievements")
        .select("*")
        .eq("user_id", user.id);
      
      if (error) throw error;
      return data as UserAchievement[];
    },
    enabled: !!user,
  });

  // Fetch verified progress - only count leetcode_verified problems
  const { data: verifiedProgress } = useQuery({
    queryKey: ["verified-progress", user?.id],
    queryFn: async () => {
      if (!user) return null;
      
      // Count only leetcode_verified problems for achievements
      const { data, error } = await supabase
        .from("user_problem_progress")
        .select(`
          problem_id,
          leetcode_verified,
          problem:problems(difficulty)
        `)
        .eq("user_id", user.id)
        .eq("status", "solved")
        .eq("leetcode_verified", true);
      
      if (error) throw error;
      
      const counts = {
        total_solved: 0,
        easy_solved: 0,
        medium_solved: 0,
        hard_solved: 0,
      };
      
      (data || []).forEach((p: any) => {
        counts.total_solved++;
        const difficulty = p.problem?.difficulty;
        if (difficulty === 'easy') counts.easy_solved++;
        else if (difficulty === 'medium') counts.medium_solved++;
        else if (difficulty === 'hard') counts.hard_solved++;
      });
      
      return counts;
    },
    enabled: !!user,
  });

  // Fetch user profile for streak checking
  const { data: profile } = useQuery({
    queryKey: ["profile", user?.id],
    queryFn: async () => {
      if (!user) return null;
      
      const { data, error } = await supabase
        .from("profiles")
        .select("current_streak, best_streak")
        .eq("user_id", user.id)
        .single();
      
      if (error) throw error;
      return data as { current_streak: number; best_streak: number };
    },
    enabled: !!user,
  });

  // Mutation to unlock achievement
  const unlockAchievement = useMutation({
    mutationFn: async (achievementId: string) => {
      if (!user) throw new Error("Not authenticated");
      
      const { error } = await supabase
        .from("user_achievements")
        .insert({ user_id: user.id, achievement_id: achievementId });
      
      if (error && error.code !== "23505") throw error; // Ignore duplicate key errors
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user-achievements", user?.id] });
    },
  });

  // Check and unlock achievements based on verified progress only
  const checkAndUnlockAchievements = async () => {
    if (!user || !verifiedProgress || !achievements.length) return;

    const unlockedIds = new Set(userAchievements.map(ua => ua.achievement_id));

    for (const achievement of achievements) {
      if (unlockedIds.has(achievement.id)) continue;

      let shouldUnlock = false;
      
      switch (achievement.requirement_type) {
        case "total_solved":
          shouldUnlock = verifiedProgress.total_solved >= achievement.requirement_value;
          break;
        case "easy_solved":
          shouldUnlock = verifiedProgress.easy_solved >= achievement.requirement_value;
          break;
        case "medium_solved":
          shouldUnlock = verifiedProgress.medium_solved >= achievement.requirement_value;
          break;
        case "hard_solved":
          shouldUnlock = verifiedProgress.hard_solved >= achievement.requirement_value;
          break;
        case "streak":
          shouldUnlock = profile ? Math.max(profile.current_streak || 0, profile.best_streak || 0) >= achievement.requirement_value : false;
          break;
      }

      if (shouldUnlock) {
        await unlockAchievement.mutateAsync(achievement.id);
      }
    }
  };

  // Auto-check achievements when verified progress changes
  useEffect(() => {
    if (verifiedProgress && achievements.length) {
      checkAndUnlockAchievements();
    }
  }, [verifiedProgress?.total_solved, profile?.current_streak, achievements.length]);

  // Combine data for display - use verified progress
  const combinedAchievements = achievements.map(achievement => {
    const userAchievement = userAchievements.find(ua => ua.achievement_id === achievement.id);
    
    let progress = 0;
    if (verifiedProgress) {
      switch (achievement.requirement_type) {
        case "total_solved":
          progress = verifiedProgress.total_solved;
          break;
        case "easy_solved":
          progress = verifiedProgress.easy_solved;
          break;
        case "medium_solved":
          progress = verifiedProgress.medium_solved;
          break;
        case "hard_solved":
          progress = verifiedProgress.hard_solved;
          break;
        case "streak":
          progress = profile ? Math.max(profile.current_streak || 0, profile.best_streak || 0) : 0;
          break;
      }
    }

    return {
      ...achievement,
      unlocked: !!userAchievement,
      unlockedAt: userAchievement?.unlocked_at,
      progress: Math.min(progress, achievement.requirement_value),
      total: achievement.requirement_value,
    };
  });

  const unlockedCount = userAchievements.length;
  const rarityCounts = {
    Common: combinedAchievements.filter(a => a.unlocked && a.rarity === "Common").length,
    Uncommon: combinedAchievements.filter(a => a.unlocked && a.rarity === "Uncommon").length,
    Rare: combinedAchievements.filter(a => a.unlocked && a.rarity === "Rare").length,
    Epic: combinedAchievements.filter(a => a.unlocked && a.rarity === "Epic").length,
    Legendary: combinedAchievements.filter(a => a.unlocked && a.rarity === "Legendary").length,
  };

  return {
    achievements: combinedAchievements,
    unlockedCount,
    totalCount: achievements.length,
    rarityCounts,
    isLoading: achievementsLoading || userAchievementsLoading,
    checkAndUnlockAchievements,
  };
}
