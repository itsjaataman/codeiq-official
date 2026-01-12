import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface GitHubUser {
  login: string;
  public_repos: number;
  followers: number;
  following: number;
  avatar_url: string;
  html_url: string;
  name: string | null;
  bio: string | null;
}

interface ContributionData {
  totalContributions: number;
}

async function fetchGitHubUser(username: string): Promise<GitHubUser | null> {
  try {
    const response = await fetch(`https://api.github.com/users/${username}`, {
      headers: {
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'CodeIQ-App',
      },
    });

    if (!response.ok) {
      console.error(`GitHub API error: ${response.status} ${response.statusText}`);
      return null;
    }

    return await response.json();
  } catch (error) {
    console.error('Error fetching GitHub user:', error);
    return null;
  }
}

async function fetchContributions(username: string): Promise<number> {
  try {
    // Use GitHub's contribution calendar via the profile page
    // This is a simplified approach - for production, consider using GraphQL API with token
    const response = await fetch(`https://github-contributions-api.jogruber.de/v4/${username}?y=last`, {
      headers: {
        'User-Agent': 'CodeIQ-App',
      },
    });

    if (!response.ok) {
      console.log(`Contributions API returned ${response.status}, using fallback`);
      return 0;
    }

    const data = await response.json();
    return data.total?.lastYear || data.total?.["2024"] || data.total?.["2025"] || 0;
  } catch (error) {
    console.error('Error fetching contributions:', error);
    return 0;
  }
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { username, user_id } = await req.json();

    if (!username) {
      return new Response(
        JSON.stringify({ error: 'GitHub username is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Fetching GitHub stats for: ${username}`);

    // Fetch GitHub user data
    const githubUser = await fetchGitHubUser(username);

    if (!githubUser) {
      return new Response(
        JSON.stringify({ error: 'GitHub user not found or API rate limited' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch contributions
    const contributions = await fetchContributions(username);

    const stats = {
      username: githubUser.login,
      repos: githubUser.public_repos,
      contributions,
      followers: githubUser.followers,
      following: githubUser.following,
      avatar_url: githubUser.avatar_url,
      profile_url: githubUser.html_url,
      name: githubUser.name,
      bio: githubUser.bio,
    };

    console.log(`GitHub stats fetched successfully:`, stats);

    // If user_id is provided, update the profile
    if (user_id) {
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
      const supabase = createClient(supabaseUrl, supabaseKey);

      const { error: updateError } = await supabase
        .from('profiles')
        .update({
          github_username: githubUser.login,
          github_repos: githubUser.public_repos,
          github_contributions: contributions,
          github_verified: true,
          last_github_sync: new Date().toISOString(),
        })
        .eq('user_id', user_id);

      if (updateError) {
        console.error('Error updating profile:', updateError);
      } else {
        console.log(`Profile updated for user: ${user_id}`);
      }
    }

    return new Response(
      JSON.stringify({ success: true, stats }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in github-stats function:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
