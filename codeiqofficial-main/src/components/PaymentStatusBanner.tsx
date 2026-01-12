import { usePaymentAccess } from "@/hooks/usePaymentAccess";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Clock, AlertTriangle, CheckCircle2 } from "lucide-react";
import { Link } from "react-router-dom";

export function PaymentStatusBanner() {
  const { hasPendingPayment, hasDeclinedPayment, pendingPayment, declinedPayment, isLoading } = usePaymentAccess();

  if (isLoading) return null;

  if (hasPendingPayment && pendingPayment) {
    return (
      <div className="bg-warning/10 border border-warning/20 rounded-lg p-4 mb-6">
        <div className="flex items-start gap-3">
          <Clock className="h-5 w-5 text-warning mt-0.5" />
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <p className="font-medium text-warning">Payment Verification in Progress</p>
              <Badge variant="outline" className="text-warning border-warning/30">
                Processing
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              Your payment of ₹{pendingPayment.amount} is being verified. This may take up to 24 hours.
              Pro features are unlocked while we verify.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (hasDeclinedPayment && declinedPayment) {
    return (
      <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4 mb-6">
        <div className="flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-destructive mt-0.5" />
          <div className="flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="font-medium text-destructive">Payment Declined</p>
              <Badge variant="destructive">Action Required</Badge>
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              Your payment of ₹{declinedPayment.amount} on {new Date(declinedPayment.created_at).toLocaleDateString()} 
              was declined. Pro features are locked.
            </p>
            <Button size="sm" className="mt-3" asChild>
              <Link to="/pricing">Repay to Activate Pro</Link>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
