import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { 
  performSecurityChecks,
  secureResponse,
  getCorsHeaders 
} from "../_shared/security.ts";

interface CreateTeacherRequest {
  name: string;
  email: string;
  created_by?: string;
  password?: string;
}

serve(async (req: Request) => {
  const origin = req.headers.get("Origin");
  const corsHeaders = getCorsHeaders(origin);

  // Perform security checks: require auth and admin role
  const security = await performSecurityChecks(req, {
    requireAuth: true,
    requiredRole: "admin",
    functionName: "create-teacher",
  });

  if (!security.passed) {
    return security.response!;
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    const { name, email, created_by, password }: CreateTeacherRequest = await req.json();

    if (!name || !email) {
      return secureResponse(
        { error: "Name and email are required" },
        400,
        corsHeaders,
        security.rateLimitResult
      );
    }

    if (password && password.length < 8) {
      return secureResponse(
        { error: "Password must be at least 8 characters" },
        400,
        corsHeaders,
        security.rateLimitResult
      );
    }

    const normalizedEmail = email.trim().toLowerCase();
    const hasCustomPassword = password && password.trim().length >= 8;

    console.log(`Admin ${security.user?.id} creating teacher: ${normalizedEmail}`);

    // Check if user exists
    const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers();
    const existingUser = existingUsers?.users?.find(
      (u) => u.email?.toLowerCase() === normalizedEmail
    );

    let userId: string;
    let isNewUser = false;

    if (existingUser) {
      userId = existingUser.id;
      console.log("User already exists:", userId);
    } else {
      const userPassword = hasCustomPassword 
        ? password!.trim() 
        : `Teacher@${Math.random().toString(36).slice(-8)}${Date.now().toString(36)}`;
      
      const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email: normalizedEmail,
        password: userPassword,
        email_confirm: true,
        user_metadata: { full_name: name },
      });

      if (createError || !newUser.user) {
        return secureResponse(
          { error: createError?.message || "Failed to create user" },
          400,
          corsHeaders,
          security.rateLimitResult
        );
      }

      userId = newUser.user.id;
      isNewUser = true;
      console.log("Created new user:", userId);
    }

    // Create or update teacher record
    const { data: existingTeacher } = await supabaseAdmin
      .from("teachers")
      .select("id")
      .eq("email", normalizedEmail)
      .maybeSingle();

    if (existingTeacher) {
      await supabaseAdmin
        .from("teachers")
        .update({ user_id: userId, is_active: true })
        .eq("id", existingTeacher.id);
    } else {
      const { error: teacherError } = await supabaseAdmin.from("teachers").insert({
        name: name.trim(),
        email: normalizedEmail,
        user_id: userId,
        created_by: created_by || security.user?.id,
        is_active: true,
      });

      if (teacherError) {
        return secureResponse(
          { error: teacherError.message },
          400,
          corsHeaders,
          security.rateLimitResult
        );
      }
    }

    // Add teacher role
    await supabaseAdmin
      .from("user_roles")
      .upsert(
        { user_id: userId, role: "teacher" },
        { onConflict: "user_id,role" }
      );

    // Send welcome email if new user
    let emailSent = false;
    if (isNewUser && !hasCustomPassword) {
      try {
        const { data: resetData } = await supabaseAdmin.auth.admin.generateLink({
          type: "recovery",
          email: normalizedEmail,
        });

        if (resetData?.properties?.action_link) {
          const emailResponse = await fetch(`${supabaseUrl}/functions/v1/send-email`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${supabaseServiceKey}`,
            },
            body: JSON.stringify({
              to: normalizedEmail,
              subject: "Welcome to CodeIQ - Set Your Teacher Password",
              html: `
                <h1>Welcome to CodeIQ!</h1>
                <p>Hi ${name}, you have been added as a Teacher on CodeIQ.</p>
                <p><a href="${resetData.properties.action_link}">Click here to set your password</a></p>
              `,
            }),
          });

          emailSent = emailResponse.ok;
        }
      } catch (emailErr) {
        console.error("Error sending welcome email:", emailErr);
      }
    }

    return secureResponse(
      {
        success: true,
        userId,
        isNewUser,
        emailSent,
        message: isNewUser
          ? hasCustomPassword
            ? "Teacher account created with custom password."
            : emailSent 
              ? "Teacher account created. Welcome email sent."
              : "Teacher account created."
          : "Teacher linked to existing user account.",
      },
      200,
      corsHeaders,
      security.rateLimitResult
    );
  } catch (error: any) {
    console.error("Error in create-teacher function:", error);
    return secureResponse(
      { error: error.message },
      500,
      corsHeaders,
      security.rateLimitResult
    );
  }
});
