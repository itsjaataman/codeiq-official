import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";
import { 
  getCorsHeaders,
  checkRateLimit,
  getClientIdentifier,
  rateLimitResponse,
  secureResponse,
  handleCors
} from "../_shared/security.ts";

// Declare EdgeRuntime for background tasks
declare const EdgeRuntime: {
  waitUntil: (promise: PromiseLike<unknown>) => void;
};

function generateOTP(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// Background email sending function
async function sendEmailInBackground(email: string, otp: string) {
  try {
    const smtpHost = Deno.env.get("SMTP_HOST") || "";
    const smtpPort = parseInt(Deno.env.get("SMTP_PORT") || "465");
    const smtpUser = Deno.env.get("SMTP_USER") || "";
    const smtpPassword = Deno.env.get("SMTP_PASSWORD") || "";

    const client = new SMTPClient({
      connection: {
        hostname: smtpHost,
        port: smtpPort,
        tls: true,
        auth: { username: smtpUser, password: smtpPassword },
      },
    });

    const htmlContent = `
<!DOCTYPE html>
<html>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', sans-serif; background-color: #f4f4f5;">
  <table width="100%" cellpadding="0" cellspacing="0" style="min-height: 100vh;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 480px; background-color: #ffffff; border-radius: 16px;">
          <tr>
            <td style="padding: 40px 40px 32px; text-align: center;">
              <h1 style="margin: 0; font-size: 24px; color: #18181b;">🦉 CodeIQ</h1>
              <p style="margin: 8px 0 0; font-size: 14px; color: #71717a;">Password Reset</p>
            </td>
          </tr>
          <tr>
            <td style="padding: 0 40px 32px;">
              <p style="margin: 0 0 24px; font-size: 15px; color: #52525b; line-height: 1.6;">
                Use the following code to reset your password. This code expires in 10 minutes.
              </p>
              <div style="background: linear-gradient(135deg, #f97316, #fb923c); border-radius: 12px; padding: 24px; text-align: center;">
                <span style="font-size: 32px; font-weight: 700; color: #ffffff; letter-spacing: 8px;">${otp}</span>
              </div>
              <p style="margin: 24px 0 0; font-size: 13px; color: #71717a; line-height: 1.6;">
                If you didn't request a password reset, you can safely ignore this email.
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding: 24px 40px; background-color: #f4f4f5; border-radius: 0 0 16px 16px;">
              <p style="margin: 0; font-size: 12px; color: #a1a1aa; text-align: center;">© ${new Date().getFullYear()} CodeIQ</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

    await client.send({
      from: "CodeIQ <no-reply.codeiq@evidhyalaya.in>",
      to: email,
      subject: "Password Reset OTP - CodeIQ",
      content: `Your OTP code for password reset is: ${otp}`,
      html: htmlContent,
    });

    await client.close();
    console.log(`Password reset email sent to ${email}`);
  } catch (error: any) {
    console.error(`Failed to send password reset email to ${email}:`, error.message);
  }
}

serve(async (req: Request) => {
  const origin = req.headers.get("Origin");
  const corsHeaders = getCorsHeaders(origin);

  // Handle CORS preflight
  const corsResponse = handleCors(req);
  if (corsResponse) {
    return corsResponse;
  }

  // Rate limit by IP
  const clientId = getClientIdentifier(req);
  const rateLimitResult = checkRateLimit(clientId, "forgot-password");
  
  if (!rateLimitResult.allowed) {
    return rateLimitResponse(rateLimitResult, corsHeaders);
  }

  try {
    const body = await req.json();
    const action = body.action || 'send-otp';

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    if (action === 'send-otp') {
      const email = body.email as string;

      if (!email || !email.includes('@')) {
        return secureResponse(
          { success: false, message: "Valid email is required" },
          400,
          corsHeaders,
          rateLimitResult
        );
      }

      console.log(`Processing password reset for: ${email}`);

      // Fast check: query profiles table instead of listing all users
      const { data: existingProfile } = await supabaseAdmin
        .from('profiles')
        .select('id')
        .eq('email', email.toLowerCase())
        .maybeSingle();

      if (!existingProfile) {
        // Don't reveal if email exists - return same message
        return secureResponse(
          { success: true, message: "If an account exists with this email, you will receive an OTP." },
          200,
          corsHeaders,
          rateLimitResult
        );
      }

      // Generate and store OTP
      const otp = generateOTP();
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

      await supabaseAdmin.from('password_reset_otps').delete().eq('email', email.toLowerCase());
      
      const { error: insertError } = await supabaseAdmin.from('password_reset_otps').insert({
        email: email.toLowerCase(),
        otp: otp,
        expires_at: expiresAt,
        used: false,
      });

      if (insertError) {
        throw new Error("Failed to generate OTP");
      }

      // Send email in background - don't wait for it
      EdgeRuntime.waitUntil(sendEmailInBackground(email, otp));

      return secureResponse(
        { success: true, message: "OTP sent to your email address." },
        200,
        corsHeaders,
        rateLimitResult
      );
    }

    if (action === 'verify-otp') {
      const email = body.email as string;
      const otp = body.otp as string;

      const { data: otpRecord, error: fetchError } = await supabaseAdmin
        .from('password_reset_otps')
        .select('id, otp, expires_at')
        .eq('email', email.toLowerCase())
        .eq('used', false)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (fetchError || !otpRecord) {
        return secureResponse(
          { success: false, message: "No OTP found. Please request a new one." },
          400,
          corsHeaders,
          rateLimitResult
        );
      }

      if (new Date() > new Date(otpRecord.expires_at)) {
        EdgeRuntime.waitUntil(
          supabaseAdmin.from('password_reset_otps').delete().eq('id', otpRecord.id).then(() => {})
        );
        return secureResponse(
          { success: false, message: "OTP has expired. Please request a new one." },
          400,
          corsHeaders,
          rateLimitResult
        );
      }

      if (otpRecord.otp !== otp.trim()) {
        return secureResponse(
          { success: false, message: "Invalid OTP. Please try again." },
          400,
          corsHeaders,
          rateLimitResult
        );
      }

      return secureResponse(
        { success: true, message: "OTP verified successfully." },
        200,
        corsHeaders,
        rateLimitResult
      );
    }

    if (action === 'reset-password') {
      const email = body.email as string;
      const otp = body.otp as string;
      const newPassword = body.newPassword as string;

      if (!newPassword || newPassword.length < 8) {
        return secureResponse(
          { success: false, message: "Password must be at least 8 characters." },
          400,
          corsHeaders,
          rateLimitResult
        );
      }

      const { data: otpRecord, error: fetchError } = await supabaseAdmin
        .from('password_reset_otps')
        .select('id, otp, expires_at')
        .eq('email', email.toLowerCase())
        .eq('used', false)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (fetchError || !otpRecord || otpRecord.otp !== otp.trim() || new Date() > new Date(otpRecord.expires_at)) {
        return secureResponse(
          { success: false, message: "Invalid or expired OTP." },
          400,
          corsHeaders,
          rateLimitResult
        );
      }

      // Get user from profiles table (fast lookup)
      const { data: profile } = await supabaseAdmin
        .from('profiles')
        .select('user_id')
        .eq('email', email.toLowerCase())
        .maybeSingle();

      if (!profile?.user_id) {
        return secureResponse(
          { success: false, message: "User not found." },
          400,
          corsHeaders,
          rateLimitResult
        );
      }

      const { error } = await supabaseAdmin.auth.admin.updateUserById(profile.user_id, {
        password: newPassword,
      });

      if (error) {
        return secureResponse(
          { success: false, message: "Failed to update password." },
          500,
          corsHeaders,
          rateLimitResult
        );
      }

      // Delete OTP in background
      EdgeRuntime.waitUntil(
        supabaseAdmin.from('password_reset_otps').delete().eq('id', otpRecord.id).then(() => {})
      );

      return secureResponse(
        { success: true, message: "Password reset successfully." },
        200,
        corsHeaders,
        rateLimitResult
      );
    }

    return secureResponse(
      { success: false, message: "Invalid action." },
      400,
      corsHeaders,
      rateLimitResult
    );
  } catch (error: any) {
    console.error("Error in forgot-password function:", error);
    return secureResponse(
      { success: false, message: error.message || "An error occurred." },
      500,
      corsHeaders
    );
  }
});
