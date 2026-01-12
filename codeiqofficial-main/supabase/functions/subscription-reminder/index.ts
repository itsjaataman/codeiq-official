import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { 
  getCorsHeaders,
  checkRateLimit,
  getClientIdentifier,
  rateLimitResponse,
  secureResponse,
  handleCors
} from "../_shared/security.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

serve(async (req: Request) => {
  const origin = req.headers.get("Origin");
  const corsHeaders = getCorsHeaders(origin);

  // Handle CORS preflight
  const corsResponse = handleCors(req);
  if (corsResponse) {
    return corsResponse;
  }

  // Rate limit (this is typically called by cron, but protect anyway)
  const clientId = getClientIdentifier(req);
  const rateLimitResult = checkRateLimit(clientId, "subscription-reminder");
  
  if (!rateLimitResult.allowed) {
    return rateLimitResponse(rateLimitResult, corsHeaders);
  }

  try {
    if (!RESEND_API_KEY) {
      console.log("RESEND_API_KEY not configured, skipping email notifications");
      return secureResponse(
        { message: "Email notifications disabled - RESEND_API_KEY not configured" },
        200,
        corsHeaders,
        rateLimitResult
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Find users whose subscription expires in the next 3 days
    const threeDaysFromNow = new Date();
    threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 3);

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const { data: expiringUsers, error } = await supabase
      .from("profiles")
      .select("user_id, email, full_name, subscription_plan, subscription_expires_at")
      .not("subscription_plan", "eq", "free")
      .not("subscription_plan", "eq", "lifetime")
      .not("subscription_expires_at", "is", null)
      .gte("subscription_expires_at", today.toISOString())
      .lte("subscription_expires_at", threeDaysFromNow.toISOString());

    if (error) {
      throw error;
    }

    console.log(`Found ${expiringUsers?.length || 0} users with expiring subscriptions`);

    const emailsSent: string[] = [];

    for (const user of expiringUsers || []) {
      if (!user.email) continue;

      const expiresAt = new Date(user.subscription_expires_at);
      const daysRemaining = Math.ceil(
        (expiresAt.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
      );

      const userName = user.full_name || user.email.split("@")[0];

      try {
        const emailResponse = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${RESEND_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: "CodeIQ <no-reply@codeiq.app>",
            to: [user.email],
            subject: `Your CodeIQ ${user.subscription_plan} subscription expires in ${daysRemaining} day${daysRemaining !== 1 ? "s" : ""}`,
            html: `
<!DOCTYPE html>
<html>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="text-align: center; margin-bottom: 30px;">
    <h1 style="color: #f97316; margin: 0;">CodeIQ</h1>
  </div>
  
  <h2 style="color: #1a1a1a;">Hi ${userName}! 👋</h2>
  
  <p>Your <strong>${user.subscription_plan}</strong> subscription will expire on <strong>${expiresAt.toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}</strong>.</p>
  
  <p>That's only <strong>${daysRemaining} day${daysRemaining !== 1 ? "s" : ""}</strong> away!</p>
  
  <div style="background: linear-gradient(135deg, #f97316, #eab308); padding: 20px; border-radius: 12px; text-align: center; margin: 30px 0;">
    <p style="color: white; margin: 0 0 15px 0;">Don't lose access to your progress!</p>
    <a href="https://codeiq.app/pricing" style="display: inline-block; background: white; color: #f97316; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold;">Renew Now</a>
  </div>
  
  <p style="color: #666; font-size: 14px; margin-top: 40px;">
    Best regards,<br>The CodeIQ Team
  </p>
  
  <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
  
  <p style="color: #999; font-size: 12px; text-align: center;">
    You're receiving this because you have an active subscription on CodeIQ.
  </p>
</body>
</html>
          `,
          }),
        });

        if (emailResponse.ok) {
          emailsSent.push(user.email);
          console.log(`Sent reminder to ${user.email}`);
        } else {
          console.error(`Failed to send to ${user.email}:`, await emailResponse.text());
        }
      } catch (emailError) {
        console.error(`Error sending to ${user.email}:`, emailError);
      }
    }

    return secureResponse(
      {
        message: `Sent ${emailsSent.length} reminder emails`,
        recipients: emailsSent,
      },
      200,
      corsHeaders,
      rateLimitResult
    );
  } catch (error: any) {
    console.error("Error in subscription-reminder function:", error);
    return secureResponse(
      { error: error.message },
      500,
      corsHeaders
    );
  }
});
