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

interface EmailRequest {
  to: string;
  subject: string;
  html: string;
  text?: string;
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
  const rateLimitResult = checkRateLimit(clientId, "send-email");
  
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
    const { to, subject, html, text }: EmailRequest = await req.json();

    if (!to || !subject || !html) {
      return secureResponse(
        { success: false, error: "Missing required fields: to, subject, html" },
        400,
        corsHeaders,
        rateLimitResult
      );
    }

    console.log(`Sending email to: ${to}, subject: ${subject}`);

    const emailResult = await resend.emails.send({
      from: "CodeIQ <no-reply@codeiq.app>",
      to: [to],
      subject: subject,
      html: html,
      text: text || html.replace(/<[^>]*>/g, ''),
    });

    if (emailResult.error) {
      console.error("Failed to send email:", emailResult.error);
      return secureResponse(
        { success: false, error: emailResult.error.message },
        500,
        corsHeaders,
        rateLimitResult
      );
    }

    console.log("Email sent successfully:", emailResult.data?.id);

    return secureResponse(
      { success: true, message: "Email sent successfully", id: emailResult.data?.id },
      200,
      corsHeaders,
      rateLimitResult
    );
  } catch (error: any) {
    console.error("Error sending email:", error);
    return secureResponse(
      { success: false, error: error.message },
      500,
      corsHeaders,
      rateLimitResult
    );
  }
});
