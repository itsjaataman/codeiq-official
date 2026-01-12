import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useAuth } from "@/contexts/AuthContext";
import { useAdmin } from "@/hooks/useAdmin";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Users,
  FileCode2,
  BarChart3,
  Plus,
  Trash2,
  Edit,
  Loader2,
  Search,
  UserCheck,
  UserX,
  Building2,
  BookOpen,
  Layers,
  Upload,
  FileUp,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Tag,
  Ban,
  ShieldOff,
  Crown,
  CreditCard,
  Clock,
  Check,
  X,
  Settings2,
  GraduationCap,
  Mail,
  ToggleLeft,
  Send,
  Globe,
} from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useAppSettings } from "@/hooks/useAppSettings";
import { CompanyManagement } from "@/components/admin/CompanyManagement";
import { AdminEmailSystem } from "@/components/admin/AdminEmailSystem";
import { EmailDomainWhitelist } from "@/components/admin/EmailDomainWhitelist";

interface User {
  id: string;
  user_id: string;
  email: string | null;
  full_name: string | null;
  leetcode_verified: boolean;
  total_solved: number;
  created_at: string;
  subscription_plan: string | null;
  is_disabled: boolean | null;
}

interface Problem {
  id: string;
  title: string;
  slug: string;
  difficulty: string;
  topic_id: string;
  leetcode_slug: string | null;
  leetcode_id: number | null;
  problem_type: string;
  companies: string[] | null;
}

interface Topic {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  icon: string | null;
  color: string | null;
  display_order: number | null;
  problem_count: number | null;
}

interface DiscountCode {
  id: string;
  code: string;
  discount_percent: number;
  is_active: boolean;
  max_uses: number | null;
  used_count: number;
  valid_from: string;
  valid_until: string | null;
  applies_to: string | null;
  created_at: string;
}

interface Payment {
  id: string;
  user_id: string;
  plan: string;
  amount: number;
  discount_amount: number | null;
  status: string;
  merchant_transaction_id: string;
  phonepay_transaction_id: string | null;
  customer_name: string | null;
  customer_email: string | null;
  customer_phone: string | null;
  created_at: string;
  approved_at: string | null;
  declined_at: string | null;
  admin_notes: string | null;
}

interface Teacher {
  id: string;
  user_id: string | null;
  name: string;
  email: string;
  is_active: boolean;
  created_at: string;
}

