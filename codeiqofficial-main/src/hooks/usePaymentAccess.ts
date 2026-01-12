import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useAppSettings } from "@/hooks/useAppSettings";

interface PaymentStatus {
  hasPendingPayment: boolean;
  hasDeclinedPayment: boolean;
  hasApprovedPayment: boolean;
  pendingPayment: any | null;
  declinedPayment: any | null;
  isLoading: boolean;
}

interface FeatureAccess {
  hasProAccess: boolean;
  hasTempProAccess: boolean;
  hasAiSolver: boolean;
  hasNotes: boolean;
  hasCompanyWise: boolean;
  hasRevision: boolean;
  isBasicPlan: boolean;
  isTrialExpired: boolean;
  isLocked: boolean;
  paidFeaturesEnabled: boolean;
  isDomainWhitelisted: boolean;
  domainDiscount: number | null;
}

export function usePaymentAccess(): PaymentStatus & FeatureAccess {
  const { user, profile } = useAuth();
  const { settings, isLoading: settingsLoading } = useAppSettings();
  const [status, setStatus] = useState<PaymentStatus>({
    hasPendingPayment: false,
    hasDeclinedPayment: false,
    hasApprovedPayment: false,
    pendingPayment: null,
    declinedPayment: null,
    isLoading: true,
  });
  const [domainDiscount, setDomainDiscount] = useState<number | null>(null);

  // Check for email domain whitelist (discount only)
  useEffect(() => {
    const checkDomainWhitelist = async () => {
      if (!user?.email) return;

      const emailDomain = user.email.split("@")[1];
      if (!emailDomain) return;

      const { data } = await supabase
        .from("email_domain_whitelist")
        .select("discount_percent")
        .eq("domain", emailDomain)
        .eq("is_active", true)
        .maybeSingle();

      if (data?.discount_percent && data.discount_percent > 0) {
        setDomainDiscount(data.discount_percent);
      }
    };

    checkDomainWhitelist();
  }, [user?.email]);

  useEffect(() => {
    const checkPaymentStatus = async () => {
      if (!user) {
        setStatus({
          hasPendingPayment: false,
          hasDeclinedPayment: false,
          hasApprovedPayment: false,
          pendingPayment: null,
          declinedPayment: null,
          isLoading: false,
        });
        return;
      }

      try {
        // Check for pending payment (within 15 min window only - no temp access, just status info)
        const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString();
        const { data: pending } = await supabase
          .from("payments")
          .select("*")
          .eq("user_id", user.id)
          .eq("status", "pending")
          .gte("created_at", fifteenMinutesAgo)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        // Check for most recent declined payment (no temp access, show message)
        const { data: declined } = await supabase
          .from("payments")
          .select("*")
          .eq("user_id", user.id)
          .eq("status", "declined")
          .order("declined_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        // Check for approved payment
        const { data: approved } = await supabase
          .from("payments")
          .select("*")
          .eq("user_id", user.id)
          .eq("status", "completed")
          .order("approved_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        setStatus({
          hasPendingPayment: !!pending,
          hasDeclinedPayment: !!declined && !pending, // Only show declined if no pending
          hasApprovedPayment: !!approved,
          pendingPayment: pending,
          declinedPayment: declined,
          isLoading: false,
        });
      } catch (error) {
        console.error("Error checking payment status:", error);
        setStatus(prev => ({ ...prev, isLoading: false }));
      }
    };

    checkPaymentStatus();

    // Subscribe to payment changes
    const channel = supabase
      .channel("payment-status")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "payments",
          filter: `user_id=eq.${user?.id}`,
        },
        () => {
          checkPaymentStatus();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id]);

  // If paid features are disabled, everyone has full access
  if (!settings.paid_features_enabled) {
    return {
      ...status,
      hasTempProAccess: true,
      hasProAccess: true,
      hasAiSolver: true,
      hasNotes: true,
      hasCompanyWise: true,
      hasRevision: true,
      isBasicPlan: false,
      isTrialExpired: false,
      isLocked: false,
      paidFeaturesEnabled: false,
      isDomainWhitelisted: domainDiscount !== null,
      domainDiscount,
    };
  }

  const now = new Date();
  
  // Check trial status - all users get trial (including domain users)
  const trialEndsAt = profile?.trial_ends_at ? new Date(profile.trial_ends_at) : null;
  const isInTrial = trialEndsAt ? trialEndsAt > now : false;
  const isTrialExpired = trialEndsAt ? trialEndsAt <= now : false;
  
  // Check subscription status
  const subscriptionPlan = profile?.subscription_plan || "free";
  const subscriptionExpiresAt = profile?.subscription_expires_at ? new Date(profile.subscription_expires_at) : null;
  
  // For lifetime and basic plans, no expiry check needed
  const isLifetimeOrBasic = ["lifetime", "basic"].includes(subscriptionPlan);
  const subscriptionActive = isLifetimeOrBasic || (subscriptionExpiresAt ? subscriptionExpiresAt > now : false);
  
  // Plan-based access
  const isProPlan = ["pro", "pro+", "lifetime"].includes(subscriptionPlan);
  const isBasicPlan = subscriptionPlan === "basic";
  const isPaidPlan = subscriptionPlan !== "free";
  
  // Check if paid subscription is valid (either lifetime/basic with no expiry OR non-expired subscription)
  const hasPaidSubscription = isPaidPlan && subscriptionActive;

  // Locked if trial expired + no valid paid subscription (pending payments no longer grant access)
  const isLocked = isTrialExpired && !hasPaidSubscription;

  // Pro access: trial OR (pro/pro+/lifetime with active subscription) - pending payments NO longer grant access
  const hasProAccessFromSubscription = isProPlan && subscriptionActive;
  const hasProAccess = isInTrial || hasProAccessFromSubscription;
  
  // Temp pro access - only for trial or confirmed paid subscription (not pending)
  const hasTempProAccess = isInTrial || (isPaidPlan && subscriptionActive) || status.hasApprovedPayment;

  // Feature access - based on trial or subscription
  const hasAiSolver = hasProAccess;
  const hasNotes = hasProAccess;
  const hasCompanyWise = hasProAccess;
  const hasRevision = hasProAccess;

  return {
    ...status,
    hasTempProAccess,
    hasProAccess,
    hasAiSolver,
    hasNotes,
    hasCompanyWise,
    hasRevision,
    isBasicPlan: isBasicPlan && subscriptionActive,
    isTrialExpired,
    isLocked,
    paidFeaturesEnabled: true,
    isDomainWhitelisted: domainDiscount !== null,
    domainDiscount,
  };
}
