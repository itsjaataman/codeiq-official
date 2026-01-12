import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@2.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface AdminEmailRequest {
  subject: string;
  content: string;
  recipients: string[];
}

function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

function isHtmlContent(content: string): boolean {
  const htmlTagPattern = /<[a-z][\s\S]*>/i;
  return htmlTagPattern.test(content);
}

async function isAdmin(authHeader: string): Promise<boolean> {
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    
    if (!supabaseUrl || !supabaseServiceKey) {
      console.error("Missing Supabase configuration");
      return false;
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    
    if (userError || !user) {
      console.error("Failed to get user:", userError);
      return false;
    }

    const { data: roleData, error: roleError } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .single();

    if (roleError || !roleData) {
      console.error("User is not admin");
      return false;
    }

    console.log(`Admin verified: ${user.id}`);
    return true;
  } catch (error) {
    console.error("Admin check error:", error);
    return false;
  }
}

serve(async (req: Request) => {
  // Handle CORS preflight FIRST
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    // Verify admin
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, error: "Authorization required" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const adminCheck = await isAdmin(authHeader);
    if (!adminCheck) {
      return new Response(
        JSON.stringify({ success: false, error: "Admin access required" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Parse request
    const { subject, content, recipients }: AdminEmailRequest = await req.json();

    if (!subject || !content || !recipients || recipients.length === 0) {
      return new Response(
        JSON.stringify({ success: false, error: "Missing required fields: subject, content, recipients" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check Resend API key
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) {
      console.error("RESEND_API_KEY not configured");
      return new Response(
        JSON.stringify({ success: false, error: "Email service not configured. Please add RESEND_API_KEY." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const resend = new Resend(resendApiKey);

    // Validate and filter emails
    const validRecipients = recipients.filter(email => {
      const trimmed = email.trim();
      const isValid = isValidEmail(trimmed);
      if (!isValid) {
        console.warn(`Invalid email format: ${trimmed}`);
      }
      return isValid;
    }).map(e => e.trim());

    if (validRecipients.length === 0) {
      return new Response(
        JSON.stringify({ success: false, error: "No valid email addresses provided" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Sending email to ${validRecipients.length} recipients via Resend`);

    const isHtml = isHtmlContent(content);
    console.log(`Email content type: ${isHtml ? "HTML" : "Plain Text"}`);

    const results = {
      sent: 0,
      failed: 0,
      errors: [] as string[],
    };

    for (const email of validRecipients) {
      try {
        const emailResult = await resend.emails.send({
          from: "CodeIQ <no-reply@codeiq.app>",
          to: [email],
          subject: subject,
          html: isHtml ? content : `<p>${content.replace(/\n/g, '<br>')}</p>`,
          text: isHtml ? content.replace(/<[^>]*>/g, '') : content,
        });

        if (emailResult.error) {
          results.failed++;
          results.errors.push(`${email}: ${emailResult.error.message}`);
          console.error(`Failed to send to ${email}:`, emailResult.error);
        } else {
          results.sent++;
          console.log(`Email sent to ${email}, ID: ${emailResult.data?.id}`);
        }
      } catch (emailError: any) {
        results.failed++;
        results.errors.push(`${email}: ${emailError.message}`);
        console.error(`Error sending to ${email}:`, emailError.message);
      }
    }

    console.log(`Email results: ${results.sent} sent, ${results.failed} failed`);

    return new Response(
      JSON.stringify({ 
        success: results.sent > 0, 
        message: `Emails sent: ${results.sent}/${validRecipients.length}`,
        results,
        contentType: isHtml ? "html" : "text"
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Error in admin email function:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message || "Unknown error occurred" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
