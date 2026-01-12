import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useAdmin } from "@/hooks/useAdmin";
import { useTeacher } from "@/hooks/useTeacher";
import { useClassroomStudent } from "@/hooks/useClassroomStudent";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Shield,
  GraduationCap,
  BookOpen,
  User,
  ArrowRight,
  Loader2,
  Users,
  BarChart3,
  Code2,
  Flame,
  Trophy,
  ClipboardList,
  Settings,
  Crown,
} from "lucide-react";

// Role configuration
const roles = {
  admin: {
    icon: Shield,
    color: "text-destructive",
    bgColor: "bg-destructive/10",
    borderColor: "border-destructive/20",
    label: "Administrator",
    description: "Full system access with user management and platform controls",
    dashboard: "/admin",
  },
  teacher: {
    icon: GraduationCap,
    color: "text-primary",
    bgColor: "bg-primary/10",
    borderColor: "border-primary/20",
    label: "Teacher",
    description: "Manage classrooms, create tests, and track student progress",
    dashboard: "/teacher",
  },
  student: {
    icon: BookOpen,
    color: "text-success",
    bgColor: "bg-success/10",
    borderColor: "border-success/20",
    label: "Student",
    description: "Access classroom content, take tests, and view leaderboard",
    dashboard: "/student",
  },
  user: {
    icon: User,
    color: "text-info",
    bgColor: "bg-info/10",
    borderColor: "border-info/20",
    label: "User",
    description: "Personal practice with problems and progress tracking",
    dashboard: "/dashboard",
  },
};

