import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  ResponsiveContainer,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import {
  TrendingUp,
  Users,
  CheckCircle2,
  Clock,
  Target,
  Award,
  Loader2,
} from "lucide-react";
import { format, subDays, startOfDay, endOfDay } from "date-fns";

interface ClassroomAnalyticsProps {
  classroomId: string;
}

export function ClassroomAnalytics({ classroomId }: ClassroomAnalyticsProps) {
  // Fetch students in classroom
  const { data: students = [] } = useQuery({
    queryKey: ["classroom-students-analytics", classroomId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("classroom_students")
        .select("user_id")
        .eq("classroom_id", classroomId)
        .eq("is_active", true);

      if (error) throw error;
      return data;
    },
    enabled: !!classroomId,
  });

  const studentIds = students.map((s) => s.user_id);

  // Fetch assignments
  const { data: assignments = [] } = useQuery({
    queryKey: ["classroom-assignments-analytics", classroomId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("classroom_assignments")
        .select("*, problems:problem_id(id, title, difficulty)")
        .eq("classroom_id", classroomId)
        .order("created_at", { ascending: true });

      if (error) throw error;
      return data;
    },
    enabled: !!classroomId,
  });

  // Fetch progress for all students on assignments
  const assignmentProblemIds = assignments.map((a: any) => a.problem_id);

  const { data: studentProgress = [], isLoading: progressLoading } = useQuery({
    queryKey: ["student-progress-analytics", classroomId, assignmentProblemIds, studentIds],
    queryFn: async () => {
      if (assignmentProblemIds.length === 0 || studentIds.length === 0) return [];

      const { data, error } = await supabase
        .from("user_problem_progress")
        .select("user_id, problem_id, status, solved_at")
        .in("problem_id", assignmentProblemIds)
        .in("user_id", studentIds);

      if (error) throw error;
      return data || [];
    },
    enabled: assignmentProblemIds.length > 0 && studentIds.length > 0,
  });

  // Fetch student profiles for leaderboard
  const { data: studentProfiles = [] } = useQuery({
    queryKey: ["student-profiles-analytics", studentIds],
    queryFn: async () => {
      if (studentIds.length === 0) return [];

      const { data, error } = await supabase
        .from("profiles")
        .select("user_id, full_name, total_solved, easy_solved, medium_solved, hard_solved")
        .in("user_id", studentIds);

      if (error) throw error;
      return data || [];
    },
    enabled: studentIds.length > 0,
  });

  // Calculate metrics
  const totalStudents = students.length;
  const totalAssignments = assignments.length;
  
  const solvedProgress = studentProgress.filter((p: any) => p.status === "solved");
  const totalPossibleCompletions = totalStudents * totalAssignments;
  const actualCompletions = solvedProgress.length;
  const overallCompletionRate = totalPossibleCompletions > 0 
    ? Math.round((actualCompletions / totalPossibleCompletions) * 100) 
    : 0;

  // Assignment completion data for bar chart
  const assignmentCompletionData = assignments.map((assignment: any) => {
    const completed = solvedProgress.filter((p: any) => p.problem_id === assignment.problem_id).length;
    return {
      name: assignment.problems?.title?.substring(0, 15) + (assignment.problems?.title?.length > 15 ? "..." : "") || "Unknown",
      completed,
      total: totalStudents,
      percentage: totalStudents > 0 ? Math.round((completed / totalStudents) * 100) : 0,
    };
  });

  // Completion trend over last 7 days
  const completionTrendData = Array.from({ length: 7 }, (_, i) => {
    const date = subDays(new Date(), 6 - i);
    const dayStart = startOfDay(date);
    const dayEnd = endOfDay(date);
    
    const completionsOnDay = solvedProgress.filter((p: any) => {
      if (!p.solved_at) return false;
      const solvedDate = new Date(p.solved_at);
      return solvedDate >= dayStart && solvedDate <= dayEnd;
    }).length;

    return {
      date: format(date, "MMM dd"),
      completions: completionsOnDay,
    };
  });

  // Difficulty distribution of assignments
  const difficultyData = [
    { name: "Easy", value: assignments.filter((a: any) => a.problems?.difficulty === "easy").length, color: "hsl(var(--success))" },
    { name: "Medium", value: assignments.filter((a: any) => a.problems?.difficulty === "medium").length, color: "hsl(var(--warning))" },
    { name: "Hard", value: assignments.filter((a: any) => a.problems?.difficulty === "hard").length, color: "hsl(var(--destructive))" },
  ].filter(d => d.value > 0);

  // Top performers
  const studentCompletions = studentIds.map((userId) => {
    const profile = studentProfiles.find((p: any) => p.user_id === userId);
    const completedCount = solvedProgress.filter((p: any) => p.user_id === userId && p.status === "solved").length;
    return {
      userId,
      name: profile?.full_name || "Unknown Student",
      completed: completedCount,
      percentage: totalAssignments > 0 ? Math.round((completedCount / totalAssignments) * 100) : 0,
    };
  }).sort((a, b) => b.completed - a.completed).slice(0, 5);

  const chartConfig = {
    completed: { label: "Completed", color: "hsl(var(--primary))" },
    completions: { label: "Completions", color: "hsl(var(--success))" },
  };

  if (progressLoading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Overview Stats */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Users className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Students</p>
                <p className="text-2xl font-bold">{totalStudents}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-info/10">
                <Target className="h-5 w-5 text-info" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Assignments</p>
                <p className="text-2xl font-bold">{totalAssignments}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-success/10">
                <CheckCircle2 className="h-5 w-5 text-success" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Completions</p>
                <p className="text-2xl font-bold">{actualCompletions}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-warning/10">
                <TrendingUp className="h-5 w-5 text-warning" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Completion Rate</p>
                <p className="text-2xl font-bold">{overallCompletionRate}%</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Assignment Completion Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Assignment Completion</CardTitle>
          </CardHeader>
          <CardContent>
            {assignmentCompletionData.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">No assignments yet</p>
            ) : (
              <ChartContainer config={chartConfig} className="h-[250px]">
                <BarChart data={assignmentCompletionData} layout="vertical">
                  <XAxis type="number" domain={[0, totalStudents]} />
                  <YAxis type="category" dataKey="name" width={100} tick={{ fontSize: 12 }} />
                  <ChartTooltip 
                    content={<ChartTooltipContent />}
                    formatter={(value, name, props) => [`${value}/${props.payload.total} students (${props.payload.percentage}%)`, "Completed"]}
                  />
                  <Bar dataKey="completed" fill="hsl(var(--primary))" radius={4} />
                </BarChart>
              </ChartContainer>
            )}
          </CardContent>
        </Card>

        {/* Completion Trend */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Completion Trend (Last 7 Days)</CardTitle>
          </CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig} className="h-[250px]">
              <LineChart data={completionTrendData}>
                <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Line 
                  type="monotone" 
                  dataKey="completions" 
                  stroke="hsl(var(--success))" 
                  strokeWidth={2}
                  dot={{ fill: "hsl(var(--success))" }}
                />
              </LineChart>
            </ChartContainer>
          </CardContent>
        </Card>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Difficulty Distribution */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Assignment Difficulty Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            {difficultyData.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">No assignments yet</p>
            ) : (
              <div className="flex items-center justify-center">
                <ChartContainer config={chartConfig} className="h-[200px] w-[200px]">
                  <PieChart>
                    <Pie
                      data={difficultyData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
                      label={({ name, value }) => `${name}: ${value}`}
                    >
                      {difficultyData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <ChartTooltip content={<ChartTooltipContent />} />
                  </PieChart>
                </ChartContainer>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Top Performers */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Award className="h-4 w-4 text-warning" />
              Top Performers
            </CardTitle>
          </CardHeader>
          <CardContent>
            {studentCompletions.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">No students yet</p>
            ) : (
              <div className="space-y-3">
                {studentCompletions.map((student, index) => (
                  <div key={student.userId} className="flex items-center gap-3">
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                      index === 0 ? "bg-yellow-500 text-yellow-950" :
                      index === 1 ? "bg-gray-400 text-gray-950" :
                      index === 2 ? "bg-amber-600 text-amber-950" :
                      "bg-muted text-muted-foreground"
                    }`}>
                      {index + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{student.name}</p>
                      <div className="flex items-center gap-2">
                        <Progress value={student.percentage} className="h-1.5 flex-1" />
                        <span className="text-xs text-muted-foreground">
                          {student.completed}/{totalAssignments}
                        </span>
                      </div>
                    </div>
                    <Badge variant="outline">{student.percentage}%</Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
