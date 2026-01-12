import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useEffect, useState } from "react";

export function useTeacher() {
  const { user, profile } = useAuth();
  const queryClient = useQueryClient();
  const [isLinking, setIsLinking] = useState(false);

  // Try to link teacher account if user email matches a teacher entry
  useEffect(() => {
    const linkTeacherAccount = async () => {
      if (!user || !profile?.email) return;

      setIsLinking(true);
      try {
        // Check if there's an unlinked teacher with this email
        const { data: teacher, error } = await supabase
          .from("teachers")
          .select("*")
          .eq("email", profile.email.toLowerCase())
          .is("user_id", null)
          .maybeSingle();

        if (teacher && !error) {
          // Link the teacher account
          await supabase
            .from("teachers")
            .update({ user_id: user.id })
            .eq("id", teacher.id);

          // Also add teacher role to user_roles
          await supabase
            .from("user_roles")
            .upsert({ user_id: user.id, role: "teacher" as const }, { onConflict: "user_id,role" });

          // Invalidate to refetch teacher status
          await queryClient.invalidateQueries({ queryKey: ["teacher-status"] });
        }
      } finally {
        setIsLinking(false);
      }
    };

    linkTeacherAccount();
  }, [user?.id, profile?.email, queryClient]);

  // Check both teachers table and user_roles for teacher status
  const { data: teacherData, isLoading: queryLoading } = useQuery({
    queryKey: ["teacher-status", user?.id],
    queryFn: async () => {
      if (!user) return { teacher: null, hasTeacherRole: false };

      // Check teachers table first
      const { data: teacher, error: teacherError } = await supabase
        .from("teachers")
        .select("*")
        .eq("user_id", user.id)
        .eq("is_active", true)
        .maybeSingle();

      if (teacherError) {
        console.error("Error checking teacher status:", teacherError);
        // Don't throw - fall back to checking user_roles
      }

      // Also check user_roles for teacher role
      const { data: roleData, error: roleError } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .eq("role", "teacher")
        .maybeSingle();

      if (roleError) {
        console.error("Error checking teacher role:", roleError);
      }

      return {
        teacher: teacher || null,
        hasTeacherRole: !!roleData,
      };
    },
    enabled: !!user && !isLinking, // Wait for linking to complete
    staleTime: 1000 * 60 * 5,
  });

  return { 
    isTeacher: !!teacherData?.teacher || !!teacherData?.hasTeacherRole, 
    teacher: teacherData?.teacher || null, 
    isLoading: queryLoading || isLinking
  };
}
