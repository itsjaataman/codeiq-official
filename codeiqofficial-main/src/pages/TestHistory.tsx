import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Link } from "react-router-dom";
import {
  Clock,
  CheckCircle2,
  XCircle,
  Trophy,
  Loader2,
  ArrowLeft,
  ExternalLink,
  Calendar,
  Target,
  BarChart3,
} from "lucide-react";

export default function TestHistory() {
  const { user } = useAuth();

  // Fetch all submissions for this student
  const { data: submissions = [], isLoading } = useQuery({
    queryKey: ["test-history", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("test_submissions")
        .select(`
          *,
          classroom_tests (
            id,
            name,
            time_limit_minutes,
            difficulty,
            topics (name),
            classrooms (name)
          )
        `)
        .eq("student_id", user!.id)
        .not("submitted_at", "is", null)
        .order("submitted_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  // Fetch all answers for completed tests
  const { data: allAnswers = [] } = useQuery({
    queryKey: ["test-history-answers", submissions.map((s: any) => s.id)],
    queryFn: async () => {
      const submissionIds = submissions.map((s: any) => s.id);
      if (submissionIds.length === 0) return [];
      
      const { data, error } = await supabase
        .from("test_problem_answers")
        .select("*")
        .in("test_submission_id", submissionIds);
      if (error) throw error;
      return data;
    },
    enabled: submissions.length > 0,
  });

  // Fetch test questions with problems for each test
  const testIds = [...new Set(submissions.map((s: any) => s.test_id))];
  const { data: allQuestions = [] } = useQuery({
    queryKey: ["test-history-questions", testIds],
    queryFn: async () => {
      if (testIds.length === 0) return [];
      
      const { data, error } = await supabase
        .from("test_questions")
        .select("*, problems (*)")
        .in("test_id", testIds)
        .order("display_order");
      if (error) throw error;
      return data;
    },
    enabled: testIds.length > 0,
  });

  // Calculate stats
  const totalTests = submissions.length;
  const totalScore = submissions.reduce((acc: number, s: any) => acc + (s.score || 0), 0);
  const totalMaxScore = submissions.reduce((acc: number, s: any) => acc + (s.max_score || 0), 0);
  const avgPercentage = totalMaxScore > 0 ? Math.round((totalScore / totalMaxScore) * 100) : 0;

  if (isLoading) {
    return (
      <DashboardLayout title="Test History">
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title="Test History" subtitle="Review your past test attempts">
      <Button variant="ghost" className="mb-4" asChild>
        <Link to="/student">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Dashboard
        </Link>
      </Button>

      {/* Stats Overview */}
      <div className="grid sm:grid-cols-3 gap-4 mb-8">
        <Card className="p-6">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-lg bg-primary/10">
              <Target className="h-6 w-6 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Tests Completed</p>
              <p className="text-2xl font-bold">{totalTests}</p>
            </div>
          </div>
        </Card>
        <Card className="p-6">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-lg bg-success/10">
              <Trophy className="h-6 w-6 text-success" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total Score</p>
              <p className="text-2xl font-bold">{totalScore}/{totalMaxScore}</p>
            </div>
          </div>
        </Card>
        <Card className="p-6">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-lg bg-warning/10">
              <BarChart3 className="h-6 w-6 text-warning" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Average Score</p>
              <p className="text-2xl font-bold">{avgPercentage}%</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Test History */}
      {submissions.length === 0 ? (
        <Card className="p-12 text-center">
          <Trophy className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium mb-2">No Tests Completed Yet</h3>
          <p className="text-muted-foreground mb-4">
            Complete some tests to see your history here.
          </p>
          <Button asChild>
            <Link to="/student">Go to Dashboard</Link>
          </Button>
        </Card>
      ) : (
        <Accordion type="single" collapsible className="space-y-4">
          {submissions.map((submission: any) => {
            const test = submission.classroom_tests;
            const questions = allQuestions.filter((q: any) => q.test_id === test?.id);
            const answers = allAnswers.filter((a: any) => a.test_submission_id === submission.id);
            const answeredProblemIds = new Set(answers.filter((a: any) => a.is_verified).map((a: any) => a.problem_id));
            const scorePercentage = submission.max_score > 0 
              ? Math.round((submission.score / submission.max_score) * 100) 
              : 0;

            return (
              <AccordionItem 
                key={submission.id} 
                value={submission.id}
                className="border rounded-lg px-4"
              >
                <AccordionTrigger className="hover:no-underline py-4">
                  <div className="flex items-center justify-between w-full pr-4">
                    <div className="flex items-center gap-4">
                      <div className={`p-2 rounded-lg ${
                        scorePercentage >= 80 ? "bg-success/10" :
                        scorePercentage >= 50 ? "bg-warning/10" :
                        "bg-destructive/10"
                      }`}>
                        <Trophy className={`h-5 w-5 ${
                          scorePercentage >= 80 ? "text-success" :
                          scorePercentage >= 50 ? "text-warning" :
                          "text-destructive"
                        }`} />
                      </div>
                      <div className="text-left">
                        <h4 className="font-medium">{test?.name || "Unknown Test"}</h4>
                        <div className="flex items-center gap-3 text-sm text-muted-foreground mt-1">
                          <span>{test?.classrooms?.name}</span>
                          {test?.topics?.name && (
                            <Badge variant="outline" className="text-xs">{test.topics.name}</Badge>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold">{submission.score}/{submission.max_score}</span>
                          <Badge className={
                            scorePercentage >= 80 ? "bg-success" :
                            scorePercentage >= 50 ? "bg-warning" :
                            "bg-destructive"
                          }>
                            {scorePercentage}%
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                          <Calendar className="h-3 w-3" />
                          {new Date(submission.submitted_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="pb-4">
                  <div className="space-y-3 pt-2">
                    <div className="flex items-center justify-between text-sm mb-4">
                      <span className="text-muted-foreground">
                        Solved {answeredProblemIds.size} of {questions.length} problems
                      </span>
                      <Progress 
                        value={(answeredProblemIds.size / Math.max(questions.length, 1)) * 100} 
                        className="w-32 h-2"
                      />
                    </div>
                    
                    {questions.map((question: any, index: number) => {
                      const problem = question.problems;
                      const isSolved = answeredProblemIds.has(problem.id);

                      return (
                        <div 
                          key={question.id}
                          className={`flex items-center justify-between p-3 rounded-lg border ${
                            isSolved 
                              ? "border-success/30 bg-success/5" 
                              : "border-destructive/30 bg-destructive/5"
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            {isSolved ? (
                              <CheckCircle2 className="h-5 w-5 text-success" />
                            ) : (
                              <XCircle className="h-5 w-5 text-destructive" />
                            )}
                            <div>
                              <p className="font-medium text-sm">
                                {index + 1}. {problem.title}
                              </p>
                              <div className="flex items-center gap-2 mt-1">
                                <Badge 
                                  variant="outline" 
                                  className={`text-xs ${
                                    problem.difficulty === "easy" ? "border-success text-success" :
                                    problem.difficulty === "medium" ? "border-warning text-warning" :
                                    "border-destructive text-destructive"
                                  }`}
                                >
                                  {problem.difficulty}
                                </Badge>
                                <span className="text-xs text-muted-foreground">
                                  {question.points || 10} pts
                                </span>
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {isSolved ? (
                              <Badge className="bg-success text-xs">+{question.points || 10}</Badge>
                            ) : (
                              <Button
                                variant="outline"
                                size="sm"
                                asChild
                              >
                                <a
                                  href={`https://leetcode.com/problems/${problem.leetcode_slug || problem.slug}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-xs"
                                >
                                  <ExternalLink className="h-3 w-3 mr-1" />
                                  Practice
                                </a>
                              </Button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </AccordionContent>
              </AccordionItem>
            );
          })}
        </Accordion>
      )}
    </DashboardLayout>
  );
}