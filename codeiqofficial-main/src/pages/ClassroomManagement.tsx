import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useTeacher } from "@/hooks/useTeacher";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ProblemAssignment } from "@/components/classroom/ProblemAssignment";
import { ClassroomLeaderboard } from "@/components/classroom/ClassroomLeaderboard";
import { ClassroomAnalytics } from "@/components/classroom/ClassroomAnalytics";
import {
  Users,
  Trophy,
  Copy,
  ArrowLeft,
  Loader2,
  BarChart3,
  UserX,
  Crown,
  Medal,
  Code2,
  Flame,
  BookOpen,
} from "lucide-react";

export default function ClassroomManagement() {
  const { classroomId } = useParams();
  const navigate = useNavigate();
  const { isTeacher, isLoading: teacherLoading } = useTeacher();
  const queryClient = useQueryClient();

  // Fetch classroom
  const { data: classroom, isLoading: classroomLoading } = useQuery({
    queryKey: ["classroom", classroomId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("classrooms")
        .select("*")
        .eq("id", classroomId)
        .single();

      if (error) throw error;
      return data;
    },
    enabled: !!classroomId && isTeacher,
  });

  // Fetch students - separate queries to avoid RLS join issues
  const { data: classroomStudents = [], isLoading: studentsLoading } = useQuery({
    queryKey: ["classroom-students", classroomId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("classroom_students")
        .select("*")
        .eq("classroom_id", classroomId)
        .eq("is_active", true);

      if (error) throw error;
      return data;
    },
    enabled: !!classroomId,
  });

  // Fetch profiles for students separately using user_ids
  const studentUserIds = classroomStudents.map((s: any) => s.user_id);
  
  const { data: studentProfiles = [] } = useQuery({
    queryKey: ["classroom-student-profiles", studentUserIds],
    queryFn: async () => {
      if (studentUserIds.length === 0) return [];
      
      const { data, error } = await supabase
        .from("profiles")
        .select("user_id, full_name, email, leetcode_username, total_solved, easy_solved, medium_solved, hard_solved, current_streak, best_streak")
        .in("user_id", studentUserIds);

      if (error) {
        console.error("Error fetching student profiles:", error);
        return [];
      }
      return data || [];
    },
    enabled: studentUserIds.length > 0,
  });

  // Combine students with their profiles
  const students = classroomStudents.map((student: any) => ({
    ...student,
    profiles: studentProfiles.find((p: any) => p.user_id === student.user_id) || null,
  }));

  // Remove student mutation
  const removeStudent = useMutation({
    mutationFn: async (studentId: string) => {
      const { error } = await supabase
        .from("classroom_students")
        .update({ is_active: false })
        .eq("id", studentId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["classroom-students"] });
      toast.success("Student removed");
    },
  });

  const copyInviteLink = () => {
    if (classroom) {
      const link = `${window.location.origin}/join/${classroom.invite_code}`;
      navigator.clipboard.writeText(link);
      toast.success("Invite link copied!");
    }
  };

  // Leaderboard sorted by total_solved
  const leaderboardByProblems = [...students].sort(
    (a: any, b: any) => (b.profiles?.total_solved || 0) - (a.profiles?.total_solved || 0)
  );

  // Leaderboard sorted by best_streak
  const leaderboardByStreak = [...students].sort(
    (a: any, b: any) => (b.profiles?.best_streak || 0) - (a.profiles?.best_streak || 0)
  );

  const rankStyles = [
    { bg: "bg-warning/10", border: "border-warning/30", text: "text-warning", icon: Crown },
    { bg: "bg-muted", border: "border-border", text: "text-muted-foreground", icon: Medal },
    { bg: "bg-primary/10", border: "border-primary/30", text: "text-primary", icon: Medal },
  ];

  if (teacherLoading || classroomLoading) {
    return (
      <DashboardLayout title="Classroom">
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  if (!classroom) {
    return (
      <DashboardLayout title="Classroom Not Found">
        <Card className="p-12 text-center">
          <p className="text-muted-foreground mb-4">Classroom not found or access denied.</p>
          <Button onClick={() => navigate("/teacher")}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Dashboard
          </Button>
        </Card>
      </DashboardLayout>
    );
  }

  const totalSolved = students.reduce((sum: number, s: any) => sum + (s.profiles?.total_solved || 0), 0);

  return (
    <DashboardLayout 
      title={classroom.name} 
      subtitle={classroom.description || "Manage your classroom"}
    >
      <Button
        variant="ghost"
        className="mb-4"
        onClick={() => navigate("/teacher")}
      >
        <ArrowLeft className="h-4 w-4 mr-2" />
        Back to Dashboard
      </Button>

      {/* Stats Overview */}
      <div className="grid sm:grid-cols-3 gap-4 mb-6">
        <Card className="p-6">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-lg bg-primary/10">
              <Users className="h-6 w-6 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total Students</p>
              <p className="text-2xl font-bold">{students.length}</p>
            </div>
          </div>
        </Card>
        <Card className="p-6">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-lg bg-success/10">
              <Code2 className="h-6 w-6 text-success" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total Problems Solved</p>
              <p className="text-2xl font-bold">{totalSolved}</p>
            </div>
          </div>
        </Card>
        <Card className="p-6 cursor-pointer hover:border-primary/50 transition-colors" onClick={copyInviteLink}>
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-lg bg-info/10">
              <Copy className="h-6 w-6 text-info" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Invite Code</p>
              <p className="text-lg font-bold">{classroom.invite_code}</p>
            </div>
          </div>
        </Card>
      </div>

      <Tabs defaultValue="students" className="space-y-6">
        <TabsList className="flex-wrap h-auto gap-1">
          <TabsTrigger value="students" className="gap-2">
            <Users className="h-4 w-4" />
            Students ({students.length})
          </TabsTrigger>
          <TabsTrigger value="assignments" className="gap-2">
            <BookOpen className="h-4 w-4" />
            Assignments
          </TabsTrigger>
          <TabsTrigger value="leaderboard" className="gap-2">
            <Trophy className="h-4 w-4" />
            Leaderboard
          </TabsTrigger>
          <TabsTrigger value="progress" className="gap-2">
            <BarChart3 className="h-4 w-4" />
            Progress
          </TabsTrigger>
        </TabsList>

        <TabsContent value="students">
          <Card className="p-6">
            {studentsLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : students.length === 0 ? (
              <div className="text-center py-12">
                <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium mb-2">No students yet</h3>
                <p className="text-muted-foreground mb-4">
                  Share the invite link to add students
                </p>
                <Button onClick={copyInviteLink}>
                  <Copy className="h-4 w-4 mr-2" />
                  Copy Invite Link
                </Button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left text-xs font-medium text-muted-foreground uppercase px-4 py-3">Student</th>
                      <th className="text-left text-xs font-medium text-muted-foreground uppercase px-4 py-3">LeetCode</th>
                      <th className="text-left text-xs font-medium text-muted-foreground uppercase px-4 py-3">Problems Solved</th>
                      <th className="text-left text-xs font-medium text-muted-foreground uppercase px-4 py-3">Streak</th>
                      <th className="text-left text-xs font-medium text-muted-foreground uppercase px-4 py-3">Joined</th>
                      <th className="text-right text-xs font-medium text-muted-foreground uppercase px-4 py-3">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {students.map((student: any) => (
                      <tr key={student.id} className="hover:bg-muted/30">
                        <td className="px-4 py-3">
                          <div>
                            <p className="font-medium">{student.profiles?.full_name || "Unknown"}</p>
                            <p className="text-sm text-muted-foreground">{student.profiles?.email}</p>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm">
                          {student.profiles?.leetcode_username ? (
                            <a 
                              href={`https://leetcode.com/${student.profiles.leetcode_username}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-primary hover:underline"
                            >
                              @{student.profiles.leetcode_username}
                            </a>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <Badge variant="secondary">{student.profiles?.total_solved || 0}</Badge>
                            <span className="text-xs text-muted-foreground hidden sm:inline">
                              ({student.profiles?.easy_solved || 0}E / {student.profiles?.medium_solved || 0}M / {student.profiles?.hard_solved || 0}H)
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1">
                            <Flame className="h-4 w-4 text-warning" />
                            <span className="text-sm">{student.profiles?.current_streak || 0}</span>
                            <span className="text-xs text-muted-foreground">(best: {student.profiles?.best_streak || 0})</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm text-muted-foreground">
                          {new Date(student.joined_at).toLocaleDateString()}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-destructive"
                            onClick={() => {
                              if (confirm("Remove this student from the classroom?")) {
                                removeStudent.mutate(student.id);
                              }
                            }}
                          >
                            <UserX className="h-4 w-4" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </TabsContent>

        <TabsContent value="assignments">
          <ProblemAssignment classroomId={classroomId!} />
        </TabsContent>

        <TabsContent value="leaderboard">
          <ClassroomLeaderboard classroomId={classroomId!} students={students} />
        </TabsContent>

        <TabsContent value="progress">
          <ClassroomAnalytics classroomId={classroomId!} />
        </TabsContent>
      </Tabs>
    </DashboardLayout>
  );
}