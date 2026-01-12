import { Link } from "react-router-dom";
import { ArrowLeft, Shield, Clock, CreditCard, AlertCircle, CheckCircle2, XCircle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import Footer from "@/components/layout/Footer";

export default function Refunds() {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 text-foreground hover:text-primary transition-colors">
            <ArrowLeft className="h-5 w-5" />
            <span className="font-medium">Back</span>
          </Link>
          <h1 className="text-xl font-bold text-foreground">Refunds & Cancellations</h1>
          <div className="w-20" />
        </div>
      </header>

      <main className="container mx-auto px-4 py-12 max-w-4xl flex-1">
        {/* Hero Section */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-6">
            <CreditCard className="h-8 w-8 text-primary" />
          </div>
          <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
            Refunds & Cancellations Policy
          </h1>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            We strive to ensure your satisfaction with CodeIQ. Please read our refund and cancellation policy carefully.
          </p>
          <p className="text-sm text-muted-foreground mt-4">Last updated: January 4, 2026</p>
        </div>

        {/* Quick Overview Cards */}
        <div className="grid md:grid-cols-3 gap-4 mb-12">
          <Card className="border-border bg-card/50">
            <CardContent className="pt-6 text-center">
              <Clock className="h-8 w-8 text-primary mx-auto mb-3" />
              <h3 className="font-semibold text-foreground mb-2">7-Day Window</h3>
              <p className="text-sm text-muted-foreground">
                Refund requests accepted within 7 days of purchase
              </p>
            </CardContent>
          </Card>
          <Card className="border-border bg-card/50">
            <CardContent className="pt-6 text-center">
              <Shield className="h-8 w-8 text-primary mx-auto mb-3" />
              <h3 className="font-semibold text-foreground mb-2">Fair Policy</h3>
              <p className="text-sm text-muted-foreground">
                Transparent and user-friendly refund process
              </p>
            </CardContent>
          </Card>
          <Card className="border-border bg-card/50">
            <CardContent className="pt-6 text-center">
              <CreditCard className="h-8 w-8 text-primary mx-auto mb-3" />
              <h3 className="font-semibold text-foreground mb-2">Quick Processing</h3>
              <p className="text-sm text-muted-foreground">
                Refunds processed within 5-7 business days
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Detailed Policy */}
        <div className="space-y-8">
          <Card className="border-border">
            <CardContent className="pt-6">
              <h2 className="text-xl font-semibold text-foreground mb-4 flex items-center gap-2">
                <span className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-bold text-primary">1</span>
                Refund Eligibility
              </h2>
              <div className="space-y-4 text-muted-foreground ml-10">
                <p>You may be eligible for a refund if:</p>
                <ul className="space-y-2">
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="h-5 w-5 text-success shrink-0 mt-0.5" />
                    <span>You request a refund within 7 days of your initial purchase</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="h-5 w-5 text-success shrink-0 mt-0.5" />
                    <span>You have not used more than 20% of the premium features</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="h-5 w-5 text-success shrink-0 mt-0.5" />
                    <span>Technical issues prevented you from accessing the service</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="h-5 w-5 text-success shrink-0 mt-0.5" />
                    <span>Duplicate or erroneous payment was made</span>
                  </li>
                </ul>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border">
            <CardContent className="pt-6">
              <h2 className="text-xl font-semibold text-foreground mb-4 flex items-center gap-2">
                <span className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-bold text-primary">2</span>
                Non-Refundable Situations
              </h2>
              <div className="space-y-4 text-muted-foreground ml-10">
                <p>Refunds will not be provided in the following cases:</p>
                <ul className="space-y-2">
                  <li className="flex items-start gap-2">
                    <XCircle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
                    <span>Request made after 7 days from the purchase date</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <XCircle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
                    <span>Significant usage of premium features (more than 20%)</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <XCircle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
                    <span>Violation of our Terms of Service</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <XCircle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
                    <span>Account suspension due to policy violations</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <XCircle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
                    <span>Change of mind without valid technical or service issues</span>
                  </li>
                </ul>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border">
            <CardContent className="pt-6">
              <h2 className="text-xl font-semibold text-foreground mb-4 flex items-center gap-2">
                <span className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-bold text-primary">3</span>
                How to Request a Refund
              </h2>
              <div className="space-y-4 text-muted-foreground ml-10">
                <p>To request a refund, please follow these steps:</p>
                <ol className="space-y-3 list-decimal list-inside">
                  <li>Email us at <a href="mailto:support@codeiq.app" className="text-primary hover:underline">support@codeiq.app</a> with the subject line "Refund Request"</li>
                  <li>Include your registered email address and transaction ID</li>
                  <li>Provide a brief explanation for the refund request</li>
                  <li>Our team will review your request within 2-3 business days</li>
                  <li>If approved, the refund will be processed within 5-7 business days</li>
                </ol>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border">
            <CardContent className="pt-6">
              <h2 className="text-xl font-semibold text-foreground mb-4 flex items-center gap-2">
                <span className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-bold text-primary">4</span>
                Subscription Cancellation
              </h2>
              <div className="space-y-4 text-muted-foreground ml-10">
                <p>For subscription cancellations:</p>
                <ul className="space-y-2">
                  <li className="flex items-start gap-2">
                    <AlertCircle className="h-5 w-5 text-warning shrink-0 mt-0.5" />
                    <span>You can cancel your subscription at any time from your account settings</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <AlertCircle className="h-5 w-5 text-warning shrink-0 mt-0.5" />
                    <span>Cancellation takes effect at the end of your current billing period</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <AlertCircle className="h-5 w-5 text-warning shrink-0 mt-0.5" />
                    <span>You will retain access to premium features until the subscription expires</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <AlertCircle className="h-5 w-5 text-warning shrink-0 mt-0.5" />
                    <span>No partial refunds for unused portions of the subscription period</span>
                  </li>
                </ul>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border">
            <CardContent className="pt-6">
              <h2 className="text-xl font-semibold text-foreground mb-4 flex items-center gap-2">
                <span className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-bold text-primary">5</span>
                Refund Processing
              </h2>
              <div className="space-y-4 text-muted-foreground ml-10">
                <p>Once your refund is approved:</p>
                <ul className="space-y-2">
                  <li>• Refunds will be credited to the original payment method</li>
                  <li>• UPI refunds typically take 5-7 business days to reflect</li>
                  <li>• Bank processing times may vary</li>
                  <li>• You will receive an email confirmation once the refund is initiated</li>
                </ul>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border bg-primary/5">
            <CardContent className="pt-6">
              <h2 className="text-xl font-semibold text-foreground mb-4 flex items-center gap-2">
                <span className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-bold text-primary">6</span>
                Contact Us
              </h2>
              <div className="space-y-4 text-muted-foreground ml-10">
                <p>If you have any questions about our refund policy, please contact us:</p>
                <div className="space-y-2">
                  <p><strong>Email:</strong> <a href="mailto:support@codeiq.app" className="text-primary hover:underline">support@codeiq.app</a></p>
                  <p><strong>Phone:</strong> <a href="tel:+918062179075" className="text-primary hover:underline">+91 8062179075</a></p>
                  <p><strong>Address:</strong> BT-1, BIO TECHNOLOGY PARK, Sitapura, Jaipur, Rajasthan 302022, India</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>

      <Footer />
    </div>
  );
}
