import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export function useClassroomStudent() {
  const { user } = useAuth();

  const { data: classroomMembership, isLoading } = useQuery({
    queryKey: ["classroom-student", user?.id],
    queryFn: async () => {
      if (!user) return null;

      const { data, error } = await supabase
        .from("classroom_students")
        .select(`
          *,
          classrooms:classroom_id (
            *,
            teachers:teacher_id (*)
          )
        `)
        .eq("user_id", user.id)
        .eq("is_active", true)
        .maybeSingle();

      if (error) {
        console.error("Error checking classroom membership:", error);
        return null;
      }

      return data;
    },
    enabled: !!user,
    staleTime: 1000 * 60 * 5,
  });

  // Classroom students get free pro access
  const hasClassroomAccess = !!classroomMembership;

  return { 
    isClassroomStudent: !!classroomMembership, 
    hasClassroomAccess,
    classroomMembership, 
    classroom: classroomMembership?.classrooms,
    teacher: classroomMembership?.classrooms?.teachers,
    isLoading 
  };
}
