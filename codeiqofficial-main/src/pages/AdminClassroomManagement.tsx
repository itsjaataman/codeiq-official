import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAdmin } from "@/hooks/useAdmin";
import { supabase } from "@/integrations/supabase/client";
import {
  Users,
  Trophy,
  ClipboardList,
  ArrowLeft,
  Loader2,
  BarChart3,
  Copy,
  GraduationCap,
} from "lucide-react";
import { toast } from "sonner";

export default function AdminClassroomManagement() {
  const { classroomId } = useParams();
  const navigate = useNavigate();
  const { isAdmin, isLoading: adminLoading } = useAdmin();

  // Fetch classroom with teacher info
  const { data: classroom, isLoading: classroomLoading } = useQuery({
    queryKey: ["admin-classroom", classroomId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("classrooms")
        .select("*, teachers(name, email)")
        .eq("id", classroomId)
        .single();

      if (error) throw error;
      return data;
    },
    enabled: !!classroomId && isAdmin,
  });

  // Fetch students
  const { data: students = [], isLoading: studentsLoading } = useQuery({
    queryKey: ["admin-classroom-students", classroomId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("classroom_students")
        .select(`
          *,
          profiles:user_id (
            full_name,
            email,
            leetcode_username,
            total_solved
          )
        `)
        .eq("classroom_id", classroomId)
        .eq("is_active", true);

      if (error) throw error;
      return data;
    },
    enabled: !!classroomId && isAdmin,
  });

  // Fetch tests
  const { data: tests = [] } = useQuery({
    queryKey: ["admin-classroom-tests", classroomId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("classroom_tests")
        .select("*, topics(name)")
        .eq("classroom_id", classroomId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!classroomId && isAdmin,
  });

  // Fetch all test submissions
  const { data: testSubmissions = [] } = useQuery({
    queryKey: ["admin-classroom-submissions", classroomId],
    queryFn: async () => {
      const testIds = tests.map((t: any) => t.id);
      if (testIds.length === 0) return [];
      
      const { data, error } = await supabase
        .from("test_submissions")
        .select(`
          *,
          profiles:student_id (full_name, leetcode_username)
        `)
        .in("test_id", testIds);
      if (error) throw error;
      return data;
    },
    enabled: tests.length > 0 && isAdmin,
  });

  const copyInviteLink = () => {
    if (classroom) {
      const link = `${window.location.origin}/join/${classroom.invite_code}`;
      navigator.clipboard.writeText(link);
      toast.success("Invite link copied!");
    }
  };

  // Calculate leaderboard
  const leaderboard = students
    .map((student: any) => ({
      ...student,
      totalSolved: student.profiles?.total_solved || 0,
    }))
    .sort((a: any, b: any) => b.totalSolved - a.totalSolved);

  // Calculate test stats
  const getTestStats = (testId: string) => {
    const submissions = testSubmissions.filter((s: any) => s.test_id === testId);
    const completedSubmissions = submissions.filter((s: any) => s.submitted_at);
    const avgScore = completedSubmissions.length > 0
      ? Math.round(completedSubmissions.reduce((sum: number, s: any) => sum + (s.score || 0), 0) / completedSubmissions.length)
      : 0;
    return {
      total: submissions.length,
      completed: completedSubmissions.length,
      avgScore,
    };
  };

  if (adminLoading || classroomLoading) {
    return (
      <DashboardLayout title="Classroom">
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  if (!isAdmin) {
    navigate("/dashboard");
    return null;
  }

  if (!classroom) {
    return (
      <DashboardLayout title="Classroom Not Found">
        <Card className="p-12 text-center">
          <p className="text-muted-foreground mb-4">Classroom not found.</p>
          <Button onClick={() => navigate("/admin")}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Admin
          </Button>
        </Card>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout 
      title={classroom.name} 
      subtitle={`Teacher: ${classroom.teachers?.name || "Unknown"}`}
    >
      <Button
        variant="ghost"
        className="mb-4"
        onClick={() => navigate("/admin")}
      >
        <ArrowLeft className="h-4 w-4 mr-2" />
        Back to Admin
      </Button>

      {/* Classroom Info */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Users className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Students</p>
              <p className="text-xl font-bold">{students.length}</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-warning/10">
              <ClipboardList className="h-5 w-5 text-warning" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Tests</p>
              <p className="text-xl font-bold">{tests.length}</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-success/10">
              <Trophy className="h-5 w-5 text-success" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Submissions</p>
              <p className="text-xl font-bold">{testSubmissions.length}</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-info/10">
              <GraduationCap className="h-5 w-5 text-info" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Teacher</p>
              <p className="text-sm font-medium truncate">{classroom.teachers?.name}</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Quick Actions */}
      <div className="flex flex-wrap gap-3 mb-6">
        <Button variant="outline" onClick={copyInviteLink}>
          <Copy className="h-4 w-4 mr-2" />
          Copy Invite Link
        </Button>
        <Badge variant={classroom.is_active ? "default" : "secondary"} className="h-9 px-4">
          {classroom.is_active ? "Active" : "Inactive"}
        </Badge>
      </div>

      <Tabs defaultValue="students" className="space-y-6">
        <TabsList>
          <TabsTrigger value="students" className="gap-2">
            <Users className="h-4 w-4" />
            Students ({students.length})
          </TabsTrigger>
          <TabsTrigger value="tests" className="gap-2">
            <ClipboardList className="h-4 w-4" />
            Tests ({tests.length})
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

        {/* Students Tab */}
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
                <p className="text-muted-foreground">
                  Students will appear here once they join using the invite link
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left text-xs font-medium text-muted-foreground uppercase px-4 py-3">Student</th>
                      <th className="text-left text-xs font-medium text-muted-foreground uppercase px-4 py-3">LeetCode</th>
                      <th className="text-left text-xs font-medium text-muted-foreground uppercase px-4 py-3">Problems Solved</th>
                      <th className="text-left text-xs font-medium text-muted-foreground uppercase px-4 py-3">Joined</th>
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
                          {student.profiles?.leetcode_username || "-"}
                        </td>
                        <td className="px-4 py-3">
                          <Badge variant="secondary">{student.profiles?.total_solved || 0}</Badge>
                        </td>
                        <td className="px-4 py-3 text-sm text-muted-foreground">
                          {new Date(student.joined_at).toLocaleDateString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </TabsContent>

        {/* Tests Tab */}
        <TabsContent value="tests">
          <Card className="p-6">
            {tests.length === 0 ? (
              <div className="text-center py-12">
                <ClipboardList className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium mb-2">No tests yet</h3>
                <p className="text-muted-foreground">
                  The teacher hasn't created any tests for this classroom
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {tests.map((test: any) => {
                  const stats = getTestStats(test.id);
                  return (
                    <div key={test.id} className="p-4 border rounded-lg">
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <h4 className="font-medium">{test.name}</h4>
                          {test.topics?.name && (
                            <p className="text-sm text-muted-foreground">Topic: {test.topics.name}</p>
                          )}
                        </div>
                        <Badge variant={test.is_active ? "default" : "secondary"}>
                          {test.is_active ? "Active" : "Inactive"}
                        </Badge>
                      </div>
                      <div className="flex gap-4 text-sm text-muted-foreground">
                        <span>Time: {test.time_limit_minutes} mins</span>
                        <span>Submissions: {stats.completed}/{stats.total}</span>
                        <span>Avg Score: {stats.avgScore}%</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        </TabsContent>

        {/* Leaderboard Tab */}
        <TabsContent value="leaderboard">
          <Card className="p-6">
            {leaderboard.length === 0 ? (
              <div className="text-center py-12">
                <Trophy className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium mb-2">No students yet</h3>
                <p className="text-muted-foreground">
                  The leaderboard will populate once students join
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {leaderboard.map((student: any, index: number) => (
                  <div 
                    key={student.id} 
                    className={`flex items-center gap-4 p-4 rounded-lg ${
                      index === 0 ? "bg-yellow-500/10 border border-yellow-500/30" :
                      index === 1 ? "bg-gray-400/10 border border-gray-400/30" :
                      index === 2 ? "bg-amber-600/10 border border-amber-600/30" :
                      "bg-muted/30"
                    }`}
                  >
                    <span className={`text-2xl font-bold w-8 ${
                      index === 0 ? "text-yellow-500" :
                      index === 1 ? "text-gray-400" :
                      index === 2 ? "text-amber-600" :
                      "text-muted-foreground"
                    }`}>
                      {index + 1}
                    </span>
                    <div className="flex-1">
                      <p className="font-medium">{student.profiles?.full_name || "Unknown"}</p>
                      <p className="text-sm text-muted-foreground">
                        {student.profiles?.leetcode_username || "No LeetCode"}
                      </p>
                    </div>
                    <Badge variant="secondary" className="text-lg">
                      {student.totalSolved} solved
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </TabsContent>

        {/* Progress Tab */}
        <TabsContent value="progress">
          <Card className="p-6">
            {students.length === 0 ? (
              <div className="text-center py-12">
                <BarChart3 className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium mb-2">No students yet</h3>
                <p className="text-muted-foreground">
                  Progress will be tracked once students join and take tests
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left text-xs font-medium text-muted-foreground uppercase px-4 py-3">Student</th>
                      <th className="text-left text-xs font-medium text-muted-foreground uppercase px-4 py-3">Tests Taken</th>
                      <th className="text-left text-xs font-medium text-muted-foreground uppercase px-4 py-3">Avg Score</th>
                      <th className="text-left text-xs font-medium text-muted-foreground uppercase px-4 py-3">Total Solved</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {students.map((student: any) => {
                      const studentSubmissions = testSubmissions.filter(
                        (s: any) => s.student_id === student.user_id && s.submitted_at
                      );
                      const avgScore = studentSubmissions.length > 0
                        ? Math.round(studentSubmissions.reduce((sum: number, s: any) => sum + (s.score || 0), 0) / studentSubmissions.length)
                        : 0;
                      
                      return (
                        <tr key={student.id} className="hover:bg-muted/30">
                          <td className="px-4 py-3">
                            <p className="font-medium">{student.profiles?.full_name || "Unknown"}</p>
                          </td>
                          <td className="px-4 py-3">
                            <Badge variant="outline">{studentSubmissions.length}</Badge>
                          </td>
                          <td className="px-4 py-3">
                            <Badge variant={avgScore >= 70 ? "default" : avgScore >= 40 ? "secondary" : "destructive"}>
                              {avgScore}%
                            </Badge>
                          </td>
                          <td className="px-4 py-3">
                            <Badge variant="secondary">{student.profiles?.total_solved || 0}</Badge>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </TabsContent>
      </Tabs>
    </DashboardLayout>
  );
}
