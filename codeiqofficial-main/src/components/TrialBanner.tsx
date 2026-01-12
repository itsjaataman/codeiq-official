import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useSubscription } from "@/hooks/useSubscription";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Crown, Clock, Sparkles, X, Percent } from "lucide-react";
import { useState } from "react";

export function TrialBanner() {
  const { isInTrial, trialDaysRemaining, trialExpired, hasBasicAccess, paidFeaturesEnabled, plan, isLoading } = useSubscription();
  const { user } = useAuth();
  const [dismissed, setDismissed] = useState(false);

  // Fetch domain discount for whitelisted users
  const { data: domainDiscount } = useQuery({
    queryKey: ["domain-discount-banner", user?.email],
    queryFn: async () => {
      if (!user?.email) return null;
      const emailDomain = user.email.split("@")[1];
      if (!emailDomain) return null;

      const { data } = await supabase
        .from("email_domain_whitelist")
        .select("discount_percent, domain")
        .eq("domain", emailDomain)
        .eq("is_active", true)
        .maybeSingle();

      if (data && data.discount_percent && data.discount_percent > 0) {
        return { percent: data.discount_percent, domain: data.domain };
      }
      return null;
    },
    enabled: !!user?.email,
  });

  // Don't show if paid features are disabled, loading, or dismissed
  if (!paidFeaturesEnabled || isLoading || dismissed) {
    return null;
  }

  // Don't show for paid users who have an active subscription
  // A user is a paid subscriber if they have a paid plan (not free) AND hasBasicAccess is true
  if (plan !== "free" && hasBasicAccess) {
    return null;
  }

  // Trial active - show countdown
  if (isInTrial) {
    const urgency = trialDaysRemaining <= 2 ? "high" : trialDaysRemaining <= 4 ? "medium" : "low";
    
    return (
      <div className={`relative px-4 py-3 border-b ${
        urgency === "high" 
          ? "bg-destructive/10 border-destructive/20" 
          : urgency === "medium"
          ? "bg-warning/10 border-warning/20"
          : "bg-primary/5 border-primary/10"
      }`}>
        <div className="container mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-3 flex-wrap">
            <Badge variant="secondary" className={`gap-1 ${
              urgency === "high" ? "bg-destructive/20 text-destructive" : "bg-primary/20 text-primary"
            }`}>
              <Sparkles className="h-3 w-3" />
              Free Trial
            </Badge>
            <div className="flex items-center gap-2 text-sm">
              <Clock className={`h-4 w-4 ${urgency === "high" ? "text-destructive" : "text-muted-foreground"}`} />
              <span className={urgency === "high" ? "text-destructive font-medium" : "text-muted-foreground"}>
                {trialDaysRemaining === 0 
                  ? "Trial ends today!" 
                  : trialDaysRemaining === 1 
                  ? "1 day left in your trial" 
                  : `${trialDaysRemaining} days left in your trial`}
              </span>
            </div>
            {domainDiscount && (
              <Badge variant="outline" className="gap-1 bg-success/10 text-success border-success/20">
                <Percent className="h-3 w-3" />
                {domainDiscount.percent}% @{domainDiscount.domain} discount
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" asChild className="gap-2">
              <Link to="/pricing">
                <Crown className="h-4 w-4" />
                Upgrade Now
              </Link>
            </Button>
            <button 
              onClick={() => setDismissed(true)}
              className="p-1 hover:bg-muted rounded-md text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Trial expired - show upgrade prompt
  if (trialExpired && !hasBasicAccess) {
    return (
      <div className="relative px-4 py-3 border-b bg-destructive/10 border-destructive/20">
        <div className="container mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Badge variant="destructive" className="gap-1">
              <Clock className="h-3 w-3" />
              Trial Expired
            </Badge>
            <span className="text-sm text-muted-foreground">
              Your free trial has ended. Subscribe to continue practicing!
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" asChild className="gap-2">
              <Link to="/pricing">
                <Crown className="h-4 w-4" />
                View Plans
              </Link>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
