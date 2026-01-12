import { useState, useEffect, useMemo } from "react";
import { useNavigate, Link } from "react-router-dom";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/contexts/AuthContext";
import { usePaymentAccess } from "@/hooks/usePaymentAccess";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  RefreshCw,
  Calendar,
  CheckCircle2,
  ExternalLink,
  Loader2,
  Brain,
  Flame,
  Clock,
  ThumbsUp,
  ThumbsDown,
  Meh,
  Zap,
  AlertCircle,
  Crown,
  Lock,
} from "lucide-react";

interface Problem {
  id: string;
  title: string;
  slug: string;
  leetcode_id: number | null;
  leetcode_slug: string | null;
  difficulty: string;
}

interface ReviewItem {
  id: string;
  problem_id: string;
  status: string;
  next_review_at: string | null;
  interval_days: number;
  ease_factor: number;
  repetitions: number;
  solved_at: string | null;
  problem: Problem;
}

// SM-2 Algorithm implementation
function calculateNextReview(
  quality: number, // 0-5: 0=complete blackout, 5=perfect
  repetitions: number,
  easeFactor: number,
  intervalDays: number
): { nextInterval: number; newEaseFactor: number; newRepetitions: number } {
  let newEaseFactor = easeFactor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
  
  // Minimum ease factor of 1.3
  if (newEaseFactor < 1.3) newEaseFactor = 1.3;
  
  let newRepetitions: number;
  let nextInterval: number;

  if (quality < 3) {
    // Failed - reset
    newRepetitions = 0;
    nextInterval = 1;
  } else {
    newRepetitions = repetitions + 1;
    
    if (newRepetitions === 1) {
      nextInterval = 1;
    } else if (newRepetitions === 2) {
      nextInterval = 6;
    } else {
      nextInterval = Math.round(intervalDays * newEaseFactor);
    }
  }

  return { nextInterval, newEaseFactor, newRepetitions };
}

