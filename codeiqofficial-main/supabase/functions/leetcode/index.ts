import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { 
  performSecurityChecks,
  authenticateRequest,
  secureResponse,
  getCorsHeaders,
  checkRateLimit,
  getClientIdentifier,
  rateLimitResponse
} from "../_shared/security.ts";

const LEETCODE_GRAPHQL_URL = "https://leetcode.com/graphql";

// GraphQL queries
const USER_PROFILE_QUERY = `
  query userPublicProfile($username: String!) {
    matchedUser(username: $username) {
      username
      profile {
        ranking
        realName
      }
      submitStats {
        acSubmissionNum {
          difficulty
          count
        }
      }
    }
  }
`;

const CONTEST_RANKING_QUERY = `
  query userContestRankingInfo($username: String!) {
    userContestRanking(username: $username) {
      rating
      globalRanking
    }
  }
`;

const RECENT_SUBMISSIONS_QUERY = `
  query recentAcSubmissions($username: String!, $limit: Int!) {
    recentAcSubmissionList(username: $username, limit: $limit) {
      id
      title
      titleSlug
      timestamp
    }
  }
`;

interface LeetCodeSubmission {
  id: string;
  title: string;
  titleSlug: string;
  timestamp: string;
}

// Make GraphQL request to LeetCode
async function leetcodeGraphQL(query: string, variables: Record<string, any>): Promise<any> {
  console.log("LeetCode GraphQL request:", JSON.stringify(variables));
  
  try {
    const response = await fetch(LEETCODE_GRAPHQL_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "Accept": "application/json",
      },
      body: JSON.stringify({ query, variables }),
    });

    console.log("LeetCode response status:", response.status);

    if (!response.ok) {
      const text = await response.text();
      console.error("LeetCode API error:", response.status, text);
      return null;
    }

    const result = await response.json();
    
    if (result.errors) {
      console.error("GraphQL errors:", JSON.stringify(result.errors));
      return null;
    }

    return result.data;
  } catch (error) {
    console.error("LeetCode fetch error:", error);
    return null;
  }
}

// Fetch user profile
async function fetchUserProfile(username: string) {
  const data = await leetcodeGraphQL(USER_PROFILE_QUERY, { username });
  return data?.matchedUser || null;
}

// Fetch contest ranking
async function fetchContestRanking(username: string) {
  const data = await leetcodeGraphQL(CONTEST_RANKING_QUERY, { username });
  return data?.userContestRanking || null;
}

// Fetch recent submissions
async function fetchRecentSubmissions(username: string, limit = 50): Promise<LeetCodeSubmission[]> {
  const data = await leetcodeGraphQL(RECENT_SUBMISSIONS_QUERY, { username, limit });
  return data?.recentAcSubmissionList || [];
}

// Check if problem was solved
function verifyProblemSolved(submissions: LeetCodeSubmission[], problemSlug: string): boolean {
  const normalizedSlug = problemSlug.toLowerCase().trim();
  return submissions.some((sub) => sub.titleSlug?.toLowerCase() === normalizedSlug);
}

