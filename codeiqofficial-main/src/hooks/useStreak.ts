import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

/**
 * Hook to calculate and update user streaks based on problem-solving activity.
 * A streak is the number of consecutive days a user has solved at least one problem.
 */
export function useStreak() {
  const { user, refreshProfile } = useAuth();

  /**
   * Calculate streak from solved_at dates
   * Returns { currentStreak, bestStreak }
   */
  const calculateStreak = (solvedDates: string[]): { currentStreak: number; bestStreak: number } => {
    if (solvedDates.length === 0) {
      return { currentStreak: 0, bestStreak: 0 };
    }

    // Get unique dates (only date part, ignore time)
    const uniqueDates = [...new Set(
      solvedDates.map(date => {
        const d = new Date(date);
        return new Date(d.getFullYear(), d.getMonth(), d.getDate()).toISOString().split('T')[0];
      })
    )].sort((a, b) => new Date(b).getTime() - new Date(a).getTime()); // Sort descending

    const today = new Date();
    const todayStr = new Date(today.getFullYear(), today.getMonth(), today.getDate()).toISOString().split('T')[0];
    
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate()).toISOString().split('T')[0];

    // Check if streak is active (solved today or yesterday)
    const mostRecentDate = uniqueDates[0];
    const streakIsActive = mostRecentDate === todayStr || mostRecentDate === yesterdayStr;

    if (!streakIsActive) {
      // Streak is broken, calculate best streak from history
      const bestStreak = calculateLongestStreak(uniqueDates);
      return { currentStreak: 0, bestStreak };
    }

    // Calculate current streak
    let currentStreak = 0;
    let checkDate = mostRecentDate === todayStr ? today : yesterday;

    for (const dateStr of uniqueDates) {
      const checkDateStr = new Date(checkDate.getFullYear(), checkDate.getMonth(), checkDate.getDate()).toISOString().split('T')[0];
      
      if (dateStr === checkDateStr) {
        currentStreak++;
        checkDate.setDate(checkDate.getDate() - 1);
      } else if (dateStr < checkDateStr) {
        // Gap found, streak ends
        break;
      }
    }

    // Calculate best streak from all history
    const bestStreak = Math.max(currentStreak, calculateLongestStreak(uniqueDates));

    return { currentStreak, bestStreak };
  };

  /**
   * Calculate the longest streak from an array of date strings
   */
  const calculateLongestStreak = (sortedDatesDesc: string[]): number => {
    if (sortedDatesDesc.length === 0) return 0;
    
    // Sort ascending for easier calculation
    const dates = [...sortedDatesDesc].sort((a, b) => new Date(a).getTime() - new Date(b).getTime());
    
    let longestStreak = 1;
    let currentStreak = 1;

    for (let i = 1; i < dates.length; i++) {
      const prevDate = new Date(dates[i - 1]);
      const currDate = new Date(dates[i]);
      
      // Calculate difference in days
      const diffTime = currDate.getTime() - prevDate.getTime();
      const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

      if (diffDays === 1) {
        currentStreak++;
        longestStreak = Math.max(longestStreak, currentStreak);
      } else if (diffDays > 1) {
        currentStreak = 1;
      }
      // If diffDays === 0, it's same day, continue
    }

    return longestStreak;
  };

  /**
   * Update streak for the current user
   * Call this after marking a problem as solved
   */
  const updateStreak = async (): Promise<{ currentStreak: number; bestStreak: number } | null> => {
    if (!user) return null;

    try {
      // Fetch all solved dates for the user
      const { data: progress, error } = await supabase
        .from("user_problem_progress")
        .select("solved_at")
        .eq("user_id", user.id)
        .eq("status", "solved")
        .not("solved_at", "is", null);

      if (error) {
        console.error("Error fetching progress for streak:", error);
        return null;
      }

      const solvedDates = progress?.map(p => p.solved_at!).filter(Boolean) || [];
      const { currentStreak, bestStreak } = calculateStreak(solvedDates);

      // Get current profile values
      const { data: profile } = await supabase
        .from("profiles")
        .select("best_streak")
        .eq("user_id", user.id)
        .single();

      // Only update best_streak if new value is higher
      const newBestStreak = Math.max(bestStreak, profile?.best_streak || 0);

      // Update profile with new streak values
      const { error: updateError } = await supabase
        .from("profiles")
        .update({
          current_streak: currentStreak,
          best_streak: newBestStreak,
        })
        .eq("user_id", user.id);

      if (updateError) {
        console.error("Error updating streak:", updateError);
        return null;
      }

      // Refresh profile context
      await refreshProfile();

      console.log(`Streak updated: current=${currentStreak}, best=${newBestStreak}`);
      return { currentStreak, bestStreak: newBestStreak };
    } catch (error) {
      console.error("Error in updateStreak:", error);
      return null;
    }
  };

  return {
    updateStreak,
    calculateStreak,
  };
}
