import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { 
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useAuth } from "@/contexts/AuthContext";
import { useLeetCode } from "@/hooks/useLeetCode";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Clock,
  CheckCircle2,
  ExternalLink,
  Loader2,
  ArrowLeft,
  AlertTriangle,
  Trophy,
  XCircle,
} from "lucide-react";

const TIMER_STORAGE_KEY = "test_timer_";

export default function TakeTest() {
  const { testId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { verifyProblem, loading: verifying } = useLeetCode();
  const queryClient = useQueryClient();

  const [timeRemaining, setTimeRemaining] = useState<number | null>(null);
  const [submissionId, setSubmissionId] = useState<string | null>(null);
  const [showSubmitDialog, setShowSubmitDialog] = useState(false);
  const [showTimeUpDialog, setShowTimeUpDialog] = useState(false);
  const [verifiedProblems, setVerifiedProblems] = useState<Set<string>>(new Set());
  const [verifyingProblemId, setVerifyingProblemId] = useState<string | null>(null);

  // Fetch test details
  const { data: test, isLoading: testLoading } = useQuery({
    queryKey: ["test", testId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("classroom_tests")
        .select("*, classrooms(name), topics(name)")
        .eq("id", testId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!testId,
  });

  // Fetch test questions with problems
  const { data: questions = [] } = useQuery({
    queryKey: ["test-questions", testId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("test_questions")
        .select("*, problems(*)")
        .eq("test_id", testId)
        .order("display_order");
      if (error) throw error;
      return data;
    },
    enabled: !!testId,
  });

  // Fetch existing submission
  const { data: existingSubmission } = useQuery({
    queryKey: ["test-submission", testId, user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("test_submissions")
        .select("*")
        .eq("test_id", testId)
        .eq("student_id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!testId && !!user?.id,
  });

  // Fetch answered problems
  const { data: answeredProblems = [] } = useQuery({
    queryKey: ["test-answers", submissionId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("test_problem_answers")
        .select("*")
        .eq("test_submission_id", submissionId);
      if (error) throw error;
      return data;
    },
    enabled: !!submissionId,
  });

  // Create submission mutation
  const createSubmission = useMutation({
    mutationFn: async () => {
      const maxScore = questions.reduce((acc: number, q: any) => acc + (q.points || 10), 0);
      const { data, error } = await supabase
        .from("test_submissions")
        .insert({
          test_id: testId,
          student_id: user!.id,
          max_score: maxScore,
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      setSubmissionId(data.id);
    },
  });

  // Submit test mutation
  const submitTest = useMutation({
    mutationFn: async () => {
      const score = verifiedProblems.size * 10; // 10 points per problem
      const { error } = await supabase
        .from("test_submissions")
        .update({
          submitted_at: new Date().toISOString(),
          score,
        })
        .eq("id", submissionId);
      if (error) throw error;
    },
    onSuccess: () => {
      localStorage.removeItem(TIMER_STORAGE_KEY + testId);
      toast.success("Test submitted successfully!");
      navigate("/student");
    },
  });

  // Initialize test
  useEffect(() => {
    if (existingSubmission) {
      setSubmissionId(existingSubmission.id);
      if (existingSubmission.submitted_at) {
        // Test already submitted
        navigate("/student");
        return;
      }
    } else if (test && user && !submissionId && questions.length > 0) {
      createSubmission.mutate();
    }
  }, [existingSubmission, test, user, questions.length]);

  // Initialize verified problems from database
  useEffect(() => {
    if (answeredProblems.length > 0) {
      const verified = new Set(
        answeredProblems
          .filter((a: any) => a.is_verified)
          .map((a: any) => a.problem_id)
      );
      setVerifiedProblems(verified);
    }
  }, [answeredProblems]);

  // Timer logic
  useEffect(() => {
    if (!test || !submissionId) return;

    const storedEndTime = localStorage.getItem(TIMER_STORAGE_KEY + testId);
    let endTime: number;

    if (storedEndTime) {
      endTime = parseInt(storedEndTime);
    } else {
      endTime = Date.now() + test.time_limit_minutes * 60 * 1000;
      localStorage.setItem(TIMER_STORAGE_KEY + testId, endTime.toString());
    }

    const updateTimer = () => {
      const remaining = Math.max(0, endTime - Date.now());
      setTimeRemaining(remaining);

      if (remaining <= 0) {
        setShowTimeUpDialog(true);
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);

    return () => clearInterval(interval);
  }, [test, submissionId, testId]);

  // Handle verify problem
  const handleVerifyProblem = useCallback(async (problem: any, questionPoints: number) => {
    if (!submissionId || verifiedProblems.has(problem.id)) return;

    setVerifyingProblemId(problem.id);
    
    const verified = await verifyProblem(
      problem.leetcode_slug || problem.slug,
      problem.id,
      problem.title
    );

    if (verified) {
      // Save to database
      await supabase.from("test_problem_answers").upsert({
        test_submission_id: submissionId,
        problem_id: problem.id,
        is_verified: true,
        verified_at: new Date().toISOString(),
      });

      setVerifiedProblems(prev => new Set([...prev, problem.id]));
      toast.success(`Problem "${problem.title}" verified!`);
    } else {
      toast.error("Problem not solved yet. Solve it on LeetCode first.");
    }

    setVerifyingProblemId(null);
  }, [submissionId, verifiedProblems, verifyProblem]);

  // Handle submit
  const handleSubmit = () => {
    setShowSubmitDialog(false);
    submitTest.mutate();
  };

  // Handle time up
  const handleTimeUp = () => {
    setShowTimeUpDialog(false);
    submitTest.mutate();
  };

  // Format time
  const formatTime = (ms: number) => {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
  };

  // Calculate progress
  const currentScore = verifiedProblems.size * 10;
  const maxScore = questions.reduce((acc: number, q: any) => acc + (q.points || 10), 0);
  const progressPercent = maxScore > 0 ? (currentScore / maxScore) * 100 : 0;

  // Time warning
  const timeWarning = timeRemaining !== null && timeRemaining <= 60000; // 1 minute
  const timeCritical = timeRemaining !== null && timeRemaining <= 300000; // 5 minutes

  if (testLoading) {
    return (
      <DashboardLayout title="Loading Test...">
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  if (!test) {
    return (
      <DashboardLayout title="Test Not Found">
        <Card className="p-12 text-center">
          <XCircle className="h-12 w-12 mx-auto text-destructive mb-4" />
          <p className="text-muted-foreground mb-4">Test not found or not active.</p>
          <Button onClick={() => navigate("/student")}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Dashboard
          </Button>
        </Card>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout 
      title={test.name}
      subtitle={test.classrooms?.name}
    >
      {/* Header with Timer */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b pb-4 mb-6 -mt-2 pt-2">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className={`flex items-center gap-2 text-2xl font-mono font-bold ${
              timeWarning ? "text-destructive animate-pulse" : 
              timeCritical ? "text-warning" : 
              "text-foreground"
            }`}>
              <Clock className="h-6 w-6" />
              {timeRemaining !== null ? formatTime(timeRemaining) : "--:--"}
            </div>
            {timeWarning && (
              <Badge variant="destructive" className="animate-pulse">
                <AlertTriangle className="h-3 w-3 mr-1" />
                Time running out!
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-4 w-full sm:w-auto">
            <div className="flex-1 sm:w-48">
              <div className="flex justify-between text-sm mb-1">
                <span>Score</span>
                <span className="font-medium">{currentScore}/{maxScore}</span>
              </div>
              <Progress value={progressPercent} className="h-2" />
            </div>
            <Button 
              onClick={() => setShowSubmitDialog(true)}
              disabled={submitTest.isPending}
            >
              {submitTest.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Submit Test"
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* Problems List */}
      <div className="space-y-4">
        {questions.map((question: any, index: number) => {
          const problem = question.problems;
          const isVerified = verifiedProblems.has(problem.id);
          const isVerifyingThis = verifyingProblemId === problem.id;

          return (
            <Card key={question.id} className={`p-6 transition-all ${
              isVerified ? "border-success/50 bg-success/5" : ""
            }`}>
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="text-lg font-bold text-muted-foreground">
                      #{index + 1}
                    </span>
                    <h3 className="font-semibold text-lg">{problem.title}</h3>
                    <Badge variant="outline" className={
                      problem.difficulty === "easy" ? "border-success text-success" :
                      problem.difficulty === "medium" ? "border-warning text-warning" :
                      "border-destructive text-destructive"
                    }>
                      {problem.difficulty}
                    </Badge>
                    <Badge variant="secondary">{question.points || 10} pts</Badge>
                    {isVerified && (
                      <Badge className="bg-success">
                        <CheckCircle2 className="h-3 w-3 mr-1" />
                        Solved
                      </Badge>
                    )}
                  </div>
                  {problem.description && (
                    <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
                      {problem.description}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    asChild
                  >
                    <a
                      href={`https://leetcode.com/problems/${problem.leetcode_slug || problem.slug}`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <ExternalLink className="h-4 w-4 mr-1" />
                      Open in LeetCode
                    </a>
                  </Button>
                  <Button
                    size="sm"
                    disabled={isVerified || isVerifyingThis || verifying}
                    onClick={() => handleVerifyProblem(problem, question.points || 10)}
                  >
                    {isVerifyingThis ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : isVerified ? (
                      <>
                        <CheckCircle2 className="h-4 w-4 mr-1" />
                        Verified
                      </>
                    ) : (
                      "Verify Solution"
                    )}
                  </Button>
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      {/* Submit Confirmation Dialog */}
      <AlertDialog open={showSubmitDialog} onOpenChange={setShowSubmitDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Submit Test?</AlertDialogTitle>
            <AlertDialogDescription>
              You have solved {verifiedProblems.size} out of {questions.length} problems.
              <br />
              Current score: {currentScore}/{maxScore}
              <br /><br />
              Once submitted, you cannot make any more changes.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Continue Test</AlertDialogCancel>
            <AlertDialogAction onClick={handleSubmit}>
              Submit Test
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Time Up Dialog */}
      <AlertDialog open={showTimeUpDialog} onOpenChange={() => {}}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-destructive" />
              Time's Up!
            </AlertDialogTitle>
            <AlertDialogDescription>
              Your time has expired. Your test will be submitted automatically.
              <br /><br />
              Final score: {currentScore}/{maxScore}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={handleTimeUp}>
              <Trophy className="h-4 w-4 mr-2" />
              View Results
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
}