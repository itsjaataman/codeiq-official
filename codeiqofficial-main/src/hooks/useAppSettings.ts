import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface LandingStats {
  problems_count: string;
  companies_count: string;
  topics_count: string;
}

interface AppSettings {
  paid_features_enabled: boolean;
  invite_system_enabled: boolean;
  company_problems_enabled: boolean;
  landing_stats: LandingStats;
}

export function useAppSettings() {
  const queryClient = useQueryClient();

  const { data: settings, isLoading } = useQuery({
    queryKey: ["app-settings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("app_settings")
        .select("key, value");

      if (error) throw error;

      const settingsMap: AppSettings = {
        paid_features_enabled: true,
        invite_system_enabled: true,
        company_problems_enabled: true,
        landing_stats: {
          problems_count: "500+",
          companies_count: "50+",
          topics_count: "15+",
        },
      };

      data?.forEach((item: any) => {
        if (item.key === "paid_features_enabled") {
          settingsMap.paid_features_enabled = item.value?.enabled ?? true;
        }
        if (item.key === "invite_system_enabled") {
          settingsMap.invite_system_enabled = item.value?.enabled ?? true;
        }
        if (item.key === "company_problems_enabled") {
          settingsMap.company_problems_enabled = item.value?.enabled ?? true;
        }
        if (item.key === "landing_stats") {
          settingsMap.landing_stats = {
            problems_count: item.value?.problems_count ?? "500+",
            companies_count: item.value?.companies_count ?? "50+",
            topics_count: item.value?.topics_count ?? "15+",
          };
        }
      });

      return settingsMap;
    },
    staleTime: 1000 * 60 * 5,
  });

  const updateSetting = useMutation({
    mutationFn: async ({ key, enabled }: { key: string; enabled: boolean }) => {
      const { error } = await supabase
        .from("app_settings")
        .update({ value: { enabled } })
        .eq("key", key);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["app-settings"] });
    },
  });

  const updateLandingStats = useMutation({
    mutationFn: async (stats: LandingStats) => {
      // First check if the setting exists
      const { data: existing } = await supabase
        .from("app_settings")
        .select("id")
        .eq("key", "landing_stats")
        .maybeSingle();
      
      const jsonValue = {
        problems_count: stats.problems_count,
        companies_count: stats.companies_count,
        topics_count: stats.topics_count,
      };
      
      if (existing) {
        const { error } = await supabase
          .from("app_settings")
          .update({ value: jsonValue })
          .eq("key", "landing_stats");
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("app_settings")
          .insert([{ key: "landing_stats", value: jsonValue }]);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["app-settings"] });
    },
  });

  return {
    settings: settings ?? { paid_features_enabled: true, invite_system_enabled: true, company_problems_enabled: true, landing_stats: { problems_count: "500+", companies_count: "50+", topics_count: "15+" } },
    isLoading,
    updateSetting,
    updateLandingStats,
  };
}