export default function Revision() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { hasRevision, paidFeaturesEnabled, isLoading: accessLoading } = usePaymentAccess();
  
  const [reviewItems, setReviewItems] = useState<ReviewItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [reviewingItem, setReviewingItem] = useState<ReviewItem | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Check if user has revision access (trial, pro, or domain whitelist)
  const hasRevisionAccess = !paidFeaturesEnabled || hasRevision;

  // Fetch problems due for review
  useEffect(() => {
    const fetchReviewItems = async () => {
      if (!user) {
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from("user_problem_progress")
        .select(`
          id,
          problem_id,
          status,
          next_review_at,
          interval_days,
          ease_factor,
          repetitions,
          solved_at,
          problem:problems (
            id,
            title,
            slug,
            leetcode_id,
            leetcode_slug,
            difficulty
          )
        `)
        .eq("user_id", user.id)
        .in("status", ["solved", "revision"])
        .order("next_review_at", { ascending: true, nullsFirst: true });

      if (error) {
        console.error("Error fetching review items:", error);
        toast.error("Failed to load revision items");
      } else {
        // Transform and filter
        const items = (data || [])
          .filter((item) => item.problem)
          .map((item) => ({
            ...item,
            problem: item.problem as unknown as Problem,
            interval_days: item.interval_days || 1,
            ease_factor: item.ease_factor || 2.5,
            repetitions: item.repetitions || 0,
          }));
        setReviewItems(items);
      }
      setLoading(false);
    };

    fetchReviewItems();
  }, [user]);

  // Categorize items
  const { dueNow, dueToday, upcoming, mastered } = useMemo(() => {
    const now = new Date();
    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999);

    const dueNow: ReviewItem[] = [];
    const dueToday: ReviewItem[] = [];
    const upcoming: ReviewItem[] = [];
    const mastered: ReviewItem[] = [];

    reviewItems.forEach((item) => {
      if (!item.next_review_at) {
        // Never reviewed, due now
        dueNow.push(item);
      } else {
        const reviewDate = new Date(item.next_review_at);
        
        if (reviewDate <= now) {
          dueNow.push(item);
        } else if (reviewDate <= endOfDay) {
          dueToday.push(item);
        } else if (item.interval_days >= 30) {
          mastered.push(item);
        } else {
          upcoming.push(item);
        }
      }
    });

    return { dueNow, dueToday, upcoming, mastered };
  }, [reviewItems]);

  const handleStartReview = () => {
    if (dueNow.length > 0) {
      setReviewingItem(dueNow[0]);
    } else if (dueToday.length > 0) {
      setReviewingItem(dueToday[0]);
    }
  };

  const handleReviewResponse = async (quality: number) => {
    if (!reviewingItem || !user) return;

    setSubmitting(true);

    try {
      const { nextInterval, newEaseFactor, newRepetitions } = calculateNextReview(
        quality,
        reviewingItem.repetitions,
        reviewingItem.ease_factor,
        reviewingItem.interval_days
      );

      const nextReviewAt = new Date();
      nextReviewAt.setDate(nextReviewAt.getDate() + nextInterval);

      const { error } = await supabase
        .from("user_problem_progress")
        .update({
          next_review_at: nextReviewAt.toISOString(),
          interval_days: nextInterval,
          ease_factor: newEaseFactor,
          repetitions: newRepetitions,
          last_reviewed_at: new Date().toISOString(),
          review_count: reviewingItem.repetitions + 1,
          status: "revision",
        })
        .eq("id", reviewingItem.id);

      if (error) throw error;

      // Update local state
      setReviewItems((prev) =>
        prev.map((item) =>
          item.id === reviewingItem.id
            ? {
                ...item,
                next_review_at: nextReviewAt.toISOString(),
                interval_days: nextInterval,
                ease_factor: newEaseFactor,
                repetitions: newRepetitions,
              }
            : item
        )
      );

      // Move to next item
      const remainingDue = dueNow.filter((item) => item.id !== reviewingItem.id);
      if (remainingDue.length > 0) {
        setReviewingItem(remainingDue[0]);
      } else {
        setReviewingItem(null);
        toast.success("Review session complete!");
      }
    } catch (error: any) {
      console.error("Error updating review:", error);
      toast.error("Failed to save review");
    } finally {
      setSubmitting(false);
    }
  };

  if (!user) {
    return (
      <DashboardLayout title="Revision" subtitle="Sign in to access revision">
        <div className="flex items-center justify-center py-20">
          <Button onClick={() => navigate("/auth")}>Sign In</Button>
        </div>
      </DashboardLayout>
    );
  }

  if (loading) {
    return (
      <DashboardLayout title="Revision" subtitle="Loading...">
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  // Pro feature restriction
  if (!hasRevisionAccess) {
    return (
      <DashboardLayout title="Revision" subtitle="Spaced repetition to reinforce your learning">
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-center max-w-lg bg-card rounded-2xl border border-border shadow-card p-12">
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-primary/10 mx-auto mb-6">
              <Brain className="h-10 w-10 text-primary" />
            </div>
            <Badge variant="secondary" className="mb-4 bg-primary/10 text-primary">
              <Crown className="h-3 w-3 mr-1" />
              Pro Feature
            </Badge>
            <h2 className="text-2xl font-bold text-foreground mb-3">
              Unlock Spaced Repetition
            </h2>
            <p className="text-muted-foreground mb-6">
              Our spaced repetition system helps you remember concepts long-term by 
              scheduling reviews at optimal intervals. Upgrade to Pro to access this feature.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <Button size="lg" asChild className="gap-2">
                <Link to="/pricing">
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

  // Review mode
  if (reviewingItem) {
    return (
      <DashboardLayout title="Review Session" subtitle="How well did you remember this problem?">
        <div className="max-w-2xl mx-auto">
          <Card className="mb-6">
            <CardHeader className="text-center pb-4">
              <Badge
                variant={
                  reviewingItem.problem.difficulty === "easy"
                    ? "easy"
                    : reviewingItem.problem.difficulty === "medium"
                    ? "medium"
                    : "hard"
                }
                className="w-fit mx-auto mb-4"
              >
                {reviewingItem.problem.difficulty.charAt(0).toUpperCase() + 
                  reviewingItem.problem.difficulty.slice(1)}
              </Badge>
              <CardTitle className="text-2xl">{reviewingItem.problem.title}</CardTitle>
              <CardDescription className="flex items-center justify-center gap-2 mt-2">
                <Clock className="h-4 w-4" />
                Interval: {reviewingItem.interval_days} day{reviewingItem.interval_days !== 1 ? "s" : ""}
                <span className="mx-2">•</span>
                Reviews: {reviewingItem.repetitions}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Link to problem */}
              {reviewingItem.problem.leetcode_slug && (
                <div className="text-center">
                  <Button variant="outline" asChild className="gap-2">
                    <a
                      href={`https://leetcode.com/problems/${reviewingItem.problem.leetcode_slug}`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <ExternalLink className="h-4 w-4" />
                      Open on LeetCode
                    </a>
                  </Button>
                </div>
              )}

              {/* Review buttons */}
              <div className="pt-4 border-t">
                <p className="text-center text-muted-foreground mb-4">
                  Rate how well you remembered the solution:
                </p>
                <div className="grid grid-cols-4 gap-3">
                  <Button
                    variant="outline"
                    className="flex flex-col h-auto py-4 border-[hsl(var(--hard))]/30 hover:bg-[hsl(var(--hard))]/10"
                    onClick={() => handleReviewResponse(1)}
                    disabled={submitting}
                  >
                    <ThumbsDown className="h-6 w-6 text-[hsl(var(--hard))] mb-1" />
                    <span className="text-xs">Again</span>
                    <span className="text-[10px] text-muted-foreground">1 day</span>
                  </Button>
                  <Button
                    variant="outline"
                    className="flex flex-col h-auto py-4 border-[hsl(var(--medium))]/30 hover:bg-[hsl(var(--medium))]/10"
                    onClick={() => handleReviewResponse(3)}
                    disabled={submitting}
                  >
                    <Meh className="h-6 w-6 text-[hsl(var(--medium))] mb-1" />
                    <span className="text-xs">Hard</span>
                    <span className="text-[10px] text-muted-foreground">
                      {Math.max(1, Math.round(reviewingItem.interval_days * 0.5))}d
                    </span>
                  </Button>
                  <Button
                    variant="outline"
                    className="flex flex-col h-auto py-4 border-[hsl(var(--easy))]/30 hover:bg-[hsl(var(--easy))]/10"
                    onClick={() => handleReviewResponse(4)}
                    disabled={submitting}
                  >
                    <ThumbsUp className="h-6 w-6 text-[hsl(var(--easy))] mb-1" />
                    <span className="text-xs">Good</span>
                    <span className="text-[10px] text-muted-foreground">
                      {Math.round(reviewingItem.interval_days * reviewingItem.ease_factor)}d
                    </span>
                  </Button>
                  <Button
                    variant="outline"
                    className="flex flex-col h-auto py-4 border-primary/30 hover:bg-primary/10"
                    onClick={() => handleReviewResponse(5)}
                    disabled={submitting}
                  >
                    <Zap className="h-6 w-6 text-primary mb-1" />
                    <span className="text-xs">Easy</span>
                    <span className="text-[10px] text-muted-foreground">
                      {Math.round(reviewingItem.interval_days * reviewingItem.ease_factor * 1.3)}d
                    </span>
                  </Button>
                </div>
              </div>

              {/* Skip button */}
              <div className="text-center">
                <Button
                  variant="ghost"
                  onClick={() => {
                    const remaining = dueNow.filter((item) => item.id !== reviewingItem.id);
                    if (remaining.length > 0) {
                      setReviewingItem(remaining[0]);
                    } else {
                      setReviewingItem(null);
                    }
                  }}
                >
                  Skip for now
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Progress */}
          <div className="text-center text-sm text-muted-foreground">
            {dueNow.length - 1} more to review
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout
      title="Revision"
      subtitle="Spaced repetition to reinforce your learning"
    >
      <div className="space-y-6">
        {/* Stats Cards */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className={dueNow.length > 0 ? "border-primary/50 bg-primary/5" : ""}>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className={`p-3 rounded-lg ${dueNow.length > 0 ? "bg-primary/10" : "bg-muted"}`}>
                  <AlertCircle className={`h-6 w-6 ${dueNow.length > 0 ? "text-primary" : "text-muted-foreground"}`} />
                </div>
                <div>
                  <p className="text-2xl font-bold">{dueNow.length}</p>
                  <p className="text-sm text-muted-foreground">Due Now</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-lg bg-[hsl(var(--warning))]/10">
                  <Calendar className="h-6 w-6 text-[hsl(var(--warning))]" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{dueToday.length}</p>
                  <p className="text-sm text-muted-foreground">Due Today</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-lg bg-[hsl(var(--info))]/10">
                  <Clock className="h-6 w-6 text-[hsl(var(--info))]" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{upcoming.length}</p>
                  <p className="text-sm text-muted-foreground">Upcoming</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-lg bg-[hsl(var(--success))]/10">
                  <Brain className="h-6 w-6 text-[hsl(var(--success))]" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{mastered.length}</p>
                  <p className="text-sm text-muted-foreground">Mastered</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Start Review Button */}
        {(dueNow.length > 0 || dueToday.length > 0) && (
          <Card className="bg-gradient-to-r from-primary/10 to-[hsl(var(--warning))]/10 border-primary/20">
            <CardContent className="py-8 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/20 mx-auto mb-4">
                <Flame className="h-8 w-8 text-primary" />
              </div>
              <h3 className="text-xl font-semibold mb-2">
                {dueNow.length > 0 
                  ? `${dueNow.length} problem${dueNow.length !== 1 ? "s" : ""} ready for review!`
                  : `${dueToday.length} problem${dueToday.length !== 1 ? "s" : ""} due today`
                }
              </h3>
              <p className="text-muted-foreground mb-4">
                Keep your knowledge fresh with spaced repetition
              </p>
              <Button size="lg" onClick={handleStartReview} className="gap-2">
                <RefreshCw className="h-5 w-5" />
                Start Review Session
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Empty state */}
        {reviewItems.length === 0 && (
          <Card>
            <CardContent className="py-12 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted mx-auto mb-4">
                <Brain className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="text-xl font-semibold mb-2">No problems in revision</h3>
              <p className="text-muted-foreground mb-4 max-w-md mx-auto">
                Mark problems as solved in the Topics or Companies section to add them to your revision queue.
              </p>
              <Button variant="outline" onClick={() => navigate("/topics")}>
                Go to Topics
              </Button>
            </CardContent>
          </Card>
        )}

        {/* All clear state */}
        {reviewItems.length > 0 && dueNow.length === 0 && dueToday.length === 0 && (
          <Card className="bg-[hsl(var(--success))]/5 border-[hsl(var(--success))]/20">
            <CardContent className="py-8 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[hsl(var(--success))]/20 mx-auto mb-4">
                <CheckCircle2 className="h-8 w-8 text-[hsl(var(--success))]" />
              </div>
              <h3 className="text-xl font-semibold mb-2">All caught up!</h3>
              <p className="text-muted-foreground">
                No reviews due right now. Keep solving new problems!
              </p>
            </CardContent>
          </Card>
        )}

        {/* Upcoming Reviews */}
        {upcoming.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Clock className="h-5 w-5 text-muted-foreground" />
                Upcoming Reviews
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {upcoming.slice(0, 5).map((item) => {
                  const reviewDate = new Date(item.next_review_at!);
                  const daysUntil = Math.ceil(
                    (reviewDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
                  );

                  return (
                    <div
                      key={item.id}
                      className="flex items-center justify-between p-3 rounded-lg bg-muted/30"
                    >
                      <div className="flex items-center gap-3">
                        <Badge
                          variant={
                            item.problem.difficulty === "easy"
                              ? "easy"
                              : item.problem.difficulty === "medium"
                              ? "medium"
                              : "hard"
                          }
                          className="w-16 justify-center"
                        >
                          {item.problem.difficulty.charAt(0).toUpperCase() +
                            item.problem.difficulty.slice(1)}
                        </Badge>
                        <span className="font-medium">{item.problem.title}</span>
                      </div>
                      <span className="text-sm text-muted-foreground">
                        in {daysUntil} day{daysUntil !== 1 ? "s" : ""}
                      </span>
                    </div>
                  );
                })}
                {upcoming.length > 5 && (
                  <p className="text-sm text-muted-foreground text-center pt-2">
                    +{upcoming.length - 5} more
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