export default function RoleDashboard() {
  const { user, profile, loading: authLoading } = useAuth();
  const { isAdmin, isLoading: adminLoading } = useAdmin();
  const { isTeacher, teacher, isLoading: teacherLoading } = useTeacher();
  const { isClassroomStudent, classroom, isLoading: studentLoading } = useClassroomStudent();
  const navigate = useNavigate();

  const isLoading = authLoading || adminLoading || teacherLoading || studentLoading;

  // Redirect if not authenticated
  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth");
    }
  }, [user, authLoading, navigate]);

  if (isLoading) {
    return (
      <DashboardLayout title="Dashboard">
        <div className="max-w-4xl mx-auto">
          <Skeleton className="h-8 w-64 mb-2" />
          <Skeleton className="h-4 w-96 mb-8" />
          <div className="grid md:grid-cols-2 gap-6">
            <Skeleton className="h-48 rounded-xl" />
            <Skeleton className="h-48 rounded-xl" />
          </div>
        </div>
      </DashboardLayout>
    );
  }

  if (!user) return null;

  // Determine user roles
  const userRoles: string[] = [];
  if (isAdmin) userRoles.push("admin");
  if (isTeacher) userRoles.push("teacher");
  if (isClassroomStudent) userRoles.push("student");
  userRoles.push("user"); // Everyone has user role as base

  // Get primary role (highest privilege)
  const primaryRole = userRoles[0];
  const primaryRoleConfig = roles[primaryRole as keyof typeof roles];

  return (
    <DashboardLayout 
      title={`Welcome, ${profile?.full_name || user.email?.split("@")[0]}!`}
      subtitle="Select your dashboard or continue with your primary role"
    >
      <div className="max-w-5xl mx-auto">
        {/* Primary Role Banner */}
        <Card className={`p-6 mb-8 ${primaryRoleConfig.bgColor} ${primaryRoleConfig.borderColor} border-2`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className={`p-4 rounded-xl ${primaryRoleConfig.bgColor}`}>
                <primaryRoleConfig.icon className={`h-8 w-8 ${primaryRoleConfig.color}`} />
              </div>
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <h2 className="text-xl font-bold text-foreground">Primary Role: {primaryRoleConfig.label}</h2>
                  <Badge className={`${primaryRoleConfig.bgColor} ${primaryRoleConfig.color} border-0`}>
                    <Crown className="h-3 w-3 mr-1" />
                    Active
                  </Badge>
                </div>
                <p className="text-muted-foreground">{primaryRoleConfig.description}</p>
              </div>
            </div>
            <Button 
              size="lg" 
              className="gap-2"
              onClick={() => navigate(primaryRoleConfig.dashboard)}
            >
              Go to Dashboard
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </Card>

        {/* All Roles Grid */}
        <h3 className="text-lg font-semibold text-foreground mb-4">Your Access Levels</h3>
        <div className="grid md:grid-cols-2 gap-4 mb-8">
          {Object.entries(roles).map(([key, config]) => {
            const hasRole = userRoles.includes(key);
            const Icon = config.icon;

            return (
              <Card 
                key={key}
                className={`p-5 transition-all ${
                  hasRole 
                    ? `${config.borderColor} border hover:shadow-lg cursor-pointer` 
                    : "opacity-40 border-dashed"
                }`}
                onClick={() => hasRole && navigate(config.dashboard)}
              >
                <div className="flex items-start gap-4">
                  <div className={`p-3 rounded-xl ${hasRole ? config.bgColor : "bg-muted"}`}>
                    <Icon className={`h-6 w-6 ${hasRole ? config.color : "text-muted-foreground"}`} />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="font-semibold text-foreground">{config.label}</h4>
                      {hasRole ? (
                        <Badge variant="outline" className={`${config.color} text-xs`}>
                          Active
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="text-xs">
                          Not Available
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground mb-3">{config.description}</p>
                    {hasRole && (
                      <Button variant="ghost" size="sm" className="gap-1 -ml-2">
                        Open <ArrowRight className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>

        {/* Quick Stats Based on Primary Role */}
        <h3 className="text-lg font-semibold text-foreground mb-4">Quick Overview</h3>
        
        {isAdmin && (
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <Card className="p-5">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-lg bg-destructive/10">
                  <Users className="h-5 w-5 text-destructive" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Admin Access</p>
                  <p className="text-xl font-bold">Full</p>
                </div>
              </div>
            </Card>
            <Card className="p-5">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-lg bg-warning/10">
                  <Settings className="h-5 w-5 text-warning" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">System Control</p>
                  <p className="text-xl font-bold">Enabled</p>
                </div>
              </div>
            </Card>
            <Card className="p-5">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-lg bg-info/10">
                  <BarChart3 className="h-5 w-5 text-info" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Analytics</p>
                  <p className="text-xl font-bold">Platform</p>
                </div>
              </div>
            </Card>
            <Card className="p-5 cursor-pointer hover:bg-muted/30 transition-colors" onClick={() => navigate("/admin")}>
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-lg bg-success/10">
                  <Shield className="h-5 w-5 text-success" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Go to</p>
                  <p className="text-xl font-bold">Admin Panel</p>
                </div>
              </div>
            </Card>
          </div>
        )}

        {isTeacher && !isAdmin && (
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <Card className="p-5">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-lg bg-primary/10">
                  <GraduationCap className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Teaching as</p>
                  <p className="text-xl font-bold truncate">{teacher?.name || "Teacher"}</p>
                </div>
              </div>
            </Card>
            <Card className="p-5">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-lg bg-success/10">
                  <Users className="h-5 w-5 text-success" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Manage</p>
                  <p className="text-xl font-bold">Classrooms</p>
                </div>
              </div>
            </Card>
            <Card className="p-5">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-lg bg-warning/10">
                  <ClipboardList className="h-5 w-5 text-warning" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Create</p>
                  <p className="text-xl font-bold">Tests</p>
                </div>
              </div>
            </Card>
            <Card className="p-5 cursor-pointer hover:bg-muted/30 transition-colors" onClick={() => navigate("/teacher")}>
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-lg bg-info/10">
                  <ArrowRight className="h-5 w-5 text-info" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Go to</p>
                  <p className="text-xl font-bold">Teacher Panel</p>
                </div>
              </div>
            </Card>
          </div>
        )}

        {isClassroomStudent && !isTeacher && !isAdmin && (
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <Card className="p-5">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-lg bg-success/10">
                  <BookOpen className="h-5 w-5 text-success" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Classroom</p>
                  <p className="text-xl font-bold truncate">{classroom?.name || "Active"}</p>
                </div>
              </div>
            </Card>
            <Card className="p-5">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-lg bg-warning/10">
                  <ClipboardList className="h-5 w-5 text-warning" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Take</p>
                  <p className="text-xl font-bold">Tests</p>
                </div>
              </div>
            </Card>
            <Card className="p-5">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-lg bg-primary/10">
                  <Trophy className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">View</p>
                  <p className="text-xl font-bold">Leaderboard</p>
                </div>
              </div>
            </Card>
            <Card className="p-5 cursor-pointer hover:bg-muted/30 transition-colors" onClick={() => navigate("/student")}>
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-lg bg-info/10">
                  <ArrowRight className="h-5 w-5 text-info" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Go to</p>
                  <p className="text-xl font-bold">Student Panel</p>
                </div>
              </div>
            </Card>
          </div>
        )}

        {!isAdmin && !isTeacher && !isClassroomStudent && (
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <Card className="p-5">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-lg bg-primary/10">
                  <Code2 className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Problems Solved</p>
                  <p className="text-xl font-bold">{profile?.total_solved || 0}</p>
                </div>
              </div>
            </Card>
            <Card className="p-5">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-lg bg-warning/10">
                  <Flame className="h-5 w-5 text-warning" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Current Streak</p>
                  <p className="text-xl font-bold">{profile?.current_streak || 0} days</p>
                </div>
              </div>
            </Card>
            <Card className="p-5">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-lg bg-success/10">
                  <Trophy className="h-5 w-5 text-success" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Best Streak</p>
                  <p className="text-xl font-bold">{profile?.best_streak || 0} days</p>
                </div>
              </div>
            </Card>
            <Card className="p-5 cursor-pointer hover:bg-muted/30 transition-colors" onClick={() => navigate("/dashboard")}>
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-lg bg-info/10">
                  <ArrowRight className="h-5 w-5 text-info" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Go to</p>
                  <p className="text-xl font-bold">Dashboard</p>
                </div>
              </div>
            </Card>
          </div>
        )}

        {/* Quick Navigation */}
        <h3 className="text-lg font-semibold text-foreground mb-4">Quick Navigation</h3>
        <div className="grid sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <Button variant="outline" className="h-auto py-4 flex-col gap-2" onClick={() => navigate("/topics")}>
            <BookOpen className="h-5 w-5" />
            <span className="text-xs">Topics</span>
          </Button>
          <Button variant="outline" className="h-auto py-4 flex-col gap-2" onClick={() => navigate("/companies")}>
            <BarChart3 className="h-5 w-5" />
            <span className="text-xs">Companies</span>
          </Button>
          <Button variant="outline" className="h-auto py-4 flex-col gap-2" onClick={() => navigate("/revision")}>
            <Code2 className="h-5 w-5" />
            <span className="text-xs">Revision</span>
          </Button>
          <Button variant="outline" className="h-auto py-4 flex-col gap-2" onClick={() => navigate("/achievements")}>
            <Trophy className="h-5 w-5" />
            <span className="text-xs">Achievements</span>
          </Button>
          <Button variant="outline" className="h-auto py-4 flex-col gap-2" onClick={() => navigate("/leaderboard")}>
            <Users className="h-5 w-5" />
            <span className="text-xs">Leaderboard</span>
          </Button>
          <Button variant="outline" className="h-auto py-4 flex-col gap-2" onClick={() => navigate("/settings")}>
            <Settings className="h-5 w-5" />
            <span className="text-xs">Settings</span>
          </Button>
        </div>
      </div>
    </DashboardLayout>
  );
}