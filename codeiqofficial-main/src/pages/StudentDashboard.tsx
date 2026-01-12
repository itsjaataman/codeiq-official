import { useQuery, useQueryClient } from "@tanstack/react-query";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useClassroomStudent } from "@/hooks/useClassroomStudent";
import { useAuth } from "@/contexts/AuthContext";
import { usePaymentAccess } from "@/hooks/usePaymentAccess";
import { useLeetCode } from "@/hooks/useLeetCode";
import { useStreak } from "@/hooks/useStreak";
import { LockedScreen } from "@/components/LockedScreen";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate, Link } from "react-router-dom";
import { toast } from "sonner";
import { useState, useEffect } from "react";
import { AISolverDialog } from "@/components/AISolverDialog";
import {
  BookOpen,
  Trophy,
  Loader2,
  GraduationCap,
  CheckCircle2,
  Target,
  Users,
  Flame,
  Code2,
  Crown,
  Medal,
  ExternalLink,
  Bot,
} from "lucide-react";

interface UserProgress {
  problem_id: string;
  status: string;
  leetcode_verified: boolean;
  solved_at: string | null;
  notes: string | null;
}

export default function StudentDashboard() {
  const { user, profile } = useAuth();
  const { classroomMembership, classroom, teacher, isClassroomStudent, isLoading: membershipLoading } = useClassroomStudent();
  const { isLocked, isLoading: paymentLoading, paidFeaturesEnabled } = usePaymentAccess();
  const { verifyProblem, loading: verifyLoading } = useLeetCode();
  const { updateStreak } = useStreak();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [userProgress, setUserProgress] = useState<Map<string, UserProgress>>(new Map());
  const [markingProblem, setMarkingProblem] = useState<string | null>(null);
  const [aiSolverOpen, setAiSolverOpen] = useState(false);
  const [selectedProblemForAI, setSelectedProblemForAI] = useState<any>(null);

  // Show locked screen if trial expired and no paid plan
  if (paidFeaturesEnabled && isLocked && !paymentLoading) {
    return (
      <DashboardLayout title="Student Dashboard" subtitle="Your classroom learning hub">
        <LockedScreen />
      </DashboardLayout>
    );
  }

  // Fetch classroom leaderboard
  const { data: classroomStudents = [], isLoading: leaderboardLoading } = useQuery({
    queryKey: ["classroom-students-leaderboard", classroom?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("classroom_students")
        .select("*")
        .eq("classroom_id", classroom!.id)
        .eq("is_active", true);
      if (error) throw error;
      return data;
    },
    enabled: !!classroom?.id,
  });

  // Fetch profiles for classmates
  const studentUserIds = classroomStudents.map((s: any) => s.user_id);
  
  const { data: studentProfiles = [] } = useQuery({
    queryKey: ["classmate-profiles", studentUserIds],
    queryFn: async () => {
      if (studentUserIds.length === 0) return [];
      
      const { data, error } = await supabase
        .from("profiles")
        .select("user_id, full_name, leetcode_username, total_solved, easy_solved, medium_solved, hard_solved, current_streak, best_streak, avatar_url")
        .in("user_id", studentUserIds);

      if (error) {
        console.error("Error fetching classmate profiles:", error);
        return [];
      }
      return data || [];
    },
    enabled: studentUserIds.length > 0,
  });

  // Combine students with their profiles
  const leaderboard = classroomStudents
    .map((student: any) => ({
      ...student,
      profiles: studentProfiles.find((p: any) => p.user_id === student.user_id) || null,
    }))
    .sort((a: any, b: any) => (b.profiles?.total_solved || 0) - (a.profiles?.total_solved || 0));

  // Fetch assigned problems
  const { data: assignments = [] } = useQuery({
    queryKey: ["student-assignments", classroom?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("classroom_assignments")
        .select("*, problems(id, title, difficulty, slug, leetcode_slug, leetcode_id)")
        .eq("classroom_id", classroom!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!classroom?.id,
  });

  // Fetch user progress for assignments
  useEffect(() => {
    const fetchProgress = async () => {
      if (!user) return;

      const { data, error } = await supabase
        .from("user_problem_progress")
        .select("problem_id, status, leetcode_verified, solved_at, notes")
        .eq("user_id", user.id);

      if (error) {
        console.error("Error fetching progress:", error);
      } else {
        const progressMap = new Map<string, UserProgress>();
        (data || []).forEach((p) => {
          progressMap.set(p.problem_id, p);
        });
        setUserProgress(progressMap);
      }
    };

    fetchProgress();
  }, [user]);

  // Handle mark as solved
  const handleMarkSolved = async (problem: any) => {
    if (!user) {
      toast.error("Please sign in to track progress");
      navigate("/auth");
      return;
    }

    setMarkingProblem(problem.id);

    try {
      // Check if LeetCode is connected and verified
      const shouldVerify = profile?.leetcode_verified && problem.leetcode_slug;
      let isVerified = false;

      if (shouldVerify) {
        isVerified = await verifyProblem(
          problem.leetcode_slug!,
          problem.leetcode_id?.toString(),
          problem.title
        );

        if (!isVerified) {
          toast.error("Problem not found in your LeetCode submissions. Solve it on LeetCode first!");
          setMarkingProblem(null);
          return;
        }
      }

      // Calculate initial review date (1 day from now for first review)
      const nextReviewAt = new Date();
      nextReviewAt.setDate(nextReviewAt.getDate() + 1);

      // Upsert progress with SRS initial values
      const { error } = await supabase
        .from("user_problem_progress")
        .upsert({
          user_id: user.id,
          problem_id: problem.id,
          status: "solved",
          solved_at: new Date().toISOString(),
          leetcode_verified: isVerified,
          next_review_at: nextReviewAt.toISOString(),
          interval_days: 1,
          ease_factor: 2.5,
          repetitions: 0,
        }, {
          onConflict: "user_id,problem_id"
        });

      if (error) throw error;

      // Update local state
      setUserProgress((prev) => {
        const updated = new Map(prev);
        const existing = prev.get(problem.id);
        updated.set(problem.id, {
          problem_id: problem.id,
          status: "solved",
          leetcode_verified: isVerified,
          solved_at: new Date().toISOString(),
          notes: existing?.notes || null,
        });
        return updated;
      });

      // Update streak after solving
      await updateStreak();

      // Refresh profile to update stats
      queryClient.invalidateQueries({ queryKey: ["classmate-profiles"] });

      toast.success(
        isVerified 
          ? "Problem marked as solved (LeetCode verified!)" 
          : "Problem marked as solved"
      );
    } catch (error: any) {
      console.error("Error marking problem:", error);
      toast.error(error.message || "Failed to mark problem");
    } finally {
      setMarkingProblem(null);
    }
  };

  // Count solved assignments
  const solvedAssignments = assignments.filter(
    (a: any) => userProgress.get(a.problems?.id)?.status === "solved"
  ).length;

  const rankStyles = [
    { bg: "bg-warning/10", border: "border-warning/30", text: "text-warning", icon: Crown },
    { bg: "bg-muted", border: "border-border", text: "text-muted-foreground", icon: Medal },
    { bg: "bg-primary/10", border: "border-primary/30", text: "text-primary", icon: Medal },
  ];

  if (membershipLoading) {
    return (
      <DashboardLayout title="Student Dashboard">
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  if (!isClassroomStudent) {
    return (
      <DashboardLayout title="Student Dashboard">
        <Card className="p-12 text-center">
          <GraduationCap className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium mb-2">Not in a Classroom</h3>
          <p className="text-muted-foreground mb-4">
            You need to join a classroom via a teacher's invite link.
          </p>
          <Button asChild>
            <Link to="/dashboard">Go to Regular Dashboard</Link>
          </Button>
        </Card>
      </DashboardLayout>
    );
  }

  const myRank = leaderboard.findIndex((s: any) => s.user_id === user?.id) + 1;

  return (
    <DashboardLayout 
      title={classroom?.name || "Student Dashboard"} 
      subtitle={teacher ? `Instructor: ${teacher.name}` : undefined}
    >
      {/* Classroom Info Banner */}
      {teacher && (
        <div className="mb-6 p-4 rounded-lg bg-gradient-to-r from-primary/10 to-primary/5 border border-primary/20">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-full bg-primary/10">
              <GraduationCap className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Your Teacher</p>
              <p className="font-semibold text-foreground">{teacher.name}</p>
            </div>
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <Card className="p-6">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-lg bg-primary/10">
              <Trophy className="h-6 w-6 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Your Rank</p>
              <p className="text-2xl font-bold">#{myRank || "-"}</p>
            </div>
          </div>
        </Card>
        <Card className="p-6">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-lg bg-success/10">
              <CheckCircle2 className="h-6 w-6 text-success" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Problems Solved</p>
              <p className="text-2xl font-bold">{profile?.total_solved || 0}</p>
            </div>
          </div>
        </Card>
        <Card className="p-6">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-lg bg-warning/10">
              <Flame className="h-6 w-6 text-warning" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Current Streak</p>
              <p className="text-2xl font-bold">{profile?.current_streak || 0} days</p>
            </div>
          </div>
        </Card>
        <Card className="p-6">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-lg bg-info/10">
              <Target className="h-6 w-6 text-info" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Assignments</p>
              <p className="text-2xl font-bold">{solvedAssignments}/{assignments.length}</p>
            </div>
          </div>
        </Card>
      </div>

      <Tabs defaultValue="leaderboard" className="space-y-6">
        <TabsList>
          <TabsTrigger value="leaderboard" className="gap-2">
            <Trophy className="h-4 w-4" />
            Leaderboard
          </TabsTrigger>
          <TabsTrigger value="assignments" className="gap-2">
            <BookOpen className="h-4 w-4" />
            Assignments
          </TabsTrigger>
        </TabsList>

        <TabsContent value="leaderboard">
          <Tabs defaultValue="problems" className="w-full">
            <TabsList className="mb-6">
              <TabsTrigger value="problems" className="gap-2">
                <Code2 className="h-4 w-4" />
                Problems Solved
              </TabsTrigger>
              <TabsTrigger value="streak" className="gap-2">
                <Flame className="h-4 w-4" />
                Best Streak
              </TabsTrigger>
            </TabsList>

            <TabsContent value="problems">
              <Card className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold">Classroom Rankings</h3>
                  <Badge variant="secondary">
                    <Users className="h-3 w-3 mr-1" />
                    {leaderboard.length} students
                  </Badge>
                </div>
                
                {leaderboardLoading ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-primary" />
                  </div>
                ) : leaderboard.length === 0 ? (
                  <div className="text-center py-12">
                    <Trophy className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                    <p className="text-muted-foreground">No classmates yet</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {leaderboard.map((student: any, index: number) => {
                      const isMe = student.user_id === user?.id;
                      const isTopThree = index < 3;
                      const style = isTopThree ? rankStyles[index] : null;

                      return (
                        <div 
                          key={student.id} 
                          className={`flex items-center gap-4 p-4 rounded-xl transition-all ${
                            isMe
                              ? "bg-primary/5 border-2 border-primary/30"
                              : isTopThree
                              ? `${style?.bg} border ${style?.border}`
                              : "bg-card border border-border hover:border-primary/20"
                          }`}
                        >
                          <div className={`flex h-10 w-10 items-center justify-center rounded-full font-bold ${
                            isTopThree ? `${style?.bg} ${style?.text}` : "bg-muted text-muted-foreground"
                          }`}>
                            {isTopThree && style ? (
                              <style.icon className="h-5 w-5" />
                            ) : (
                              <span className="text-sm">#{index + 1}</span>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className={`font-medium truncate ${isMe ? "text-primary" : "text-foreground"}`}>
                              {student.profiles?.full_name || "Unknown"}
                              {isMe && <span className="text-xs text-primary ml-2">(You)</span>}
                            </p>
                            {student.profiles?.leetcode_username && (
                              <p className="text-xs text-muted-foreground truncate">@{student.profiles.leetcode_username}</p>
                            )}
                          </div>
                          <div className="flex items-center gap-4">
                            <div className="hidden sm:flex items-center gap-2 text-xs">
                              <Badge variant="easy" className="text-[10px]">{student.profiles?.easy_solved || 0} E</Badge>
                              <Badge variant="medium" className="text-[10px]">{student.profiles?.medium_solved || 0} M</Badge>
                              <Badge variant="hard" className="text-[10px]">{student.profiles?.hard_solved || 0} H</Badge>
                            </div>
                            <div className="flex items-center gap-2 min-w-[80px] justify-end">
                              <Code2 className="h-4 w-4 text-primary" />
                              <span className="font-bold">{student.profiles?.total_solved || 0}</span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </Card>
            </TabsContent>

            <TabsContent value="streak">
              <Card className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold">Best Streak Rankings</h3>
                  <Badge variant="secondary">
                    <Users className="h-3 w-3 mr-1" />
                    {leaderboard.length} students
                  </Badge>
                </div>
                
                {leaderboardLoading ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-primary" />
                  </div>
                ) : leaderboard.length === 0 ? (
                  <div className="text-center py-12">
                    <Flame className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                    <p className="text-muted-foreground">No classmates yet</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {[...leaderboard]
                      .sort((a: any, b: any) => (b.profiles?.best_streak || 0) - (a.profiles?.best_streak || 0))
                      .map((student: any, index: number) => {
                        const isMe = student.user_id === user?.id;
                        const isTopThree = index < 3;
                        const style = isTopThree ? rankStyles[index] : null;

                        return (
                          <div 
                            key={student.id} 
                            className={`flex items-center gap-4 p-4 rounded-xl transition-all ${
                              isMe
                                ? "bg-primary/5 border-2 border-primary/30"
                                : isTopThree
                                ? `${style?.bg} border ${style?.border}`
                                : "bg-card border border-border hover:border-primary/20"
                            }`}
                          >
                            <div className={`flex h-10 w-10 items-center justify-center rounded-full font-bold ${
                              isTopThree ? `${style?.bg} ${style?.text}` : "bg-muted text-muted-foreground"
                            }`}>
                              {isTopThree && style ? (
                                <style.icon className="h-5 w-5" />
                              ) : (
                                <span className="text-sm">#{index + 1}</span>
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className={`font-medium truncate ${isMe ? "text-primary" : "text-foreground"}`}>
                                {student.profiles?.full_name || "Unknown"}
                                {isMe && <span className="text-xs text-primary ml-2">(You)</span>}
                              </p>
                              {student.profiles?.leetcode_username && (
                                <p className="text-xs text-muted-foreground truncate">@{student.profiles.leetcode_username}</p>
                              )}
                            </div>
                            <div className="flex items-center gap-4">
                              <div className="hidden sm:flex items-center gap-2 text-xs text-muted-foreground">
                                <span>Current: {student.profiles?.current_streak || 0} days</span>
                              </div>
                              <div className="flex items-center gap-2 min-w-[80px] justify-end">
                                <Flame className="h-4 w-4 text-warning" />
                                <span className="font-bold">{student.profiles?.best_streak || 0} days</span>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                  </div>
                )}
              </Card>
            </TabsContent>
          </Tabs>
        </TabsContent>

        <TabsContent value="assignments">
          <Card className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold">Assigned Problems</h3>
              <Badge variant="secondary">
                {solvedAssignments}/{assignments.length} solved
              </Badge>
            </div>
            {assignments.length === 0 ? (
              <div className="text-center py-8">
                <BookOpen className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No assignments yet</p>
              </div>
            ) : (
              <div className="space-y-2">
                {assignments.map((assignment: any) => {
                  const problem = assignment.problems;
                  const progress = userProgress.get(problem?.id);
                  const isSolved = progress?.status === "solved";
                  const isVerified = progress?.leetcode_verified;
                  const isMarking = markingProblem === problem?.id;

                  return (
                    <div 
                      key={assignment.id} 
                      className={`flex items-center justify-between p-4 border rounded-lg transition-all ${
                        isSolved 
                          ? "bg-success/5 border-success/30" 
                          : "hover:bg-muted/30"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        {isSolved ? (
                          <CheckCircle2 className={`h-5 w-5 ${isVerified ? "text-success" : "text-muted-foreground"}`} />
                        ) : (
                          <div className="h-5 w-5 rounded-full border-2 border-muted-foreground/30" />
                        )}
                        <div>
                          <span className={`font-medium ${isSolved ? "text-success" : "text-foreground"}`}>
                            {problem?.title}
                          </span>
                          {isVerified && (
                            <Badge variant="secondary" className="ml-2 text-[10px]">Verified</Badge>
                          )}
                        </div>
                        <Badge 
                          variant={
                            problem?.difficulty === "easy" ? "easy" :
                            problem?.difficulty === "medium" ? "medium" : "hard"
                          }
                        >
                          {problem?.difficulty}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="gap-1 text-primary hover:text-primary"
                          onClick={() => {
                            setSelectedProblemForAI(problem);
                            setAiSolverOpen(true);
                          }}
                        >
                          <Bot className="h-3 w-3" />
                          AI
                        </Button>
                        <Button variant="ghost" size="sm" asChild>
                          <a 
                            href={`https://leetcode.com/problems/${problem?.slug}`} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="gap-1"
                          >
                            <ExternalLink className="h-3 w-3" />
                            LeetCode
                          </a>
                        </Button>
                        {isSolved ? (
                          <Badge variant="success" className="gap-1">
                            <CheckCircle2 className="h-3 w-3" />
                            Solved
                          </Badge>
                        ) : (
                          <Button 
                            variant="default"
                            size="sm"
                            onClick={() => handleMarkSolved(problem)}
                            disabled={isMarking || verifyLoading}
                          >
                            {isMarking ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              "Mark Solved"
                            )}
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        </TabsContent>
      </Tabs>

      {/* AI Solver Dialog */}
      {selectedProblemForAI && (
        <AISolverDialog
          open={aiSolverOpen}
          onOpenChange={setAiSolverOpen}
          problemId={selectedProblemForAI.id}
          problemTitle={selectedProblemForAI.title}
          leetcodeId={selectedProblemForAI.leetcode_id}
          onNotesSaved={() => {
            // Refresh user progress
            if (user) {
              supabase
                .from("user_problem_progress")
                .select("problem_id, status, leetcode_verified, solved_at, notes")
                .eq("user_id", user.id)
                .then(({ data }) => {
                  if (data) {
                    const progressMap = new Map<string, UserProgress>();
                    data.forEach((p) => {
                      progressMap.set(p.problem_id, p);
                    });
                    setUserProgress(progressMap);
                  }
                });
            }
          }}
        />
      )}
    </DashboardLayout>
  );
}