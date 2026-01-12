import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useAppSettings } from "@/hooks/useAppSettings";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { load } from "@cashfreepayments/cashfree-js";
import {
  Crown,
  Check,
  Zap,
  Star,
  Sparkles,
  Loader2,
  ArrowLeft,
  ShieldCheck,
  Tag,
  Clock,
  XCircle,
  AlertTriangle,
  CreditCard,
} from "lucide-react";
import confetti from "canvas-confetti";

interface Plan {
  id: string;
  name: string;
  price: number;
  duration: string;
  durationLabel: string;
  features: string[];
  popular?: boolean;
  icon: React.ReactNode;
  featureLevel: "basic" | "pro";
  isCombo?: boolean;
}

const PLANS: Plan[] = [
  {
    id: "basic",
    name: "Basic",
    price: 99,
    duration: "1 month",
    durationLabel: "/month",
    icon: <Zap className="h-6 w-6" />,
    featureLevel: "basic",
    features: [
      "Topic-wise problems",
      "LeetCode verification",
      "Progress tracking",
      "Basic achievements",
    ],
  },
  {
    id: "pro",
    name: "Pro",
    price: 499,
    duration: "3 months",
    durationLabel: "/3 months",
    popular: true,
    icon: <Crown className="h-6 w-6" />,
    featureLevel: "pro",
    features: [
      "All Basic features",
      "Company-wise problems",
      "Notes & AI Solver",
      "Spaced Revision system",
      "Priority support",
    ],
  },
  {
    id: "pro_plus",
    name: "Pro+",
    price: 899,
    duration: "6 months",
    durationLabel: "/6 months",
    icon: <Star className="h-6 w-6" />,
    featureLevel: "pro",
    features: [
      "All Pro features",
      "6 months access",
      "Best value",
      "Early feature access",
    ],
  },
  {
    id: "lifetime",
    name: "Lifetime",
    price: 1499,
    duration: "forever",
    durationLabel: "",
    icon: <Sparkles className="h-6 w-6" />,
    featureLevel: "pro",
    features: [
      "All Pro features",
      "Lifetime access",
      "Never pay again",
      "All future updates",
    ],
  },
];

interface DeclinedPayment {
  id: string;
  amount: number;
  plan: string;
  declined_at: string;
  created_at: string;
}

