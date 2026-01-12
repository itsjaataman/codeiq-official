import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";

interface LeetCodeStats {
  totalSolved: number;
  easySolved: number;
  mediumSolved: number;
  hardSolved: number;
  ranking: number | null;
  contestRating: number | null;
}

interface VerificationResult {
  success: boolean;
  token?: string;
  instruction?: string;
  currentName?: string;
  verified?: boolean;
  message?: string;
}

export function useLeetCode() {
  const { refreshProfile } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  const syncStats = async (): Promise<LeetCodeStats | null> => {
    setLoading(true);
    try {
      const { data: result, error: invokeError } = await supabase.functions.invoke(
        "leetcode?action=sync-stats"
      );

      if (invokeError) {
        toast({
          variant: "destructive",
          title: "Sync failed",
          description: invokeError.message || "Failed to sync LeetCode stats",
        });
        return null;
      }

      if (result?.error) {
        toast({
          variant: "destructive",
          title: "Sync failed",
          description: result.error,
        });
        return null;
      }

      await refreshProfile();
      toast({
        title: "Stats synced!",
        description: "Your LeetCode statistics have been updated.",
      });

      return result.stats;
    } catch (error) {
      console.error("Sync error:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to sync stats. Please try again.",
      });
      return null;
    } finally {
      setLoading(false);
    }
  };

  const startVerification = async (username: string): Promise<VerificationResult> => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke(
        "leetcode?action=verify-username",
        { body: { username } }
      );

      if (error) {
        return { success: false, message: error.message };
      }

      if (data?.error) {
        return { success: false, message: data.error };
      }

      return {
        success: true,
        token: data.token,
        instruction: data.instruction,
        currentName: data.currentName,
      };
    } catch (error) {
      console.error("Verification error:", error);
      return { success: false, message: "Failed to start verification" };
    } finally {
      setLoading(false);
    }
  };

  const completeVerification = async (token: string): Promise<VerificationResult> => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke(
        "leetcode?action=complete-verification",
        { body: { token } }
      );

      if (error) {
        return { success: false, message: error.message };
      }

      if (data?.verified) {
        await refreshProfile();
        toast({
          title: "Verified!",
          description: "Your LeetCode account has been verified successfully.",
        });
        return { success: true, verified: true, message: data.message };
      }

      return { success: false, verified: false, message: data.message };
    } catch (error) {
      console.error("Verification error:", error);
      return { success: false, message: "Failed to complete verification" };
    } finally {
      setLoading(false);
    }
  };

  const verifyProblem = async (
    problemSlug: string,
    problemId?: string,
    problemTitle?: string
  ): Promise<boolean> => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke(
        "leetcode?action=verify-problem",
        { body: { problemSlug, problemId, problemTitle } }
      );

      if (error || data?.error) {
        toast({
          variant: "destructive",
          title: "Verification failed",
          description: data?.error || error?.message || "Could not verify problem",
        });
        return false;
      }

      return data?.verified || false;
    } catch (error) {
      console.error("Problem verification error:", error);
      return false;
    } finally {
      setLoading(false);
    }
  };

  const getLeetCodeProfile = async (username: string): Promise<LeetCodeStats | null> => {
    try {
      const { data, error } = await supabase.functions.invoke(
        `leetcode?action=get-profile&username=${encodeURIComponent(username)}`
      );

      if (error || data?.error) {
        return null;
      }

      return {
        totalSolved: data.totalSolved,
        easySolved: data.easySolved,
        mediumSolved: data.mediumSolved,
        hardSolved: data.hardSolved,
        ranking: data.ranking,
        contestRating: data.contestRating,
      };
    } catch (error) {
      console.error("Profile fetch error:", error);
      return null;
    }
  };

  return {
    loading,
    syncStats,
    startVerification,
    completeVerification,
    verifyProblem,
    getLeetCodeProfile,
  };
}
