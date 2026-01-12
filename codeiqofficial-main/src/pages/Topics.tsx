import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { useLeetCode } from "@/hooks/useLeetCode";
import { useStreak } from "@/hooks/useStreak";
import { usePaymentAccess } from "@/hooks/usePaymentAccess";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ProblemNotesDialog } from "@/components/ProblemNotesDialog";
import { LeetCodeGate } from "@/components/LeetCodeGate";
import { AISolverDialog } from "@/components/AISolverDialog";
import { LockedScreen } from "@/components/LockedScreen";
import {
  CheckCircle2,
  ExternalLink,
  RefreshCw,
  ChevronRight,
  Search,
  Filter,
  Loader2,
  ShieldCheck,
  Bot,
} from "lucide-react";

interface Topic {
  id: string;
  name: string;
  slug: string;
  description: string;
  icon: string;
  color: string;
  problem_count: number;
  display_order: number;
}

interface Problem {
  id: string;
  topic_id: string;
  title: string;
  slug: string;
  leetcode_id: number | null;
  leetcode_slug: string | null;
  difficulty: string;
  description: string | null;
  companies: string[] | null;
  tags: string[] | null;
  is_premium: boolean;
  display_order: number;
}

interface UserProgress {
  problem_id: string;
  status: string;
  leetcode_verified: boolean;
  solved_at: string | null;
  notes: string | null;
}

const topicIcons: Record<string, string> = {
  arrays: "📊",
  strings: "📝",
  "linked-lists": "🔗",
  trees: "🌳",
  graphs: "🕸️",
  "dynamic-programming": "🧮",
  "binary-search": "🔍",
  "stack-queue": "📚",
  heap: "⛰️",
  backtracking: "🔙",
};

