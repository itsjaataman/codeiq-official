import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useLeetCode } from "@/hooks/useLeetCode";
import { useAppSettings } from "@/hooks/useAppSettings";
import { usePaymentAccess } from "@/hooks/usePaymentAccess";
import { Sidebar } from "@/components/layout/Sidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { InviteManager } from "@/components/InviteManager";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  User,
  Mail,
  School,
  Code,
  Crown,
  Calendar,
  CheckCircle,
  XCircle,
  RefreshCw,
  Unlink,
  Loader2,
  Code2,
  Github,
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export default function Settings() {
  const navigate = useNavigate();
  const { user, profile, loading, refreshProfile } = useAuth();
  const { syncStats, loading: leetcodeLoading } = useLeetCode();
  const { settings } = useAppSettings();
  const { isDomainWhitelisted, domainDiscount } = usePaymentAccess();
  
  const paidFeaturesEnabled = settings.paid_features_enabled;
  
  const [fullName, setFullName] = useState(profile?.full_name || "");
  const [college, setCollege] = useState(profile?.college || "");
  const [dsaLanguage, setDsaLanguage] = useState(profile?.preferred_dsa_language || "");
  const [githubUsername, setGithubUsername] = useState(profile?.github_username || "");
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [savingLanguage, setSavingLanguage] = useState(false);
  const [syncingGithub, setSyncingGithub] = useState(false);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    navigate("/auth");
    return null;
  }

  const handleSaveProfile = async () => {
    if (!user) return;
    
    setSaving(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          full_name: fullName,
          college: college,
        })
        .eq("user_id", user.id);

      if (error) throw error;
      
      await refreshProfile();
      toast.success("Profile updated successfully!");
    } catch (error: any) {
      toast.error(error.message || "Failed to update profile");
    } finally {
      setSaving(false);
    }
  };

  const handleSyncStats = async () => {
    if (!profile?.leetcode_username) {
      toast.error("Please connect your LeetCode account first");
      return;
    }
    
    setSyncing(true);
    try {
      await syncStats();
      await refreshProfile();
      toast.success("LeetCode stats synced successfully!");
    } catch (error: any) {
      toast.error(error.message || "Failed to sync stats");
    } finally {
      setSyncing(false);
    }
  };

  const handleDisconnectLeetCode = async () => {
    if (!user) return;
    
    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          leetcode_username: null,
          leetcode_verified: false,
          total_solved: 0,
          easy_solved: 0,
          medium_solved: 0,
          hard_solved: 0,
          leetcode_ranking: null,
          contest_rating: null,
          last_stats_sync: null,
        })
        .eq("user_id", user.id);

      if (error) throw error;
      
      await refreshProfile();
      toast.success("LeetCode account disconnected");
    } catch (error: any) {
      toast.error(error.message || "Failed to disconnect");
    }
  };

  const handleSyncGitHub = async () => {
    if (!githubUsername.trim()) {
      toast.error("Please enter a GitHub username");
      return;
    }

    setSyncingGithub(true);
    try {
      const { data, error } = await supabase.functions.invoke("github-stats", {
        body: { username: githubUsername.trim(), user_id: user?.id },
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);

      await refreshProfile();
      toast.success("GitHub stats synced successfully!");
    } catch (error: any) {
      toast.error(error.message || "Failed to sync GitHub stats");
    } finally {
      setSyncingGithub(false);
    }
  };

  const handleDisconnectGitHub = async () => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          github_username: null,
          github_repos: 0,
          github_contributions: 0,
          github_verified: false,
          last_github_sync: null,
        })
        .eq("user_id", user.id);

      if (error) throw error;
      setGithubUsername("");
      await refreshProfile();
      toast.success("GitHub account disconnected");
    } catch (error: any) {
      toast.error(error.message || "Failed to disconnect");
    }
  };

  const subscriptionPlan = profile?.subscription_plan || "free";
  const trialEndsAt = profile?.trial_ends_at ? new Date(profile.trial_ends_at) : null;
  const subscriptionExpiresAt = profile?.subscription_expires_at 
    ? new Date(profile.subscription_expires_at) 
    : null;
  
  const isTrialActive = trialEndsAt && trialEndsAt > new Date();
  const daysRemaining = trialEndsAt 
    ? Math.ceil((trialEndsAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    : 0;

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      
      <main className="flex-1 lg:ml-64 p-6 lg:p-8">
        <div className="max-w-4xl mx-auto space-y-8">
          {/* Header */}
          <div>
            <h1 className="text-3xl font-bold text-foreground">Settings</h1>
            <p className="text-muted-foreground mt-1">
              Manage your account, LeetCode connection, and subscription
            </p>
          </div>

          {/* Profile Section */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5 text-primary" />
                Profile Information
              </CardTitle>
              <CardDescription>
                Update your personal details
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="email"
                      value={user?.email || ""}
                      disabled
                      className="pl-10 bg-muted"
                    />
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="fullName">Full Name</Label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="fullName"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="Enter your full name"
                      className="pl-10"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="college">College/University</Label>
                <div className="relative">
                  <School className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="college"
                    value={college}
                    onChange={(e) => setCollege(e.target.value)}
                    placeholder="Enter your college or university"
                    className="pl-10"
                  />
                </div>
              </div>

              <Button onClick={handleSaveProfile} disabled={saving}>
                {saving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  "Save Changes"
                )}
              </Button>
            </CardContent>
          </Card>

          {/* DSA Preferences */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Code2 className="h-5 w-5 text-primary" />
                DSA Preferences
              </CardTitle>
              <CardDescription>
                Configure your preferred programming language for AI-powered solutions
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="dsaLanguage">Preferred Language</Label>
                <Select
                  value={dsaLanguage}
                  onValueChange={async (value) => {
                    if (!user) return;
                    setDsaLanguage(value);
                    setSavingLanguage(true);
                    try {
                      const { error } = await supabase
                        .from("profiles")
                        .update({ preferred_dsa_language: value })
                        .eq("user_id", user.id);

                      if (error) throw error;
                      await refreshProfile();
                      toast.success("Language preference saved!");
                    } catch (error: any) {
                      toast.error("Failed to save preference");
                    } finally {
                      setSavingLanguage(false);
                    }
                  }}
                >
                  <SelectTrigger className="w-full md:w-64">
                    <SelectValue placeholder="Select your preferred language" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="java">☕ Java</SelectItem>
                    <SelectItem value="python">🐍 Python</SelectItem>
                    <SelectItem value="cpp">⚡ C++</SelectItem>
                    <SelectItem value="c">🔧 C</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-sm text-muted-foreground">
                  This language will be used when generating AI solutions for LeetCode problems.
                </p>
              </div>
              {savingLanguage && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Saving...
                </div>
              )}
            </CardContent>
          </Card>

          {/* LeetCode Connection */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Code className="h-5 w-5 text-primary" />
                LeetCode Connection
              </CardTitle>
              <CardDescription>
                Connect and sync your LeetCode profile
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {profile?.leetcode_username ? (
                <>
                  <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50 border">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                        <Code className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <p className="font-medium">{profile.leetcode_username}</p>
                        <div className="flex items-center gap-2 text-sm">
                          {profile.leetcode_verified ? (
                            <span className="flex items-center gap-1 text-[hsl(var(--success))]">
                              <CheckCircle className="h-3 w-3" />
                              Verified
                            </span>
                          ) : (
                            <span className="flex items-center gap-1 text-[hsl(var(--warning))]">
                              <XCircle className="h-3 w-3" />
                              Not Verified
                            </span>
                          )}
                          {profile.last_stats_sync && (
                            <span className="text-muted-foreground">
                              · Last synced: {new Date(profile.last_stats_sync).toLocaleDateString()}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleSyncStats}
                        disabled={syncing || leetcodeLoading}
                      >
                        {syncing ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <RefreshCw className="h-4 w-4" />
                        )}
                        <span className="ml-2">Sync</span>
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleDisconnectLeetCode}
                        className="text-destructive hover:text-destructive"
                      >
                        <Unlink className="h-4 w-4" />
                        <span className="ml-2">Disconnect</span>
                      </Button>
                    </div>
                  </div>

                  {/* Stats Grid */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="p-4 rounded-lg bg-muted/30 text-center">
                      <p className="text-2xl font-bold text-foreground">{profile.total_solved}</p>
                      <p className="text-sm text-muted-foreground">Total Solved</p>
                    </div>
                    <div className="p-4 rounded-lg bg-[hsl(var(--easy)/0.1)] text-center">
                      <p className="text-2xl font-bold text-[hsl(var(--easy))]">{profile.easy_solved}</p>
                      <p className="text-sm text-muted-foreground">Easy</p>
                    </div>
                    <div className="p-4 rounded-lg bg-[hsl(var(--medium)/0.1)] text-center">
                      <p className="text-2xl font-bold text-[hsl(var(--medium))]">{profile.medium_solved}</p>
                      <p className="text-sm text-muted-foreground">Medium</p>
                    </div>
                    <div className="p-4 rounded-lg bg-[hsl(var(--hard)/0.1)] text-center">
                      <p className="text-2xl font-bold text-[hsl(var(--hard))]">{profile.hard_solved}</p>
                      <p className="text-sm text-muted-foreground">Hard</p>
                    </div>
                  </div>
                </>
              ) : (
                <div className="text-center py-8">
                  <Code className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="font-medium text-foreground mb-2">No LeetCode Account Connected</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Connect your LeetCode account from the Dashboard to track your progress
                  </p>
                  <Button variant="outline" onClick={() => navigate("/dashboard")}>
                    Go to Dashboard
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* GitHub Connection */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Github className="h-5 w-5 text-primary" />
                GitHub Connection
              </CardTitle>
              <CardDescription>
                Connect your GitHub profile to display your repositories and contributions
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {profile?.github_username ? (
                <>
                  <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50 border">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                        <Github className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <p className="font-medium">{profile.github_username}</p>
                        <div className="flex items-center gap-2 text-sm">
                          {profile.github_verified ? (
                            <span className="flex items-center gap-1 text-[hsl(var(--success))]">
                              <CheckCircle className="h-3 w-3" />
                              Connected
                            </span>
                          ) : (
                            <span className="flex items-center gap-1 text-muted-foreground">
                              Pending verification
                            </span>
                          )}
                          {profile.last_github_sync && (
                            <span className="text-muted-foreground">
                              · Last synced: {new Date(profile.last_github_sync).toLocaleDateString()}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleSyncGitHub}
                        disabled={syncingGithub}
                      >
                        {syncingGithub ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <RefreshCw className="h-4 w-4" />
                        )}
                        <span className="ml-2">Sync</span>
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleDisconnectGitHub}
                        className="text-destructive hover:text-destructive"
                      >
                        <Unlink className="h-4 w-4" />
                        <span className="ml-2">Disconnect</span>
                      </Button>
                    </div>
                  </div>

                  {/* Stats Grid */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 rounded-lg bg-muted/30 text-center">
                      <p className="text-2xl font-bold text-foreground">{profile.github_repos}</p>
                      <p className="text-sm text-muted-foreground">Repositories</p>
                    </div>
                    <div className="p-4 rounded-lg bg-emerald-500/10 text-center">
                      <p className="text-2xl font-bold text-emerald-500">{profile.github_contributions}</p>
                      <p className="text-sm text-muted-foreground">Contributions</p>
                    </div>
                  </div>
                </>
              ) : (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="githubUsername">GitHub Username</Label>
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <Github className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          id="githubUsername"
                          value={githubUsername}
                          onChange={(e) => setGithubUsername(e.target.value)}
                          placeholder="Enter your GitHub username"
                          className="pl-10"
                        />
                      </div>
                      <Button onClick={handleSyncGitHub} disabled={syncingGithub || !githubUsername.trim()}>
                        {syncingGithub ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Connecting...
                          </>
                        ) : (
                          "Connect"
                        )}
                      </Button>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Your public repositories and contribution count will be displayed on your profile card.
                    </p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>


          {/* Subscription Section - Only show when paid features are enabled */}
          {paidFeaturesEnabled && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Crown className="h-5 w-5 text-primary" />
                  Subscription
                </CardTitle>
                <CardDescription>
                  Manage your subscription and billing
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
              <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50 border">
                  <div className="flex items-center gap-3">
                    <div className={`flex h-10 w-10 items-center justify-center rounded-full ${
                      isDomainWhitelisted 
                        ? "bg-success/10" 
                        : subscriptionPlan === "pro" 
                          ? "bg-primary/10" 
                          : "bg-muted"
                    }`}>
                      <Crown className={`h-5 w-5 ${
                        isDomainWhitelisted
                          ? "text-success"
                          : subscriptionPlan === "pro" 
                            ? "text-primary" 
                            : "text-muted-foreground"
                      }`} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-medium">
                          {subscriptionPlan.charAt(0).toUpperCase() + subscriptionPlan.slice(1)} Plan
                        </p>
                        {isDomainWhitelisted && domainDiscount && (
                          <Badge variant="secondary" className="bg-success/10 text-success">
                            {domainDiscount}% Discount
                          </Badge>
                        )}
                        {isTrialActive && subscriptionPlan === "free" && (
                          <Badge variant="secondary" className="bg-primary/10 text-primary">
                            Trial Active
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {isDomainWhitelisted ? (
                          <>Your institution provides access to premium features</>
                        ) : subscriptionPlan === "pro" && subscriptionExpiresAt ? (
                          <>
                            <Calendar className="inline h-3 w-3 mr-1" />
                            Renews on {subscriptionExpiresAt.toLocaleDateString()}
                          </>
                        ) : isTrialActive ? (
                          <>
                            <Calendar className="inline h-3 w-3 mr-1" />
                            {daysRemaining} days remaining in trial
                          </>
                        ) : (
                          "Upgrade to unlock all features"
                        )}
                      </p>
                    </div>
                  </div>
                  {subscriptionPlan === "free" && !isDomainWhitelisted && (
                    <Button className="bg-gradient-orange hover:opacity-90" asChild>
                      <Link to="/pricing">Upgrade to Pro</Link>
                    </Button>
                  )}
                </div>

                <Separator />

                <div className="space-y-3">
                  <h4 className="font-medium text-foreground">Plan Features</h4>
                  <div className="grid gap-2 md:grid-cols-2">
                    {[
                      { feature: "Basic DSA Problems", free: true, pro: true },
                      { feature: "Progress Tracking", free: true, pro: true },
                      { feature: "Company-wise Questions", free: false, pro: true },
                      { feature: "Priority Support", free: false, pro: true },
                      { feature: "Advanced Analytics", free: false, pro: true },
                      { feature: "Peer Comparison", free: false, pro: true },
                    ].map((item) => (
                      <div key={item.feature} className="flex items-center gap-2 text-sm">
                        {(subscriptionPlan === "pro" ? item.pro : item.free) ? (
                          <CheckCircle className="h-4 w-4 text-[hsl(var(--success))]" />
                        ) : (
                          <XCircle className="h-4 w-4 text-muted-foreground" />
                        )}
                        <span className={
                          (subscriptionPlan === "pro" ? item.pro : item.free) 
                            ? "text-foreground" 
                            : "text-muted-foreground"
                        }>
                          {item.feature}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Invite Friends Section */}
          <InviteManager />
        </div>
      </main>
    </div>
  );
}
