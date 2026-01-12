import { useState, useEffect } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { useAppSettings } from "@/hooks/useAppSettings";
import { useTeacher } from "@/hooks/useTeacher";
import { useClassroomStudent } from "@/hooks/useClassroomStudent";
import { useAdmin } from "@/hooks/useAdmin";
import { useLeetCode } from "@/hooks/useLeetCode";
import { supabase } from "@/integrations/supabase/client";
import codeiqLogo from "@/assets/codeiq-logo.png";
import codeiqOwl from "@/assets/codeiq-owl.gif";
import { Mail, Lock, User, Eye, EyeOff, ArrowRight, CheckCircle2, Loader2, Ticket, AlertCircle, ArrowLeft, Link2, Copy, ExternalLink, Phone, GraduationCap, Calendar, Briefcase } from "lucide-react";

export default function Auth() {
  const [searchParams] = useSearchParams();
  const inviteCodeFromUrl = searchParams.get("invite");
  const redirectUrl = searchParams.get("redirect");

  const [isLogin, setIsLogin] = useState(true);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [inviteCode, setInviteCode] = useState(inviteCodeFromUrl || "");
  const [isLoading, setIsLoading] = useState(false);
  const [inviteValid, setInviteValid] = useState<boolean | null>(null);
  const [checkingInvite, setCheckingInvite] = useState(false);
  
  // OTP-based password reset state
  const [otpSent, setOtpSent] = useState(false);
  const [otp, setOtp] = useState("");
  const [otpVerified, setOtpVerified] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  
  // Signup OTP verification state
  const [signupStep, setSignupStep] = useState<'form' | 'otp' | 'onboarding' | 'leetcode'>('form');
  const [signupOtp, setSignupOtp] = useState("");
  
  // OTP resend cooldown state
  const [signupResendCooldown, setSignupResendCooldown] = useState(0);
  const [resetResendCooldown, setResetResendCooldown] = useState(0);
  
  // Onboarding state
  const [mobileNumber, setMobileNumber] = useState("");
  const [course, setCourse] = useState("");
  const [collegeName, setCollegeName] = useState("");
  const [passOutYear, setPassOutYear] = useState("");
  const [interestedRoles, setInterestedRoles] = useState("");
  const [domainCollegeName, setDomainCollegeName] = useState<string | null>(null);
  
  // LeetCode linking state
  const [leetcodeUsername, setLeetcodeUsername] = useState("");
  const [leetcodeToken, setLeetcodeToken] = useState("");
  const [leetcodeStep, setLeetcodeStep] = useState<'username' | 'verify'>('username');
  
  const navigate = useNavigate();
  const { toast } = useToast();
  const { signIn, signUp, user, loading } = useAuth();
  const { settings, isLoading: settingsLoading } = useAppSettings();
  const { isTeacher, isLoading: teacherLoading } = useTeacher();
  const { isClassroomStudent, isLoading: studentLoading } = useClassroomStudent();
  const { isAdmin, isLoading: adminLoading } = useAdmin();
  const { startVerification, completeVerification, loading: leetcodeLoading } = useLeetCode();

  const inviteSystemEnabled = settings.invite_system_enabled;

  // Cooldown timer effect for signup OTP
  useEffect(() => {
    if (signupResendCooldown > 0) {
      const timer = setTimeout(() => setSignupResendCooldown(signupResendCooldown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [signupResendCooldown]);

  // Cooldown timer effect for reset password OTP
  useEffect(() => {
    if (resetResendCooldown > 0) {
      const timer = setTimeout(() => setResetResendCooldown(resetResendCooldown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resetResendCooldown]);

  // Helper to get smart redirect path based on user role
  const getSmartRedirectPath = () => {
    if (redirectUrl) return redirectUrl;
    
    // Role-based redirect priority: admin > teacher > student > user
    if (isAdmin) return "/admin";
    if (isTeacher) return "/teacher";
    if (isClassroomStudent) return "/student";
    return "/dashboard";
  };

  // Check invite code validity (only if invite system is enabled)
  useEffect(() => {
    if (!inviteSystemEnabled) {
      setInviteValid(true); // Auto-valid if system is disabled
      return;
    }

    const checkInvite = async () => {
      if (!inviteCode || inviteCode.length < 8) {
        setInviteValid(null);
        return;
      }

      setCheckingInvite(true);
      const { data, error } = await supabase
        .from("invite_codes")
        .select("id, used_by, expires_at")
        .eq("code", inviteCode.toUpperCase())
        .maybeSingle();

      if (error || !data) {
        setInviteValid(false);
      } else if (data.used_by) {
        setInviteValid(false);
      } else if (new Date(data.expires_at) <= new Date()) {
        setInviteValid(false);
      } else {
        setInviteValid(true);
      }
      setCheckingInvite(false);
    };

    const debounce = setTimeout(checkInvite, 500);
    return () => clearTimeout(debounce);
  }, [inviteCode, inviteSystemEnabled]);

  // If we have an invite code in URL, show signup form
  useEffect(() => {
    if (inviteCodeFromUrl) {
      setIsLogin(false);
    }
  }, [inviteCodeFromUrl]);

  // Auto-fetch domain college for whitelisted users during onboarding
  useEffect(() => {
    const fetchDomainCollege = async () => {
      if (signupStep === 'onboarding' && email) {
        const emailDomain = email.split("@")[1];
        if (emailDomain) {
          const { data } = await supabase
            .from("email_domain_whitelist")
            .select("description")
            .eq("domain", emailDomain)
            .eq("is_active", true)
            .maybeSingle();

          if (data?.description) {
            setDomainCollegeName(data.description);
            setCollegeName(data.description);
          }
        }
      }
    };
    fetchDomainCollege();
  }, [signupStep, email]);

  // Redirect if already logged in (with role-based logic)
  // Skip redirect during signup onboarding or LeetCode linking step
  useEffect(() => {
    const allLoaded = !loading && !settingsLoading && !teacherLoading && !studentLoading && !adminLoading;
    const isInOnboardingOrLeetcodeStep = !isLogin && (signupStep === 'onboarding' || signupStep === 'leetcode');
    
    if (allLoaded && user && !isInOnboardingOrLeetcodeStep) {
      navigate(getSmartRedirectPath());
    }
  }, [user, loading, settingsLoading, teacherLoading, studentLoading, adminLoading, navigate, isTeacher, isClassroomStudent, isAdmin, redirectUrl, isLogin, signupStep]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const { error } = await signIn(email, password);
      if (error) {
        toast({
          variant: "destructive",
          title: "Sign in failed",
          description: error.message,
        });
      } else {
        toast({
          title: "Welcome back!",
          description: "You have successfully signed in.",
        });
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Step 1: Send signup OTP
  const handleSendSignupOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate invite code if system is enabled
    if (inviteSystemEnabled) {
      if (!inviteCode) {
        toast({
          variant: "destructive",
          title: "Invite code required",
          description: "You need an invite code to sign up. Ask a friend for one!",
        });
        return;
      }

      if (!inviteValid) {
        toast({
          variant: "destructive",
          title: "Invalid invite code",
          description: "This invite code is invalid, expired, or already used.",
        });
        return;
      }
    }

    if (!name.trim()) {
      toast({
        variant: "destructive",
        title: "Name required",
        description: "Please enter your full name.",
      });
      return;
    }

    if (password.length < 6) {
      toast({
        variant: "destructive",
        title: "Password too short",
        description: "Password must be at least 6 characters.",
      });
      return;
    }

    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("signup-otp", {
        body: { action: 'send-otp', email, name },
      });

      if (error) throw error;
      
      if (data.success) {
        setSignupStep('otp');
        setSignupResendCooldown(60); // Start 60 second cooldown
        toast({
          title: "Verification code sent",
          description: "Check your email for the 6-digit code.",
        });
      } else {
        toast({
          variant: "destructive",
          title: "Failed to send code",
          description: data.message || "Please try again.",
        });
      }
    } catch (error: any) {
      console.error("Send signup OTP error:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to send verification code.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Step 2: Verify OTP and complete signup
  const handleVerifySignupOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (signupOtp.length !== 6) {
      toast({
        variant: "destructive",
        title: "Invalid code",
        description: "Please enter a valid 6-digit code.",
      });
      return;
    }

    setIsLoading(true);
    try {
      // Verify OTP first
      const { data: verifyData, error: verifyError } = await supabase.functions.invoke("signup-otp", {
        body: { action: 'verify-otp', email, otp: signupOtp },
      });

      // Handle edge function errors - try to extract message from response
      if (verifyError) {
        let errorMessage = "Invalid code. Please try again.";
        try {
          // FunctionsHttpError contains the response context
          const errorContext = (verifyError as any).context;
          if (errorContext) {
            const errorBody = await errorContext.json();
            errorMessage = errorBody.message || errorMessage;
          }
        } catch {
          // If we can't parse the error, use default message
        }
        toast({
          variant: "destructive",
          title: "Verification failed",
          description: errorMessage,
        });
        setIsLoading(false);
        return;
      }
      
      if (!verifyData?.success) {
        toast({
          variant: "destructive",
          title: "Verification failed",
          description: verifyData?.message || "Invalid code. Please try again.",
        });
        setIsLoading(false);
        return;
      }

      // OTP verified, now create the account
      const { error: signUpError, data: signUpData } = await signUp(email, password, name);
      
      if (signUpError) {
        if (signUpError.message.includes("already registered")) {
          toast({
            variant: "destructive",
            title: "Account exists",
            description: "This email is already registered. Please sign in instead.",
          });
          setIsLogin(true);
          setSignupStep('form');
        } else {
          toast({
            variant: "destructive",
            title: "Sign up failed",
            description: signUpError.message,
          });
        }
        setIsLoading(false);
        return;
      }

      // Mark invite code as used (only if invite system enabled)
      if (signUpData?.user && inviteSystemEnabled && inviteCode) {
        await supabase
          .from("invite_codes")
          .update({
            used_by: signUpData.user.id,
            used_at: new Date().toISOString(),
          })
          .eq("code", inviteCode.toUpperCase());

        // Update profile with invite info
        await supabase
          .from("profiles")
          .update({
            invite_code_used: inviteCode.toUpperCase(),
          })
          .eq("user_id", signUpData.user.id);
      }

      // Move to onboarding step (collect user details)
      setSignupStep('onboarding');
      toast({
        title: "Email verified!",
        description: "Now let's get to know you better.",
      });
      
    } catch (error: any) {
      console.error("Signup error:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to create account.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      toast({
        variant: "destructive",
        title: "Email required",
        description: "Please enter your email address.",
      });
      return;
    }

    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("forgot-password", {
        body: { action: 'send-otp', email },
      });

      if (error) throw error;
      
      setOtpSent(true);
      setResetResendCooldown(60); // Start 60 second cooldown
      toast({
        title: "OTP Sent",
        description: "Check your email for the verification code.",
      });
    } catch (error: any) {
      console.error("Send OTP error:", error);
      toast({
        title: "OTP Sent",
        description: "If an account exists with this email, you'll receive an OTP.",
      });
      setOtpSent(true);
      setResetResendCooldown(60); // Start cooldown even on error for security
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otp || otp.length !== 6) {
      toast({
        variant: "destructive",
        title: "Invalid OTP",
        description: "Please enter a valid 6-digit OTP.",
      });
      return;
    }

    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("forgot-password", {
        body: { action: 'verify-otp', email, otp },
      });

      if (error) throw error;
      
      if (data.success) {
        setOtpVerified(true);
        toast({
          title: "OTP Verified",
          description: "Now set your new password.",
        });
      } else {
        toast({
          variant: "destructive",
          title: "Verification Failed",
          description: data.message || "Invalid OTP. Please try again.",
        });
      }
    } catch (error: any) {
      console.error("Verify OTP error:", error);
      toast({
        variant: "destructive",
        title: "Verification Failed",
        description: "Invalid or expired OTP. Please try again.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      toast({
        variant: "destructive",
        title: "Passwords don't match",
        description: "Please make sure your passwords match.",
      });
      return;
    }

    if (newPassword.length < 6) {
      toast({
        variant: "destructive",
        title: "Password too short",
        description: "Password must be at least 6 characters.",
      });
      return;
    }

    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("forgot-password", {
        body: { action: 'reset-password', email, otp, newPassword },
      });

      if (error) throw error;
      
      if (data.success) {
        toast({
          title: "Password Reset!",
          description: "Your password has been updated. Please sign in.",
        });
        setShowForgotPassword(false);
        setOtpSent(false);
        setOtpVerified(false);
        setOtp("");
        setNewPassword("");
        setConfirmPassword("");
        setIsLogin(true);
      } else {
        toast({
          variant: "destructive",
          title: "Reset Failed",
          description: data.message || "Failed to reset password.",
        });
      }
    } catch (error: any) {
      console.error("Reset password error:", error);
      toast({
        variant: "destructive",
        title: "Reset Failed",
        description: "Failed to reset password. Please try again.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Forgot Password Form with OTP
  if (showForgotPassword) {
    return (
      <div className="min-h-screen bg-background flex">
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="w-full max-w-md">
            <Link to="/" className="flex items-center gap-2 mb-8">
              <img src={codeiqLogo} alt="CodeIQ" className="h-10" />
            </Link>

            <button
              onClick={() => {
                setShowForgotPassword(false);
                setOtpSent(false);
                setOtpVerified(false);
                setOtp("");
                setNewPassword("");
                setConfirmPassword("");
              }}
              className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6 transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Sign In
            </button>

            <div className="mb-8">
              <h1 className="text-3xl font-bold text-foreground mb-2">
                {otpVerified ? "Set New Password" : otpSent ? "Enter OTP" : "Reset your password"}
              </h1>
              <p className="text-muted-foreground">
                {otpVerified 
                  ? "Create a new password for your account." 
                  : otpSent 
                    ? "Enter the 6-digit code sent to your email." 
                    : "Enter your email to receive a verification code."}
              </p>
            </div>

            {/* Step 1: Enter Email */}
            {!otpSent && !otpVerified && (
              <form onSubmit={handleSendOtp} className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">Email</label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <input
                      type="email"
                      placeholder="you@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full pl-10 pr-4 py-3 rounded-lg bg-muted border border-border text-foreground placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                      required
                    />
                  </div>
                </div>

                <Button type="submit" size="lg" className="w-full gap-2" disabled={isLoading}>
                  {isLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      Send OTP
                      <ArrowRight className="h-4 w-4" />
                    </>
                  )}
                </Button>
              </form>
            )}

            {/* Step 2: Enter OTP */}
            {otpSent && !otpVerified && (
              <form onSubmit={handleVerifyOtp} className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">Enter OTP</label>
                  <input
                    type="text"
                    placeholder="000000"
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    className="w-full px-4 py-3 rounded-lg bg-muted border border-border text-foreground placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-center text-2xl font-mono tracking-widest"
                    maxLength={6}
                    required
                  />
                  <p className="text-sm text-muted-foreground text-center">
                    Didn't receive the code?{" "}
                    {resetResendCooldown > 0 ? (
                      <span className="text-muted-foreground">
                        Resend in {resetResendCooldown}s
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={handleSendOtp}
                        className="text-primary hover:underline"
                        disabled={isLoading}
                      >
                        Resend
                      </button>
                    )}
                  </p>
                </div>

                <Button type="submit" size="lg" className="w-full gap-2" disabled={isLoading || otp.length !== 6}>
                  {isLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      Verify OTP
                      <ArrowRight className="h-4 w-4" />
                    </>
                  )}
                </Button>
              </form>
            )}

            {/* Step 3: Set New Password */}
            {otpVerified && (
              <form onSubmit={handleResetPassword} className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">New Password</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <input
                      type={showNewPassword ? "text" : "password"}
                      placeholder="••••••••"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="w-full pl-10 pr-12 py-3 rounded-lg bg-muted border border-border text-foreground placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                      required
                      minLength={6}
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">Confirm Password</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <input
                      type={showNewPassword ? "text" : "password"}
                      placeholder="••••••••"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="w-full pl-10 pr-4 py-3 rounded-lg bg-muted border border-border text-foreground placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                      required
                      minLength={6}
                    />
                  </div>
                </div>

                <Button type="submit" size="lg" className="w-full gap-2" disabled={isLoading}>
                  {isLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      Reset Password
                      <ArrowRight className="h-4 w-4" />
                    </>
                  )}
                </Button>
              </form>
            )}
          </div>
        </div>

        {/* Right Panel */}
        <div className="hidden lg:flex flex-1 bg-gradient-to-br from-primary to-warning p-12 items-center justify-center">
          <div className="max-w-md text-primary-foreground text-center">
            <img src={codeiqOwl} alt="CodeIQ Owl" className="h-40 w-40 mx-auto mb-8" />
            <h2 className="text-3xl font-bold mb-4">Reset Your Password</h2>
            <p className="text-primary-foreground/80">
              Enter your email to receive a one-time password for resetting your account credentials securely.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Main Auth Form
  return (
    <div className="min-h-screen bg-background flex">
      {/* Left Panel - Form */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-md">
          <Link to="/" className="flex items-center gap-2 mb-8">
            <img src={codeiqLogo} alt="CodeIQ" className="h-10" />
          </Link>

          <div className="mb-8">
            <h1 className="text-3xl font-bold text-foreground mb-2">
              {isLogin 
                ? "Welcome back" 
                : signupStep === 'otp' 
                  ? "Verify your email" 
                  : signupStep === 'onboarding'
                    ? "Tell us about yourself"
                    : signupStep === 'leetcode'
                      ? "Connect LeetCode"
                      : "Create an account"
              }
            </h1>
            <p className="text-muted-foreground">
              {isLogin 
                ? "Sign in to continue your coding journey" 
                : signupStep === 'otp' 
                  ? "Enter the 6-digit code sent to your email"
                  : signupStep === 'onboarding'
                    ? "Help us personalize your experience"
                    : signupStep === 'leetcode'
                      ? "Link your LeetCode account to verify your solutions"
                      : "Start your journey to mastering DSA"
              }
            </p>
          </div>

          {/* Login Form */}
          {isLogin && (
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Email</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <input
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 rounded-lg bg-muted border border-border text-foreground placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Password</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <input
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-10 pr-12 py-3 rounded-lg bg-muted border border-border text-foreground placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                    required
                    minLength={6}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-end">
                <button
                  type="button"
                  onClick={() => setShowForgotPassword(true)}
                  className="text-sm text-primary hover:text-primary/80 transition-colors"
                >
                  Forgot password?
                </button>
              </div>

              <Button type="submit" size="lg" className="w-full gap-2" disabled={isLoading}>
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    Sign In
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </Button>
            </form>
          )}

          {/* Signup Form - Step 1 */}
          {!isLogin && signupStep === 'form' && (
            <form onSubmit={handleSendSignupOtp} className="space-y-4">
              {/* Invite Code Field - only show if invite system is enabled */}
              {inviteSystemEnabled && (
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">Invite Code</label>
                  <div className="relative">
                    <Ticket className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <input
                      type="text"
                      placeholder="ABCD1234"
                      value={inviteCode}
                      onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                      className={`w-full pl-10 pr-10 py-3 rounded-lg bg-muted border text-foreground placeholder:text-muted-foreground outline-none focus:ring-2 transition-all font-mono uppercase ${
                        inviteValid === true
                          ? "border-success focus:ring-success/20"
                          : inviteValid === false
                          ? "border-destructive focus:ring-destructive/20"
                          : "border-border focus:ring-primary/20 focus:border-primary"
                      }`}
                      required
                      maxLength={8}
                    />
                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                      {checkingInvite ? (
                        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                      ) : inviteValid === true ? (
                        <CheckCircle2 className="h-4 w-4 text-success" />
                      ) : inviteValid === false ? (
                        <AlertCircle className="h-4 w-4 text-destructive" />
                      ) : null}
                    </div>
                  </div>
                  {inviteValid === false && (
                    <p className="text-xs text-destructive">
                      Invalid, expired, or already used invite code
                    </p>
                  )}
                </div>
              )}

              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Full Name</label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <input
                    type="text"
                    placeholder="John Doe"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 rounded-lg bg-muted border border-border text-foreground placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Email</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <input
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 rounded-lg bg-muted border border-border text-foreground placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Password</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <input
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-10 pr-12 py-3 rounded-lg bg-muted border border-border text-foreground placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                    required
                    minLength={6}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <Button 
                type="submit" 
                size="lg" 
                className="w-full gap-2" 
                disabled={isLoading || (inviteSystemEnabled && !inviteValid)}
              >
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    Continue
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </Button>
            </form>
          )}

          {/* Signup Form - Step 2: OTP Verification */}
          {!isLogin && signupStep === 'otp' && (
            <form onSubmit={handleVerifySignupOtp} className="space-y-4">
              <div className="p-4 rounded-lg bg-muted/50 border border-border mb-4">
                <p className="text-sm text-muted-foreground">
                  We've sent a verification code to <span className="font-medium text-foreground">{email}</span>
                </p>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Verification Code</label>
                <input
                  type="text"
                  placeholder="000000"
                  value={signupOtp}
                  onChange={(e) => setSignupOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  className="w-full px-4 py-3 rounded-lg bg-muted border border-border text-foreground placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-center text-2xl font-mono tracking-widest"
                  maxLength={6}
                  required
                  autoFocus
                />
              </div>

              <div className="flex items-center justify-between text-sm">
                <button
                  type="button"
                  onClick={() => setSignupStep('form')}
                  className="text-muted-foreground hover:text-foreground transition-colors"
                >
                  ← Change email
                </button>
                {signupResendCooldown > 0 ? (
                  <span className="text-muted-foreground">
                    Resend in {signupResendCooldown}s
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={handleSendSignupOtp}
                    className="text-primary hover:text-primary/80 transition-colors"
                    disabled={isLoading}
                  >
                    Resend code
                  </button>
                )}
              </div>

              <Button 
                type="submit" 
                size="lg" 
                className="w-full gap-2" 
                disabled={isLoading || signupOtp.length !== 6}
              >
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    Verify & Continue
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </Button>
            </form>
          )}

          {/* Signup Form - Step 3: Onboarding */}
          {!isLogin && signupStep === 'onboarding' && (
            <div className="space-y-4">
              {/* Progress indicator */}
              <div className="flex items-center gap-2 mb-6">
                <div className="flex items-center gap-1">
                  <div className="w-6 h-6 rounded-full bg-success flex items-center justify-center">
                    <CheckCircle2 className="h-4 w-4 text-success-foreground" />
                  </div>
                  <span className="text-xs text-muted-foreground">Account</span>
                </div>
                <div className="flex-1 h-0.5 bg-success" />
                <div className="flex items-center gap-1">
                  <div className="w-6 h-6 rounded-full bg-success flex items-center justify-center">
                    <CheckCircle2 className="h-4 w-4 text-success-foreground" />
                  </div>
                  <span className="text-xs text-muted-foreground">Email</span>
                </div>
                <div className="flex-1 h-0.5 bg-primary" />
                <div className="flex items-center gap-1">
                  <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center">
                    <User className="h-4 w-4 text-primary-foreground" />
                  </div>
                  <span className="text-xs text-foreground font-medium">Details</span>
                </div>
                <div className="flex-1 h-0.5 bg-muted" />
                <div className="flex items-center gap-1">
                  <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center">
                    <Link2 className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <span className="text-xs text-muted-foreground">LeetCode</span>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Mobile Number</label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <input
                    type="tel"
                    placeholder="9876543210"
                    value={mobileNumber}
                    onChange={(e) => setMobileNumber(e.target.value.replace(/\D/g, '').slice(0, 10))}
                    className="w-full pl-10 pr-4 py-3 rounded-lg bg-muted border border-border text-foreground placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Course</label>
                <div className="relative">
                  <GraduationCap className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <select
                    value={course}
                    onChange={(e) => setCourse(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 rounded-lg bg-muted border border-border text-foreground outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all appearance-none cursor-pointer"
                    required
                  >
                    <option value="">Select your course</option>
                    <option value="BCA">BCA</option>
                    <option value="MCA">MCA</option>
                    <option value="BTech">BTech</option>
                    <option value="MTech">MTech</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">
                  College Name
                  {domainCollegeName && (
                    <span className="ml-2 text-xs text-success">(Auto-filled from your domain)</span>
                  )}
                </label>
                <div className="relative">
                  <GraduationCap className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <input
                    type="text"
                    placeholder="Enter your college name"
                    value={collegeName}
                    onChange={(e) => !domainCollegeName && setCollegeName(e.target.value)}
                    readOnly={!!domainCollegeName}
                    className={`w-full pl-10 pr-4 py-3 rounded-lg bg-muted border border-border text-foreground placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all ${domainCollegeName ? 'cursor-not-allowed opacity-75' : ''}`}
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Pass Out Year</label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <select
                    value={passOutYear}
                    onChange={(e) => setPassOutYear(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 rounded-lg bg-muted border border-border text-foreground outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all appearance-none cursor-pointer"
                    required
                  >
                    <option value="">Select pass out year</option>
                    {Array.from({ length: 10 }, (_, i) => new Date().getFullYear() + 5 - i).map(year => (
                      <option key={year} value={year}>{year}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Interested For</label>
                <div className="relative">
                  <Briefcase className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <select
                    value={interestedRoles}
                    onChange={(e) => setInterestedRoles(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 rounded-lg bg-muted border border-border text-foreground outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all appearance-none cursor-pointer"
                    required
                  >
                    <option value="">Select your interest</option>
                    <option value="Internship">Internship</option>
                    <option value="Full Time">Full Time</option>
                    <option value="Both">Both</option>
                  </select>
                </div>
              </div>

              <Button 
                size="lg" 
                className="w-full gap-2" 
                disabled={isLoading || !mobileNumber || !course || !collegeName || !passOutYear || !interestedRoles}
                onClick={async () => {
                  setIsLoading(true);
                  try {
                    // Update profile with onboarding data
                    const { error } = await supabase
                      .from("profiles")
                      .update({
                        mobile_number: mobileNumber,
                        course: course,
                        college: collegeName,
                        pass_out_year: parseInt(passOutYear),
                        interested_roles: interestedRoles,
                        onboarding_completed: true,
                      })
                      .eq("user_id", user?.id);

                    if (error) throw error;

                    setSignupStep('leetcode');
                    toast({
                      title: "Details saved!",
                      description: "Now let's connect your LeetCode account.",
                    });
                  } catch (error: any) {
                    console.error("Onboarding error:", error);
                    toast({
                      variant: "destructive",
                      title: "Error",
                      description: error.message || "Failed to save details.",
                    });
                  } finally {
                    setIsLoading(false);
                  }
                }}
              >
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    Continue
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </Button>
            </div>
          )}

          {/* Signup Form - Step 4: LeetCode Linking */}
          {!isLogin && signupStep === 'leetcode' && (
            <div className="space-y-4">
              {/* Progress indicator */}
              <div className="flex items-center gap-2 mb-6">
                <div className="flex items-center gap-1">
                  <div className="w-6 h-6 rounded-full bg-success flex items-center justify-center">
                    <CheckCircle2 className="h-4 w-4 text-success-foreground" />
                  </div>
                  <span className="text-xs text-muted-foreground">Account</span>
                </div>
                <div className="flex-1 h-0.5 bg-success" />
                <div className="flex items-center gap-1">
                  <div className="w-6 h-6 rounded-full bg-success flex items-center justify-center">
                    <CheckCircle2 className="h-4 w-4 text-success-foreground" />
                  </div>
                  <span className="text-xs text-muted-foreground">Email</span>
                </div>
                <div className="flex-1 h-0.5 bg-success" />
                <div className="flex items-center gap-1">
                  <div className="w-6 h-6 rounded-full bg-success flex items-center justify-center">
                    <CheckCircle2 className="h-4 w-4 text-success-foreground" />
                  </div>
                  <span className="text-xs text-muted-foreground">Details</span>
                </div>
                <div className="flex-1 h-0.5 bg-primary" />
                <div className="flex items-center gap-1">
                  <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center">
                    <Link2 className="h-4 w-4 text-primary-foreground" />
                  </div>
                  <span className="text-xs text-foreground font-medium">LeetCode</span>
                </div>
              </div>

              {leetcodeStep === 'username' && (
                <>
                  <div className="p-4 rounded-lg bg-primary/10 border border-primary/20 mb-4">
                    <p className="text-sm text-foreground">
                      <strong>Why connect LeetCode?</strong> We verify your solutions directly from LeetCode to ensure authentic progress tracking.
                    </p>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground">LeetCode Username</label>
                    <div className="relative">
                      <Link2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <input
                        type="text"
                        placeholder="your_leetcode_username"
                        value={leetcodeUsername}
                        onChange={(e) => setLeetcodeUsername(e.target.value)}
                        className="w-full pl-10 pr-4 py-3 rounded-lg bg-muted border border-border text-foreground placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                      />
                    </div>
                  </div>

                  <Button 
                    size="lg" 
                    className="w-full gap-2" 
                    disabled={leetcodeLoading || !leetcodeUsername.trim()}
                    onClick={async () => {
                      const result = await startVerification(leetcodeUsername.trim());
                      if (result.success && result.token) {
                        setLeetcodeToken(result.token);
                        setLeetcodeStep('verify');
                      } else {
                        toast({
                          variant: "destructive",
                          title: "Verification failed",
                          description: result.message || "Could not start verification. Please check your username.",
                        });
                      }
                    }}
                  >
                    {leetcodeLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <>
                        Continue
                        <ArrowRight className="h-4 w-4" />
                      </>
                    )}
                  </Button>
                </>
              )}

              {leetcodeStep === 'verify' && (
                <>
                  <div className="bg-muted rounded-lg p-4">
                    <p className="text-sm text-muted-foreground mb-2">Add this code to your LeetCode profile name:</p>
                    <div className="flex items-center gap-2">
                      <code className="flex-1 bg-background rounded px-3 py-2 font-mono text-lg text-primary">
                        {leetcodeToken}
                      </code>
                      <Button 
                        variant="outline" 
                        size="icon" 
                        onClick={() => {
                          navigator.clipboard.writeText(leetcodeToken);
                          toast({ title: "Copied!", description: "Token copied to clipboard" });
                        }}
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  
                  <div className="text-sm text-muted-foreground space-y-2 p-4 bg-muted/50 rounded-lg">
                    <p className="font-medium text-foreground">Steps:</p>
                    <p>1. Go to your LeetCode profile settings</p>
                    <p>2. Add <strong className="text-primary">{leetcodeToken}</strong> anywhere in your display name</p>
                    <p>3. Save and click "Verify" below</p>
                  </div>

                  <div className="flex gap-2">
                    <Button 
                      variant="outline" 
                      className="flex-1 gap-2"
                      onClick={() => window.open(`https://leetcode.com/profile/`, "_blank")}
                    >
                      <ExternalLink className="h-4 w-4" />
                      Open LeetCode
                    </Button>
                    <Button 
                      className="flex-1 gap-2"
                      onClick={async () => {
                        const result = await completeVerification(leetcodeToken);
                        if (result.verified) {
                          // Send welcome email after successful LeetCode verification
                          try {
                            await supabase.functions.invoke("welcome-email", {
                              body: { 
                                email, 
                                name, 
                                type: 'normal',
                                leetcodeUsername: leetcodeUsername.trim()
                              },
                            });
                          } catch (emailError) {
                            console.error("Failed to send welcome email:", emailError);
                            // Don't block signup if email fails
                          }
                          
                          toast({
                            title: "LeetCode connected!",
                            description: "Welcome to CodeIQ. Your journey begins now!",
                          });
                          navigate(getSmartRedirectPath());
                        } else {
                          toast({
                            variant: "destructive",
                            title: "Not verified",
                            description: result.message || "Token not found in your profile. Please try again.",
                          });
                        }
                      }}
                      disabled={leetcodeLoading}
                    >
                      {leetcodeLoading ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <>
                          Verify
                          <CheckCircle2 className="h-4 w-4" />
                        </>
                      )}
                    </Button>
                  </div>

                  <button
                    type="button"
                    onClick={() => setLeetcodeStep('username')}
                    className="text-sm text-muted-foreground hover:text-foreground transition-colors text-center w-full"
                  >
                    ← Change username
                  </button>
                </>
              )}
            </div>
          )}

          {/* Toggle - hide during leetcode step */}
          {signupStep !== 'leetcode' && (
            <p className="mt-6 text-center text-sm text-muted-foreground">
              {isLogin ? "Don't have an account?" : "Already have an account?"}{" "}
              <button
                type="button"
                onClick={() => {
                  setIsLogin(!isLogin);
                  setSignupStep('form');
                  setSignupOtp("");
                  setLeetcodeUsername("");
                  setLeetcodeToken("");
                  setLeetcodeStep('username');
                }}
                className="font-medium text-primary hover:text-primary/80 transition-colors"
              >
                {isLogin ? "Sign up" : "Sign in"}
              </button>
            </p>
          )}
        </div>
      </div>

      {/* Right Panel - Features */}
      <div className="hidden lg:flex flex-1 bg-gradient-to-br from-primary to-warning p-12 items-center justify-center">
        <div className="max-w-md text-primary-foreground">
          <div className="flex justify-center mb-8">
            <img src={codeiqOwl} alt="CodeIQ Owl" className="h-40 w-40" />
          </div>
          <Badge variant="hero" className="mb-6">
            {isLogin ? "Welcome Back" : "Get Started"}
          </Badge>
          <h2 className="text-3xl font-bold mb-6">
            {isLogin 
              ? "Continue your journey to mastering DSA"
              : "Join our community of developers"
            }
          </h2>
          <div className="space-y-4">
            {[
              "LeetCode-verified problem solving",
              "Topic-wise & Company-wise practice",
              "Spaced repetition for better retention",
              "Detailed progress analytics",
              "Shareable public profile",
            ].map((feature) => (
              <div key={feature} className="flex items-center gap-3">
                <CheckCircle2 className="h-5 w-5 shrink-0" />
                <span>{feature}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
