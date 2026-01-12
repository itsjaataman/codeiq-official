import { useEffect, useState } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, CheckCircle2, XCircle, ArrowLeft, Crown } from "lucide-react";

export default function PaymentCallback() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState<"loading" | "success" | "failed" | "pending">("loading");
  const [message, setMessage] = useState("");

  useEffect(() => {
    const verifyPayment = async () => {
      const orderId = searchParams.get("order_id");
      
      if (!orderId) {
        // No order ID, redirect to dashboard
        navigate("/dashboard");
        return;
      }

      try {
        // Verify payment with edge function
        const { data, error } = await supabase.functions.invoke("cashfree-payment", {
          body: {
            action: "verify",
            orderId: orderId,
          },
        });

        if (error) {
          console.error("Verification error:", error);
          setStatus("failed");
          setMessage("Unable to verify payment. Please contact support.");
          return;
        }

        if (data?.status === "completed") {
          setStatus("success");
          setMessage("Your subscription is now active!");
        } else if (data?.orderStatus === "PAID" || data?.status === "pending") {
          setStatus("pending");
          setMessage("Payment received! Your subscription will be activated shortly.");
        } else {
          setStatus("failed");
          setMessage("Payment was not completed. Please try again.");
        }
      } catch (error) {
        console.error("Error verifying payment:", error);
        setStatus("failed");
        setMessage("Unable to verify payment status.");
      }
    };

    verifyPayment();
  }, [searchParams, navigate]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          {status === "loading" && (
            <>
              <div className="mx-auto p-4 rounded-full bg-primary/10 mb-4">
                <Loader2 className="h-12 w-12 text-primary animate-spin" />
              </div>
              <CardTitle>Verifying Payment</CardTitle>
              <CardDescription>Please wait while we confirm your payment...</CardDescription>
            </>
          )}

          {status === "success" && (
            <>
              <div className="mx-auto p-4 rounded-full bg-success/10 mb-4">
                <CheckCircle2 className="h-12 w-12 text-success" />
              </div>
              <CardTitle className="text-success">Payment Successful!</CardTitle>
              <CardDescription>{message}</CardDescription>
            </>
          )}

          {status === "pending" && (
            <>
              <div className="mx-auto p-4 rounded-full bg-warning/10 mb-4">
                <Loader2 className="h-12 w-12 text-warning" />
              </div>
              <CardTitle>Payment Processing</CardTitle>
              <CardDescription>{message}</CardDescription>
            </>
          )}

          {status === "failed" && (
            <>
              <div className="mx-auto p-4 rounded-full bg-destructive/10 mb-4">
                <XCircle className="h-12 w-12 text-destructive" />
              </div>
              <CardTitle className="text-destructive">Payment Failed</CardTitle>
              <CardDescription>{message}</CardDescription>
            </>
          )}
        </CardHeader>

        <CardContent className="space-y-4">
          {status === "success" && (
            <Button className="w-full gap-2" onClick={() => navigate("/dashboard")}>
              <Crown className="h-4 w-4" />
              Go to Dashboard
            </Button>
          )}

          {status === "pending" && (
            <Button className="w-full" onClick={() => navigate("/dashboard")}>
              Continue to Dashboard
            </Button>
          )}

          {status === "failed" && (
            <div className="space-y-3">
              <Button className="w-full gap-2" asChild>
                <Link to="/pricing">
                  <Crown className="h-4 w-4" />
                  Try Again
                </Link>
              </Button>
              <Button variant="outline" className="w-full gap-2" asChild>
                <Link to="/dashboard">
                  <ArrowLeft className="h-4 w-4" />
                  Back to Dashboard
                </Link>
              </Button>
            </div>
          )}

          {status !== "loading" && (
            <p className="text-xs text-center text-muted-foreground">
              Questions? Contact support@codeiq.app
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
