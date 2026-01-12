import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Sparkles, ExternalLink, TrendingDown, Loader2, AlertCircle } from "lucide-react";
import { toast } from "sonner";

interface Recommendation {
  id: string;
  title: string;
  difficulty: string;
  slug: string;
  leetcode_slug: string;
  topicName: string;
  reason: string;
}

interface WeakTopic {
  id: string;
  name: string;
  completionRate: number;
  solved: number;
  total: number;
}

interface RecommendationResponse {
  recommendations: Recommendation[];
  weakTopics: WeakTopic[];
  preferredDifficulty: string;
  message?: string;
  error?: string;
}

const difficultyColors = {
  Easy: "bg-success/10 text-success border-success/20",
  Medium: "bg-warning/10 text-warning border-warning/20",
  Hard: "bg-destructive/10 text-destructive border-destructive/20",
};

export function DailyRecommendations() {
  const { user } = useAuth();

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["daily-recommendations", user?.id],
    queryFn: async (): Promise<RecommendationResponse> => {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;

      if (!token) {
        throw new Error("Not authenticated");
      }

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/daily-recommendation`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        if (response.status === 429) {
          toast.error("Rate limit exceeded. Please try again later.");
        } else if (response.status === 402) {
          toast.error("AI credits exhausted. Please add credits.");
        }
        throw new Error(errorData.error || "Failed to get recommendations");
      }

      return response.json();
    },
    enabled: !!user,
    staleTime: 1000 * 60 * 30, // Cache for 30 minutes
    retry: false,
  });

  if (!user) {
    return null;
  }

  if (isLoading) {
    return (
      <Card className="p-6 bg-card border-border">
        <div className="flex items-center gap-2 mb-4">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
          <span className="text-sm text-muted-foreground">Analyzing your progress...</span>
        </div>
        <div className="space-y-3">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </div>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="p-6 bg-card border-border">
        <div className="flex items-center gap-2 text-destructive mb-4">
          <AlertCircle className="h-5 w-5" />
          <span className="font-medium">Failed to load recommendations</span>
        </div>
        <p className="text-sm text-muted-foreground mb-4">
          {error instanceof Error ? error.message : "An error occurred"}
        </p>
        <Button variant="outline" size="sm" onClick={() => refetch()}>
          Try Again
        </Button>
      </Card>
    );
  }

  if (!data || data.recommendations.length === 0) {
    return (
      <Card className="p-6 bg-card border-border">
        <div className="flex items-center gap-2 mb-2">
          <Sparkles className="h-5 w-5 text-primary" />
          <h3 className="font-semibold text-foreground">Daily Recommendations</h3>
        </div>
        <p className="text-sm text-muted-foreground">
          {data?.message || "No recommendations available. Solve some problems to get personalized suggestions!"}
        </p>
      </Card>
    );
  }

  return (
    <Card className="p-6 bg-card border-border">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />
          <h3 className="font-semibold text-foreground">Today's Recommendations</h3>
        </div>
        <Badge variant="secondary" className="text-xs">
          AI Powered
        </Badge>
      </div>

      {/* Weak Topics */}
      {data.weakTopics && data.weakTopics.length > 0 && (
        <div className="mb-4 p-3 rounded-lg bg-muted/50">
          <div className="flex items-center gap-2 mb-2">
            <TrendingDown className="h-4 w-4 text-warning" />
            <span className="text-sm font-medium text-foreground">Focus Areas</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {data.weakTopics.map((topic) => (
              <Badge key={topic.id} variant="outline" className="text-xs">
                {topic.name} ({Math.round(topic.completionRate * 100)}%)
              </Badge>
            ))}
          </div>
        </div>
      )}

      {/* Recommendations */}
      <div className="space-y-3">
        {data.recommendations.map((problem, index) => (
          <div
            key={problem.id}
            className="p-4 rounded-lg border border-border bg-background hover:border-primary/30 transition-colors"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-bold text-primary">#{index + 1}</span>
                  <h4 className="font-medium text-foreground truncate">{problem.title}</h4>
                </div>
                <div className="flex items-center gap-2 mb-2">
                  <Badge
                    variant="outline"
                    className={`text-xs ${difficultyColors[problem.difficulty as keyof typeof difficultyColors]}`}
                  >
                    {problem.difficulty}
                  </Badge>
                  <Badge variant="secondary" className="text-xs">
                    {problem.topicName}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">{problem.reason}</p>
              </div>
              {problem.leetcode_slug && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="shrink-0"
                  asChild
                >
                  <a
                    href={`https://leetcode.com/problems/${problem.leetcode_slug}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <ExternalLink className="h-4 w-4" />
                  </a>
                </Button>
              )}
            </div>
          </div>
        ))}
      </div>

      <Button
        variant="outline"
        size="sm"
        className="w-full mt-4"
        onClick={() => refetch()}
      >
        <Sparkles className="h-4 w-4 mr-2" />
        Refresh Recommendations
      </Button>
    </Card>
  );
}
