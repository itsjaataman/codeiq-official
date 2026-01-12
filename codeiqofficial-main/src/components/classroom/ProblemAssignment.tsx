import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Plus,
  Trash2,
  Loader2,
  BookOpen,
  Calendar,
  Search,
  CheckCircle2,
  Clock,
  ExternalLink,
  CalendarPlus,
  Users,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

interface ProblemAssignmentProps {
  classroomId: string;
}

export function ProblemAssignment({ classroomId }: ProblemAssignmentProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [extendDialogOpen, setExtendDialogOpen] = useState(false);
  const [selectedAssignment, setSelectedAssignment] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTopic, setSelectedTopic] = useState<string>("all");
  const [selectedDifficulty, setSelectedDifficulty] = useState<string>("all");
  const [dueDate, setDueDate] = useState("");
  const [newDueDate, setNewDueDate] = useState("");

  // Fetch classroom students for notifications
  const { data: classroomStudents = [] } = useQuery({
    queryKey: ["classroom-students-for-notify", classroomId],
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

  // Fetch assignments for this classroom
  const { data: assignments = [], isLoading: assignmentsLoading } = useQuery({
    queryKey: ["classroom-assignments", classroomId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("classroom_assignments")
        .select("*")
        .eq("classroom_id", classroomId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: !!classroomId,
  });

  // Fetch student progress for assignments
  const assignedProblemIds = assignments.map((a: any) => a.problem_id);
  const studentUserIds = classroomStudents.map((s: any) => s.user_id);

  const { data: studentProgress = [] } = useQuery({
    queryKey: ["assignment-progress", classroomId, assignedProblemIds],
    queryFn: async () => {
      if (assignedProblemIds.length === 0 || studentUserIds.length === 0) return [];
      
      const { data, error } = await supabase
        .from("user_problem_progress")
        .select("user_id, problem_id, status")
        .in("problem_id", assignedProblemIds)
        .in("user_id", studentUserIds)
        .eq("status", "solved");

      if (error) throw error;
      return data || [];
    },
    enabled: assignedProblemIds.length > 0 && studentUserIds.length > 0,
  });

  // Calculate completion stats per assignment
  const getAssignmentStats = (problemId: string) => {
    const totalStudents = classroomStudents.length;
    const completedCount = studentProgress.filter(
      (p: any) => p.problem_id === problemId
    ).length;
    return {
      total: totalStudents,
      completed: completedCount,
      percentage: totalStudents > 0 ? Math.round((completedCount / totalStudents) * 100) : 0,
    };
  };

  // Fetch problems for assignment dialog
  const { data: problems = [] } = useQuery({
    queryKey: ["problems-for-assignment", selectedTopic, selectedDifficulty, searchQuery],
    queryFn: async () => {
      let query = supabase
        .from("problems")
        .select("id, title, difficulty, leetcode_slug, topic_id")
        .order("display_order");

      if (selectedTopic && selectedTopic !== "all") {
        query = query.eq("topic_id", selectedTopic);
      }
      if (selectedDifficulty && selectedDifficulty !== "all") {
        query = query.eq("difficulty", selectedDifficulty);
      }
      if (searchQuery) {
        query = query.ilike("title", `%${searchQuery}%`);
      }

      const { data, error } = await query.limit(50);
      if (error) throw error;
      return data;
    },
    enabled: dialogOpen,
  });

  // Fetch assigned problem details
  const { data: assignedProblems = [] } = useQuery({
    queryKey: ["assigned-problems", assignedProblemIds],
    queryFn: async () => {
      if (assignedProblemIds.length === 0) return [];
      const { data, error } = await supabase
        .from("problems")
        .select("id, title, difficulty, leetcode_slug")
        .in("id", assignedProblemIds);

      if (error) throw error;
      return data;
    },
    enabled: assignedProblemIds.length > 0,
  });

  // Fetch topics
  const { data: topics = [] } = useQuery({
    queryKey: ["topics"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("topics")
        .select("id, name")
        .order("display_order");

      if (error) throw error;
      return data;
    },
    enabled: dialogOpen,
  });

  // Fetch classroom name for notification
  const { data: classroom } = useQuery({
    queryKey: ["classroom-name", classroomId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("classrooms")
        .select("name")
        .eq("id", classroomId)
        .single();

      if (error) throw error;
      return data;
    },
    enabled: !!classroomId,
  });

  // Send notifications to all students
  const sendNotifications = async (problemTitle: string, notificationType: "new" | "extended", newDueDate?: string) => {
    if (classroomStudents.length === 0) return;

    const notifications = classroomStudents.map((student: any) => ({
      user_id: student.user_id,
      title: notificationType === "new" 
        ? "New Assignment Posted" 
        : "Assignment Due Date Extended",
      message: notificationType === "new"
        ? `New problem "${problemTitle}" has been assigned in ${classroom?.name || "your classroom"}`
        : `Due date for "${problemTitle}" has been extended to ${new Date(newDueDate!).toLocaleDateString()}`,
      type: "assignment",
      related_id: classroomId,
      related_type: "classroom",
    }));

    const { error } = await supabase.from("notifications").insert(notifications);
    if (error) {
      console.error("Failed to send notifications:", error);
    }
  };

  // Assign problem mutation
  const assignProblem = useMutation({
    mutationFn: async (problemId: string) => {
      const { error } = await supabase.from("classroom_assignments").insert({
        classroom_id: classroomId,
        problem_id: problemId,
        assigned_by: user!.id,
        due_date: dueDate || null,
      });
      if (error) throw error;

      // Get problem title for notification
      const problem = problems.find((p: any) => p.id === problemId);
      if (problem) {
        await sendNotifications(problem.title, "new");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["classroom-assignments"] });
      toast.success("Problem assigned! Students have been notified.");
    },
    onError: (error: any) => {
      if (error.message?.includes("duplicate")) {
        toast.error("This problem is already assigned");
      } else {
        toast.error("Failed to assign problem");
      }
    },
  });

  // Extend due date mutation
  const extendDueDate = useMutation({
    mutationFn: async ({ assignmentId, newDate }: { assignmentId: string; newDate: string }) => {
      const { error } = await supabase
        .from("classroom_assignments")
        .update({ due_date: newDate })
        .eq("id", assignmentId);
      
      if (error) throw error;

      // Send notification about extended due date
      if (selectedAssignment?.problem) {
        await sendNotifications(selectedAssignment.problem.title, "extended", newDate);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["classroom-assignments"] });
      toast.success("Due date extended! Students have been notified.");
      setExtendDialogOpen(false);
      setSelectedAssignment(null);
      setNewDueDate("");
    },
    onError: () => {
      toast.error("Failed to extend due date");
    },
  });

  // Remove assignment mutation
  const removeAssignment = useMutation({
    mutationFn: async (assignmentId: string) => {
      const { error } = await supabase
        .from("classroom_assignments")
        .delete()
        .eq("id", assignmentId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["classroom-assignments"] });
      toast.success("Assignment removed");
    },
  });

  // Combine assignments with problem details
  const assignmentsWithProblems = assignments.map((assignment: any) => ({
    ...assignment,
    problem: assignedProblems.find((p: any) => p.id === assignment.problem_id),
  }));

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty?.toLowerCase()) {
      case "easy":
        return "easy";
      case "medium":
        return "medium";
      case "hard":
        return "hard";
      default:
        return "secondary";
    }
  };

  const isAlreadyAssigned = (problemId: string) => {
    return assignedProblemIds.includes(problemId);
  };

  const isOverdue = (dueDate: string) => {
    return new Date(dueDate) < new Date();
  };

  const openExtendDialog = (assignment: any) => {
    setSelectedAssignment(assignment);
    setNewDueDate(assignment.due_date ? new Date(assignment.due_date).toISOString().slice(0, 16) : "");
    setExtendDialogOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Problem Assignments</h3>
          <p className="text-sm text-muted-foreground">
            Assign problems for students to practice
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              Assign Problem
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col" aria-describedby={undefined}>
            <DialogHeader>
              <DialogTitle>Assign Problem to Classroom</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 flex-1 overflow-hidden flex flex-col">
              {/* Filters */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search problems..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9"
                  />
                </div>
                <Select value={selectedTopic} onValueChange={setSelectedTopic}>
                  <SelectTrigger>
                    <SelectValue placeholder="All Topics" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Topics</SelectItem>
                    {topics.map((topic: any) => (
                      <SelectItem key={topic.id} value={topic.id}>
                        {topic.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={selectedDifficulty} onValueChange={setSelectedDifficulty}>
                  <SelectTrigger>
                    <SelectValue placeholder="All Difficulties" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Difficulties</SelectItem>
                    <SelectItem value="easy">Easy</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="hard">Hard</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Due Date */}
              <div>
                <Label htmlFor="due-date">Due Date (Optional)</Label>
                <Input
                  id="due-date"
                  type="datetime-local"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="mt-1"
                />
              </div>

              {/* Problem List */}
              <div className="flex-1 overflow-y-auto space-y-2 max-h-[300px] border rounded-lg p-3">
                {problems.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">
                    No problems found
                  </p>
                ) : (
                  problems.map((problem: any) => (
                    <div
                      key={problem.id}
                      className="flex items-center justify-between p-3 bg-muted/30 rounded-lg hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <Badge variant={getDifficultyColor(problem.difficulty) as any}>
                          {problem.difficulty}
                        </Badge>
                        <span className="font-medium truncate">{problem.title}</span>
                        {problem.leetcode_slug && (
                          <a
                            href={`https://leetcode.com/problems/${problem.leetcode_slug}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-muted-foreground hover:text-primary"
                          >
                            <ExternalLink className="h-4 w-4" />
                          </a>
                        )}
                      </div>
                      <Button
                        size="sm"
                        variant={isAlreadyAssigned(problem.id) ? "secondary" : "default"}
                        disabled={isAlreadyAssigned(problem.id) || assignProblem.isPending}
                        onClick={() => assignProblem.mutate(problem.id)}
                      >
                        {isAlreadyAssigned(problem.id) ? (
                          <>
                            <CheckCircle2 className="h-4 w-4 mr-1" />
                            Assigned
                          </>
                        ) : (
                          "Assign"
                        )}
                      </Button>
                    </div>
                  ))
                )}
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Extend Due Date Dialog */}
      <Dialog open={extendDialogOpen} onOpenChange={setExtendDialogOpen}>
        <DialogContent aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle>Extend Due Date</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <p className="text-sm text-muted-foreground mb-2">
                Problem: <span className="font-medium text-foreground">{selectedAssignment?.problem?.title}</span>
              </p>
              <Label htmlFor="new-due-date">New Due Date</Label>
              <Input
                id="new-due-date"
                type="datetime-local"
                value={newDueDate}
                onChange={(e) => setNewDueDate(e.target.value)}
                className="mt-1"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setExtendDialogOpen(false)}>
                Cancel
              </Button>
              <Button 
                onClick={() => extendDueDate.mutate({ assignmentId: selectedAssignment?.id, newDate: newDueDate })}
                disabled={!newDueDate || extendDueDate.isPending}
              >
                {extendDueDate.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : null}
                Extend & Notify Students
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Assigned Problems List */}
      {assignmentsLoading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : assignmentsWithProblems.length === 0 ? (
        <Card className="p-12 text-center">
          <BookOpen className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium mb-2">No assignments yet</h3>
          <p className="text-muted-foreground mb-4">
            Assign problems for your students to practice
          </p>
          <Button onClick={() => setDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Assign First Problem
          </Button>
        </Card>
      ) : (
        <div className="space-y-3">
          {assignmentsWithProblems.map((assignment: any) => {
            const stats = getAssignmentStats(assignment.problem_id);
            const overdue = assignment.due_date && isOverdue(assignment.due_date);

            return (
              <Card
                key={assignment.id}
                className="p-4 hover:border-primary/30 transition-colors"
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <Badge variant={getDifficultyColor(assignment.problem?.difficulty) as any}>
                      {assignment.problem?.difficulty || "Unknown"}
                    </Badge>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium truncate">
                        {assignment.problem?.title || "Unknown Problem"}
                      </p>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          Assigned: {new Date(assignment.created_at).toLocaleDateString()}
                        </span>
                        {assignment.due_date && (
                          <span className={`flex items-center gap-1 ${overdue ? "text-destructive" : ""}`}>
                            <Clock className="h-3 w-3" />
                            Due: {new Date(assignment.due_date).toLocaleDateString()}
                            {overdue && " (Overdue)"}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {assignment.problem?.leetcode_slug && (
                      <Button variant="outline" size="sm" asChild>
                        <a
                          href={`https://leetcode.com/problems/${assignment.problem.leetcode_slug}`}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <ExternalLink className="h-4 w-4" />
                        </a>
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openExtendDialog(assignment)}
                    >
                      <CalendarPlus className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-destructive"
                      onClick={() => {
                        if (confirm("Remove this assignment?")) {
                          removeAssignment.mutate(assignment.id);
                        }
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                {/* Completion Status */}
                <div className="mt-3 pt-3 border-t">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2 text-sm">
                      <Users className="h-4 w-4 text-muted-foreground" />
                      <span>
                        <span className="font-medium">{stats.completed}</span>
                        <span className="text-muted-foreground">/{stats.total} students completed</span>
                      </span>
                    </div>
                    <Badge variant={stats.percentage === 100 ? "success" : stats.percentage > 50 ? "default" : "secondary"}>
                      {stats.percentage}%
                    </Badge>
                  </div>
                  <Progress value={stats.percentage} className="h-2" />
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
