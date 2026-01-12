import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useTeacher } from "@/hooks/useTeacher";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Users,
  BookOpen,
  Trophy,
  ClipboardList,
  Plus,
  Copy,
  Trash2,
  Edit,
  Loader2,
  GraduationCap,
  Clock,
  CheckCircle2,
  BarChart3,
  FileText,
} from "lucide-react";
import { useNavigate } from "react-router-dom";

export default function TeacherDashboard() {
  const { user, loading: authLoading } = useAuth();
  const { teacher, isTeacher, isLoading: teacherLoading } = useTeacher();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  
  const [classroomDialogOpen, setClassroomDialogOpen] = useState(false);
  const [classroomForm, setClassroomForm] = useState({ name: "", description: "" });

  // Redirect if not authenticated or not teacher
  useEffect(() => {
    if (!authLoading && !teacherLoading) {
      if (!user) {
        navigate("/auth");
      } else if (!isTeacher) {
        navigate("/dashboard");
      }
    }
  }, [user, isTeacher, authLoading, teacherLoading, navigate]);

  // Fetch classrooms
  const { data: classrooms = [], isLoading: classroomsLoading } = useQuery({
    queryKey: ["teacher-classrooms", teacher?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("classrooms")
        .select("*")
        .eq("teacher_id", teacher!.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: !!teacher?.id,
  });

  // Fetch student counts for each classroom
  const { data: studentCounts = {} } = useQuery({
    queryKey: ["classroom-student-counts", classrooms.map(c => c.id)],
    queryFn: async () => {
      const counts: Record<string, number> = {};
      for (const classroom of classrooms) {
        const { count } = await supabase
          .from("classroom_students")
          .select("*", { count: "exact", head: true })
          .eq("classroom_id", classroom.id)
          .eq("is_active", true);
        counts[classroom.id] = count || 0;
      }
      return counts;
    },
    enabled: classrooms.length > 0,
  });

  // Create classroom mutation
  const createClassroom = useMutation({
    mutationFn: async () => {
      if (!teacher?.id) {
        throw new Error("Teacher account not found. Please refresh and try again.");
      }
      const { error } = await supabase.from("classrooms").insert({
        teacher_id: teacher.id,
        name: classroomForm.name.trim(),
        description: classroomForm.description.trim() || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["teacher-classrooms"] });
      setClassroomDialogOpen(false);
      setClassroomForm({ name: "", description: "" });
      toast.success("Classroom created!");
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to create classroom");
    },
  });

  // Delete classroom mutation
  const deleteClassroom = useMutation({
    mutationFn: async (classroomId: string) => {
      const { error } = await supabase.from("classrooms").delete().eq("id", classroomId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["teacher-classrooms"] });
      toast.success("Classroom deleted");
    },
  });

  const copyInviteLink = (inviteCode: string) => {
    const link = `${window.location.origin}/join/${inviteCode}`;
    navigator.clipboard.writeText(link);
    toast.success("Invite link copied!");
  };

  // Show loading while checking auth/teacher status
  if (authLoading || teacherLoading) {
    return (
      <DashboardLayout title="Teacher Dashboard">
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  // Don't render if not teacher (redirect will happen via useEffect)
  if (!isTeacher) {
    return null;
  }

  if (classroomsLoading) {
    return (
      <DashboardLayout title="Teacher Dashboard" subtitle={`Welcome, ${teacher?.name}`}>
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title="Teacher Dashboard" subtitle={`Welcome, ${teacher?.name}`}>
      {/* Stats */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <Card className="p-6">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-lg bg-primary/10">
              <GraduationCap className="h-6 w-6 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total Classrooms</p>
              <p className="text-2xl font-bold">{classrooms.length}</p>
            </div>
          </div>
        </Card>
        <Card className="p-6">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-lg bg-success/10">
              <Users className="h-6 w-6 text-success" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total Students</p>
              <p className="text-2xl font-bold">
                {Object.values(studentCounts).reduce((a, b) => a + b, 0)}
              </p>
            </div>
          </div>
        </Card>
        <Card className="p-6">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-lg bg-warning/10">
              <ClipboardList className="h-6 w-6 text-warning" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Active Tests</p>
              <p className="text-2xl font-bold">0</p>
            </div>
          </div>
        </Card>
        <Card className="p-6">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-lg bg-info/10">
              <BookOpen className="h-6 w-6 text-info" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Assigned Problems</p>
              <p className="text-2xl font-bold">0</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Classrooms */}
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold">Your Classrooms</h2>
        <Dialog open={classroomDialogOpen} onOpenChange={setClassroomDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              Create Classroom
            </Button>
          </DialogTrigger>
          <DialogContent aria-describedby={undefined}>
            <DialogHeader>
              <DialogTitle>Create New Classroom</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-4">
              <div>
                <Label>Classroom Name</Label>
                <Input
                  value={classroomForm.name}
                  onChange={(e) => setClassroomForm({ ...classroomForm, name: e.target.value })}
                  placeholder="e.g., DSA Batch 2024"
                />
              </div>
              <div>
                <Label>Description (Optional)</Label>
                <Textarea
                  value={classroomForm.description}
                  onChange={(e) => setClassroomForm({ ...classroomForm, description: e.target.value })}
                  placeholder="Brief description of the classroom..."
                  rows={3}
                />
              </div>
              <Button
                className="w-full"
                onClick={() => createClassroom.mutate()}
                disabled={createClassroom.isPending || !classroomForm.name.trim() || !teacher?.id}
              >
                {createClassroom.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  "Create Classroom"
                )}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {classrooms.length === 0 ? (
        <Card className="p-12 text-center">
          <GraduationCap className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium mb-2">No classrooms yet</h3>
          <p className="text-muted-foreground mb-4">
            Create your first classroom to start inviting students
          </p>
          <Button onClick={() => setClassroomDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Create Classroom
          </Button>
        </Card>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {classrooms.map((classroom) => (
            <Card key={classroom.id} className="hover:border-primary/50 transition-colors">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-lg">{classroom.name}</CardTitle>
                    <CardDescription className="line-clamp-2">
                      {classroom.description || "No description"}
                    </CardDescription>
                  </div>
                  <Badge variant={classroom.is_active ? "default" : "secondary"}>
                    {classroom.is_active ? "Active" : "Inactive"}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-4 mb-4 text-sm text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <Users className="h-4 w-4" />
                    <span>{studentCounts[classroom.id] || 0} students</span>
                  </div>
                </div>
                
                <div className="flex items-center gap-2 mb-4">
                  <code className="flex-1 text-xs bg-muted px-2 py-1 rounded truncate">
                    {window.location.origin}/join/{classroom.invite_code}
                  </code>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => copyInviteLink(classroom.invite_code)}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>

                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={() => navigate(`/teacher/classroom/${classroom.id}`)}
                  >
                    Manage
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-destructive"
                    onClick={() => {
                      if (confirm("Delete this classroom? All students will be removed.")) {
                        deleteClassroom.mutate(classroom.id);
                      }
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </DashboardLayout>
  );
}
