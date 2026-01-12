import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/contexts/AuthContext";
import { usePaymentAccess } from "@/hooks/usePaymentAccess";
import { LockedScreen } from "@/components/LockedScreen";
import { supabase } from "@/integrations/supabase/client";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  Area,
  AreaChart,
  Legend,
} from "recharts";
import {
  Loader2,
  TrendingUp,
  Target,
  Calendar,
  Flame,
  Award,
  Brain,
  Zap,
} from "lucide-react";
import { format, subDays, startOfWeek, eachDayOfInterval, parseISO } from "date-fns";

interface UserProgress {
  id: string;
  problem_id: string;
  status: string;
  solved_at: string | null;
  leetcode_verified: boolean;
}

interface Problem {
  id: string;
  difficulty: string;
  topic_id: string;
}

interface Topic {
  id: string;
  name: string;
  slug: string;
}

const COLORS = {
  easy: "hsl(142, 76%, 36%)",
  medium: "hsl(38, 92%, 50%)",
  hard: "hsl(0, 84%, 60%)",
  primary: "hsl(24, 95%, 53%)",
  muted: "hsl(220, 9%, 46%)",
};

export default function Analytics() {
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const { isLocked, isLoading: paymentLoading, paidFeaturesEnabled } = usePaymentAccess();

  const [progress, setProgress] = useState<UserProgress[]>([]);
  const [problems, setProblems] = useState<Problem[]>([]);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [loading, setLoading] = useState(true);

  // Show locked screen if trial expired and no paid plan
  if (paidFeaturesEnabled && isLocked && !paymentLoading) {
    return (
      <DashboardLayout title="Analytics" subtitle="View your progress statistics">
        <LockedScreen />
      </DashboardLayout>
    );
  }

  // Fetch all data
  useEffect(() => {
    const fetchData = async () => {
      if (!user) {
        setLoading(false);
        return;
      }

      const [progressRes, problemsRes, topicsRes] = await Promise.all([
        supabase
          .from("user_problem_progress")
          .select("id, problem_id, status, solved_at, leetcode_verified")
          .eq("user_id", user.id),
        supabase.from("problems").select("id, difficulty, topic_id"),
        supabase.from("topics").select("id, name, slug"),
      ]);

      if (progressRes.data) setProgress(progressRes.data);
      if (problemsRes.data) setProblems(problemsRes.data);
      if (topicsRes.data) setTopics(topicsRes.data);

      setLoading(false);
    };

    fetchData();
  }, [user]);

  // Calculate statistics
  const stats = useMemo(() => {
    const solved = progress.filter((p) => p.status === "solved");
    const verified = solved.filter((p) => p.leetcode_verified);

    // Difficulty breakdown
    const difficultyCount = { easy: 0, medium: 0, hard: 0 };
    solved.forEach((p) => {
      const problem = problems.find((prob) => prob.id === p.problem_id);
      if (problem) {
        difficultyCount[problem.difficulty as keyof typeof difficultyCount]++;
      }
    });

    // Topic breakdown
    const topicCount: Record<string, number> = {};
    solved.forEach((p) => {
      const problem = problems.find((prob) => prob.id === p.problem_id);
      if (problem) {
        const topic = topics.find((t) => t.id === problem.topic_id);
        if (topic) {
          topicCount[topic.name] = (topicCount[topic.name] || 0) + 1;
        }
      }
    });

    return {
      total: solved.length,
      verified: verified.length,
      difficultyCount,
      topicCount,
    };
  }, [progress, problems, topics]);

  // Weekly progress data (last 7 days)
  const weeklyData = useMemo(() => {
    const days = eachDayOfInterval({
      start: subDays(new Date(), 6),
      end: new Date(),
    });

    return days.map((day) => {
      const dayStr = format(day, "yyyy-MM-dd");
      const solved = progress.filter((p) => {
        if (!p.solved_at) return false;
        return format(parseISO(p.solved_at), "yyyy-MM-dd") === dayStr;
      });

      return {
        day: format(day, "EEE"),
        date: format(day, "MMM d"),
        problems: solved.length,
      };
    });
  }, [progress]);

  // Monthly trend (last 4 weeks)
  const monthlyTrend = useMemo(() => {
    const weeks = [];
    for (let i = 3; i >= 0; i--) {
      const weekStart = startOfWeek(subDays(new Date(), i * 7));
      const weekEnd = subDays(weekStart, -6);
      
      const solved = progress.filter((p) => {
        if (!p.solved_at) return false;
        const solvedDate = parseISO(p.solved_at);
        return solvedDate >= weekStart && solvedDate <= weekEnd;
      });

      weeks.push({
        week: `Week ${4 - i}`,
        problems: solved.length,
        easy: solved.filter((p) => {
          const prob = problems.find((pr) => pr.id === p.problem_id);
          return prob?.difficulty === "easy";
        }).length,
        medium: solved.filter((p) => {
          const prob = problems.find((pr) => pr.id === p.problem_id);
          return prob?.difficulty === "medium";
        }).length,
        hard: solved.filter((p) => {
          const prob = problems.find((pr) => pr.id === p.problem_id);
          return prob?.difficulty === "hard";
        }).length,
      });
    }
    return weeks;
  }, [progress, problems]);

  // Difficulty pie chart data
  const difficultyPieData = useMemo(() => {
    return [
      { name: "Easy", value: stats.difficultyCount.easy, color: COLORS.easy },
      { name: "Medium", value: stats.difficultyCount.medium, color: COLORS.medium },
      { name: "Hard", value: stats.difficultyCount.hard, color: COLORS.hard },
    ].filter((d) => d.value > 0);
  }, [stats]);

  // Topic bar chart data
  const topicBarData = useMemo(() => {
    return Object.entries(stats.topicCount)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 6);
  }, [stats]);

  if (!user) {
    return (
      <DashboardLayout title="Analytics" subtitle="Sign in to view your analytics">
        <div className="flex items-center justify-center py-20">
          <button onClick={() => navigate("/auth")} className="text-primary hover:underline">
            Sign In
          </button>
        </div>
      </DashboardLayout>
    );
  }

  if (loading) {
    return (
      <DashboardLayout title="Analytics" subtitle="Loading...">
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  const totalProblems = problems.length;
  const completionRate = totalProblems > 0 ? Math.round((stats.total / totalProblems) * 100) : 0;
  const verificationRate = stats.total > 0 ? Math.round((stats.verified / stats.total) * 100) : 0;

  return (
    <DashboardLayout
      title="Analytics"
      subtitle="Track your progress and performance"
    >
      <div className="space-y-6">
        {/* Stats Overview */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-lg bg-primary/10">
                  <Target className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.total}</p>
                  <p className="text-sm text-muted-foreground">Problems Solved</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-lg bg-[hsl(var(--success))]/10">
                  <Award className="h-6 w-6 text-[hsl(var(--success))]" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{verificationRate}%</p>
                  <p className="text-sm text-muted-foreground">Verified Rate</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-lg bg-[hsl(var(--warning))]/10">
                  <Flame className="h-6 w-6 text-[hsl(var(--warning))]" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{profile?.current_streak || 0}</p>
                  <p className="text-sm text-muted-foreground">Day Streak</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-lg bg-[hsl(var(--info))]/10">
                  <TrendingUp className="h-6 w-6 text-[hsl(var(--info))]" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{completionRate}%</p>
                  <p className="text-sm text-muted-foreground">Completion</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Charts Row 1 */}
        <div className="grid lg:grid-cols-2 gap-6">
          {/* Weekly Progress */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5 text-muted-foreground" />
                Weekly Progress
              </CardTitle>
              <CardDescription>Problems solved in the last 7 days</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[280px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={weeklyData}>
                    <defs>
                      <linearGradient id="colorProblems" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={COLORS.primary} stopOpacity={0.3} />
                        <stop offset="95%" stopColor={COLORS.primary} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis 
                      dataKey="day" 
                      stroke="hsl(var(--muted-foreground))"
                      fontSize={12}
                    />
                    <YAxis 
                      stroke="hsl(var(--muted-foreground))"
                      fontSize={12}
                      allowDecimals={false}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "8px",
                      }}
                      labelFormatter={(value, payload) => {
                        if (payload && payload[0]) {
                          return payload[0].payload.date;
                        }
                        return value;
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="problems"
                      stroke={COLORS.primary}
                      strokeWidth={2}
                      fill="url(#colorProblems)"
                      name="Problems"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Difficulty Distribution */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Zap className="h-5 w-5 text-muted-foreground" />
                Difficulty Distribution
              </CardTitle>
              <CardDescription>Breakdown by problem difficulty</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[280px] flex items-center justify-center">
                {difficultyPieData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={difficultyPieData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={100}
                        paddingAngle={4}
                        dataKey="value"
                      >
                        {difficultyPieData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "hsl(var(--card))",
                          border: "1px solid hsl(var(--border))",
                          borderRadius: "8px",
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="text-muted-foreground">No data yet</p>
                )}
              </div>
              {/* Legend */}
              <div className="flex justify-center gap-6 mt-4">
                {[
                  { label: "Easy", count: stats.difficultyCount.easy, color: COLORS.easy },
                  { label: "Medium", count: stats.difficultyCount.medium, color: COLORS.medium },
                  { label: "Hard", count: stats.difficultyCount.hard, color: COLORS.hard },
                ].map((item) => (
                  <div key={item.label} className="flex items-center gap-2">
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: item.color }}
                    />
                    <span className="text-sm text-muted-foreground">
                      {item.label}: {item.count}
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Charts Row 2 */}
        <div className="grid lg:grid-cols-2 gap-6">
          {/* Monthly Trend */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-muted-foreground" />
                Monthly Trend
              </CardTitle>
              <CardDescription>Problems solved by difficulty over 4 weeks</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[280px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={monthlyTrend}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis 
                      dataKey="week" 
                      stroke="hsl(var(--muted-foreground))"
                      fontSize={12}
                    />
                    <YAxis 
                      stroke="hsl(var(--muted-foreground))"
                      fontSize={12}
                      allowDecimals={false}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "8px",
                      }}
                    />
                    <Legend />
                    <Bar dataKey="easy" stackId="a" fill={COLORS.easy} name="Easy" radius={[0, 0, 0, 0]} />
                    <Bar dataKey="medium" stackId="a" fill={COLORS.medium} name="Medium" />
                    <Bar dataKey="hard" stackId="a" fill={COLORS.hard} name="Hard" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Topics Performance */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Brain className="h-5 w-5 text-muted-foreground" />
                Topics Performance
              </CardTitle>
              <CardDescription>Top topics by problems solved</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[280px]">
                {topicBarData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={topicBarData} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis 
                        type="number"
                        stroke="hsl(var(--muted-foreground))"
                        fontSize={12}
                        allowDecimals={false}
                      />
                      <YAxis 
                        type="category"
                        dataKey="name"
                        stroke="hsl(var(--muted-foreground))"
                        fontSize={12}
                        width={100}
                        tickFormatter={(value) => value.length > 12 ? `${value.slice(0, 12)}...` : value}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "hsl(var(--card))",
                          border: "1px solid hsl(var(--border))",
                          borderRadius: "8px",
                        }}
                      />
                      <Bar 
                        dataKey="count" 
                        fill={COLORS.primary}
                        radius={[0, 4, 4, 0]}
                        name="Problems"
                      />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center">
                    <p className="text-muted-foreground">No data yet</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* LeetCode Stats */}
        {profile?.leetcode_verified && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Award className="h-5 w-5 text-muted-foreground" />
                LeetCode Profile
                <Badge variant="secondary" className="ml-2">Verified</Badge>
              </CardTitle>
              <CardDescription>
                Stats synced from LeetCode ({profile.leetcode_username})
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="p-4 rounded-lg bg-muted/30 text-center">
                  <p className="text-3xl font-bold text-foreground">{profile.total_solved || 0}</p>
                  <p className="text-sm text-muted-foreground">Total Solved</p>
                </div>
                <div className="p-4 rounded-lg bg-[hsl(var(--easy))]/10 text-center">
                  <p className="text-3xl font-bold text-[hsl(var(--easy))]">{profile.easy_solved || 0}</p>
                  <p className="text-sm text-muted-foreground">Easy</p>
                </div>
                <div className="p-4 rounded-lg bg-[hsl(var(--medium))]/10 text-center">
                  <p className="text-3xl font-bold text-[hsl(var(--medium))]">{profile.medium_solved || 0}</p>
                  <p className="text-sm text-muted-foreground">Medium</p>
                </div>
                <div className="p-4 rounded-lg bg-[hsl(var(--hard))]/10 text-center">
                  <p className="text-3xl font-bold text-[hsl(var(--hard))]">{profile.hard_solved || 0}</p>
                  <p className="text-sm text-muted-foreground">Hard</p>
                </div>
              </div>
              {(profile.leetcode_ranking || profile.contest_rating) && (
                <div className="grid sm:grid-cols-2 gap-4 mt-4">
                  {profile.leetcode_ranking && (
                    <div className="p-4 rounded-lg bg-muted/30 text-center">
                      <p className="text-2xl font-bold text-foreground">
                        #{profile.leetcode_ranking.toLocaleString()}
                      </p>
                      <p className="text-sm text-muted-foreground">Global Ranking</p>
                    </div>
                  )}
                  {profile.contest_rating && (
                    <div className="p-4 rounded-lg bg-primary/10 text-center">
                      <p className="text-2xl font-bold text-primary">{profile.contest_rating}</p>
                      <p className="text-sm text-muted-foreground">Contest Rating</p>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
