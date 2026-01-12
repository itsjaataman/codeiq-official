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
async function sendEmailInBackground(email: string, otp: string, name?: string) {
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
              <p style="margin: 8px 0 0; font-size: 14px; color: #71717a;">Verify Your Email</p>
            </td>
          </tr>
          <tr>
            <td style="padding: 0 40px 32px;">
              <h2 style="margin: 0 0 16px; font-size: 20px; color: #18181b;">Welcome${name ? `, ${name}` : ''}! 👋</h2>
              <p style="margin: 0 0 24px; font-size: 15px; color: #52525b; line-height: 1.6;">
                Use the following code to verify your email. This code expires in 10 minutes.
              </p>
              <div style="background: linear-gradient(135deg, #f97316, #fb923c); border-radius: 12px; padding: 24px; text-align: center;">
                <span style="font-size: 32px; font-weight: 700; color: #ffffff; letter-spacing: 8px;">${otp}</span>
              </div>
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
      subject: "Verify Your Email - CodeIQ",
      content: `Your verification code is: ${otp}`,
      html: htmlContent,
    });

    await client.close();
    console.log(`Email sent successfully to ${email}`);
  } catch (error: any) {
    console.error(`Failed to send email to ${email}:`, error.message);
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
  const rateLimitResult = checkRateLimit(clientId, "signup-otp");
  
  if (!rateLimitResult.allowed) {
    return rateLimitResponse(rateLimitResult, corsHeaders);
  }

  try {
    let body: Record<string, unknown> = {};
    try {
      const text = await req.text();
      if (text && text.trim()) {
        body = JSON.parse(text);
      }
    } catch (parseError) {
      console.error("Failed to parse request body:", parseError);
      return secureResponse(
        { success: false, message: "Invalid request body" },
        400,
        corsHeaders,
        rateLimitResult
      );
    }
    
    const action = (body.action as string) || 'send-otp';

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
      const name = body.name as string | undefined;
      
      if (!email || !email.includes('@')) {
        return secureResponse(
          { success: false, message: "Valid email is required" },
          400,
          corsHeaders,
          rateLimitResult
        );
      }

      console.log(`Processing signup OTP for: ${email}`);

      // Fast check: query profiles table instead of listing all users
      const { data: existingProfile } = await supabaseAdmin
        .from('profiles')
        .select('id')
        .eq('email', email.toLowerCase())
        .maybeSingle();

      if (existingProfile) {
        return secureResponse(
          { success: false, message: "An account with this email already exists. Please sign in." },
          400,
          corsHeaders,
          rateLimitResult
        );
      }

      // Generate OTP
      const otp = generateOTP();
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

      // Delete existing OTPs and store new one (parallel operations)
      const deletePromise = supabaseAdmin.from('password_reset_otps').delete().eq('email', email.toLowerCase());
      await deletePromise;
      
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
      EdgeRuntime.waitUntil(sendEmailInBackground(email, otp, name));

      // Return immediately
      return secureResponse(
        { success: true, message: "Verification code sent to your email." },
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
          { success: false, message: "No verification code found. Please request a new one." },
          400,
          corsHeaders,
          rateLimitResult
        );
      }

      if (new Date() > new Date(otpRecord.expires_at)) {
        // Delete expired OTP in background
        EdgeRuntime.waitUntil(
          supabaseAdmin.from('password_reset_otps').delete().eq('id', otpRecord.id).then(() => {})
        );
        return secureResponse(
          { success: false, message: "Verification code has expired. Please request a new one." },
          400,
          corsHeaders,
          rateLimitResult
        );
      }

      if (otpRecord.otp !== otp.trim()) {
        return secureResponse(
          { success: false, message: "Invalid verification code. Please try again." },
          400,
          corsHeaders,
          rateLimitResult
        );
      }

      // Mark as used in background
      EdgeRuntime.waitUntil(
        supabaseAdmin.from('password_reset_otps').update({ used: true }).eq('id', otpRecord.id).then(() => {})
      );

      return secureResponse(
        { success: true, message: "Email verified successfully." },
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
    console.error("Error in signup-otp function:", error);
    return secureResponse(
      { success: false, message: error.message || "An error occurred. Please try again." },
      500,
      corsHeaders
    );
  }
});
