import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { useLeetCode } from "@/hooks/useLeetCode";
import { usePaymentAccess } from "@/hooks/usePaymentAccess";
import { useAppSettings } from "@/hooks/useAppSettings";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ProblemNotesDialog } from "@/components/ProblemNotesDialog";
import {
  Lock,
  Crown,
  Search,
  ChevronLeft,
  ExternalLink,
  CheckCircle2,
  ShieldCheck,
  Loader2,
  X,
  Sparkles,
} from "lucide-react";
import { Link } from "react-router-dom";

interface Company {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  description: string | null;
  problem_count: number | null;
}

interface Problem {
  id: string;
  title: string;
  slug: string;
  leetcode_id: number | null;
  leetcode_slug: string | null;
  difficulty: string;
  company_id: string | null;
}

interface UserProgress {
  problem_id: string;
  status: string;
  leetcode_verified: boolean;
  notes: string | null;
}

function CompanyLogo({ company, size = "md" }: { company: Company; size?: "sm" | "md" | "lg" }) {
  const sizeClasses = {
    sm: "h-8 w-8",
    md: "h-12 w-12",
    lg: "h-16 w-16",
  };
  const textSizeClasses = {
    sm: "text-xs",
    md: "text-sm",
    lg: "text-lg",
  };

  if (company.logo_url) {
    return (
      <img
        src={company.logo_url}
        alt={company.name}
        className={`${sizeClasses[size]} rounded-xl object-contain bg-muted p-1`}
      />
    );
  }

  return (
    <div
      className={`${sizeClasses[size]} ${textSizeClasses[size]} rounded-xl flex items-center justify-center font-bold bg-primary/10 text-primary`}
    >
      {company.name.charAt(0)}
    </div>
  );
}