export default function Topics() {
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const { verifyProblem, loading: verifyLoading } = useLeetCode();
  const { updateStreak } = useStreak();
  const { isLocked, paidFeaturesEnabled } = usePaymentAccess();
  
  const [topics, setTopics] = useState<Topic[]>([]);
  const [problems, setProblems] = useState<Problem[]>([]);
  const [userProgress, setUserProgress] = useState<Map<string, UserProgress>>(new Map());
  const [selectedTopic, setSelectedTopic] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [markingProblem, setMarkingProblem] = useState<string | null>(null);
  const [aiSolverOpen, setAiSolverOpen] = useState(false);
  const [selectedProblemForAI, setSelectedProblemForAI] = useState<Problem | null>(null);

  // Fetch topics
  useEffect(() => {
    const fetchTopics = async () => {
      const { data, error } = await supabase
        .from("topics")
        .select("*")
        .order("display_order");
      
      if (error) {
        console.error("Error fetching topics:", error);
        toast.error("Failed to load topics");
      } else {
        setTopics(data || []);
      }
      setLoading(false);
    };

    fetchTopics();
  }, []);

  // Fetch problems when topic is selected
  useEffect(() => {
    const fetchProblems = async () => {
      if (!selectedTopic) {
        setProblems([]);
        return;
      }

      const { data, error } = await supabase
        .from("problems")
        .select("*")
        .eq("topic_id", selectedTopic)
        .order("display_order");

      if (error) {
        console.error("Error fetching problems:", error);
      } else {
        setProblems(data || []);
      }
    };

    fetchProblems();
  }, [selectedTopic]);

  // Fetch user progress
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

  // Calculate solved counts per topic
  const getTopicProgress = (topicId: string) => {
    const topicProblems = problems.filter((p) => p.topic_id === topicId);
    const solved = topicProblems.filter((p) => 
      userProgress.get(p.id)?.status === "solved"
    ).length;
    return { solved, total: topicProblems.length };
  };

  const handleMarkSolved = async (problem: Problem) => {
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
        // Verify with LeetCode
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

  const selectedTopicData = topics.find((t) => t.id === selectedTopic);
  const filteredProblems = problems.filter((p) =>
    p.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Count solved for selected topic
  const solvedInTopic = problems.filter((p) => 
    userProgress.get(p.id)?.status === "solved"
  ).length;

  if (loading) {
    return (
      <DashboardLayout title="Topic-wise Practice" subtitle="Loading...">
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  // Show locked screen if trial expired and no paid plan
  if (paidFeaturesEnabled && isLocked) {
    return (
      <DashboardLayout title="Topic-wise Practice" subtitle="Access Locked">
        <LockedScreen 
          title="Your Trial Has Expired"
          description="Your free trial has ended. Upgrade to a paid plan to continue practicing problems and advancing your skills."
        />
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout
      title="Topic-wise Practice"
      subtitle="Master DSA concepts one topic at a time"
    >
      <LeetCodeGate>
      <div className="grid lg:grid-cols-12 gap-6">
        {/* Topics Sidebar */}
        <div className="lg:col-span-4 xl:col-span-3">
          <div className="bg-card rounded-xl border border-border shadow-card p-4 sticky top-24">
            <h2 className="text-lg font-semibold text-foreground mb-4">Topics</h2>
            <div className="space-y-1">
              {topics.map((topic) => {
                const isActive = selectedTopic === topic.id;
                const icon = topicIcons[topic.slug] || "📁";

                return (
                  <button
                    key={topic.id}
                    onClick={() => setSelectedTopic(topic.id)}
                    className={`w-full flex items-center gap-3 p-3 rounded-lg transition-all duration-200 text-left ${
                      isActive
                        ? "bg-primary/10 border border-primary/30"
                        : "hover:bg-muted/50"
                    }`}
                  >
                    <span className="text-xl">{icon}</span>
                    <div className="flex-1 min-w-0">
                      <span
                        className={`font-medium text-sm ${
                          isActive ? "text-primary" : "text-foreground"
                        }`}
                      >
                        {topic.name}
                      </span>
                    </div>
                    <ChevronRight
                      className={`h-4 w-4 transition-transform ${
                        isActive ? "text-primary rotate-90" : "text-muted-foreground"
                      }`}
                    />
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Problems List */}
        <div className="lg:col-span-8 xl:col-span-9">
          {selectedTopic ? (
            <div className="space-y-4">
              {/* Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
                    <span>{topicIcons[selectedTopicData?.slug || ""] || "📁"}</span>
                    {selectedTopicData?.name}
                  </h2>
                  <p className="text-muted-foreground">
                    {solvedInTopic} of {problems.length} problems solved
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <input
                      type="text"
                      placeholder="Search problems..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-9 pr-4 py-2 rounded-lg bg-muted border border-border text-sm outline-none focus:ring-2 focus:ring-primary/20 w-48"
                    />
                  </div>
                  <Button variant="outline" size="icon">
                    <Filter className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {/* Problems Table */}
              <div className="bg-card rounded-xl border border-border shadow-card overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-border bg-muted/30">
                        <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-4 py-3 w-12">
                          Status
                        </th>
                        <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-4 py-3">
                          Problem
                        </th>
                        <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-4 py-3 w-24">
                          Difficulty
                        </th>
                        <th className="text-right text-xs font-medium text-muted-foreground uppercase tracking-wider px-4 py-3 w-40">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {filteredProblems.map((problem) => {
                        const progress = userProgress.get(problem.id);
                        const isSolved = progress?.status === "solved";
                        const isVerified = progress?.leetcode_verified;
                        const isMarking = markingProblem === problem.id;

                        return (
                          <tr
                            key={problem.id}
                            className="hover:bg-muted/30 transition-colors"
                          >
                            <td className="px-4 py-4">
                              {isSolved ? (
                                <div className="relative">
                                  <CheckCircle2 className="h-5 w-5 text-[hsl(var(--success))]" />
                                  {isVerified && (
                                    <ShieldCheck className="absolute -top-1 -right-1 h-3 w-3 text-primary" />
                                  )}
                                </div>
                              ) : (
                                <div className="h-5 w-5 rounded-full border-2 border-muted-foreground/30" />
                              )}
                            </td>
                            <td className="px-4 py-4">
                              <div className="flex items-center gap-2">
                                <span className="font-medium text-foreground">
                                  {problem.title}
                                </span>
                                {problem.companies && problem.companies.length > 0 && (
                                  <div className="hidden sm:flex items-center gap-1">
                                    {problem.companies.slice(0, 2).map((company) => (
                                      <span 
                                        key={company}
                                        className="text-[10px] px-1.5 py-0.5 bg-muted rounded text-muted-foreground"
                                      >
                                        {company}
                                      </span>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </td>
                            <td className="px-4 py-4">
                              <Badge
                                variant={
                                  problem.difficulty === "easy"
                                    ? "easy"
                                    : problem.difficulty === "medium"
                                    ? "medium"
                                    : "hard"
                                }
                              >
                                {problem.difficulty.charAt(0).toUpperCase() + problem.difficulty.slice(1)}
                              </Badge>
                            </td>
                            <td className="px-4 py-4">
                              <div className="flex items-center justify-end gap-1">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="gap-1 text-primary hover:text-primary"
                                  onClick={() => {
                                    setSelectedProblemForAI(problem);
                                    setAiSolverOpen(true);
                                  }}
                                >
                                  <Bot className="h-3.5 w-3.5" />
                                  AI
                                </Button>
                                <ProblemNotesDialog
                                  problemId={problem.id}
                                  problemTitle={problem.title}
                                  existingNotes={progress?.notes}
                                  hasProgress={!!progress}
                                />
                                {problem.leetcode_slug && (
                                  <Button 
                                    variant="ghost" 
                                    size="sm" 
                                    className="gap-1"
                                    asChild
                                  >
                                    <a 
                                      href={`https://leetcode.com/problems/${problem.leetcode_slug}`}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                    >
                                      <ExternalLink className="h-3.5 w-3.5" />
                                      Solve
                                    </a>
                                  </Button>
                                )}
                                {!isSolved && (
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
                                {isSolved && (
                                  <Button 
                                    variant="outline" 
                                    size="sm"
                                    onClick={() => {
                                      navigate("/revision");
                                    }}
                                  >
                                    <RefreshCw className="h-3.5 w-3.5 mr-1" />
                                    Revise
                                  </Button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                {filteredProblems.length === 0 && (
                  <div className="py-12 text-center text-muted-foreground">
                    No problems found
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="bg-card rounded-xl border border-border shadow-card p-12 text-center">
              <div className="text-6xl mb-4">📚</div>
              <h2 className="text-xl font-semibold text-foreground mb-2">
                Select a Topic
              </h2>
              <p className="text-muted-foreground max-w-md mx-auto">
                Choose a topic from the sidebar to view and practice problems. 
                Track your progress as you solve each problem.
              </p>
            </div>
          )}
        </div>
      </div>
      </LeetCodeGate>

      {/* AI Solver Dialog */}
      {selectedProblemForAI && (
        <AISolverDialog
          open={aiSolverOpen}
          onOpenChange={setAiSolverOpen}
          problemId={selectedProblemForAI.id}
          problemTitle={selectedProblemForAI.title}
          leetcodeId={selectedProblemForAI.leetcode_id}
          onNotesSaved={() => {
            // Refresh user progress to show updated notes
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
