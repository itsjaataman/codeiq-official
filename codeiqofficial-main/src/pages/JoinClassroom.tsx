import { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { GraduationCap, Loader2, Users, BookOpen, ArrowRight, CheckCircle2 } from "lucide-react";

export default function JoinClassroom() {
  const { inviteCode } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user, loading: authLoading } = useAuth();
  const [joining, setJoining] = useState(false);

  // Fetch classroom by invite code
  const { data: classroom, isLoading: classroomLoading, error } = useQuery({
    queryKey: ["classroom-invite", inviteCode],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("classrooms")
        .select(`
          *,
          teachers:teacher_id (name)
        `)
        .eq("invite_code", inviteCode)
        .eq("is_active", true)
        .single();

      if (error) throw error;
      return data;
    },
    enabled: !!inviteCode,
  });

  // Check if already a member
  const { data: existingMembership } = useQuery({
    queryKey: ["classroom-membership", classroom?.id, user?.id],
    queryFn: async () => {
      if (!user || !classroom) return null;
      
      const { data } = await supabase
        .from("classroom_students")
        .select("*")
        .eq("classroom_id", classroom.id)
        .eq("user_id", user.id)
        .eq("is_active", true)
        .maybeSingle();

      return data;
    },
    enabled: !!user && !!classroom,
  });

  const joinClassroom = async () => {
    if (!user || !classroom) return;

    setJoining(true);
    try {
      const { error } = await supabase.from("classroom_students").insert({
        classroom_id: classroom.id,
        user_id: user.id,
      });

      if (error) {
        if (error.message.includes("duplicate")) {
          toast.info("You're already in this classroom!");
        } else {
          throw error;
        }
      } else {
        toast.success("Successfully joined the classroom!");
        
        // Send classroom welcome email
        const { data: profile } = await supabase
          .from("profiles")
          .select("full_name, email")
          .eq("user_id", user.id)
          .single();
        
        if (profile?.email) {
          supabase.functions.invoke("welcome-email", {
            body: {
              to: profile.email,
              userName: profile.full_name || "Student",
              emailType: "classroom",
              classroomName: classroom.name,
              teacherName: (classroom as any).teachers?.name || "Teacher",
            },
          }).catch(console.error);
        }
      }
      
      // Invalidate classroom student cache to ensure proper redirect
      await queryClient.invalidateQueries({ queryKey: ["classroom-student"] });
      
      // Small delay to allow cache to update before navigating
      setTimeout(() => {
        navigate("/student");
      }, 100);
    } catch (error: any) {
      console.error("Error joining classroom:", error);
      toast.error("Failed to join classroom");
    } finally {
      setJoining(false);
    }
  };

  if (classroomLoading || authLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !classroom) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardHeader className="text-center">
            <CardTitle className="text-destructive">Invalid Invite Link</CardTitle>
            <CardDescription>
              This classroom invite link is invalid or has expired.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <Button asChild>
              <Link to="/">Go to Homepage</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Already a member
  if (existingMembership) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardHeader className="text-center">
            <div className="mx-auto p-4 rounded-full bg-success/10 mb-4">
              <CheckCircle2 className="h-12 w-12 text-success" />
            </div>
            <CardTitle>Already a Member!</CardTitle>
            <CardDescription>
              You're already part of {classroom.name}
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <Button onClick={() => navigate("/student")}>
              Go to Student Dashboard
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/30 flex items-center justify-center p-4">
      <Card className="max-w-lg w-full">
        <CardHeader className="text-center pb-2">
          <div className="mx-auto p-4 rounded-full bg-primary/10 mb-4">
            <GraduationCap className="h-12 w-12 text-primary" />
          </div>
          {(classroom as any).teachers?.name && (
            <div className="mb-2">
              <span className="text-sm text-muted-foreground">You've been invited by</span>
              <h2 className="text-xl font-semibold text-primary">{(classroom as any).teachers.name}</h2>
            </div>
          )}
          <CardTitle className="text-2xl">
            Join {classroom.name}
          </CardTitle>
          <CardDescription className="text-lg">
            to Master DSA
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {classroom.description && (
            <p className="text-center text-muted-foreground">
              {classroom.description}
            </p>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 rounded-lg bg-muted/50 text-center">
              <BookOpen className="h-6 w-6 mx-auto mb-2 text-primary" />
              <p className="text-sm text-muted-foreground">Access to</p>
              <p className="font-medium">All Problems</p>
            </div>
            <div className="p-4 rounded-lg bg-muted/50 text-center">
              <Users className="h-6 w-6 mx-auto mb-2 text-success" />
              <p className="text-sm text-muted-foreground">Classroom</p>
              <p className="font-medium">Leaderboard</p>
            </div>
          </div>

          <div className="p-4 rounded-lg bg-success/10 border border-success/20 text-center">
            <p className="text-success font-medium">✨ Free Access</p>
            <p className="text-sm text-muted-foreground">
              Students joining via teacher invite get free access to all features!
            </p>
          </div>

          {user ? (
            <Button 
              className="w-full" 
              size="lg" 
              onClick={joinClassroom}
              disabled={joining}
            >
              {joining ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Joining...
                </>
              ) : (
                <>
                  Join Classroom
                  <ArrowRight className="h-4 w-4 ml-2" />
                </>
              )}
            </Button>
          ) : (
            <div className="space-y-3">
              <Button 
                className="w-full" 
                size="lg" 
                asChild
              >
                <Link to={`/auth?redirect=/join/${inviteCode}`}>
                  Create Account to Join
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Link>
              </Button>
              <p className="text-center text-sm text-muted-foreground">
                Already have an account?{" "}
                <Link to={`/auth?redirect=/join/${inviteCode}`} className="text-primary hover:underline">
                  Sign in
                </Link>
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