serve(async (req) => {
  const origin = req.headers.get("Origin");
  const corsHeaders = getCorsHeaders(origin);

  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  const url = new URL(req.url);
  const action = url.searchParams.get("action");
  console.log(`Action: ${action}`);

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Handle public endpoints first (no auth required, but rate limited)
    if (action === "get-profile") {
      // Rate limit by IP for public endpoint
      const clientId = getClientIdentifier(req);
      const rateLimitResult = checkRateLimit(clientId, "leetcode");
      
      if (!rateLimitResult.allowed) {
        return rateLimitResponse(rateLimitResult, corsHeaders);
      }

      const username = url.searchParams.get("username");
      if (!username) {
        return secureResponse(
          { error: "Username is required" },
          400,
          corsHeaders,
          rateLimitResult
        );
      }

      console.log(`Fetching public profile for: ${username}`);
      const [lcProfile, lcContest] = await Promise.all([
        fetchUserProfile(username),
        fetchContestRanking(username),
      ]);

      if (!lcProfile) {
        return secureResponse(
          { error: "User not found or LeetCode API unavailable" },
          404,
          corsHeaders,
          rateLimitResult
        );
      }

      const acStats = lcProfile.submitStats?.acSubmissionNum || [];
      return secureResponse(
        {
          username: lcProfile.username,
          realName: lcProfile.profile?.realName || "",
          totalSolved: acStats.find((s: any) => s.difficulty === "All")?.count || 0,
          easySolved: acStats.find((s: any) => s.difficulty === "Easy")?.count || 0,
          mediumSolved: acStats.find((s: any) => s.difficulty === "Medium")?.count || 0,
          hardSolved: acStats.find((s: any) => s.difficulty === "Hard")?.count || 0,
          ranking: lcProfile.profile?.ranking || null,
          contestRating: lcContest?.rating ? Math.round(lcContest.rating) : null,
        },
        200,
        corsHeaders,
        rateLimitResult
      );
    }

    // All other actions require authentication
    const authResult = await authenticateRequest(req);
    if (!authResult.authenticated || !authResult.user) {
      return secureResponse(
        { error: "Authentication required", message: authResult.error },
        401,
        corsHeaders
      );
    }

    const user = authResult.user;
    
    // Rate limit by user ID for authenticated endpoints
    const clientId = getClientIdentifier(req, user.id);
    const rateLimitResult = checkRateLimit(clientId, "leetcode");
    
    if (!rateLimitResult.allowed) {
      return rateLimitResponse(rateLimitResult, corsHeaders);
    }

    console.log(`Authenticated user: ${user.id}`);

    switch (action) {
      case "sync-stats": {
        const { data: profile } = await supabase
          .from("profiles")
          .select("leetcode_username")
          .eq("user_id", user.id)
          .single();

        if (!profile?.leetcode_username) {
          return secureResponse(
            { error: "LeetCode username not set" },
            400,
            corsHeaders,
            rateLimitResult
          );
        }

        console.log(`Syncing stats for: ${profile.leetcode_username}`);
        const [lcProfile, lcContest] = await Promise.all([
          fetchUserProfile(profile.leetcode_username),
          fetchContestRanking(profile.leetcode_username),
        ]);

        if (!lcProfile) {
          return secureResponse(
            { error: "Failed to fetch LeetCode data" },
            503,
            corsHeaders,
            rateLimitResult
          );
        }

        const acStats = lcProfile.submitStats?.acSubmissionNum || [];
        const stats = {
          totalSolved: acStats.find((s: any) => s.difficulty === "All")?.count || 0,
          easySolved: acStats.find((s: any) => s.difficulty === "Easy")?.count || 0,
          mediumSolved: acStats.find((s: any) => s.difficulty === "Medium")?.count || 0,
          hardSolved: acStats.find((s: any) => s.difficulty === "Hard")?.count || 0,
          ranking: lcProfile.profile?.ranking || null,
          contestRating: lcContest?.rating ? Math.round(lcContest.rating) : null,
        };

        await supabase.from("profiles").update({
          total_solved: stats.totalSolved,
          easy_solved: stats.easySolved,
          medium_solved: stats.mediumSolved,
          hard_solved: stats.hardSolved,
          leetcode_ranking: stats.ranking,
          contest_rating: stats.contestRating,
          last_stats_sync: new Date().toISOString(),
        }).eq("user_id", user.id);

        return secureResponse(
          { success: true, stats },
          200,
          corsHeaders,
          rateLimitResult
        );
      }

      case "verify-username": {
        const body = await req.json();
        const { username } = body;

        if (!username) {
          return secureResponse(
            { error: "Username is required" },
            400,
            corsHeaders,
            rateLimitResult
          );
        }

        console.log(`Starting verification for: ${username}`);
        const lcProfile = await fetchUserProfile(username);
        
        if (!lcProfile) {
          return secureResponse(
            { error: "LeetCode username not found. Please check the spelling." },
            404,
            corsHeaders,
            rateLimitResult
          );
        }

        // Generate a unique token
        const token = `CIQ${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
        console.log(`Generated token: ${token}`);

        // Save username to profile
        await supabase.from("profiles").update({
          leetcode_username: username,
          leetcode_verified: false,
        }).eq("user_id", user.id);

        return secureResponse(
          {
            success: true,
            token,
            currentName: lcProfile.profile?.realName || "",
            instruction: `Add "${token}" to your LeetCode display name, save, then click Verify.`,
          },
          200,
          corsHeaders,
          rateLimitResult
        );
      }

      case "complete-verification": {
        const body = await req.json();
        const { token } = body;

        if (!token) {
          return secureResponse(
            { error: "Token is required" },
            400,
            corsHeaders,
            rateLimitResult
          );
        }

        const { data: profile } = await supabase
          .from("profiles")
          .select("leetcode_username")
          .eq("user_id", user.id)
          .single();

        if (!profile?.leetcode_username) {
          return secureResponse(
            { error: "No username to verify" },
            400,
            corsHeaders,
            rateLimitResult
          );
        }

        console.log(`Verifying ${profile.leetcode_username} with token ${token}`);
        const lcProfile = await fetchUserProfile(profile.leetcode_username);
        
        if (!lcProfile) {
          return secureResponse(
            { error: "Failed to fetch LeetCode profile. Please try again." },
            503,
            corsHeaders,
            rateLimitResult
          );
        }

        const realName = lcProfile.profile?.realName || "";
        console.log(`Current LeetCode name: "${realName}"`);
        
        // Check if token exists in the name (case insensitive)
        const isVerified = realName.toUpperCase().includes(token.toUpperCase());
        console.log(`Token found: ${isVerified}`);

        if (isVerified) {
          const acStats = lcProfile.submitStats?.acSubmissionNum || [];
          
          await supabase.from("profiles").update({
            leetcode_verified: true,
            total_solved: acStats.find((s: any) => s.difficulty === "All")?.count || 0,
            easy_solved: acStats.find((s: any) => s.difficulty === "Easy")?.count || 0,
            medium_solved: acStats.find((s: any) => s.difficulty === "Medium")?.count || 0,
            hard_solved: acStats.find((s: any) => s.difficulty === "Hard")?.count || 0,
            leetcode_ranking: lcProfile.profile?.ranking || null,
            last_stats_sync: new Date().toISOString(),
          }).eq("user_id", user.id);

          return secureResponse(
            { verified: true, message: "LeetCode account verified!" },
            200,
            corsHeaders,
            rateLimitResult
          );
        }

        return secureResponse(
          {
            verified: false,
            message: `Token not found. Your current LeetCode name is "${realName}". Add "${token}" to it and save.`,
            currentName: realName,
          },
          200,
          corsHeaders,
          rateLimitResult
        );
      }

      case "verify-problem": {
        const body = await req.json();
        const { problemSlug } = body;

        if (!problemSlug) {
          return secureResponse(
            { error: "Problem slug is required" },
            400,
            corsHeaders,
            rateLimitResult
          );
        }

        const { data: profile } = await supabase
          .from("profiles")
          .select("leetcode_username, leetcode_verified")
          .eq("user_id", user.id)
          .single();

        if (!profile?.leetcode_username || !profile?.leetcode_verified) {
          return secureResponse(
            { error: "LeetCode account not verified" },
            400,
            corsHeaders,
            rateLimitResult
          );
        }

        console.log(`Checking if ${profile.leetcode_username} solved ${problemSlug}`);
        const submissions = await fetchRecentSubmissions(profile.leetcode_username, 100);
        const isSolved = verifyProblemSolved(submissions, problemSlug);

        return secureResponse(
          { verified: isSolved, problemSlug },
          200,
          corsHeaders,
          rateLimitResult
        );
      }

      default:
        return secureResponse(
          { error: `Unknown action: ${action}` },
          400,
          corsHeaders,
          rateLimitResult
        );
    }
  } catch (error) {
    console.error("Edge function error:", error);
    return secureResponse(
      { error: error instanceof Error ? error.message : "Internal server error" },
      500,
      corsHeaders
    );
  }
});
