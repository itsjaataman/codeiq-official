import { useState, useEffect, useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useAppSettings } from "@/hooks/useAppSettings";

export type SubscriptionPlan = "free" | "basic" | "pro" | "pro+" | "lifetime";

export interface SubscriptionStatus {
  // Current plan
  plan: SubscriptionPlan;
  
  // Trial status
  isInTrial: boolean;
  trialEndsAt: Date | null;
  trialDaysRemaining: number;
  trialExpired: boolean;
  
  // Subscription status
  isActive: boolean;
  expiresAt: Date | null;
  
  // Feature access
  hasFullAccess: boolean; // Has access to all features (trial or pro/pro+/lifetime)
  hasBasicAccess: boolean; // Has access to basic features
  hasProAccess: boolean; // Has access to pro features (Notes, AI, Revision, Companies)
  
  // Loading state
  isLoading: boolean;
  
  // Paid features enabled (from settings)
  paidFeaturesEnabled: boolean;
}

export function useSubscription(): SubscriptionStatus {
  const { user, profile } = useAuth();
  const { settings, isLoading: settingsLoading } = useAppSettings();
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!settingsLoading && profile !== undefined) {
      setIsLoading(false);
    }
  }, [settingsLoading, profile]);

  return useMemo(() => {
    const paidFeaturesEnabled = settings.paid_features_enabled;
    
    // If paid features are disabled, everyone has full access
    if (!paidFeaturesEnabled) {
      return {
        plan: "lifetime" as SubscriptionPlan,
        isInTrial: false,
        trialEndsAt: null,
        trialDaysRemaining: 0,
        trialExpired: false,
        isActive: true,
        expiresAt: null,
        hasFullAccess: true,
        hasBasicAccess: true,
        hasProAccess: true,
        isLoading,
        paidFeaturesEnabled: false,
      };
    }

    if (!user || !profile) {
      return {
        plan: "free" as SubscriptionPlan,
        isInTrial: false,
        trialEndsAt: null,
        trialDaysRemaining: 0,
        trialExpired: true,
        isActive: false,
        expiresAt: null,
        hasFullAccess: false,
        hasBasicAccess: false,
        hasProAccess: false,
        isLoading,
        paidFeaturesEnabled: true,
      };
    }

    const now = new Date();
    const plan = (profile.subscription_plan || "free") as SubscriptionPlan;
    
    // Check trial status
    const trialEndsAt = profile.trial_ends_at ? new Date(profile.trial_ends_at) : null;
    const isInTrial = trialEndsAt ? trialEndsAt > now : false;
    const trialExpired = trialEndsAt ? trialEndsAt <= now : true;
    const trialDaysRemaining = trialEndsAt 
      ? Math.max(0, Math.ceil((trialEndsAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)))
      : 0;

    // Check subscription expiry
    const expiresAt = profile.subscription_expires_at ? new Date(profile.subscription_expires_at) : null;
    const subscriptionActive = expiresAt ? expiresAt > now : false;
    
    // Determine plan-based access
    const isPaidPlan = plan !== "free";
    const isProPlan = ["pro", "pro+", "lifetime"].includes(plan);
    const isBasicPlan = plan === "basic";

    // Access logic:
    // - In trial: full access to all features
    // - Basic plan: basic features only (topics, leetcode, progress)
    // - Pro/Pro+/Lifetime: all features
    // - Free (trial expired): no access
    
    const isActive = isInTrial || (isPaidPlan && subscriptionActive);
    const hasBasicAccess = isInTrial || (isPaidPlan && subscriptionActive);
    const hasProAccess = isInTrial || (isProPlan && subscriptionActive);
    const hasFullAccess = hasProAccess;

    return {
      plan,
      isInTrial,
      trialEndsAt,
      trialDaysRemaining,
      trialExpired: !isInTrial && (!isPaidPlan || !subscriptionActive),
      isActive,
      expiresAt,
      hasFullAccess,
      hasBasicAccess,
      hasProAccess,
      isLoading,
      paidFeaturesEnabled: true,
    };
  }, [user, profile, settings.paid_features_enabled, isLoading]);
}
