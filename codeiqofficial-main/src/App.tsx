import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import Landing from "./pages/Landing";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import RoleDashboard from "./pages/RoleDashboard";
import Topics from "./pages/Topics";
import Companies from "./pages/Companies";
import Achievements from "./pages/Achievements";
import Settings from "./pages/Settings";
import Revision from "./pages/Revision";
import Analytics from "./pages/Analytics";
import Leaderboard from "./pages/Leaderboard";
import Admin from "./pages/Admin";
import Pricing from "./pages/Pricing";
import PaymentCallback from "./pages/PaymentCallback";
import NotFound from "./pages/NotFound";
import Privacy from "./pages/Privacy";
import Terms from "./pages/Terms";
import Contact from "./pages/Contact";
import Refunds from "./pages/Refunds";
import TeacherDashboard from "./pages/TeacherDashboard";
import ClassroomManagement from "./pages/ClassroomManagement";
import JoinClassroom from "./pages/JoinClassroom";
import StudentDashboard from "./pages/StudentDashboard";
import TakeTest from "./pages/TakeTest";
import TestHistory from "./pages/TestHistory";
import AdminClassroomManagement from "./pages/AdminClassroomManagement";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <AuthProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/home" element={<RoleDashboard />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/topics" element={<Topics />} />
            <Route path="/companies" element={<Companies />} />
            <Route path="/achievements" element={<Achievements />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/revision" element={<Revision />} />
            <Route path="/analytics" element={<Analytics />} />
            <Route path="/leaderboard" element={<Leaderboard />} />
            <Route path="/admin" element={<Admin />} />
            <Route path="/admin/classroom/:classroomId" element={<AdminClassroomManagement />} />
            <Route path="/pricing" element={<Pricing />} />
            <Route path="/payment-callback" element={<PaymentCallback />} />
            <Route path="/privacy" element={<Privacy />} />
            <Route path="/terms" element={<Terms />} />
            <Route path="/contact" element={<Contact />} />
            <Route path="/refunds" element={<Refunds />} />
            <Route path="/teacher" element={<TeacherDashboard />} />
            <Route path="/teacher/classroom/:classroomId" element={<ClassroomManagement />} />
            <Route path="/join/:inviteCode" element={<JoinClassroom />} />
            <Route path="/student" element={<StudentDashboard />} />
            <Route path="/test/:testId" element={<TakeTest />} />
            <Route path="/test-history" element={<TestHistory />} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
