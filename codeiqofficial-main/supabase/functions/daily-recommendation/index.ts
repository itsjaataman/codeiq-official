import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { 
  performSecurityChecks, 
  secureResponse,
  getCorsHeaders 
} from "../_shared/security.ts";

serve(async (req) => {
  const origin = req.headers.get("Origin");
  const corsHeaders = getCorsHeaders(origin);

  // Perform security checks: require auth, apply rate limiting
  const security = await performSecurityChecks(req, {
    requireAuth: true,
    functionName: "daily-recommendation",
  });

  if (!security.passed) {
    return security.response!;
  }

  try {
    const user = security.user;

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get user's solved problems
    const { data: progress } = await supabase
      .from("user_problem_progress")
      .select("problem_id")
      .eq("user_id", user.id)
      .eq("status", "solved");

    const solvedIds = progress?.map(p => p.problem_id) || [];

    // Get all problems with their topics
    const { data: problems } = await supabase
      .from("problems")
      .select("id, title, difficulty, slug, leetcode_slug, topic_id, tags");

    // Get all topics
    const { data: topics } = await supabase
      .from("topics")
      .select("id, name, slug");

    if (!problems || !topics) {
      return secureResponse(
        { error: "Failed to fetch data" },
        500,
        corsHeaders,
        security.rateLimitResult
      );
    }

    // Calculate topic-wise progress
    const topicStats: Record<string, { solved: number; total: number; name: string }> = {};
    
    for (const topic of topics) {
      topicStats[topic.id] = { solved: 0, total: 0, name: topic.name };
    }

    for (const problem of problems) {
      if (topicStats[problem.topic_id]) {
        topicStats[problem.topic_id].total++;
        if (solvedIds.includes(problem.id)) {
          topicStats[problem.topic_id].solved++;
        }
      }
    }

    // Find weak topics (lowest completion rate with at least some problems)
    const weakTopics = Object.entries(topicStats)
      .filter(([_, stats]) => stats.total > 0)
      .map(([id, stats]) => ({
        id,
        name: stats.name,
        completionRate: stats.total > 0 ? stats.solved / stats.total : 0,
        solved: stats.solved,
        total: stats.total,
      }))
      .sort((a, b) => a.completionRate - b.completionRate)
      .slice(0, 3);

    // Get unsolved problems from weak topics
    const unsolvedProblems = problems.filter(p => 
      !solvedIds.includes(p.id) && 
      weakTopics.some(t => t.id === p.topic_id)
    );

    // Get user profile for difficulty preference
    const { data: profile } = await supabase
      .from("profiles")
      .select("easy_solved, medium_solved, hard_solved")
      .eq("user_id", user.id)
      .single();

    // Determine recommended difficulty based on user's progress
    let preferredDifficulty = "Easy";
    if (profile) {
      const totalSolved = (profile.easy_solved || 0) + (profile.medium_solved || 0) + (profile.hard_solved || 0);
      if (totalSolved > 50) {
        preferredDifficulty = "Hard";
      } else if (totalSolved > 20) {
        preferredDifficulty = "Medium";
      }
    }

    // If no unsolved problems, return empty
    if (unsolvedProblems.length === 0) {
      return secureResponse(
        { 
          recommendations: [],
          weakTopics,
          message: "Great job! You've solved all problems in your weak topics."
        },
        200,
        corsHeaders,
        security.rateLimitResult
      );
    }

    // Use AI to generate personalized recommendation
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      // Fallback to simple recommendation without AI
      const recommendations = unsolvedProblems
        .sort((a, b) => {
          // Prioritize preferred difficulty
          const diffOrder: Record<string, number> = { Easy: 1, Medium: 2, Hard: 3 };
          const prefOrder = diffOrder[preferredDifficulty];
          const aDiff = Math.abs(diffOrder[a.difficulty] - prefOrder);
          const bDiff = Math.abs(diffOrder[b.difficulty] - prefOrder);
          return aDiff - bDiff;
        })
        .slice(0, 3)
        .map(p => ({
          ...p,
          topicName: topics.find(t => t.id === p.topic_id)?.name || "Unknown",
          reason: `This problem is from your weak topic and matches your current skill level.`
        }));

      return secureResponse(
        { 
          recommendations,
          weakTopics,
          preferredDifficulty 
        },
        200,
        corsHeaders,
        security.rateLimitResult
      );
    }

    // Use AI to select and explain recommendations
    const problemsContext = unsolvedProblems.slice(0, 20).map(p => ({
      id: p.id,
      title: p.title,
      difficulty: p.difficulty,
      topic: topics.find(t => t.id === p.topic_id)?.name,
      tags: p.tags,
    }));

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content: `You are a coding interview preparation assistant. Given a user's weak topics and available problems, select the 3 best problems to recommend for today's practice. Consider:
1. Balance between different weak topics
2. Progressive difficulty (if user is beginner, lean towards easier)
3. Variety in problem types

Return a JSON object with this exact structure:
{
  "recommendations": [
    {
      "id": "problem-uuid",
      "reason": "Brief personalized reason why this problem is good for the user (1 sentence)"
    }
  ]
}`
          },
          {
            role: "user",
            content: `User's weak topics (lowest completion rates):
${weakTopics.map(t => `- ${t.name}: ${t.solved}/${t.total} solved (${Math.round(t.completionRate * 100)}%)`).join("\n")}

User's preferred difficulty: ${preferredDifficulty}

Available unsolved problems:
${JSON.stringify(problemsContext, null, 2)}

Select the 3 best problems for today's practice.`
          }
        ],
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return secureResponse(
          { error: "Rate limit exceeded. Please try again later." },
          429,
          corsHeaders,
          security.rateLimitResult
        );
      }
      if (response.status === 402) {
        return secureResponse(
          { error: "AI credits exhausted. Please add credits to continue." },
          402,
          corsHeaders,
          security.rateLimitResult
        );
      }
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const aiData = await response.json();
    const aiContent = aiData.choices?.[0]?.message?.content || "";
    
    // Parse AI response
    let aiRecommendations: { id: string; reason: string }[] = [];
    try {
      const jsonMatch = aiContent.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        aiRecommendations = parsed.recommendations || [];
      }
    } catch (e) {
      console.error("Failed to parse AI response:", e);
    }

    // Map AI recommendations to full problem data
    const recommendations = aiRecommendations
      .map(rec => {
        const problem = unsolvedProblems.find(p => p.id === rec.id);
        if (!problem) return null;
        return {
          ...problem,
          topicName: topics.find(t => t.id === problem.topic_id)?.name || "Unknown",
          reason: rec.reason,
        };
      })
      .filter(Boolean)
      .slice(0, 3);

    // Fallback if AI didn't return valid recommendations
    if (recommendations.length === 0) {
      const fallbackRecs = unsolvedProblems.slice(0, 3).map(p => ({
        ...p,
        topicName: topics.find(t => t.id === p.topic_id)?.name || "Unknown",
        reason: "Recommended based on your weak topics.",
      }));
      return secureResponse(
        { 
          recommendations: fallbackRecs,
          weakTopics,
          preferredDifficulty 
        },
        200,
        corsHeaders,
        security.rateLimitResult
      );
    }

    return secureResponse(
      { 
        recommendations,
        weakTopics,
        preferredDifficulty 
      },
      200,
      corsHeaders,
      security.rateLimitResult
    );

  } catch (error) {
    console.error("Error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return secureResponse(
      { error: errorMessage },
      500,
      corsHeaders,
      security.rateLimitResult
    );
  }
});
