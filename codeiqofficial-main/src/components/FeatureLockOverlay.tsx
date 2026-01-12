import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Crown, Sparkles, Percent } from "lucide-react";
import { usePaymentAccess } from "@/hooks/usePaymentAccess";

interface FeatureLockOverlayProps {
  featureName: string;
  featureDescription: string;
  icon: React.ReactNode;
  onClose?: () => void;
}

export function FeatureLockOverlay({
  featureName,
  featureDescription,
  icon,
  onClose,
}: FeatureLockOverlayProps) {
  const { domainDiscount, isDomainWhitelisted } = usePaymentAccess();

  return (
    <div className="text-center py-6">
      <div className="mx-auto p-4 rounded-full bg-primary/10 w-fit mb-4">
        {icon}
      </div>
      
      <div className="flex items-center justify-center gap-2 mb-4">
        <Badge variant="secondary" className="bg-primary/10 text-primary gap-1">
          <Sparkles className="h-3 w-3" />
          Pro Feature
        </Badge>
        
        {isDomainWhitelisted && domainDiscount && (
          <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/30 gap-1">
            <Percent className="h-3 w-3" />
            {domainDiscount}% Off
          </Badge>
        )}
      </div>
      
      <h3 className="font-semibold text-lg mb-2">{featureName}</h3>
      <p className="text-muted-foreground text-sm mb-4">
        {featureDescription}
      </p>
      
      {isDomainWhitelisted && domainDiscount && (
        <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-3 mb-4 mx-auto max-w-xs">
          <p className="text-sm text-green-600 font-medium">
            🎉 You have a {domainDiscount}% discount!
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            As a whitelisted domain user
          </p>
        </div>
      )}
      
      <div className="flex gap-3 justify-center">
        <Button asChild>
          <Link to="/pricing">
            <Crown className="h-4 w-4 mr-2" />
            Upgrade to Pro
          </Link>
        </Button>
        {onClose && (
          <Button variant="outline" onClick={onClose}>
            Maybe Later
          </Button>
        )}
      </div>
    </div>
  );
}
