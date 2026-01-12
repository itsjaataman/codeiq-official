import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@2.0.0";
import { 
  getCorsHeaders,
  checkRateLimit,
  getClientIdentifier,
  rateLimitResponse,
  secureResponse,
  handleCors
} from "../_shared/security.ts";

interface WelcomeEmailRequest {
  to: string;
  userName: string;
  emailType: "normal" | "classroom";
  classroomName?: string;
  teacherName?: string;
}

const getNormalWelcomeEmail = (userName: string) => `
<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#0f0f23;font-family:Segoe UI;">
<table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 20px;">
<tr><td align="center">
<table width="600" style="background:#14142b;border-radius:16px;border:1px solid #2a2a4a;">
<tr>
<td style="background:linear-gradient(135deg,#667eea,#764ba2);padding:40px;text-align:center;">
<h1 style="color:#fff;margin:0;">Welcome to CodeIQ</h1>
<p style="color:#e0e0ff;margin-top:10px;">Your structured DSA learning platform</p>
</td>
</tr>
<tr>
<td style="padding:40px;color:#d1d1d1;font-size:16px;line-height:1.7;">
<p>Hi <strong style="color:#667eea;">${userName || "Coder"}</strong>,</p>
<p>You're officially onboard 🎯 CodeIQ helps you practice DSA with clarity, consistency, and confidence.</p>
<ul style="margin:20px 0;padding-left:18px;color:#b5b5b5;">
<li>Curated DSA problem sets</li>
<li>Smart revision & analytics</li>
<li>Progress tracking & goals</li>
</ul>
<div style="text-align:center;margin-top:30px;">
<a href="https://codeiq.app/dashboard" style="background:linear-gradient(135deg,#667eea,#764ba2);color:#fff;text-decoration:none;padding:14px 36px;border-radius:8px;font-weight:600;">Go to Dashboard →</a>
</div>
</td>
</tr>
<tr>
<td style="background:#0d0d1f;padding:20px;text-align:center;border-top:1px solid #2a2a4a;">
<p style="color:#666;font-size:12px;margin:0;">© ${new Date().getFullYear()} CodeIQ by eVidyalaya</p>
</td>
</tr>
</table>
</td></tr>
</table>
</body>
</html>
`;

const getClassroomWelcomeEmail = (userName: string, classroomName: string, teacherName: string) => `
<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#0f0f23;font-family:Segoe UI;">
<table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 20px;">
<tr><td align="center">
<table width="600" style="background:#14142b;border-radius:16px;border:1px solid #2a2a4a;">
<tr>
<td style="background:linear-gradient(135deg,#34d399,#059669);padding:36px;text-align:center;">
<h1 style="color:#fff;margin:0;">${classroomName}</h1>
<p style="color:#d1ffe9;margin-top:8px;">Instructor: ${teacherName}</p>
</td>
</tr>
<tr>
<td style="padding:40px;color:#d1d1d1;font-size:16px;line-height:1.7;">
<p>Hi <strong style="color:#34d399;">${userName || "Student"}</strong>,</p>
<p>You've successfully joined this classroom and unlocked premium learning access.</p>
<ul style="margin:20px 0;padding-left:18px;color:#b5b5b5;">
<li>Free Pro access</li>
<li>Teacher-assigned practice</li>
<li>Leaderboard & progress tracking</li>
</ul>
<div style="text-align:center;margin-top:30px;">
<a href="https://codeiq.app/student" style="background:linear-gradient(135deg,#34d399,#059669);color:#fff;text-decoration:none;padding:14px 36px;border-radius:8px;font-weight:600;">Open Student Dashboard →</a>
</div>
</td>
</tr>
<tr>
<td style="background:#0d0d1f;padding:20px;text-align:center;border-top:1px solid #2a2a4a;">
<p style="color:#666;font-size:12px;margin:0;">© ${new Date().getFullYear()} CodeIQ by eVidyalaya</p>
</td>
</tr>
</table>
</td></tr>
</table>
</body>
</html>
`;

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
  const rateLimitResult = checkRateLimit(clientId, "welcome-email");
  
  if (!rateLimitResult.allowed) {
    return rateLimitResponse(rateLimitResult, corsHeaders);
  }

  try {
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) {
      console.error("RESEND_API_KEY not configured");
      return secureResponse(
        { success: false, error: "Email service not configured" },
        500,
        corsHeaders,
        rateLimitResult
      );
    }

    const resend = new Resend(resendApiKey);
    const { to, userName, emailType, classroomName, teacherName }: WelcomeEmailRequest = await req.json();

    if (!to || !userName) {
      return secureResponse(
        { success: false, error: "Missing required fields" },
        400,
        corsHeaders,
        rateLimitResult
      );
    }

    const subject = emailType === "classroom" 
      ? `Welcome to ${classroomName} – CodeIQ` 
      : "Welcome to CodeIQ – Start Your DSA Journey";

    const html = emailType === "classroom"
      ? getClassroomWelcomeEmail(userName, classroomName || "Classroom", teacherName || "Instructor")
      : getNormalWelcomeEmail(userName);

    const emailResult = await resend.emails.send({
      from: "CodeIQ <no-reply@codeiq.app>",
      to: [to],
      subject: subject,
      html: html,
      text: "Welcome to CodeIQ",
    });

    if (emailResult.error) {
      console.error("Failed to send welcome email:", emailResult.error);
      return secureResponse(
        { success: false, error: emailResult.error.message },
        500,
        corsHeaders,
        rateLimitResult
      );
    }

    console.log("Welcome email sent:", emailResult.data?.id);

    return secureResponse(
      { success: true, id: emailResult.data?.id },
      200,
      corsHeaders,
      rateLimitResult
    );
  } catch (err: any) {
    console.error("Email error:", err.message);
    return secureResponse(
      { success: false, error: err.message },
      500,
      corsHeaders
    );
  }
});
