import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const CASHFREE_APP_ID = Deno.env.get("CASHFREE_APP_ID");
const CASHFREE_SECRET_KEY = Deno.env.get("CASHFREE_SECRET_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

// Use production API - change to sandbox for testing
const CASHFREE_API_URL = "https://api.cashfree.com/pg";

interface CreateOrderRequest {
  userId: string;
  plan: string;
  planName?: string;
  amount: number;
  discountCodeId?: string;
  discountAmount?: number;
  customerName: string;
  customerEmail: string;
  customerPhone?: string;
  domainPlanId?: string;
  domainPlanDurationDays?: number;
  domainPlanFeatures?: {
    all_features?: boolean;
    ai_solver?: boolean;
    notes?: boolean;
    company_wise?: boolean;
    revision?: boolean;
  };
}

interface PlanConfig {
  name: string;
  durationMonths?: number;
  durationYears?: number;
  durationDays?: number;
  subscriptionPlan: string;
}

const PLAN_CONFIGS: Record<string, PlanConfig> = {
  basic: { name: "Basic", durationMonths: 1, subscriptionPlan: "basic" },
  pro: { name: "Pro", durationMonths: 3, subscriptionPlan: "pro" },
  pro_plus: { name: "Pro+", durationMonths: 6, subscriptionPlan: "pro+" },
  lifetime: { name: "Lifetime", durationYears: 5, subscriptionPlan: "lifetime" },
};

// Helper function to calculate expiry date
function calculateExpiryDate(planConfig: PlanConfig | null, domainPlanDurationDays?: number): Date {
  const now = new Date();
  let expiresAt: Date = new Date(now);

  // Domain plan duration takes priority
  if (domainPlanDurationDays) {
    expiresAt.setDate(expiresAt.getDate() + domainPlanDurationDays);
    console.log(`Using domain plan duration: ${domainPlanDurationDays} days, expires at: ${expiresAt.toISOString()}`);
    return expiresAt;
  }

  // Fall back to regular plan config
  if (planConfig?.durationYears) {
    expiresAt.setFullYear(expiresAt.getFullYear() + planConfig.durationYears);
  } else if (planConfig?.durationMonths) {
    expiresAt.setMonth(expiresAt.getMonth() + planConfig.durationMonths);
  } else if (planConfig?.durationDays) {
    expiresAt.setDate(expiresAt.getDate() + planConfig.durationDays);
  } else {
    // Default to 1 month
    expiresAt.setMonth(expiresAt.getMonth() + 1);
  }

  return expiresAt;
}

// Helper to determine subscription plan name
function getSubscriptionPlanName(plan: string, domainPlanFeatures?: CreateOrderRequest['domainPlanFeatures']): string {
  // If it's a domain plan with all_features, treat as pro
  if (domainPlanFeatures?.all_features) {
    return "pro";
  }
  
  // If it's a domain plan, use a generic "domain" plan type
  if (plan.startsWith("domain_")) {
    return "domain";
  }

  // Regular plan
  return PLAN_CONFIGS[plan]?.subscriptionPlan || plan;
}

async function handleFreeActivation(req: Request): Promise<Response> {
  try {
    const body = await req.json();
    const { 
      userId, 
      plan, 
      planName,
      discountCodeId, 
      discountAmount,
      domainPlanId,
      domainPlanDurationDays,
      domainPlanFeatures,
    } = body;

    console.log("Free activation request:", { userId, plan, planName, domainPlanId, domainPlanDurationDays });

    if (!userId || !plan) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);
    
    // Check if this is a domain plan
    const isDomainPlan = plan.startsWith("domain_");
    const regularPlanConfig = isDomainPlan ? null : PLAN_CONFIGS[plan];
    
    const now = new Date();
    const expiresAt = calculateExpiryDate(regularPlanConfig, domainPlanDurationDays);
    const subscriptionPlanName = getSubscriptionPlanName(plan, domainPlanFeatures);
    const displayName = planName || regularPlanConfig?.name || plan;

    const orderId = `FREE_${Date.now()}_${Math.random().toString(36).substring(7)}`;

    // Create payment record with 0 amount
    const { data: payment, error: paymentError } = await supabase
      .from("payments")
      .insert({
        user_id: userId,
        plan: plan,
        amount: 0,
        discount_amount: discountAmount || 0,
        discount_code_id: discountCodeId || null,
        status: "completed",
        merchant_transaction_id: orderId,
        approved_at: now.toISOString(),
        payment_method: "free_discount",
        admin_notes: domainPlanId ? `Domain Plan ID: ${domainPlanId}` : null,
      })
      .select()
      .single();

    if (paymentError) {
      console.error("Error creating payment record:", paymentError);
      return new Response(JSON.stringify({ error: "Failed to create payment record" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Create subscription with domain plan info
    const subscriptionData: Record<string, any> = {
      user_id: userId,
      plan: subscriptionPlanName,
      status: "active",
      starts_at: now.toISOString(),
      expires_at: expiresAt.toISOString(),
      payment_id: payment.id,
    };

    await supabase.from("subscriptions").insert(subscriptionData);

    // Update profile with subscription info
    const profileUpdate: Record<string, any> = {
      subscription_plan: subscriptionPlanName,
      subscription_expires_at: expiresAt.toISOString(),
      subscription_started_at: now.toISOString(),
    };

    await supabase
      .from("profiles")
      .update(profileUpdate)
      .eq("user_id", userId);

    // Create notification
    await supabase.from("notifications").insert({
      user_id: userId,
      type: "success",
      title: "Subscription Activated!",
      message: `Your ${displayName} plan is now active${discountAmount ? " with 100% discount" : ""}. Enjoy!`,
    });

    console.log("Free activation successful:", { userId, plan, expiresAt: expiresAt.toISOString() });

    return new Response(JSON.stringify({
      success: true,
      message: "Subscription activated successfully",
      expiresAt: expiresAt.toISOString(),
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error activating free subscription:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
}

async function createOrder(req: Request): Promise<Response> {
  try {
    const body: CreateOrderRequest = await req.json();
    const { 
      userId, 
      plan, 
      planName,
      amount, 
      discountCodeId, 
      discountAmount, 
      customerName, 
      customerEmail, 
      customerPhone,
      domainPlanId,
      domainPlanDurationDays,
      domainPlanFeatures,
    } = body;

    console.log("Create order request:", { userId, plan, planName, amount, domainPlanId, domainPlanDurationDays });

    if (!userId || !plan || amount === undefined) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // If amount is 0, this shouldn't happen as frontend should call free-activation
    if (amount === 0) {
      return new Response(JSON.stringify({ error: "Use free-activation for 0 amount orders" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);

    // Generate unique order ID
    const orderId = `ORDER_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    const displayName = planName || PLAN_CONFIGS[plan]?.name || plan;

    // Build admin notes with domain plan info
    let adminNotes = null;
    if (domainPlanId) {
      adminNotes = JSON.stringify({
        domainPlanId,
        domainPlanDurationDays,
        domainPlanFeatures,
      });
    }

    // Create payment record first
    const { data: payment, error: paymentError } = await supabase
      .from("payments")
      .insert({
        user_id: userId,
        plan: plan,
        amount: amount,
        discount_amount: discountAmount || 0,
        discount_code_id: discountCodeId || null,
        status: "pending",
        merchant_transaction_id: orderId,
        customer_name: customerName,
        customer_email: customerEmail,
        customer_phone: customerPhone || null,
        admin_notes: adminNotes,
      })
      .select()
      .single();

    if (paymentError) {
      console.error("Error creating payment record:", paymentError);
      return new Response(JSON.stringify({ error: "Failed to create payment record" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Create Cashfree order
    const cashfreeResponse = await fetch(`${CASHFREE_API_URL}/orders`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-client-id": CASHFREE_APP_ID!,
        "x-client-secret": CASHFREE_SECRET_KEY!,
        "x-api-version": "2023-08-01",
      },
      body: JSON.stringify({
        order_id: orderId,
        order_amount: amount,
        order_currency: "INR",
        customer_details: {
          customer_id: userId.substring(0, 50),
          customer_name: customerName.substring(0, 100),
          customer_email: customerEmail,
          customer_phone: customerPhone && customerPhone.length >= 10 ? customerPhone : undefined,
        },
        order_meta: {
          return_url: `https://codeiq.app/payment-callback?order_id=${orderId}`,
          notify_url: `${SUPABASE_URL}/functions/v1/cashfree-payment`,
        },
        order_note: `CodeIQ ${displayName} Plan`,
      }),
    });

    const cashfreeData = await cashfreeResponse.json();
    console.log("Cashfree create order response:", JSON.stringify(cashfreeData));

    if (!cashfreeResponse.ok) {
      console.error("Cashfree error:", cashfreeData);
      // Delete the pending payment record
      await supabase.from("payments").delete().eq("id", payment.id);
      return new Response(JSON.stringify({ error: cashfreeData.message || "Failed to create Cashfree order" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Update payment record with Cashfree order ID
    await supabase
      .from("payments")
      .update({ cashfree_order_id: cashfreeData.order_id })
      .eq("id", payment.id);

    return new Response(JSON.stringify({
      success: true,
      orderId: cashfreeData.order_id,
      paymentSessionId: cashfreeData.payment_session_id,
      paymentId: payment.id,
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error creating order:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
}

async function handleWebhook(req: Request): Promise<Response> {
  try {
    const body = await req.json();
    console.log("Webhook received:", JSON.stringify(body));

    const { data } = body;
    if (!data) {
      console.log("No data in webhook");
      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const orderId = data.order?.order_id;
    const paymentStatus = data.payment?.payment_status;
    const paymentId = data.payment?.cf_payment_id;
    const paymentMethod = data.payment?.payment_method?.type || data.payment?.payment_group;

    if (!orderId) {
      console.log("No order_id in webhook");
      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);

    // Find the payment record
    const { data: payment, error: paymentError } = await supabase
      .from("payments")
      .select("*")
      .eq("merchant_transaction_id", orderId)
      .single();

    if (paymentError || !payment) {
      console.error("Payment not found:", orderId);
      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check if already processed
    if (payment.status === "completed") {
      console.log("Payment already processed:", orderId);
      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (paymentStatus === "SUCCESS") {
      // Parse domain plan info from admin_notes if present
      let domainPlanDurationDays: number | undefined;
      let domainPlanFeatures: CreateOrderRequest['domainPlanFeatures'] | undefined;
      
      if (payment.admin_notes) {
        try {
          const notes = JSON.parse(payment.admin_notes);
          domainPlanDurationDays = notes.domainPlanDurationDays;
          domainPlanFeatures = notes.domainPlanFeatures;
          console.log("Domain plan info from payment:", { domainPlanDurationDays, domainPlanFeatures });
        } catch (e) {
          console.log("Admin notes is not JSON, skipping domain plan parsing");
        }
      }

      // Payment successful - activate subscription
      const isDomainPlan = payment.plan.startsWith("domain_");
      const planConfig = isDomainPlan ? null : PLAN_CONFIGS[payment.plan];
      const now = new Date();
      const expiresAt = calculateExpiryDate(planConfig, domainPlanDurationDays);
      const subscriptionPlanName = getSubscriptionPlanName(payment.plan, domainPlanFeatures);

      console.log("Activating subscription:", { 
        plan: payment.plan, 
        subscriptionPlanName, 
        expiresAt: expiresAt.toISOString(),
        isDomainPlan,
        domainPlanDurationDays,
      });

      // Update payment record
      await supabase
        .from("payments")
        .update({
          status: "completed",
          cashfree_payment_id: paymentId?.toString(),
          payment_method: paymentMethod,
          approved_at: now.toISOString(),
        })
        .eq("id", payment.id);

      // Create subscription record
      await supabase.from("subscriptions").insert({
        user_id: payment.user_id,
        plan: subscriptionPlanName,
        status: "active",
        starts_at: now.toISOString(),
        expires_at: expiresAt.toISOString(),
        payment_id: payment.id,
      });

      // Update user profile
      await supabase
        .from("profiles")
        .update({
          subscription_plan: subscriptionPlanName,
          subscription_expires_at: expiresAt.toISOString(),
          subscription_started_at: now.toISOString(),
        })
        .eq("user_id", payment.user_id);

      // Create notification
      const planDisplayName = planConfig?.name || (isDomainPlan ? "Domain" : payment.plan);
      await supabase.from("notifications").insert({
        user_id: payment.user_id,
        type: "success",
        title: "Payment Successful!",
        message: `Your ${planDisplayName} plan is now active. Thank you for subscribing!`,
      });

      console.log("Payment processed successfully:", orderId);
    } else if (paymentStatus === "FAILED" || paymentStatus === "CANCELLED") {
      // Payment failed
      await supabase
        .from("payments")
        .update({
          status: "declined",
          declined_at: new Date().toISOString(),
          cashfree_payment_id: paymentId?.toString(),
          payment_method: paymentMethod,
        })
        .eq("id", payment.id);

      console.log("Payment failed:", orderId, paymentStatus);
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Webhook error:", error);
    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
}

async function verifyPayment(req: Request): Promise<Response> {
  try {
    const { orderId } = await req.json();

    if (!orderId) {
      return new Response(JSON.stringify({ error: "Order ID required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch order status from Cashfree
    const cashfreeResponse = await fetch(`${CASHFREE_API_URL}/orders/${orderId}`, {
      method: "GET",
      headers: {
        "x-client-id": CASHFREE_APP_ID!,
        "x-client-secret": CASHFREE_SECRET_KEY!,
        "x-api-version": "2023-08-01",
      },
    });

    const cashfreeData = await cashfreeResponse.json();
    console.log("Cashfree verify response:", JSON.stringify(cashfreeData));

    if (!cashfreeResponse.ok) {
      return new Response(JSON.stringify({ error: "Failed to verify order" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);

    // Get payment record
    const { data: payment } = await supabase
      .from("payments")
      .select("*")
      .eq("merchant_transaction_id", orderId)
      .single();

    const orderStatus = cashfreeData.order_status;
    
    // If payment is PAID but not yet processed
    if (orderStatus === "PAID" && payment && payment.status !== "completed") {
      // Fetch payment details
      const paymentsResponse = await fetch(`${CASHFREE_API_URL}/orders/${orderId}/payments`, {
        method: "GET",
        headers: {
          "x-client-id": CASHFREE_APP_ID!,
          "x-client-secret": CASHFREE_SECRET_KEY!,
          "x-api-version": "2023-08-01",
        },
      });

      const paymentsData = await paymentsResponse.json();
      const successfulPayment = paymentsData.find((p: any) => p.payment_status === "SUCCESS");

      if (successfulPayment) {
        // Parse domain plan info from admin_notes if present
        let domainPlanDurationDays: number | undefined;
        let domainPlanFeatures: CreateOrderRequest['domainPlanFeatures'] | undefined;
        
        if (payment.admin_notes) {
          try {
            const notes = JSON.parse(payment.admin_notes);
            domainPlanDurationDays = notes.domainPlanDurationDays;
            domainPlanFeatures = notes.domainPlanFeatures;
          } catch (e) {
            console.log("Admin notes is not JSON, skipping domain plan parsing");
          }
        }

        // Process the payment
        const isDomainPlan = payment.plan.startsWith("domain_");
        const planConfig = isDomainPlan ? null : PLAN_CONFIGS[payment.plan];
        const now = new Date();
        const expiresAt = calculateExpiryDate(planConfig, domainPlanDurationDays);
        const subscriptionPlanName = getSubscriptionPlanName(payment.plan, domainPlanFeatures);

        console.log("Verify - Activating subscription:", { 
          plan: payment.plan, 
          subscriptionPlanName, 
          expiresAt: expiresAt.toISOString(),
        });

        // Update payment
        await supabase
          .from("payments")
          .update({
            status: "completed",
            cashfree_payment_id: successfulPayment.cf_payment_id?.toString(),
            payment_method: successfulPayment.payment_method?.type || successfulPayment.payment_group,
            approved_at: now.toISOString(),
          })
          .eq("id", payment.id);

        // Create subscription
        await supabase.from("subscriptions").insert({
          user_id: payment.user_id,
          plan: subscriptionPlanName,
          status: "active",
          starts_at: now.toISOString(),
          expires_at: expiresAt.toISOString(),
          payment_id: payment.id,
        });

        // Update profile
        await supabase
          .from("profiles")
          .update({
            subscription_plan: subscriptionPlanName,
            subscription_expires_at: expiresAt.toISOString(),
            subscription_started_at: now.toISOString(),
          })
          .eq("user_id", payment.user_id);

        return new Response(JSON.stringify({
          success: true,
          status: "completed",
          message: "Payment verified and subscription activated!",
        }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    return new Response(JSON.stringify({
      success: true,
      status: payment?.status || orderStatus,
      orderStatus: orderStatus,
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Verify error:", error);
    return new Response(JSON.stringify({ error: "Verification failed" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const url = new URL(req.url);
  const path = url.pathname.split("/").pop();

  try {
    // Check if it's a webhook (POST without specific path or with webhook indicator)
    const contentType = req.headers.get("content-type") || "";
    
    if (req.method === "POST") {
      // Clone request to peek at body
      const clonedReq = req.clone();
      const bodyText = await clonedReq.text();
      
      // Check if it's a Cashfree webhook
      if (bodyText.includes('"type":"PAYMENT_SUCCESS"') || 
          bodyText.includes('"type":"PAYMENT_FAILED"') ||
          bodyText.includes('"type":"PAYMENT_CANCELLED"') ||
          bodyText.includes('"event_time"')) {
        // Create new request with parsed body
        const webhookReq = new Request(req.url, {
          method: "POST",
          headers: req.headers,
          body: bodyText,
        });
        return handleWebhook(webhookReq);
      }

      // Parse JSON for regular requests
      const jsonBody = JSON.parse(bodyText);
      const newReq = new Request(req.url, {
        method: "POST",
        headers: req.headers,
        body: JSON.stringify(jsonBody),
      });

      if (jsonBody.action === "free-activation") {
        return handleFreeActivation(newReq);
      } else if (jsonBody.action === "create-order" || path === "create-order") {
        return createOrder(newReq);
      } else if (jsonBody.action === "verify" || path === "verify") {
        return verifyPayment(newReq);
      } else if (jsonBody.orderId && !jsonBody.action) {
        return verifyPayment(newReq);
      } else {
        return createOrder(newReq);
      }
    }

    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Handler error:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});