export default function Companies() {
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const { verifyProblem, loading: verifyLoading } = useLeetCode();
  const { hasCompanyWise, paidFeaturesEnabled } = usePaymentAccess();
  const { settings, isLoading: settingsLoading } = useAppSettings();

  const [companies, setCompanies] = useState<Company[]>([]);
  const [problems, setProblems] = useState<Problem[]>([]);
  const [userProgress, setUserProgress] = useState<Map<string, UserProgress>>(new Map());
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);
  const [difficultyFilter, setDifficultyFilter] = useState<string | null>(null);
  const [markingProblem, setMarkingProblem] = useState<string | null>(null);

  // Company-wise access includes trial users, pro users, or domain whitelist
  const hasCompanyWiseAccess = !paidFeaturesEnabled || hasCompanyWise;

  // Fetch companies
  useEffect(() => {
    const fetchCompanies = async () => {
      const { data, error } = await supabase
        .from("companies")
        .select("id, name, slug, logo_url, description, problem_count")
        .order("display_order");

      if (error) {
        console.error("Error fetching companies:", error);
      } else {
        setCompanies(data || []);
      }
      setLoading(false);
    };

    fetchCompanies();
  }, []);

  // Fetch problems for selected company
  useEffect(() => {
    const fetchProblems = async () => {
      if (!selectedCompany) {
        setProblems([]);
        return;
      }

      const { data, error } = await supabase
        .from("problems")
        .select("id, title, slug, leetcode_id, leetcode_slug, difficulty, company_id")
        .eq("company_id", selectedCompany.id)
        .order("display_order");

      if (error) {
        console.error("Error fetching problems:", error);
      } else {
        setProblems(data || []);
      }
    };

    fetchProblems();
  }, [selectedCompany]);

  // Fetch user progress
  useEffect(() => {
    const fetchProgress = async () => {
      if (!user) return;

      const { data, error } = await supabase
        .from("user_problem_progress")
        .select("problem_id, status, leetcode_verified, notes")
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

  // Calculate solved count per company
  const companiesWithProgress = useMemo(() => {
    return companies.map((company) => {
      // Count solved problems for this company from all problems
      const companyProblems = problems.filter(p => p.company_id === company.id);
      const solved = companyProblems.filter(p => userProgress.get(p.id)?.status === "solved").length;
      return {
        ...company,
        solved,
      };
    });
  }, [companies, problems, userProgress]);

  // Filter companies by search
  const filteredCompanies = useMemo(() => {
    return companiesWithProgress.filter((c) =>
      c.name.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [companiesWithProgress, searchQuery]);

  // Filter problems by difficulty
  const filteredProblems = useMemo(() => {
    if (!selectedCompany) return [];
    let probs = problems;
    if (difficultyFilter) {
      probs = probs.filter((p) => p.difficulty === difficultyFilter);
    }
    return probs;
  }, [problems, difficultyFilter, selectedCompany]);

  // Calculate solved count for selected company
  const selectedCompanySolved = useMemo(() => {
    if (!selectedCompany) return 0;
    return problems.filter(p => userProgress.get(p.id)?.status === "solved").length;
  }, [problems, userProgress, selectedCompany]);

  const handleMarkSolved = async (problem: Problem) => {
    if (!user) {
      toast.error("Please sign in to track progress");
      navigate("/auth");
      return;
    }

    setMarkingProblem(problem.id);

    try {
      const shouldVerify = profile?.leetcode_verified && problem.leetcode_slug;
      let isVerified = false;

      if (shouldVerify) {
        isVerified = await verifyProblem(
          problem.leetcode_slug!,
          problem.leetcode_id?.toString(),
          problem.title
        );

        if (!isVerified) {
          toast.error("Problem not found in your LeetCode submissions");
          setMarkingProblem(null);
          return;
        }
      }

      // Calculate initial review date (1 day from now for first review)
      const nextReviewAt = new Date();
      nextReviewAt.setDate(nextReviewAt.getDate() + 1);

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

      setUserProgress((prev) => {
        const updated = new Map(prev);
        const existing = prev.get(problem.id);
        updated.set(problem.id, {
          problem_id: problem.id,
          status: "solved",
          leetcode_verified: isVerified,
          notes: existing?.notes || null,
        });
        return updated;
      });

      toast.success(isVerified ? "Verified and marked as solved!" : "Marked as solved");
    } catch (error: any) {
      toast.error(error.message || "Failed to mark problem");
    } finally {
      setMarkingProblem(null);
    }
  };

  // Show coming soon state if feature is disabled
  if (!settingsLoading && !settings.company_problems_enabled) {
    return (
      <DashboardLayout
        title="Company-wise Practice"
        subtitle="Practice problems asked by top tech companies"
      >
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-center max-w-lg bg-card rounded-2xl border border-border shadow-card p-12">
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-primary/20 to-primary/5 mx-auto mb-6">
              <Sparkles className="h-10 w-10 text-primary" />
            </div>
            <Badge variant="secondary" className="mb-4">
              Coming Soon
            </Badge>
            <h2 className="text-2xl font-bold text-foreground mb-3">
              Something Amazing is Coming!
            </h2>
            <p className="text-muted-foreground mb-6">
              We're working hard to bring you company-specific interview questions from top tech companies like Google, Amazon, Meta, and more. Stay tuned!
            </p>
            <Button variant="outline" size="lg" asChild>
              <Link to="/topics">Continue with Topics</Link>
            </Button>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  // Show locked state for users without company-wise access
  if (!hasCompanyWiseAccess) {
    return (
      <DashboardLayout
        title="Company-wise Practice"
        subtitle="Practice problems asked by top tech companies"
      >
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-center max-w-lg bg-card rounded-2xl border border-border shadow-card p-12">
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-primary/10 mx-auto mb-6">
              <Lock className="h-10 w-10 text-primary" />
            </div>
            <Badge variant="premium" className="mb-4">
              <Crown className="h-3 w-3 mr-1" />
              Pro Feature
            </Badge>
            <h2 className="text-2xl font-bold text-foreground mb-3">
              Unlock Company-wise Practice
            </h2>
            <p className="text-muted-foreground mb-6">
              Get access to problems asked by top tech companies like Google, Amazon, Meta, and more.
              Upgrade to Pro to start practicing company-specific questions.
            </p>

            {/* Preview of companies */}
            <div className="flex justify-center gap-2 mb-6">
              {companies.slice(0, 5).map((company) => (
                <CompanyLogo key={company.id} company={company} size="sm" />
              ))}
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <Button size="lg" asChild className="gap-2">
                <Link to="/#pricing">
                  <Crown className="h-4 w-4" />
                  Upgrade to Pro
                </Link>
              </Button>
              <Button variant="outline" size="lg" asChild>
                <Link to="/topics">Continue with Topics</Link>
              </Button>
            </div>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  if (loading) {
    return (
      <DashboardLayout title="Company-wise Practice" subtitle="Loading...">
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout
      title="Company-wise Practice"
      subtitle="Practice problems asked by top tech companies"
    >
      {selectedCompany ? (
        // Company Problems View
        <div className="space-y-4">
          {/* Back button and header */}
          <div className="flex items-center gap-4 mb-6">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => {
                setSelectedCompany(null);
                setDifficultyFilter(null);
              }}
            >
              <ChevronLeft className="h-5 w-5" />
            </Button>
            <div className="flex items-center gap-4">
              <CompanyLogo company={selectedCompany} size="lg" />
              <div>
                <h2 className="text-2xl font-bold text-foreground">{selectedCompany.name}</h2>
                <p className="text-muted-foreground">
                  {selectedCompanySolved} of {problems.length} solved
                </p>
              </div>
            </div>
          </div>

          {/* Difficulty filters */}
          <div className="flex items-center gap-2 mb-4">
            <span className="text-sm text-muted-foreground mr-2">Filter:</span>
            {["easy", "medium", "hard"].map((diff) => (
              <Button
                key={diff}
                variant={difficultyFilter === diff ? "default" : "outline"}
                size="sm"
                onClick={() => setDifficultyFilter(difficultyFilter === diff ? null : diff)}
                className={
                  difficultyFilter === diff
                    ? ""
                    : diff === "easy"
                    ? "text-[hsl(var(--easy))] border-[hsl(var(--easy))]/30"
                    : diff === "medium"
                    ? "text-[hsl(var(--medium))] border-[hsl(var(--medium))]/30"
                    : "text-[hsl(var(--hard))] border-[hsl(var(--hard))]/30"
                }
              >
                {diff.charAt(0).toUpperCase() + diff.slice(1)}
              </Button>
            ))}
            {difficultyFilter && (
              <Button variant="ghost" size="sm" onClick={() => setDifficultyFilter(null)}>
                <X className="h-4 w-4 mr-1" />
                Clear
              </Button>
            )}
          </div>

          {/* Problems table */}
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
                      <tr key={problem.id} className="hover:bg-muted/30 transition-colors">
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
                          <span className="font-medium text-foreground">{problem.title}</span>
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
                            <ProblemNotesDialog
                              problemId={problem.id}
                              problemTitle={problem.title}
                              existingNotes={progress?.notes}
                              hasProgress={!!progress}
                            />
                            {problem.leetcode_slug && (
                              <Button variant="ghost" size="sm" className="gap-1" asChild>
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
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {filteredProblems.length === 0 && (
              <div className="text-center py-12">
                <p className="text-muted-foreground">No problems found</p>
              </div>
            )}
          </div>
        </div>
      ) : (
        // Companies Grid View
        <div className="space-y-6">
          {/* Search */}
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search companies..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
            />
          </div>

          {/* Companies Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredCompanies.map((company) => (
              <button
                key={company.id}
                onClick={() => setSelectedCompany(company)}
                className="bg-card rounded-xl border border-border p-5 text-left hover:border-primary/50 hover:shadow-lg transition-all group"
              >
                <div className="flex items-start gap-4">
                  <CompanyLogo company={company} />
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors truncate">
                      {company.name}
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      {company.problem_count || 0} problems
                    </p>
                  </div>
                </div>
                {company.description && (
                  <p className="text-xs text-muted-foreground mt-3 line-clamp-2">
                    {company.description}
                  </p>
                )}
              </button>
            ))}
          </div>

          {filteredCompanies.length === 0 && (
            <div className="text-center py-12">
              <p className="text-muted-foreground">No companies found</p>
            </div>
          )}
        </div>
      )}
    </DashboardLayout>
  );
}
