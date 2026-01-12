import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Trophy,
  Crown,
  Medal,
  Code2,
  Flame,
  Target,
  Loader2,
} from "lucide-react";

interface ClassroomLeaderboardProps {
  classroomId: string;
  students: any[];
}

export function ClassroomLeaderboard({ classroomId, students }: ClassroomLeaderboardProps) {
  // Fetch assignments for this classroom
  const { data: assignments = [] } = useQuery({
    queryKey: ["classroom-assignments", classroomId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("classroom_assignments")
        .select("problem_id")
        .eq("classroom_id", classroomId);

      if (error) throw error;
      return data;
    },
    enabled: !!classroomId,
  });

  const assignedProblemIds = assignments.map((a: any) => a.problem_id);

  // Fetch progress for all students on assigned problems
  const studentUserIds = students.map((s: any) => s.user_id);
  
  const { data: studentProgress = [], isLoading: progressLoading } = useQuery({
    queryKey: ["classroom-student-progress", studentUserIds, assignedProblemIds],
    queryFn: async () => {
      if (studentUserIds.length === 0 || assignedProblemIds.length === 0) return [];
      
      const { data, error } = await supabase
        .from("user_problem_progress")
        .select("user_id, problem_id, status")
        .in("user_id", studentUserIds)
        .in("problem_id", assignedProblemIds)
        .eq("status", "solved");

      if (error) {
        console.error("Error fetching progress:", error);
        return [];
      }
      return data || [];
    },
    enabled: studentUserIds.length > 0 && assignedProblemIds.length > 0,
  });

  // Calculate assignments completed per student
  const studentAssignmentCounts: Record<string, number> = {};
  studentProgress.forEach((progress: any) => {
    studentAssignmentCounts[progress.user_id] = 
      (studentAssignmentCounts[progress.user_id] || 0) + 1;
  });

  // Leaderboard sorted by assignments completed
  const leaderboardByAssignments = [...students]
    .map((student: any) => ({
      ...student,
      assignmentsCompleted: studentAssignmentCounts[student.user_id] || 0,
    }))
    .sort((a, b) => b.assignmentsCompleted - a.assignmentsCompleted);

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

  const renderLeaderboardList = (
    data: any[],
    valueKey: string,
    valueLabel: string,
    icon: React.ElementType
  ) => {
    const IconComponent = icon;
    
    if (students.length === 0) {
      return (
        <div className="text-center py-12">
          <Trophy className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <p className="text-muted-foreground">No students yet</p>
        </div>
      );
    }

    return (
      <div className="space-y-3">
        {data.map((student: any, index: number) => {
          const isTopThree = index < 3;
          const style = isTopThree ? rankStyles[index] : null;
          const value = valueKey === "assignmentsCompleted" 
            ? student.assignmentsCompleted 
            : student.profiles?.[valueKey] || 0;

          return (
            <div
              key={student.id}
              className={`flex items-center gap-4 p-4 rounded-xl transition-all ${
                isTopThree
                  ? `${style?.bg} border ${style?.border}`
                  : "bg-card border border-border hover:border-primary/20"
              }`}
            >
              <div
                className={`flex h-10 w-10 items-center justify-center rounded-full font-bold ${
                  isTopThree ? `${style?.bg} ${style?.text}` : "bg-muted text-muted-foreground"
                }`}
              >
                {isTopThree && style ? (
                  <style.icon className="h-5 w-5" />
                ) : (
                  <span className="text-sm">#{index + 1}</span>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate">
                  {student.profiles?.full_name || "Unknown"}
                </p>
                {student.profiles?.leetcode_username && (
                  <p className="text-xs text-muted-foreground truncate">
                    @{student.profiles.leetcode_username}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-4">
                {valueKey === "total_solved" && (
                  <div className="hidden sm:flex items-center gap-2 text-xs">
                    <Badge variant="easy" className="text-[10px]">
                      {student.profiles?.easy_solved || 0} E
                    </Badge>
                    <Badge variant="medium" className="text-[10px]">
                      {student.profiles?.medium_solved || 0} M
                    </Badge>
                    <Badge variant="hard" className="text-[10px]">
                      {student.profiles?.hard_solved || 0} H
                    </Badge>
                  </div>
                )}
                {valueKey === "assignmentsCompleted" && (
                  <div className="text-xs text-muted-foreground">
                    of {assignedProblemIds.length} assigned
                  </div>
                )}
                <div className="flex items-center gap-2 min-w-[80px] justify-end">
                  <IconComponent className="h-4 w-4 text-primary" />
                  <span className="font-bold">{value}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  if (progressLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold">Classroom Leaderboard</h3>
        <p className="text-sm text-muted-foreground">
          Track student progress and rankings
        </p>
      </div>

      <Tabs defaultValue="assignments" className="w-full">
        <TabsList className="mb-6">
          <TabsTrigger value="assignments" className="gap-2">
            <Target className="h-4 w-4" />
            Assignments
          </TabsTrigger>
          <TabsTrigger value="problems" className="gap-2">
            <Code2 className="h-4 w-4" />
            Total Solved
          </TabsTrigger>
          <TabsTrigger value="streak" className="gap-2">
            <Flame className="h-4 w-4" />
            Best Streak
          </TabsTrigger>
        </TabsList>

        <TabsContent value="assignments">
          <Card className="p-6">
            {assignedProblemIds.length === 0 ? (
              <div className="text-center py-12">
                <Target className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium mb-2">No assignments yet</h3>
                <p className="text-muted-foreground">
                  Assign problems to track student completion
                </p>
              </div>
            ) : (
              renderLeaderboardList(
                leaderboardByAssignments,
                "assignmentsCompleted",
                "completed",
                Target
              )
            )}
          </Card>
        </TabsContent>

        <TabsContent value="problems">
          <Card className="p-6">
            {renderLeaderboardList(leaderboardByProblems, "total_solved", "solved", Code2)}
          </Card>
        </TabsContent>

        <TabsContent value="streak">
          <Card className="p-6">
            {renderLeaderboardList(leaderboardByStreak, "best_streak", "days", Flame)}
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
