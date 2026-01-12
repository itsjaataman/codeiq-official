import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Lock, Crown, AlertTriangle } from "lucide-react";

interface LockedScreenProps {
  title?: string;
  description?: string;
  showTrialExpired?: boolean;
}

export function LockedScreen({ 
  title = "Feature Locked",
  description = "Your trial has expired. Upgrade to continue using this feature.",
  showTrialExpired = true
}: LockedScreenProps) {
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="text-center max-w-lg bg-card rounded-2xl border border-border shadow-card p-12">
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-destructive/10 mx-auto mb-6">
          <Lock className="h-10 w-10 text-destructive" />
        </div>
        {showTrialExpired && (
          <Badge variant="destructive" className="mb-4 gap-1">
            <AlertTriangle className="h-3 w-3" />
            Trial Expired
          </Badge>
        )}
        <h2 className="text-2xl font-bold text-foreground mb-3">
          {title}
        </h2>
        <p className="text-muted-foreground mb-6">
          {description}
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <Button size="lg" asChild className="gap-2">
            <Link to="/pricing">
              <Crown className="h-4 w-4" />
              Upgrade Now
            </Link>
          </Button>
          <Button variant="outline" size="lg" asChild>
            <Link to="/dashboard">Go to Dashboard</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
