import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);

    // Calculate 15 minutes ago
    const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString();

    console.log(`Checking for pending payments older than: ${fifteenMinutesAgo}`);

    // Find and update pending payments older than 15 minutes
    const { data: expiredPayments, error: fetchError } = await supabase
      .from("payments")
      .select("id, user_id, plan, amount, created_at")
      .eq("status", "pending")
      .lt("created_at", fifteenMinutesAgo);

    if (fetchError) {
      console.error("Error fetching expired payments:", fetchError);
      return new Response(JSON.stringify({ error: "Failed to fetch payments" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!expiredPayments || expiredPayments.length === 0) {
      console.log("No expired pending payments found");
      return new Response(JSON.stringify({ 
        success: true, 
        message: "No expired payments found",
        expiredCount: 0 
      }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`Found ${expiredPayments.length} expired pending payments`);

    // Update each expired payment
    const expiredIds = expiredPayments.map(p => p.id);
    const { error: updateError } = await supabase
      .from("payments")
      .update({
        status: "expired",
        declined_at: new Date().toISOString(),
        admin_notes: "Auto-expired after 15 minutes without confirmation",
      })
      .in("id", expiredIds);

    if (updateError) {
      console.error("Error updating expired payments:", updateError);
      return new Response(JSON.stringify({ error: "Failed to update payments" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Create notifications for affected users
    const notifications = expiredPayments.map(payment => ({
      user_id: payment.user_id,
      type: "warning",
      title: "Payment Expired",
      message: `Your payment of ₹${payment.amount} for ${payment.plan} plan expired after 15 minutes. Please try again if you wish to subscribe.`,
    }));

    await supabase.from("notifications").insert(notifications);

    console.log(`Successfully expired ${expiredPayments.length} payments`);

    return new Response(JSON.stringify({
      success: true,
      message: `Expired ${expiredPayments.length} pending payments`,
      expiredCount: expiredPayments.length,
      expiredIds,
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error in expire-pending-payments:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