export default function Admin() {
  const { user, loading } = useAuth();
  const { isAdmin, isLoading: adminLoading } = useAdmin();
  const { settings, updateSetting, updateLandingStats } = useAppSettings();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  
  const [searchUsers, setSearchUsers] = useState("");
  const [searchProblems, setSearchProblems] = useState("");
  const [searchTopics, setSearchTopics] = useState("");
  const [problemDialogOpen, setProblemDialogOpen] = useState(false);
  const [topicDialogOpen, setTopicDialogOpen] = useState(false);
  const [discountDialogOpen, setDiscountDialogOpen] = useState(false);
  const [bulkImportDialogOpen, setBulkImportDialogOpen] = useState(false);
  const [teacherDialogOpen, setTeacherDialogOpen] = useState(false);
  const [editingProblem, setEditingProblem] = useState<Problem | null>(null);
  const [editingTopic, setEditingTopic] = useState<Topic | null>(null);
  const [problemTypeFilter, setProblemTypeFilter] = useState<string>("all");
  
  // Bulk import state
  const [importedProblems, setImportedProblems] = useState<any[]>([]);
  const [importErrors, setImportErrors] = useState<string[]>([]);
  const [isImporting, setIsImporting] = useState(false);
  const [importPreview, setImportPreview] = useState(false);

  // Teacher form state
  const [teacherForm, setTeacherForm] = useState({ name: "", email: "", password: "" });
  
  const [problemForm, setProblemForm] = useState({
    title: "",
    slug: "",
    difficulty: "easy",
    topic_id: "",
    leetcode_slug: "",
    leetcode_id: "",
    problem_type: "topic_wise",
    companies: "",
  });

  const [topicForm, setTopicForm] = useState({
    name: "",
    slug: "",
    description: "",
    icon: "",
    color: "",
    display_order: "0",
  });

  const [discountForm, setDiscountForm] = useState({
    code: "",
    discount_percent: "10",
    max_uses: "",
    valid_until: "",
    applies_to: "all",
  });

  // Redirect non-admins
  useEffect(() => {
    if (!loading && !adminLoading) {
      if (!user) {
        navigate("/auth");
      } else if (!isAdmin) {
        toast.error("Access denied. Admin privileges required.");
        navigate("/dashboard");
      }
    }
  }, [user, isAdmin, loading, adminLoading, navigate]);

  // Fetch users with additional fields
  const { data: users = [], isLoading: usersLoading } = useQuery({
    queryKey: ["admin-users"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, user_id, email, full_name, leetcode_verified, total_solved, created_at, subscription_plan, is_disabled")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as User[];
    },
    enabled: isAdmin,
  });

  // Fetch pending payments
  const { data: payments = [], isLoading: paymentsLoading, refetch: refetchPayments } = useQuery({
    queryKey: ["admin-payments"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payments")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as Payment[];
    },
    enabled: isAdmin,
  });

  // Fetch discount codes
  const { data: discountCodes = [], isLoading: discountsLoading } = useQuery({
    queryKey: ["admin-discount-codes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("discount_codes")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as DiscountCode[];
    },
    enabled: isAdmin,
  });

  // Fetch problems
  const { data: problems = [], isLoading: problemsLoading } = useQuery({
    queryKey: ["admin-problems"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("problems")
        .select("id, title, slug, difficulty, topic_id, leetcode_slug, leetcode_id, problem_type, companies")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as Problem[];
    },
    enabled: isAdmin,
  });

  // Fetch topics (full data)
  const { data: topics = [], isLoading: topicsLoading } = useQuery({
    queryKey: ["admin-topics-full"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("topics")
        .select("*")
        .order("display_order");

      if (error) throw error;
      return data as Topic[];
    },
    enabled: isAdmin,
  });

  // Fetch teachers
  const { data: teachers = [], isLoading: teachersLoading } = useQuery({
    queryKey: ["admin-teachers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("teachers")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as Teacher[];
    },
    enabled: isAdmin,
  });

  // Fetch all classrooms for admin
  const { data: classrooms = [], isLoading: classroomsLoading } = useQuery({
    queryKey: ["admin-classrooms"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("classrooms")
        .select("*, teachers(name, email)")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: isAdmin,
  });

  // Fetch student counts for classrooms
  const { data: classroomStudentCounts = {} } = useQuery({
    queryKey: ["admin-classroom-student-counts", classrooms.map((c: any) => c.id)],
    queryFn: async () => {
      const counts: Record<string, number> = {};
      for (const classroom of classrooms) {
        const { count } = await supabase
          .from("classroom_students")
          .select("*", { count: "exact", head: true })
          .eq("classroom_id", classroom.id)
          .eq("is_active", true);
        counts[classroom.id] = count || 0;
      }
      return counts;
    },
    enabled: classrooms.length > 0 && isAdmin,
  });

  // Analytics data
  const { data: analytics } = useQuery({
    queryKey: ["admin-analytics"],
    queryFn: async () => {
      const [usersRes, problemsRes, progressRes, topicsRes, paymentsRes] = await Promise.all([
        supabase.from("profiles").select("id", { count: "exact" }),
        supabase.from("problems").select("id", { count: "exact" }),
        supabase.from("user_problem_progress").select("id", { count: "exact" }).eq("status", "solved"),
        supabase.from("topics").select("id", { count: "exact" }),
        supabase.from("payments").select("amount").eq("status", "completed"),
      ]);

      const verifiedRes = await supabase
        .from("profiles")
        .select("id", { count: "exact" })
        .eq("leetcode_verified", true);

      const paidUsers = await supabase
        .from("profiles")
        .select("id", { count: "exact" })
        .neq("subscription_plan", "free");

      const totalRevenue = (paymentsRes.data || []).reduce((sum, p) => sum + (p.amount || 0), 0);

      return {
        totalUsers: usersRes.count || 0,
        totalProblems: problemsRes.count || 0,
        totalSolved: progressRes.count || 0,
        verifiedUsers: verifiedRes.count || 0,
        totalTopics: topicsRes.count || 0,
        paidUsers: paidUsers.count || 0,
        totalRevenue,
      };
    },
    enabled: isAdmin,
  });

  // Disable/Enable user mutation
  const toggleUserDisabled = useMutation({
    mutationFn: async ({ userId, disabled }: { userId: string; disabled: boolean }) => {
      const { error } = await supabase
        .from("profiles")
        .update({ is_disabled: disabled })
        .eq("user_id", userId);
      if (error) throw error;
    },
    onSuccess: (_, { disabled }) => {
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      toast.success(disabled ? "User disabled" : "User enabled");
    },
    onError: () => {
      toast.error("Failed to update user status");
    },
  });

  // Delete user mutation
  const deleteUser = useMutation({
    mutationFn: async (userId: string) => {
      // Delete user progress first
      const { error: progressError } = await supabase.from("user_problem_progress").delete().eq("user_id", userId);
      if (progressError) {
        console.error("Error deleting progress:", progressError);
      }
      
      const { error: achievementsError } = await supabase.from("user_achievements").delete().eq("user_id", userId);
      if (achievementsError) {
        console.error("Error deleting achievements:", achievementsError);
      }

      // Delete from classroom_students
      const { error: classroomError } = await supabase.from("classroom_students").delete().eq("user_id", userId);
      if (classroomError) {
        console.error("Error deleting classroom memberships:", classroomError);
      }

      // Delete test submissions
      const { error: submissionsError } = await supabase.from("test_submissions").delete().eq("student_id", userId);
      if (submissionsError) {
        console.error("Error deleting test submissions:", submissionsError);
      }
      
      // Delete profile
      const { error } = await supabase.from("profiles").delete().eq("user_id", userId);
      if (error) {
        console.error("Error deleting profile:", error);
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      queryClient.invalidateQueries({ queryKey: ["admin-analytics"] });
      toast.success("User deleted");
    },
    onError: (error: any) => {
      console.error("Delete user error:", error);
      toast.error(error.message || "Failed to delete user");
    },
  });

  // Create discount code
  const createDiscountCode = useMutation({
    mutationFn: async () => {
      const codeData = {
        code: discountForm.code.toUpperCase().trim(),
        discount_percent: parseInt(discountForm.discount_percent),
        max_uses: discountForm.max_uses ? parseInt(discountForm.max_uses) : null,
        valid_until: discountForm.valid_until || null,
        applies_to: discountForm.applies_to === "all" ? null : discountForm.applies_to,
        created_by: user!.id,
        is_active: true,
      };

      const { error } = await supabase.from("discount_codes").insert(codeData);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-discount-codes"] });
      setDiscountDialogOpen(false);
      resetDiscountForm();
      toast.success("Discount code created");
    },
    onError: (error: any) => {
      console.error("Error creating discount code:", error);
      toast.error(error.message?.includes("duplicate") ? "Code already exists" : "Failed to create discount code");
    },
  });

  // Approve payment
  const approvePayment = useMutation({
    mutationFn: async ({ paymentId, userId, plan }: { paymentId: string; userId: string; plan: string }) => {
      // Update payment status
      await supabase.from("payments").update({ 
        status: "completed", 
        approved_at: new Date().toISOString() 
      }).eq("id", paymentId);
      
      // Update user subscription
      const expiresAt = plan === "lifetime" || plan === "basic" ? null : 
        new Date(Date.now() + (plan === "pro_6" ? 180 : 90) * 24 * 60 * 60 * 1000).toISOString();
      
      await supabase.from("profiles").update({ 
        subscription_plan: plan.startsWith("pro") ? "pro" : plan,
        subscription_expires_at: expiresAt
      }).eq("user_id", userId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-payments"] });
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      toast.success("Payment approved & subscription activated");
    },
  });

  // Decline payment
  const declinePayment = useMutation({
    mutationFn: async (paymentId: string) => {
      await supabase.from("payments").update({ 
        status: "declined", 
        declined_at: new Date().toISOString() 
      }).eq("id", paymentId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-payments"] });
      toast.success("Payment declined");
    },
  });

  // Create teacher mutation - now creates user account automatically
  const createTeacher = useMutation({
    mutationFn: async () => {
      const body: Record<string, string> = {
        name: teacherForm.name.trim(),
        email: teacherForm.email.trim().toLowerCase(),
        created_by: user!.id,
      };
      
      // Only include password if provided
      if (teacherForm.password.trim()) {
        body.password = teacherForm.password.trim();
      }
      
      const response = await supabase.functions.invoke("create-teacher", {
        body,
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      if (response.data?.error) {
        throw new Error(response.data.error);
      }

      return response.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["admin-teachers"] });
      setTeacherDialogOpen(false);
      setTeacherForm({ name: "", email: "", password: "" });
      
      if (data?.isNewUser) {
        if (data?.hasCustomPassword) {
          toast.success(
            "Teacher account created with the password you set!",
            { duration: 5000 }
          );
        } else {
          toast.success(
            "Teacher account created! They will receive a password reset email to set their password.",
            { duration: 5000 }
          );
        }
      } else {
        toast.success(
          "Teacher role assigned to existing user account.",
          { duration: 5000 }
        );
      }
    },
    onError: (error: any) => {
      if (error.message?.includes("duplicate")) {
        toast.error("A teacher with this email already exists");
      } else {
        toast.error(error.message || "Failed to create teacher");
      }
    },
  });

  // Toggle teacher active status
  const toggleTeacher = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      const { error } = await supabase
        .from("teachers")
        .update({ is_active: isActive })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-teachers"] });
    },
  });

  // Delete teacher mutation
  const deleteTeacher = useMutation({
    mutationFn: async (id: string) => {
      // First get teacher to check for classrooms
      const { data: teacherData } = await supabase.from("teachers").select("*").eq("id", id).single();
      
      if (teacherData) {
        // Delete related classrooms first
        const { data: teacherClassrooms } = await supabase
          .from("classrooms")
          .select("id")
          .eq("teacher_id", id);
        
        if (teacherClassrooms && teacherClassrooms.length > 0) {
          for (const classroom of teacherClassrooms) {
            await supabase.from("classroom_students").delete().eq("classroom_id", classroom.id);
            await supabase.from("classroom_tests").delete().eq("classroom_id", classroom.id);
            await supabase.from("classroom_assignments").delete().eq("classroom_id", classroom.id);
          }
          await supabase.from("classrooms").delete().eq("teacher_id", id);
        }
      }
      
      const { error } = await supabase.from("teachers").delete().eq("id", id);
      if (error) {
        console.error("Error deleting teacher:", error);
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-teachers"] });
      queryClient.invalidateQueries({ queryKey: ["admin-classrooms"] });
      toast.success("Teacher deleted");
    },
    onError: (error: any) => {
      console.error("Delete teacher error:", error);
      toast.error(error.message || "Failed to delete teacher");
    },
  });

  // Toggle classroom active status
  const toggleClassroom = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      const { error } = await supabase
        .from("classrooms")
        .update({ is_active: isActive })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-classrooms"] });
      toast.success("Classroom status updated");
    },
  });

  // Delete classroom
  const deleteClassroom = useMutation({
    mutationFn: async (id: string) => {
      // First delete related data
      const { error: studentsError } = await supabase.from("classroom_students").delete().eq("classroom_id", id);
      if (studentsError) console.error("Error deleting students:", studentsError);
      
      // Delete test questions and submissions for each test
      const { data: tests } = await supabase.from("classroom_tests").select("id").eq("classroom_id", id);
      if (tests) {
        for (const test of tests) {
          await supabase.from("test_questions").delete().eq("test_id", test.id);
          await supabase.from("test_submissions").delete().eq("test_id", test.id);
        }
      }
      
      const { error: testsError } = await supabase.from("classroom_tests").delete().eq("classroom_id", id);
      if (testsError) console.error("Error deleting tests:", testsError);
      
      const { error: assignmentsError } = await supabase.from("classroom_assignments").delete().eq("classroom_id", id);
      if (assignmentsError) console.error("Error deleting assignments:", assignmentsError);
      
      const { error } = await supabase.from("classrooms").delete().eq("id", id);
      if (error) {
        console.error("Error deleting classroom:", error);
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-classrooms"] });
      toast.success("Classroom deleted");
    },
    onError: (error: any) => {
      console.error("Delete classroom error:", error);
      toast.error(error.message || "Failed to delete classroom");
    },
  });

  // Toggle discount code active status
  const toggleDiscountCode = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      const { error } = await supabase
        .from("discount_codes")
        .update({ is_active: isActive })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-discount-codes"] });
    },
  });

  // Delete discount code
  const deleteDiscountCode = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("discount_codes").delete().eq("id", id);
      if (error) {
        console.error("Error deleting discount code:", error);
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-discount-codes"] });
      toast.success("Discount code deleted");
    },
    onError: (error: any) => {
      console.error("Delete discount code error:", error);
      toast.error(error.message || "Failed to delete discount code");
    },
  });

  // Create/Update problem
  const saveProblem = useMutation({
    mutationFn: async (isEdit: boolean) => {
      const problemData = {
        title: problemForm.title.trim(),
        slug: problemForm.slug.trim() || problemForm.title.toLowerCase().replace(/\s+/g, "-"),
        difficulty: problemForm.difficulty,
        topic_id: problemForm.topic_id,
        leetcode_slug: problemForm.leetcode_slug.trim() || null,
        leetcode_id: problemForm.leetcode_id ? parseInt(problemForm.leetcode_id) : null,
        problem_type: problemForm.problem_type,
        companies: problemForm.companies ? problemForm.companies.split(",").map(c => c.trim()).filter(Boolean) : null,
      };

      if (isEdit && editingProblem) {
        const { error } = await supabase
          .from("problems")
          .update(problemData)
          .eq("id", editingProblem.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("problems").insert(problemData);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-problems"] });
      queryClient.invalidateQueries({ queryKey: ["admin-analytics"] });
      setProblemDialogOpen(false);
      setEditingProblem(null);
      resetProblemForm();
      toast.success(editingProblem ? "Problem updated" : "Problem created");
    },
    onError: (error) => {
      console.error("Error saving problem:", error);
      toast.error("Failed to save problem");
    },
  });

  // Delete problem
  const deleteProblem = useMutation({
    mutationFn: async (problemId: string) => {
      // Delete related data first
      const { error: progressError } = await supabase.from("user_problem_progress").delete().eq("problem_id", problemId);
      if (progressError) console.error("Error deleting problem progress:", progressError);
      
      const { error: testQuestionsError } = await supabase.from("test_questions").delete().eq("problem_id", problemId);
      if (testQuestionsError) console.error("Error deleting test questions:", testQuestionsError);
      
      const { error: assignmentsError } = await supabase.from("classroom_assignments").delete().eq("problem_id", problemId);
      if (assignmentsError) console.error("Error deleting assignments:", assignmentsError);
      
      const { error } = await supabase.from("problems").delete().eq("id", problemId);
      if (error) {
        console.error("Error deleting problem:", error);
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-problems"] });
      queryClient.invalidateQueries({ queryKey: ["admin-analytics"] });
      toast.success("Problem deleted");
    },
    onError: (error: any) => {
      console.error("Error deleting problem:", error);
      toast.error(error.message || "Failed to delete problem");
    },
  });

  // Create/Update topic
  const saveTopic = useMutation({
    mutationFn: async (isEdit: boolean) => {
      const topicData = {
        name: topicForm.name.trim(),
        slug: topicForm.slug.trim() || topicForm.name.toLowerCase().replace(/\s+/g, "-"),
        description: topicForm.description.trim() || null,
        icon: topicForm.icon.trim() || null,
        color: topicForm.color.trim() || null,
        display_order: parseInt(topicForm.display_order) || 0,
      };

      if (isEdit && editingTopic) {
        const { error } = await supabase
          .from("topics")
          .update(topicData)
          .eq("id", editingTopic.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("topics").insert(topicData);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-topics-full"] });
      queryClient.invalidateQueries({ queryKey: ["admin-topics"] });
      queryClient.invalidateQueries({ queryKey: ["admin-analytics"] });
      setTopicDialogOpen(false);
      setEditingTopic(null);
      resetTopicForm();
      toast.success(editingTopic ? "Topic updated" : "Topic created");
    },
    onError: (error) => {
      console.error("Error saving topic:", error);
      toast.error("Failed to save topic");
    },
  });

  // Delete topic
  const deleteTopic = useMutation({
    mutationFn: async (topicId: string) => {
      const { count } = await supabase
        .from("problems")
        .select("id", { count: "exact" })
        .eq("topic_id", topicId);

      if (count && count > 0) {
        throw new Error(`Cannot delete topic with ${count} problems. Delete or reassign problems first.`);
      }

      const { error } = await supabase.from("topics").delete().eq("id", topicId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-topics-full"] });
      queryClient.invalidateQueries({ queryKey: ["admin-topics"] });
      queryClient.invalidateQueries({ queryKey: ["admin-analytics"] });
      toast.success("Topic deleted");
    },
    onError: (error: any) => {
      console.error("Error deleting topic:", error);
      toast.error(error.message || "Failed to delete topic");
    },
  });

  // Bulk import helper functions
  const parseCSV = (text: string): any[] => {
    const lines = text.trim().split('\n');
    if (lines.length < 2) return [];
    
    const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/"/g, ''));
    const problemsList: any[] = [];
    
    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].match(/(".*?"|[^",]+)(?=\s*,|\s*$)/g) || [];
      const cleanValues = values.map(v => v.trim().replace(/^"|"$/g, ''));
      
      const problem: any = {};
      headers.forEach((header, index) => {
        problem[header] = cleanValues[index] || '';
      });
      problemsList.push(problem);
    }
    
    return problemsList;
  };

  const parseJSON = (text: string): any[] => {
    const data = JSON.parse(text);
    return Array.isArray(data) ? data : [data];
  };

  const validateProblem = (problem: any, index: number): { valid: boolean; error?: string; data?: any } => {
    const title = problem.title?.trim();
    const difficulty = problem.difficulty?.toLowerCase()?.trim();
    const topicName = problem.topic?.trim() || problem.topic_name?.trim();
    const topicId = problem.topic_id?.trim();
    
    if (!title) {
      return { valid: false, error: `Row ${index + 1}: Missing title` };
    }
    
    if (!['easy', 'medium', 'hard'].includes(difficulty)) {
      return { valid: false, error: `Row ${index + 1}: Invalid difficulty "${difficulty}" (must be easy, medium, or hard)` };
    }
    
    let resolvedTopicId = topicId;
    if (!resolvedTopicId && topicName) {
      const matchedTopic = topics.find(t => 
        t.name.toLowerCase() === topicName.toLowerCase() || 
        t.slug.toLowerCase() === topicName.toLowerCase()
      );
      if (matchedTopic) {
        resolvedTopicId = matchedTopic.id;
      }
    }
    
    if (!resolvedTopicId) {
      return { valid: false, error: `Row ${index + 1}: Topic "${topicName || 'unknown'}" not found. Create the topic first.` };
    }
    
    let companies: string[] | null = null;
    if (problem.companies) {
      companies = problem.companies.split(/[,;]/).map((c: string) => c.trim()).filter(Boolean);
    }
    
    return {
      valid: true,
      data: {
        title,
        slug: problem.slug?.trim() || title.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''),
        difficulty,
        topic_id: resolvedTopicId,
        leetcode_slug: problem.leetcode_slug?.trim() || null,
        leetcode_id: problem.leetcode_id ? parseInt(problem.leetcode_id) : null,
        problem_type: problem.problem_type?.trim() || 'topic_wise',
        companies,
      }
    };
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    
    setImportErrors([]);
    setImportedProblems([]);
    setImportPreview(false);
    
    try {
      const text = await file.text();
      let parsedProblems: any[];
      
      if (file.name.endsWith('.json')) {
        parsedProblems = parseJSON(text);
      } else if (file.name.endsWith('.csv')) {
        parsedProblems = parseCSV(text);
      } else {
        toast.error('Please upload a CSV or JSON file');
        return;
      }
      
      if (parsedProblems.length === 0) {
        toast.error('No problems found in file');
        return;
      }
      
      const errors: string[] = [];
      const validProblems: any[] = [];
      
      parsedProblems.forEach((problem, index) => {
        const result = validateProblem(problem, index);
        if (result.valid && result.data) {
          validProblems.push(result.data);
        } else if (result.error) {
          errors.push(result.error);
        }
      });
      
      setImportedProblems(validProblems);
      setImportErrors(errors);
      setImportPreview(true);
      
      if (validProblems.length === 0) {
        toast.error('No valid problems found');
      } else {
        toast.success(`Found ${validProblems.length} valid problems`);
      }
    } catch (error: any) {
      console.error('Error parsing file:', error);
      toast.error(`Error parsing file: ${error.message}`);
    }
    
    event.target.value = '';
  };

  const executeBulkImport = async () => {
    if (importedProblems.length === 0) return;
    
    setIsImporting(true);
    
    try {
      const { error } = await supabase.from('problems').insert(importedProblems);
      
      if (error) throw error;
      
      queryClient.invalidateQueries({ queryKey: ['admin-problems'] });
      queryClient.invalidateQueries({ queryKey: ['admin-analytics'] });
      
      toast.success(`Successfully imported ${importedProblems.length} problems`);
      setBulkImportDialogOpen(false);
      setImportedProblems([]);
      setImportErrors([]);
      setImportPreview(false);
    } catch (error: any) {
      console.error('Error importing problems:', error);
      toast.error(`Import failed: ${error.message}`);
    } finally {
      setIsImporting(false);
    }
  };

  const resetProblemForm = () => {
    setProblemForm({
      title: "",
      slug: "",
      difficulty: "easy",
      topic_id: "",
      leetcode_slug: "",
      leetcode_id: "",
      problem_type: "topic_wise",
      companies: "",
    });
  };

  const resetTopicForm = () => {
    setTopicForm({
      name: "",
      slug: "",
      description: "",
      icon: "",
      color: "",
      display_order: "0",
    });
  };

  const resetDiscountForm = () => {
    setDiscountForm({
      code: "",
      discount_percent: "10",
      max_uses: "",
      valid_until: "",
      applies_to: "all",
    });
  };

  const openEditProblem = (problem: Problem) => {
    setEditingProblem(problem);
    setProblemForm({
      title: problem.title,
      slug: problem.slug,
      difficulty: problem.difficulty,
      topic_id: problem.topic_id,
      leetcode_slug: problem.leetcode_slug || "",
      leetcode_id: problem.leetcode_id?.toString() || "",
      problem_type: problem.problem_type || "topic_wise",
      companies: problem.companies?.join(", ") || "",
    });
    setProblemDialogOpen(true);
  };

  const openEditTopic = (topic: Topic) => {
    setEditingTopic(topic);
    setTopicForm({
      name: topic.name,
      slug: topic.slug,
      description: topic.description || "",
      icon: topic.icon || "",
      color: topic.color || "",
      display_order: topic.display_order?.toString() || "0",
    });
    setTopicDialogOpen(true);
  };

  const filteredUsers = users.filter(
    (u) =>
      u.email?.toLowerCase().includes(searchUsers.toLowerCase()) ||
      u.full_name?.toLowerCase().includes(searchUsers.toLowerCase())
  );

  const filteredProblems = problems.filter((p) => {
    const matchesSearch = p.title.toLowerCase().includes(searchProblems.toLowerCase());
    const matchesType = problemTypeFilter === "all" || p.problem_type === problemTypeFilter || (problemTypeFilter === "both" && p.problem_type === "both");
    return matchesSearch && matchesType;
  });

  const filteredTopics = topics.filter((t) =>
    t.name.toLowerCase().includes(searchTopics.toLowerCase())
  );

  const problemCountByTopic = problems.reduce((acc, p) => {
    acc[p.topic_id] = (acc[p.topic_id] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const generateRandomCode = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    for (let i = 0; i < 8; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setDiscountForm({ ...discountForm, code });
  };

  if (loading || adminLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAdmin) {
    return null;
  }

  return (
    <DashboardLayout title="Admin Panel" subtitle="Manage users, topics, problems, discounts, and view analytics">
      <Tabs defaultValue="settings" className="space-y-6">
        <TabsList className="flex flex-wrap gap-1 h-auto">
          <TabsTrigger value="settings" className="gap-2">
            <Settings2 className="h-4 w-4" />
            <span className="hidden sm:inline">Settings</span>
          </TabsTrigger>
          <TabsTrigger value="analytics" className="gap-2">
            <BarChart3 className="h-4 w-4" />
            <span className="hidden sm:inline">Analytics</span>
          </TabsTrigger>
          <TabsTrigger value="users" className="gap-2">
            <Users className="h-4 w-4" />
            <span className="hidden sm:inline">Users</span>
          </TabsTrigger>
          <TabsTrigger value="teachers" className="gap-2">
            <GraduationCap className="h-4 w-4" />
            <span className="hidden sm:inline">Teachers</span>
          </TabsTrigger>
          <TabsTrigger value="classrooms" className="gap-2">
            <BookOpen className="h-4 w-4" />
            <span className="hidden sm:inline">Classrooms</span>
          </TabsTrigger>
          <TabsTrigger value="discounts" className="gap-2">
            <Tag className="h-4 w-4" />
            <span className="hidden sm:inline">Discounts</span>
          </TabsTrigger>
          <TabsTrigger value="topics" className="gap-2">
            <Layers className="h-4 w-4" />
            <span className="hidden sm:inline">Topics</span>
          </TabsTrigger>
          <TabsTrigger value="topic-problems" className="gap-2">
            <BookOpen className="h-4 w-4" />
            <span className="hidden sm:inline">Topic Problems</span>
          </TabsTrigger>
          <TabsTrigger value="companies" className="gap-2">
            <Building2 className="h-4 w-4" />
            <span className="hidden sm:inline">Companies</span>
          </TabsTrigger>
          <TabsTrigger value="payments" className="gap-2">
            <CreditCard className="h-4 w-4" />
            <span className="hidden sm:inline">Payments</span>
          </TabsTrigger>
          <TabsTrigger value="emails" className="gap-2">
            <Send className="h-4 w-4" />
            <span className="hidden sm:inline">Emails</span>
          </TabsTrigger>
          <TabsTrigger value="domains" className="gap-2">
            <Globe className="h-4 w-4" />
            <span className="hidden sm:inline">Domains</span>
          </TabsTrigger>
        </TabsList>

        {/* Settings Tab */}
        <TabsContent value="settings">
          <div className="grid md:grid-cols-2 gap-6">
            <Card className="p-6">
              <h3 className="font-semibold text-lg mb-4 flex items-center gap-2">
                <ToggleLeft className="h-5 w-5" />
                Feature Toggles
              </h3>
              <div className="space-y-6">
                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div>
                    <p className="font-medium">Paid Features</p>
                    <p className="text-sm text-muted-foreground">
                      {settings.paid_features_enabled 
                        ? "Users must pay for pro features" 
                        : "All features are free for everyone"}
                    </p>
                  </div>
                  <Switch
                    checked={settings.paid_features_enabled}
                    onCheckedChange={(checked) => 
                      updateSetting.mutate({ key: "paid_features_enabled", enabled: checked })
                    }
                    disabled={updateSetting.isPending}
                  />
                </div>
                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div>
                    <p className="font-medium">Invite System</p>
                    <p className="text-sm text-muted-foreground">
                      {settings.invite_system_enabled 
                        ? "Users can invite others for rewards" 
                        : "Invite system is disabled"}
                    </p>
                  </div>
                  <Switch
                    checked={settings.invite_system_enabled}
                    onCheckedChange={(checked) => 
                      updateSetting.mutate({ key: "invite_system_enabled", enabled: checked })
                    }
                    disabled={updateSetting.isPending}
                  />
                </div>
                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div>
                    <p className="font-medium">Company-wise Problems</p>
                    <p className="text-sm text-muted-foreground">
                      {settings.company_problems_enabled 
                        ? "Company problems visible on user dashboard" 
                        : "Company problems hidden (Coming Soon shown)"}
                    </p>
                  </div>
                  <Switch
                    checked={settings.company_problems_enabled}
                    onCheckedChange={(checked) => 
                      updateSetting.mutate({ key: "company_problems_enabled", enabled: checked })
                    }
                    disabled={updateSetting.isPending}
                  />
                </div>
              </div>
            </Card>
            <Card className="p-6">
              <h3 className="font-semibold text-lg mb-4">Quick Stats</h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Total Users</span>
                  <Badge variant="secondary">{analytics?.totalUsers || 0}</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Paid Users</span>
                  <Badge variant="secondary">{analytics?.paidUsers || 0}</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Total Teachers</span>
                  <Badge variant="secondary">{teachers.length}</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Pending Payments</span>
                  <Badge variant="secondary">{payments.filter(p => p.status === "pending").length}</Badge>
                </div>
              </div>
            </Card>
          </div>
          
          {/* Landing Page Stats Settings */}
          <Card className="p-6 mt-6">
            <h3 className="font-semibold text-lg mb-4 flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Landing Page Stats
            </h3>
            <p className="text-sm text-muted-foreground mb-4">
              Customize the statistics shown on the landing page hero section
            </p>
            <div className="grid sm:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Problems Count</Label>
                <Input
                  value={settings.landing_stats.problems_count}
                  onChange={(e) => {
                    const newStats = { ...settings.landing_stats, problems_count: e.target.value };
                    updateLandingStats.mutate(newStats);
                  }}
                  placeholder="500+"
                />
              </div>
              <div className="space-y-2">
                <Label>Companies Count</Label>
                <Input
                  value={settings.landing_stats.companies_count}
                  onChange={(e) => {
                    const newStats = { ...settings.landing_stats, companies_count: e.target.value };
                    updateLandingStats.mutate(newStats);
                  }}
                  placeholder="50+"
                />
              </div>
              <div className="space-y-2">
                <Label>Topics Count</Label>
                <Input
                  value={settings.landing_stats.topics_count}
                  onChange={(e) => {
                    const newStats = { ...settings.landing_stats, topics_count: e.target.value };
                    updateLandingStats.mutate(newStats);
                  }}
                  placeholder="15+"
                />
              </div>
            </div>
          </Card>
        </TabsContent>

        {/* Analytics Tab */}
        <TabsContent value="analytics">
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <Card className="p-6">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-lg bg-primary/10">
                  <Users className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Users</p>
                  <p className="text-2xl font-bold">{analytics?.totalUsers || 0}</p>
                </div>
              </div>
            </Card>
            <Card className="p-6">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-lg bg-success/10">
                  <Crown className="h-6 w-6 text-success" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Paid Users</p>
                  <p className="text-2xl font-bold">{analytics?.paidUsers || 0}</p>
                </div>
              </div>
            </Card>
            <Card className="p-6">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-lg bg-warning/10">
                  <FileCode2 className="h-6 w-6 text-warning" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Problems</p>
                  <p className="text-2xl font-bold">{analytics?.totalProblems || 0}</p>
                </div>
              </div>
            </Card>
            <Card className="p-6">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-lg bg-info/10">
                  <BarChart3 className="h-6 w-6 text-info" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Revenue</p>
                  <p className="text-2xl font-bold">₹{analytics?.totalRevenue || 0}</p>
                </div>
              </div>
            </Card>
          </div>
          <div className="grid sm:grid-cols-3 gap-4">
            <Card className="p-6">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-lg bg-success/10">
                  <UserCheck className="h-6 w-6 text-success" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Verified Users</p>
                  <p className="text-2xl font-bold">{analytics?.verifiedUsers || 0}</p>
                </div>
              </div>
            </Card>
            <Card className="p-6">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-lg bg-info/10">
                  <Layers className="h-6 w-6 text-info" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Topics</p>
                  <p className="text-2xl font-bold">{analytics?.totalTopics || 0}</p>
                </div>
              </div>
            </Card>
            <Card className="p-6">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-lg bg-primary/10">
                  <CheckCircle2 className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Problems Solved</p>
                  <p className="text-2xl font-bold">{analytics?.totalSolved || 0}</p>
                </div>
              </div>
            </Card>
          </div>
        </TabsContent>

        {/* Teachers Tab */}
        <TabsContent value="teachers">
          <Card className="p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="font-semibold text-lg">Teacher Management</h3>
                <p className="text-sm text-muted-foreground">Create and manage teachers who can create classrooms</p>
              </div>
              <Dialog open={teacherDialogOpen} onOpenChange={setTeacherDialogOpen}>
                <DialogTrigger asChild>
                  <Button className="gap-2">
                    <Plus className="h-4 w-4" />
                    Add Teacher
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Add New Teacher</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 pt-4">
                    <div>
                      <Label>Full Name</Label>
                      <Input
                        value={teacherForm.name}
                        onChange={(e) => setTeacherForm({ ...teacherForm, name: e.target.value })}
                        placeholder="John Doe"
                      />
                    </div>
                    <div>
                      <Label>Email</Label>
                      <Input
                        type="email"
                        value={teacherForm.email}
                        onChange={(e) => setTeacherForm({ ...teacherForm, email: e.target.value })}
                        placeholder="teacher@example.com"
                      />
                    </div>
                    <div>
                      <Label>Password (Optional)</Label>
                      <Input
                        type="password"
                        value={teacherForm.password}
                        onChange={(e) => setTeacherForm({ ...teacherForm, password: e.target.value })}
                        placeholder="Leave empty for email reset link"
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        {teacherForm.password.trim() 
                          ? "Teacher will be created with this password" 
                          : "Teacher will receive an email to set their own password"}
                      </p>
                    </div>
                    <Button
                      className="w-full"
                      onClick={() => createTeacher.mutate()}
                      disabled={createTeacher.isPending || !teacherForm.name.trim() || !teacherForm.email.trim() || (teacherForm.password.trim() && teacherForm.password.trim().length < 6)}
                    >
                      {createTeacher.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create Teacher"}
                    </Button>
                    {teacherForm.password.trim() && teacherForm.password.trim().length > 0 && teacherForm.password.trim().length < 6 && (
                      <p className="text-xs text-destructive text-center">Password must be at least 6 characters</p>
                    )}
                  </div>
                </DialogContent>
              </Dialog>
            </div>

            {teachersLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : teachers.length === 0 ? (
              <div className="text-center py-12">
                <GraduationCap className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium mb-2">No teachers yet</h3>
                <p className="text-muted-foreground mb-4">
                  Add your first teacher to get started with classroom management
                </p>
                <Button onClick={() => setTeacherDialogOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Teacher
                </Button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left text-xs font-medium text-muted-foreground uppercase px-4 py-3">Teacher</th>
                      <th className="text-left text-xs font-medium text-muted-foreground uppercase px-4 py-3">Email</th>
                      <th className="text-left text-xs font-medium text-muted-foreground uppercase px-4 py-3">Status</th>
                      <th className="text-left text-xs font-medium text-muted-foreground uppercase px-4 py-3">Account</th>
                      <th className="text-left text-xs font-medium text-muted-foreground uppercase px-4 py-3">Created</th>
                      <th className="text-right text-xs font-medium text-muted-foreground uppercase px-4 py-3">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {teachers.map((t) => (
                      <tr key={t.id} className="hover:bg-muted/30">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <GraduationCap className="h-4 w-4 text-muted-foreground" />
                            <span className="font-medium">{t.name}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <code className="text-sm text-muted-foreground">{t.email}</code>
                        </td>
                        <td className="px-4 py-3">
                          <Switch
                            checked={t.is_active}
                            onCheckedChange={(checked) => toggleTeacher.mutate({ id: t.id, isActive: checked })}
                          />
                        </td>
                        <td className="px-4 py-3">
                          {t.user_id ? (
                            <Badge className="bg-success">Linked</Badge>
                          ) : (
                            <Badge variant="secondary">Not yet signed up</Badge>
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm text-muted-foreground">
                          {new Date(t.created_at).toLocaleDateString()}
                        </td>
                        <td className="px-4 py-3">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-destructive hover:text-destructive"
                            onClick={() => {
                              if (confirm("Delete this teacher? Their classrooms will also be deleted.")) {
                                deleteTeacher.mutate(t.id);
                              }
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </TabsContent>

        {/* Classrooms Tab */}
        <TabsContent value="classrooms">
          <Card className="p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="font-semibold text-lg">Classroom Management</h3>
                <p className="text-sm text-muted-foreground">View and manage all classrooms across all teachers</p>
              </div>
            </div>

            {classroomsLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : classrooms.length === 0 ? (
              <div className="text-center py-12">
                <BookOpen className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium mb-2">No classrooms yet</h3>
                <p className="text-muted-foreground">
                  Classrooms will appear here once teachers create them
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left text-xs font-medium text-muted-foreground uppercase px-4 py-3">Classroom</th>
                      <th className="text-left text-xs font-medium text-muted-foreground uppercase px-4 py-3">Teacher</th>
                      <th className="text-left text-xs font-medium text-muted-foreground uppercase px-4 py-3">Students</th>
                      <th className="text-left text-xs font-medium text-muted-foreground uppercase px-4 py-3">Status</th>
                      <th className="text-left text-xs font-medium text-muted-foreground uppercase px-4 py-3">Created</th>
                      <th className="text-right text-xs font-medium text-muted-foreground uppercase px-4 py-3">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {classrooms.map((classroom: any) => (
                      <tr key={classroom.id} className="hover:bg-muted/30">
                        <td className="px-4 py-3">
                          <div>
                            <p className="font-medium">{classroom.name}</p>
                            <p className="text-sm text-muted-foreground line-clamp-1">
                              {classroom.description || "No description"}
                            </p>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div>
                            <p className="font-medium">{classroom.teachers?.name || "Unknown"}</p>
                            <p className="text-xs text-muted-foreground">{classroom.teachers?.email}</p>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <Badge variant="secondary">
                            {classroomStudentCounts[classroom.id] || 0} students
                          </Badge>
                        </td>
                        <td className="px-4 py-3">
                          <Badge variant={classroom.is_active ? "default" : "secondary"}>
                            {classroom.is_active ? "Active" : "Inactive"}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-sm text-muted-foreground">
                          {new Date(classroom.created_at).toLocaleDateString()}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => navigate(`/admin/classroom/${classroom.id}`)}
                            >
                              View
                            </Button>
                            <Switch
                              checked={classroom.is_active}
                              onCheckedChange={(checked) => toggleClassroom.mutate({ id: classroom.id, isActive: checked })}
                            />
                            <Button
                              variant="ghost"
                              size="icon"
                              className="text-destructive hover:text-destructive"
                              onClick={() => {
                                if (confirm("Delete this classroom? All students and tests will be removed.")) {
                                  deleteClassroom.mutate(classroom.id);
                                }
                              }}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </TabsContent>

        {/* Users Tab */}
        <TabsContent value="users">
          <Card className="p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-semibold text-lg">User Management</h3>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search users..."
                  value={searchUsers}
                  onChange={(e) => setSearchUsers(e.target.value)}
                  className="pl-9 w-64"
                />
              </div>
            </div>

            {usersLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left text-xs font-medium text-muted-foreground uppercase px-4 py-3">User</th>
                      <th className="text-left text-xs font-medium text-muted-foreground uppercase px-4 py-3">Status</th>
                      <th className="text-left text-xs font-medium text-muted-foreground uppercase px-4 py-3">Plan</th>
                      <th className="text-left text-xs font-medium text-muted-foreground uppercase px-4 py-3">Solved</th>
                      <th className="text-left text-xs font-medium text-muted-foreground uppercase px-4 py-3">Joined</th>
                      <th className="text-right text-xs font-medium text-muted-foreground uppercase px-4 py-3">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {filteredUsers.map((u) => (
                      <tr key={u.id} className={`hover:bg-muted/30 ${u.is_disabled ? 'opacity-50' : ''}`}>
                        <td className="px-4 py-3">
                          <div>
                            <p className="font-medium">{u.full_name || "No name"}</p>
                            <p className="text-sm text-muted-foreground">{u.email}</p>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          {u.is_disabled ? (
                            <Badge variant="destructive" className="gap-1">
                              <Ban className="h-3 w-3" />
                              Disabled
                            </Badge>
                          ) : u.leetcode_verified ? (
                            <Badge variant="default" className="bg-success">
                              <UserCheck className="h-3 w-3 mr-1" />
                              Verified
                            </Badge>
                          ) : (
                            <Badge variant="secondary">
                              <UserX className="h-3 w-3 mr-1" />
                              Not Verified
                            </Badge>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <Badge variant={u.subscription_plan === 'pro' ? 'default' : u.subscription_plan === 'basic' ? 'secondary' : 'outline'}>
                            {u.subscription_plan || 'free'}
                          </Badge>
                        </td>
                        <td className="px-4 py-3">
                          <span className="font-medium">{u.total_solved || 0}</span>
                        </td>
                        <td className="px-4 py-3 text-sm text-muted-foreground">
                          {new Date(u.created_at).toLocaleDateString()}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => toggleUserDisabled.mutate({ userId: u.user_id, disabled: !u.is_disabled })}
                              title={u.is_disabled ? "Enable user" : "Disable user"}
                            >
                              {u.is_disabled ? (
                                <UserCheck className="h-4 w-4 text-success" />
                              ) : (
                                <ShieldOff className="h-4 w-4 text-warning" />
                              )}
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="text-destructive hover:text-destructive"
                              onClick={() => {
                                if (confirm("Delete this user? This action cannot be undone.")) {
                                  deleteUser.mutate(u.user_id);
                                }
                              }}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </TabsContent>

        {/* Discount Codes Tab */}
        <TabsContent value="discounts">
          <Card className="p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-semibold text-lg">Discount Codes</h3>
              <Dialog open={discountDialogOpen} onOpenChange={setDiscountDialogOpen}>
                <DialogTrigger asChild>
                  <Button className="gap-2">
                    <Plus className="h-4 w-4" />
                    Create Code
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Create Discount Code</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 pt-4">
                    <div>
                      <Label>Code</Label>
                      <div className="flex gap-2">
                        <Input
                          value={discountForm.code}
                          onChange={(e) => setDiscountForm({ ...discountForm, code: e.target.value.toUpperCase() })}
                          placeholder="SAVE20"
                          className="uppercase"
                        />
                        <Button variant="outline" onClick={generateRandomCode}>
                          Generate
                        </Button>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>Discount %</Label>
                        <Input
                          type="number"
                          value={discountForm.discount_percent}
                          onChange={(e) => setDiscountForm({ ...discountForm, discount_percent: e.target.value })}
                          min="1"
                          max="100"
                        />
                      </div>
                      <div>
                        <Label>Max Uses (optional)</Label>
                        <Input
                          type="number"
                          value={discountForm.max_uses}
                          onChange={(e) => setDiscountForm({ ...discountForm, max_uses: e.target.value })}
                          placeholder="Unlimited"
                        />
                      </div>
                    </div>
                    <div>
                      <Label>Applies To</Label>
                      <Select
                        value={discountForm.applies_to}
                        onValueChange={(v) => setDiscountForm({ ...discountForm, applies_to: v })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Plans</SelectItem>
                          <SelectItem value="basic">Basic Only</SelectItem>
                          <SelectItem value="pro_3">Pro 3 Months Only</SelectItem>
                          <SelectItem value="pro_6">Pro 6 Months Only</SelectItem>
                          <SelectItem value="lifetime">Lifetime Only</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Valid Until (optional)</Label>
                      <Input
                        type="date"
                        value={discountForm.valid_until}
                        onChange={(e) => setDiscountForm({ ...discountForm, valid_until: e.target.value })}
                      />
                    </div>
                    <Button
                      className="w-full"
                      onClick={() => createDiscountCode.mutate()}
                      disabled={createDiscountCode.isPending || !discountForm.code.trim()}
                    >
                      {createDiscountCode.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        "Create Discount Code"
                      )}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>

            {discountsLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left text-xs font-medium text-muted-foreground uppercase px-4 py-3">Code</th>
                      <th className="text-left text-xs font-medium text-muted-foreground uppercase px-4 py-3">Discount</th>
                      <th className="text-left text-xs font-medium text-muted-foreground uppercase px-4 py-3">Usage</th>
                      <th className="text-left text-xs font-medium text-muted-foreground uppercase px-4 py-3">Applies To</th>
                      <th className="text-left text-xs font-medium text-muted-foreground uppercase px-4 py-3">Status</th>
                      <th className="text-right text-xs font-medium text-muted-foreground uppercase px-4 py-3">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {discountCodes.map((dc) => (
                      <tr key={dc.id} className="hover:bg-muted/30">
                        <td className="px-4 py-3">
                          <code className="font-mono font-bold">{dc.code}</code>
                        </td>
                        <td className="px-4 py-3">
                          <Badge variant="secondary">{dc.discount_percent}% OFF</Badge>
                        </td>
                        <td className="px-4 py-3 text-sm">
                          {dc.used_count} / {dc.max_uses || '∞'}
                        </td>
                        <td className="px-4 py-3 text-sm text-muted-foreground">
                          {dc.applies_to || 'All Plans'}
                        </td>
                        <td className="px-4 py-3">
                          <Switch
                            checked={dc.is_active}
                            onCheckedChange={(checked) => toggleDiscountCode.mutate({ id: dc.id, isActive: checked })}
                          />
                        </td>
                        <td className="px-4 py-3">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-destructive hover:text-destructive"
                            onClick={() => {
                              if (confirm("Delete this discount code?")) {
                                deleteDiscountCode.mutate(dc.id);
                              }
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {discountCodes.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    No discount codes yet. Create your first discount code.
                  </div>
                )}
              </div>
            )}
          </Card>
        </TabsContent>

        {/* Topics Tab */}
        <TabsContent value="topics">
          <Card className="p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-semibold text-lg">Topic Management</h3>
              <div className="flex items-center gap-3">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search topics..."
                    value={searchTopics}
                    onChange={(e) => setSearchTopics(e.target.value)}
                    className="pl-9 w-64"
                  />
                </div>
                <Dialog open={topicDialogOpen} onOpenChange={(open) => {
                  setTopicDialogOpen(open);
                  if (!open) {
                    setEditingTopic(null);
                    resetTopicForm();
                  }
                }}>
                  <DialogTrigger asChild>
                    <Button className="gap-2">
                      <Plus className="h-4 w-4" />
                      Add Topic
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-lg">
                    <DialogHeader>
                      <DialogTitle>{editingTopic ? "Edit Topic" : "Add New Topic"}</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 pt-4">
                      <div>
                        <Label>Name</Label>
                        <Input
                          value={topicForm.name}
                          onChange={(e) => setTopicForm({ ...topicForm, name: e.target.value })}
                          placeholder="Arrays & Hashing"
                        />
                      </div>
                      <div>
                        <Label>Slug (URL-friendly)</Label>
                        <Input
                          value={topicForm.slug}
                          onChange={(e) => setTopicForm({ ...topicForm, slug: e.target.value })}
                          placeholder="arrays-hashing"
                        />
                      </div>
                      <div>
                        <Label>Description</Label>
                        <Textarea
                          value={topicForm.description}
                          onChange={(e) => setTopicForm({ ...topicForm, description: e.target.value })}
                          placeholder="Learn about arrays and hash maps..."
                          rows={3}
                        />
                      </div>
                      <div className="grid grid-cols-3 gap-4">
                        <div>
                          <Label>Icon</Label>
                          <Input
                            value={topicForm.icon}
                            onChange={(e) => setTopicForm({ ...topicForm, icon: e.target.value })}
                            placeholder="📊"
                          />
                        </div>
                        <div>
                          <Label>Color</Label>
                          <Input
                            value={topicForm.color}
                            onChange={(e) => setTopicForm({ ...topicForm, color: e.target.value })}
                            placeholder="#f97316"
                          />
                        </div>
                        <div>
                          <Label>Order</Label>
                          <Input
                            type="number"
                            value={topicForm.display_order}
                            onChange={(e) => setTopicForm({ ...topicForm, display_order: e.target.value })}
                          />
                        </div>
                      </div>
                      <Button
                        className="w-full"
                        onClick={() => saveTopic.mutate(!!editingTopic)}
                        disabled={saveTopic.isPending || !topicForm.name.trim()}
                      >
                        {saveTopic.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : editingTopic ? "Update Topic" : "Create Topic"}
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            </div>

            {topicsLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left text-xs font-medium text-muted-foreground uppercase px-4 py-3">Topic</th>
                      <th className="text-left text-xs font-medium text-muted-foreground uppercase px-4 py-3">Problems</th>
                      <th className="text-left text-xs font-medium text-muted-foreground uppercase px-4 py-3">Order</th>
                      <th className="text-right text-xs font-medium text-muted-foreground uppercase px-4 py-3">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {filteredTopics.map((t) => (
                      <tr key={t.id} className="hover:bg-muted/30">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            {t.icon && <span className="text-xl">{t.icon}</span>}
                            <div>
                              <p className="font-medium">{t.name}</p>
                              <code className="text-xs text-muted-foreground">{t.slug}</code>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <Badge variant="secondary">{problemCountByTopic[t.id] || 0}</Badge>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">{t.display_order || 0}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-1">
                            <Button variant="ghost" size="icon" onClick={() => openEditTopic(t)}>
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="text-destructive hover:text-destructive"
                              onClick={() => {
                                if (confirm("Delete this topic?")) deleteTopic.mutate(t.id);
                              }}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </TabsContent>

        {/* Topic-wise Problems Tab */}
        <TabsContent value="topic-problems">
          <Card className="p-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
              <div>
                <h3 className="font-semibold text-lg">Topic-wise Problems</h3>
                <p className="text-sm text-muted-foreground">Free tier problems organized by topic</p>
              </div>
              <div className="flex items-center gap-3">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search problems..."
                    value={searchProblems}
                    onChange={(e) => setSearchProblems(e.target.value)}
                    className="pl-9 w-64"
                  />
                </div>
                <Dialog open={bulkImportDialogOpen} onOpenChange={setBulkImportDialogOpen}>
                  <DialogTrigger asChild>
                    <Button variant="outline" className="gap-2">
                      <Upload className="h-4 w-4" />
                      Import
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-2xl">
                    <DialogHeader>
                      <DialogTitle>Bulk Import Problems</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 pt-4">
                      {!importPreview ? (
                        <div className="border-2 border-dashed border-border rounded-lg p-8 text-center">
                          <FileUp className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                          <p className="text-sm text-muted-foreground mb-4">Upload CSV or JSON file</p>
                          <Label htmlFor="file-upload" className="cursor-pointer">
                            <Button asChild><span><Upload className="h-4 w-4 mr-2" />Select File</span></Button>
                          </Label>
                          <Input id="file-upload" type="file" accept=".csv,.json" className="hidden" onChange={handleFileUpload} />
                        </div>
                      ) : (
                        <>
                          <div className="flex items-center gap-4 text-sm">
                            <span className="text-success">{importedProblems.length} valid</span>
                            {importErrors.length > 0 && <span className="text-destructive">{importErrors.length} errors</span>}
                          </div>
                          {importedProblems.length > 0 && (
                            <ScrollArea className="h-48 border rounded-lg">
                              <table className="w-full text-sm">
                                <thead className="bg-muted sticky top-0">
                                  <tr>
                                    <th className="text-left px-3 py-2">Title</th>
                                    <th className="text-left px-3 py-2">Difficulty</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y">
                                  {importedProblems.map((p, i) => (
                                    <tr key={i}><td className="px-3 py-2">{p.title}</td><td className="px-3 py-2"><Badge variant={p.difficulty as any}>{p.difficulty}</Badge></td></tr>
                                  ))}
                                </tbody>
                              </table>
                            </ScrollArea>
                          )}
                          <div className="flex gap-3">
                            <Button variant="outline" onClick={() => { setImportPreview(false); setImportedProblems([]); }} className="flex-1">Upload Different</Button>
                            <Button onClick={executeBulkImport} disabled={isImporting || importedProblems.length === 0} className="flex-1">
                              {isImporting ? <Loader2 className="h-4 w-4 animate-spin" /> : `Import ${importedProblems.length}`}
                            </Button>
                          </div>
                        </>
                      )}
                    </div>
                  </DialogContent>
                </Dialog>
                <Dialog open={problemDialogOpen && problemForm.problem_type === 'topic_wise'} onOpenChange={(open) => {
                  setProblemDialogOpen(open);
                  if (!open) { setEditingProblem(null); resetProblemForm(); }
                }}>
                  <DialogTrigger asChild>
                    <Button className="gap-2" onClick={() => setProblemForm({ ...problemForm, problem_type: 'topic_wise' })}>
                      <Plus className="h-4 w-4" />
                      Add Problem
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>{editingProblem ? "Edit Problem" : "Add Topic-wise Problem"}</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 pt-4">
                      <div><Label>Title</Label><Input value={problemForm.title} onChange={(e) => setProblemForm({ ...problemForm, title: e.target.value })} placeholder="Two Sum" /></div>
                      <div className="grid grid-cols-2 gap-4">
                        <div><Label>Difficulty</Label><Select value={problemForm.difficulty} onValueChange={(v) => setProblemForm({ ...problemForm, difficulty: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="easy">Easy</SelectItem><SelectItem value="medium">Medium</SelectItem><SelectItem value="hard">Hard</SelectItem></SelectContent></Select></div>
                        <div><Label>Topic</Label><Select value={problemForm.topic_id} onValueChange={(v) => setProblemForm({ ...problemForm, topic_id: v })}><SelectTrigger><SelectValue placeholder="Select topic" /></SelectTrigger><SelectContent>{topics.map((t) => (<SelectItem key={t.id} value={t.id}>{t.icon} {t.name}</SelectItem>))}</SelectContent></Select></div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div><Label>LeetCode Slug</Label><Input value={problemForm.leetcode_slug} onChange={(e) => setProblemForm({ ...problemForm, leetcode_slug: e.target.value })} placeholder="two-sum" /></div>
                        <div><Label>LeetCode ID</Label><Input type="number" value={problemForm.leetcode_id} onChange={(e) => setProblemForm({ ...problemForm, leetcode_id: e.target.value })} placeholder="1" /></div>
                      </div>
                      <Button className="w-full" onClick={() => saveProblem.mutate(!!editingProblem)} disabled={saveProblem.isPending || !problemForm.title.trim() || !problemForm.topic_id}>
                        {saveProblem.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : editingProblem ? "Update" : "Create"}
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left text-xs font-medium text-muted-foreground uppercase px-4 py-3">Problem</th>
                    <th className="text-left text-xs font-medium text-muted-foreground uppercase px-4 py-3">Difficulty</th>
                    <th className="text-left text-xs font-medium text-muted-foreground uppercase px-4 py-3">Topic</th>
                    <th className="text-right text-xs font-medium text-muted-foreground uppercase px-4 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {problems.filter(p => p.problem_type === 'topic_wise' || p.problem_type === 'both').filter(p => p.title.toLowerCase().includes(searchProblems.toLowerCase())).map((p) => (
                    <tr key={p.id} className="hover:bg-muted/30">
                      <td className="px-4 py-3"><p className="font-medium">{p.title}</p></td>
                      <td className="px-4 py-3"><Badge variant={p.difficulty as any}>{p.difficulty}</Badge></td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">{topics.find(t => t.id === p.topic_id)?.name}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="icon" onClick={() => openEditProblem(p)}><Edit className="h-4 w-4" /></Button>
                          <Button variant="ghost" size="icon" className="text-destructive" onClick={() => { if (confirm("Delete?")) deleteProblem.mutate(p.id); }}><Trash2 className="h-4 w-4" /></Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </TabsContent>

        {/* Companies Tab */}
        <TabsContent value="companies">
          <CompanyManagement />
        </TabsContent>

        {/* Payments Tab */}
        <TabsContent value="payments">
          <Card className="p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="font-semibold text-lg">Payment Approvals</h3>
                <p className="text-sm text-muted-foreground">Review and approve/decline UPI payments</p>
              </div>
              <Badge variant="outline">{payments.filter(p => p.status === "pending").length} pending</Badge>
            </div>

            {paymentsLoading ? (
              <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left text-xs font-medium text-muted-foreground uppercase px-4 py-3">User</th>
                      <th className="text-left text-xs font-medium text-muted-foreground uppercase px-4 py-3">Plan</th>
                      <th className="text-left text-xs font-medium text-muted-foreground uppercase px-4 py-3">Amount</th>
                      <th className="text-left text-xs font-medium text-muted-foreground uppercase px-4 py-3">Transaction ID</th>
                      <th className="text-left text-xs font-medium text-muted-foreground uppercase px-4 py-3">Status</th>
                      <th className="text-left text-xs font-medium text-muted-foreground uppercase px-4 py-3">Date</th>
                      <th className="text-right text-xs font-medium text-muted-foreground uppercase px-4 py-3">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {payments.map((p) => (
                      <tr key={p.id} className="hover:bg-muted/30">
                        <td className="px-4 py-3">
                          <p className="font-medium">{p.customer_name || "N/A"}</p>
                          <p className="text-xs text-muted-foreground">{p.customer_email}</p>
                        </td>
                        <td className="px-4 py-3"><Badge variant="secondary">{p.plan}</Badge></td>
                        <td className="px-4 py-3 font-medium">₹{p.amount}</td>
                        <td className="px-4 py-3"><code className="text-xs bg-muted px-1.5 py-0.5 rounded">{p.phonepay_transaction_id || "N/A"}</code></td>
                        <td className="px-4 py-3">
                          {p.status === "pending" && <Badge className="bg-warning text-warning-foreground"><Clock className="h-3 w-3 mr-1" />Pending</Badge>}
                          {p.status === "completed" && <Badge className="bg-success text-success-foreground"><Check className="h-3 w-3 mr-1" />Approved</Badge>}
                          {p.status === "declined" && <Badge variant="destructive"><X className="h-3 w-3 mr-1" />Declined</Badge>}
                        </td>
                        <td className="px-4 py-3 text-sm text-muted-foreground">{new Date(p.created_at).toLocaleDateString()}</td>
                        <td className="px-4 py-3">
                          {p.status === "pending" && (
                            <div className="flex items-center justify-end gap-1">
                              <Button size="sm" variant="default" className="bg-success hover:bg-success/90" onClick={() => approvePayment.mutate({ paymentId: p.id, userId: p.user_id, plan: p.plan })} disabled={approvePayment.isPending}>
                                <Check className="h-3 w-3 mr-1" />Approve
                              </Button>
                              <Button size="sm" variant="destructive" onClick={() => declinePayment.mutate(p.id)} disabled={declinePayment.isPending}>
                                <X className="h-3 w-3 mr-1" />Decline
                              </Button>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </TabsContent>

        {/* Emails Tab */}
        <TabsContent value="emails">
          <Card className="p-6">
            <AdminEmailSystem />
          </Card>
        </TabsContent>

        {/* Domains Tab */}
        <TabsContent value="domains">
          <EmailDomainWhitelist />
        </TabsContent>
      </Tabs>
    </DashboardLayout>
  );
}