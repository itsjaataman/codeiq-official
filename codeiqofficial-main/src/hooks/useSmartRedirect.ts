import { useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useTeacher } from "@/hooks/useTeacher";
import { useClassroomStudent } from "@/hooks/useClassroomStudent";
import { useAdmin } from "@/hooks/useAdmin";

export function useSmartRedirect() {
  const navigate = useNavigate();
  const { isTeacher, isLoading: teacherLoading } = useTeacher();
  const { isClassroomStudent, isLoading: studentLoading } = useClassroomStudent();
  const { isAdmin, isLoading: adminLoading } = useAdmin();

  const isLoading = teacherLoading || studentLoading || adminLoading;

  const getRedirectPath = useCallback(() => {
    // Role-based redirect priority: admin > teacher > student > user
    if (isAdmin) return "/admin";
    if (isTeacher) return "/teacher";
    if (isClassroomStudent) return "/student";
    return "/dashboard";
  }, [isAdmin, isTeacher, isClassroomStudent]);

  const redirect = useCallback(() => {
    const path = getRedirectPath();
    navigate(path);
  }, [getRedirectPath, navigate]);

  return {
    redirect,
    getRedirectPath,
    isLoading,
    isAdmin,
    isTeacher,
    isClassroomStudent,
  };
}