export default function Pricing() {
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const { settings, isLoading: settingsLoading } = useAppSettings();
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
  const [discountCode, setDiscountCode] = useState("");
  const [appliedDiscount, setAppliedDiscount] = useState<{ code: string; percent: number; code_id: string | null; isDomainDiscount?: boolean } | null>(null);
  const [validatingCode, setValidatingCode] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [pendingPayment, setPendingPayment] = useState<any>(null);
  const [declinedPayment, setDeclinedPayment] = useState<DeclinedPayment | null>(null);
  const [checkingStatus, setCheckingStatus] = useState(true);
  const [domainDiscount, setDomainDiscount] = useState<{ percent: number; domain: string } | null>(null);
  

  // Redirect if paid features are disabled
  useEffect(() => {
    if (!settingsLoading && !settings.paid_features_enabled) {
      navigate("/dashboard");
    }
  }, [settings.paid_features_enabled, settingsLoading, navigate]);

  // Check for pending or declined payments and domain discount
  useEffect(() => {
    const checkPaymentStatus = async () => {
      if (!user) {
        setCheckingStatus(false);
        return;
      }

      try {
        // Check for pending payment
        const { data: pending } = await supabase
          .from("payments")
          .select("*")
          .eq("user_id", user.id)
          .eq("status", "pending")
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (pending) {
          setPendingPayment(pending);
        }

        // Check for declined payment
        const { data: declined } = await supabase
          .from("payments")
          .select("*")
          .eq("user_id", user.id)
          .eq("status", "declined")
          .order("declined_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (declined) {
          setDeclinedPayment(declined);
        }

        // Check for domain-based discount
        const emailDomain = user.email?.split("@")[1];
        if (emailDomain) {
          const { data: domainData } = await supabase
            .from("email_domain_whitelist")
            .select("discount_percent, domain")
            .eq("domain", emailDomain)
            .eq("is_active", true)
            .maybeSingle();

          if (domainData && domainData.discount_percent && domainData.discount_percent > 0) {
            setDomainDiscount({ percent: domainData.discount_percent, domain: domainData.domain });
            // Auto-apply domain discount
            setAppliedDiscount({
              code: `@${domainData.domain}`,
              percent: domainData.discount_percent,
              code_id: null,
              isDomainDiscount: true,
            });
          }
        }
      } catch (error) {
        console.error("Error checking payment status:", error);
      } finally {
        setCheckingStatus(false);
      }
    };

    checkPaymentStatus();
  }, [user]);

  const handleApplyDiscount = async () => {
    if (!discountCode.trim() || !selectedPlan) {
      toast.error("Please select a plan and enter a discount code");
      return;
    }

    setValidatingCode(true);
    try {
      const { data, error } = await supabase
        .from("discount_codes")
        .select("*")
        .eq("code", discountCode.toUpperCase().trim())
        .eq("is_active", true)
        .maybeSingle();

      if (error) throw error;

      if (!data) {
        toast.error("Invalid discount code");
        return;
      }

      if (data.valid_until && new Date(data.valid_until) < new Date()) {
        toast.error("This discount code has expired");
        return;
      }

      if (data.max_uses && data.used_count >= data.max_uses) {
        toast.error("This discount code has reached its usage limit");
        return;
      }

      if (data.applies_to && data.applies_to !== "all" && data.applies_to !== selectedPlan) {
        toast.error("This discount code is not valid for this plan");
        return;
      }

      setAppliedDiscount({ 
        code: data.code, 
        percent: data.discount_percent,
        code_id: data.id 
      });
      toast.success(`Discount applied: ${data.discount_percent}% off!`);
    } catch (error: any) {
      console.error("Error validating discount:", error);
      toast.error("Failed to validate discount code");
    } finally {
      setValidatingCode(false);
    }
  };

  const getDiscountedPrice = (originalPrice: number) => {
    if (!appliedDiscount) return originalPrice;
    return Math.round(originalPrice - (originalPrice * appliedDiscount.percent) / 100);
  };

  const handlePayment = async () => {
    if (!user) {
      toast.error("Please sign in to continue");
      navigate("/auth");
      return;
    }

    if (!selectedPlan) {
      toast.error("Please select a plan");
      return;
    }

    setProcessing(true);

    try {
      // Get selected plan data
      const regularPlan = PLANS.find(p => p.id === selectedPlan);
      
      const planPrice = regularPlan?.price ?? 0;
      const planName = regularPlan?.id ?? selectedPlan;
      const finalAmount = getDiscountedPrice(planPrice);

      // Handle 100% discount or free plan - no payment needed
      if (finalAmount === 0) {
        const { data, error } = await supabase.functions.invoke("cashfree-payment", {
          body: {
            action: "free-activation",
            userId: user.id,
            plan: selectedPlan,
            planName: planName,
            discountCodeId: appliedDiscount?.code_id,
            discountAmount: planPrice,
          },
        });

        if (error || !data?.success) {
          throw new Error(data?.error || error?.message || "Failed to activate subscription");
        }

        // Increment discount code usage
        if (appliedDiscount?.code_id) {
          await supabase.rpc("increment_discount_usage", { code_id: appliedDiscount.code_id });
        }

        // Celebrate with confetti!
        const duration = 3000;
        const end = Date.now() + duration;
        
        const frame = () => {
          confetti({
            particleCount: 3,
            angle: 60,
            spread: 55,
            origin: { x: 0 },
            colors: ['#10b981', '#3b82f6', '#8b5cf6', '#f59e0b', '#ec4899'],
          });
          confetti({
            particleCount: 3,
            angle: 120,
            spread: 55,
            origin: { x: 1 },
            colors: ['#10b981', '#3b82f6', '#8b5cf6', '#f59e0b', '#ec4899'],
          });
          
          if (Date.now() < end) {
            requestAnimationFrame(frame);
          }
        };
        frame();

        toast.success("🎉 Subscription activated for FREE!");
        setTimeout(() => navigate("/dashboard"), 2000);
        return;
      }

      // Create order via edge function for paid orders
      const { data, error } = await supabase.functions.invoke("cashfree-payment", {
        body: {
          action: "create-order",
          userId: user.id,
          plan: selectedPlan,
          planName: planName,
          amount: finalAmount,
          discountCodeId: appliedDiscount?.code_id,
          discountAmount: appliedDiscount ? planPrice - finalAmount : 0,
          customerName: profile?.full_name || user.email?.split("@")[0] || "Customer",
          customerEmail: profile?.email || user.email || "",
          customerPhone: profile?.mobile_number && profile.mobile_number.length >= 10 ? profile.mobile_number : undefined,
        },
      });

      if (error || !data?.success) {
        throw new Error(data?.error || error?.message || "Failed to create order");
      }

      // Increment discount code usage if applied
      if (appliedDiscount?.code_id) {
        await supabase.rpc("increment_discount_usage", { code_id: appliedDiscount.code_id });
      }

      // Initialize Cashfree
      const cashfree = await load({ mode: "production" }); // Use "sandbox" for testing

      // Open Cashfree checkout
      const checkoutOptions = {
        paymentSessionId: data.paymentSessionId,
        redirectTarget: "_self",
      };

      await cashfree.checkout(checkoutOptions);
    } catch (error: any) {
      console.error("Payment error:", error);
      toast.error(error.message || "Failed to initiate payment");
    } finally {
      setProcessing(false);
    }
  };

  // Helper to get selected plan data
  const getSelectedPlanData = (): { name: string; price: number; durationLabel: string; features: string[] } | null => {
    if (!selectedPlan) return null;
    
    const regularPlan = PLANS.find(p => p.id === selectedPlan);
    if (regularPlan) {
      return {
        name: regularPlan.name,
        price: regularPlan.price,
        durationLabel: regularPlan.durationLabel,
        features: regularPlan.features,
      };
    }
    
    return null;
  };

  const selectedPlanData = getSelectedPlanData();
  const currentPlan = profile?.subscription_plan || "free";
  const finalPrice = selectedPlanData ? getDiscountedPrice(selectedPlanData.price) : 0;

  if (checkingStatus) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Show pending payment status
  if (pendingPayment && !declinedPayment) {
    const planData = PLANS.find(p => p.id === pendingPayment.plan);
    return (
      <div className="min-h-screen bg-background">
        <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-50">
          <div className="container mx-auto px-4 py-4 flex items-center justify-between">
            <Link to="/dashboard" className="flex items-center gap-2 text-foreground hover:text-primary transition-colors">
              <ArrowLeft className="h-5 w-5" />
              <span className="font-medium">Dashboard</span>
            </Link>
            <h1 className="text-xl font-bold text-foreground">Payment Status</h1>
            <div className="w-20" />
          </div>
        </header>

        <main className="container mx-auto px-4 py-12 max-w-lg">
          <Card>
            <CardHeader className="text-center">
              <div className="mx-auto p-4 rounded-full bg-warning/10 mb-4">
                <Clock className="h-12 w-12 text-warning" />
              </div>
              <CardTitle>Payment Processing</CardTitle>
              <CardDescription>
                We're processing your payment. This should complete shortly.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="p-4 rounded-lg bg-muted/50 border">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-muted-foreground">Plan</span>
                  <span className="font-medium">{planData?.name || pendingPayment.plan}</span>
                </div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-muted-foreground">Amount</span>
                  <span className="font-medium">₹{pendingPayment.amount}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Submitted</span>
                  <span className="text-sm">{new Date(pendingPayment.created_at).toLocaleString()}</span>
                </div>
              </div>

              <Button className="w-full" onClick={() => navigate("/dashboard")}>
                Continue to Dashboard
              </Button>
            </CardContent>
          </Card>
        </main>
      </div>
    );
  }

  // Show declined payment message
  if (declinedPayment) {
    const planData = PLANS.find(p => p.id === declinedPayment.plan);
    return (
      <div className="min-h-screen bg-background">
        <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-50">
          <div className="container mx-auto px-4 py-4 flex items-center justify-between">
            <Link to="/dashboard" className="flex items-center gap-2 text-foreground hover:text-primary transition-colors">
              <ArrowLeft className="h-5 w-5" />
              <span className="font-medium">Dashboard</span>
            </Link>
            <h1 className="text-xl font-bold text-foreground">Payment Failed</h1>
            <div className="w-20" />
          </div>
        </header>

        <main className="container mx-auto px-4 py-12 max-w-lg">
          <Card>
            <CardHeader className="text-center">
              <div className="mx-auto p-4 rounded-full bg-destructive/10 mb-4">
                <XCircle className="h-12 w-12 text-destructive" />
              </div>
              <CardTitle>Payment Failed</CardTitle>
              <CardDescription>
                Your payment could not be processed. Please try again.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="p-4 rounded-lg bg-destructive/5 border border-destructive/20">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="h-5 w-5 text-destructive mt-0.5" />
                  <div>
                    <p className="font-medium text-destructive">Payment Failed</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      Payment of <strong>₹{declinedPayment.amount}</strong> for {planData?.name || declinedPayment.plan} plan was declined.
                    </p>
                  </div>
                </div>
              </div>

              <Button 
                className="w-full" 
                onClick={() => {
                  setDeclinedPayment(null);
                }}
              >
                <Crown className="h-4 w-4 mr-2" />
                Try Again
              </Button>

              <p className="text-xs text-center text-muted-foreground">
                If you believe this is an error, please contact support@codeiq.app
              </p>
            </CardContent>
          </Card>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Link to="/dashboard" className="flex items-center gap-2 text-foreground hover:text-primary transition-colors">
            <ArrowLeft className="h-5 w-5" />
            <span className="font-medium">Dashboard</span>
          </Link>
          <h1 className="text-xl font-bold text-foreground">Choose Your Plan</h1>
          <div className="w-20" />
        </div>
      </header>

      <main className="container mx-auto px-4 py-12">
        {/* Hero */}
        <div className="text-center mb-12">
          {domainDiscount ? (
            <>
              <Badge className="mb-4 bg-gradient-to-r from-primary to-accent text-primary-foreground">
                <Sparkles className="h-3 w-3 mr-1" />
                {domainDiscount.percent}% Discount for @{domainDiscount.domain}
              </Badge>
              <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
                Unlock Your DSA Potential
              </h2>
              <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                Get unlimited access with your exclusive {domainDiscount.percent}% domain discount auto-applied!
              </p>
            </>
          ) : (
            <>
              <Badge variant="secondary" className="mb-4">
                <Sparkles className="h-3 w-3 mr-1" />
                7-Day Free Trial with Full Access
              </Badge>
              <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
                Unlock Your DSA Potential
              </h2>
              <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                Get unlimited access to our complete problem library, AI solver, and spaced repetition system.
              </p>
            </>
          )}
        </div>

        {/* Regular Plans Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-6xl mx-auto mb-12">
          {PLANS.map((plan) => {
            const isSelected = selectedPlan === plan.id;
            const isCurrentPlan = currentPlan === plan.id;

            return (
              <Card
                key={plan.id}
                className={`relative cursor-pointer transition-all duration-200 ${
                  isSelected
                    ? "border-primary ring-2 ring-primary/20 shadow-lg"
                    : "border-border hover:border-primary/50"
                } ${plan.popular ? "ring-1 ring-primary/30" : ""}`}
                onClick={() => setSelectedPlan(plan.id)}
              >
                {plan.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <Badge className="bg-primary text-primary-foreground">Most Popular</Badge>
                  </div>
                )}
                
                <CardHeader className="text-center pb-2">
                  <div className={`mx-auto p-3 rounded-xl mb-3 ${
                    isSelected ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
                  }`}>
                    {plan.icon}
                  </div>
                  <CardTitle className="text-xl">{plan.name}</CardTitle>
                  <div className="flex items-baseline justify-center gap-1">
                    <span className="text-3xl font-bold text-foreground">₹{plan.price}</span>
                    {plan.durationLabel && (
                      <span className="text-muted-foreground">{plan.durationLabel}</span>
                    )}
                  </div>
                  {isCurrentPlan && (
                    <Badge variant="outline" className="mt-2">Current Plan</Badge>
                  )}
                </CardHeader>

                <CardContent>
                  <ul className="space-y-2">
                    {plan.features.map((feature, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm">
                        <Check className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                        <span className="text-muted-foreground">{feature}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Selected Plan Summary */}
        {selectedPlanData && (
          <div className="max-w-lg mx-auto">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Order Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">
                    {selectedPlanData.name} Plan
                  </span>
                  <span className="font-medium">
                    {selectedPlanData.price === 0 ? "FREE" : `₹${selectedPlanData.price}`}
                  </span>
                </div>
                {appliedDiscount && (
                  <div className="flex items-center justify-between text-primary">
                    <span className="flex items-center gap-1">
                      <Tag className="h-4 w-4" />
                      {appliedDiscount.isDomainDiscount ? "Domain Discount" : "Discount"} ({appliedDiscount.percent}%)
                    </span>
                    <span>-₹{selectedPlanData.price - finalPrice}</span>
                  </div>
                )}

                <Separator />

                <div className="flex items-center justify-between text-lg font-bold">
                  <span>Total</span>
                  <span className={finalPrice === 0 ? "text-success" : ""}>
                    {finalPrice === 0 ? "FREE" : `₹${finalPrice}`}
                  </span>
                </div>

                {/* Domain discount notice */}
                {domainDiscount && appliedDiscount?.isDomainDiscount && (
                  <div className="p-3 rounded-lg bg-success/10 border border-success/20">
                    <p className="text-sm text-success font-medium flex items-center gap-2">
                      <Sparkles className="h-4 w-4" />
                      {domainDiscount.percent}% discount auto-applied for @{domainDiscount.domain} users!
                    </p>
                  </div>
                )}

                {/* Discount Code Input - only show if no domain discount */}
                {!appliedDiscount?.isDomainDiscount && (
                  <div className="space-y-2">
                    <Label htmlFor="discount">Discount Code</Label>
                    <div className="flex gap-2">
                      <Input
                        id="discount"
                        placeholder="Enter code"
                        value={discountCode}
                        onChange={(e) => setDiscountCode(e.target.value.toUpperCase())}
                        disabled={!!appliedDiscount}
                      />
                      <Button
                        variant="outline"
                        onClick={handleApplyDiscount}
                        disabled={validatingCode || !!appliedDiscount}
                      >
                        {validatingCode ? <Loader2 className="h-4 w-4 animate-spin" /> : "Apply"}
                      </Button>
                    </div>
                    {appliedDiscount && (
                      <p className="text-xs text-primary flex items-center gap-1">
                        <Check className="h-3 w-3" />
                        Code "{appliedDiscount.code}" applied!
                      </p>
                    )}
                  </div>
                )}

                <Button 
                  className="w-full gap-2" 
                  size="lg"
                  onClick={handlePayment}
                  disabled={processing}
                >
                  {processing ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Processing...
                    </>
                  ) : finalPrice === 0 ? (
                    <>
                      <Sparkles className="h-4 w-4" />
                      Activate Free Plan
                    </>
                  ) : (
                    <>
                      <CreditCard className="h-4 w-4" />
                      Pay ₹{finalPrice}
                    </>
                  )}
                </Button>

                <div className="flex items-center justify-center gap-4 text-xs text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <ShieldCheck className="h-3 w-3" />
                    Secure Payment
                  </div>
                  <div className="flex items-center gap-1">
                    <CreditCard className="h-3 w-3" />
                    UPI, Cards, NetBanking
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Trust badges */}
        <div className="flex flex-wrap items-center justify-center gap-6 mt-12 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" />
            Secure Payments by Cashfree
          </div>
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Instant Access
          </div>
          <div className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-primary" />
            Cancel Anytime
          </div>
        </div>
      </main>
    </div>
  );
}
