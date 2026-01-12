// ============================================================
// SHARED SECURITY UTILITIES FOR EDGE FUNCTIONS
// Implements: Rate Limiting, CORS, Authentication, Authorization
// ============================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ============================================================
// CORS CONFIGURATION - Strict origin policy
// ============================================================

const ALLOWED_ORIGINS = [
  // Production domain
  "https://codeiq.app",
  "https://www.codeiq.app",
  // Lovable preview domains
  "https://lovable.dev",
];

// Allow Lovable preview URLs pattern
const LOVABLE_PREVIEW_PATTERN = /^https:\/\/[a-z0-9-]+--[a-z0-9-]+\.lovable\.app$/;
const LOVABLE_DEV_PATTERN = /^https:\/\/[a-z0-9-]+\.lovableproject\.com$/;

export function isAllowedOrigin(origin: string | null): boolean {
  if (!origin) return false;
  
  // Check explicit allowed origins
  if (ALLOWED_ORIGINS.includes(origin)) return true;
  
  // Check Lovable preview patterns (for development)
  if (LOVABLE_PREVIEW_PATTERN.test(origin)) return true;
  if (LOVABLE_DEV_PATTERN.test(origin)) return true;
  
  return false;
}

export function getCorsHeaders(origin: string | null): Record<string, string> {
  const allowedOrigin = isAllowedOrigin(origin) ? origin : ALLOWED_ORIGINS[0];
  
  return {
    "Access-Control-Allow-Origin": allowedOrigin || ALLOWED_ORIGINS[0],
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-request-id",
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Max-Age": "86400", // 24 hours
  };
}

export function handleCors(req: Request): Response | null {
  const origin = req.headers.get("Origin");
  const corsHeaders = getCorsHeaders(origin);
  
  if (req.method === "OPTIONS") {
    return new Response(null, { 
      status: 204,
      headers: corsHeaders 
    });
  }
  
  // Block requests from disallowed origins (except for internal calls)
  if (origin && !isAllowedOrigin(origin)) {
    console.warn(`Blocked request from unauthorized origin: ${origin}`);
    return new Response(
      JSON.stringify({ error: "Origin not allowed" }),
      { 
        status: 403, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    );
  }
  
  return null; // Continue processing
}

// ============================================================
// RATE LIMITING - In-memory with configurable limits
// ============================================================

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

// In-memory store (resets on function cold start)
const rateLimitStore = new Map<string, RateLimitEntry>();

// Default limits - can be overridden via environment variables
const DEFAULT_RATE_LIMIT = parseInt(Deno.env.get("RATE_LIMIT_REQUESTS") || "100");
const DEFAULT_RATE_WINDOW = parseInt(Deno.env.get("RATE_LIMIT_WINDOW_SECONDS") || "60") * 1000;

// Function-specific limits (more restrictive for sensitive endpoints)
const FUNCTION_LIMITS: Record<string, { requests: number; windowMs: number }> = {
  "signup-otp": { requests: 5, windowMs: 60000 }, // 5 per minute (prevent OTP spam)
  "forgot-password": { requests: 5, windowMs: 60000 }, // 5 per minute
  "ai-solver": { requests: 20, windowMs: 60000 }, // 20 per minute (AI costs)
  "create-teacher": { requests: 10, windowMs: 60000 }, // 10 per minute
  "admin-email": { requests: 50, windowMs: 60000 }, // 50 per minute
  "default": { requests: DEFAULT_RATE_LIMIT, windowMs: DEFAULT_RATE_WINDOW },
};

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetTime: number;
  limit: number;
}

export function checkRateLimit(
  identifier: string, 
  functionName: string = "default"
): RateLimitResult {
  const now = Date.now();
  const config = FUNCTION_LIMITS[functionName] || FUNCTION_LIMITS["default"];
  const key = `${functionName}:${identifier}`;
  
  // Clean up expired entries periodically
  if (Math.random() < 0.01) {
    cleanupExpiredEntries();
  }
  
  const entry = rateLimitStore.get(key);
  
  if (!entry || now > entry.resetTime) {
    // Create new entry
    const newEntry: RateLimitEntry = {
      count: 1,
      resetTime: now + config.windowMs,
    };
    rateLimitStore.set(key, newEntry);
    
    return {
      allowed: true,
      remaining: config.requests - 1,
      resetTime: newEntry.resetTime,
      limit: config.requests,
    };
  }
  
  // Increment count
  entry.count++;
  
  if (entry.count > config.requests) {
    return {
      allowed: false,
      remaining: 0,
      resetTime: entry.resetTime,
      limit: config.requests,
    };
  }
  
  return {
    allowed: true,
    remaining: config.requests - entry.count,
    resetTime: entry.resetTime,
    limit: config.requests,
  };
}

function cleanupExpiredEntries(): void {
  const now = Date.now();
  for (const [key, entry] of rateLimitStore.entries()) {
    if (now > entry.resetTime) {
      rateLimitStore.delete(key);
    }
  }
}

export function getRateLimitHeaders(result: RateLimitResult): Record<string, string> {
  return {
    "X-RateLimit-Limit": result.limit.toString(),
    "X-RateLimit-Remaining": result.remaining.toString(),
    "X-RateLimit-Reset": Math.ceil(result.resetTime / 1000).toString(),
    "Retry-After": result.allowed ? "" : Math.ceil((result.resetTime - Date.now()) / 1000).toString(),
  };
}

export function rateLimitResponse(
  result: RateLimitResult, 
  corsHeaders: Record<string, string>
): Response {
  const rateLimitHeaders = getRateLimitHeaders(result);
  const headers: Record<string, string> = {
    ...corsHeaders,
    ...rateLimitHeaders,
    "Content-Type": "application/json",
  };
  
  // Remove empty Retry-After
  if (headers["Retry-After"] === "") {
    delete headers["Retry-After"];
  }
  
  return new Response(
    JSON.stringify({
      error: "Too Many Requests",
      message: "Rate limit exceeded. Please try again later.",
      retryAfter: Math.ceil((result.resetTime - Date.now()) / 1000),
    }),
    {
      status: 429,
      headers,
    }
  );
}

// ============================================================
// AUTHENTICATION - JWT validation and user extraction
// ============================================================

export interface AuthResult {
  authenticated: boolean;
  user: any | null;
  error?: string;
}

export async function authenticateRequest(req: Request): Promise<AuthResult> {
  const authHeader = req.headers.get("Authorization");
  
  if (!authHeader) {
    return {
      authenticated: false,
      user: null,
      error: "No authorization header provided",
    };
  }
  
  if (!authHeader.startsWith("Bearer ")) {
    return {
      authenticated: false,
      user: null,
      error: "Invalid authorization header format. Expected: Bearer <token>",
    };
  }
  
  const token = authHeader.replace("Bearer ", "");
  
  if (!token || token.length < 10) {
    return {
      authenticated: false,
      user: null,
      error: "Invalid or malformed token",
    };
  }
  
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
    
    if (!supabaseUrl || !supabaseAnonKey) {
      console.error("Missing Supabase configuration");
      return {
        authenticated: false,
        user: null,
        error: "Server configuration error",
      };
    }
    
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    
    const { data: { user }, error } = await supabase.auth.getUser();
    
    if (error || !user) {
      return {
        authenticated: false,
        user: null,
        error: "Invalid or expired token",
      };
    }
    
    return {
      authenticated: true,
      user,
    };
  } catch (error) {
    console.error("Authentication error:", error);
    return {
      authenticated: false,
      user: null,
      error: "Authentication failed",
    };
  }
}

export function authErrorResponse(
  error: string, 
  corsHeaders: Record<string, string>
): Response {
  return new Response(
    JSON.stringify({ 
      error: "Unauthorized",
      message: error,
    }),
    {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    }
  );
}

// ============================================================
// AUTHORIZATION - Role-based access control
// ============================================================

export type AppRole = "admin" | "teacher" | "user";

export async function checkUserRole(
  userId: string, 
  requiredRole: AppRole
): Promise<boolean> {
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    
    if (!supabaseUrl || !supabaseServiceKey) {
      console.error("Missing Supabase service configuration");
      return false;
    }
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    const { data, error } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", requiredRole)
      .single();
    
    if (error || !data) {
      return false;
    }
    
    return true;
  } catch (error) {
    console.error("Role check error:", error);
    return false;
  }
}

export async function getUserRoles(userId: string): Promise<AppRole[]> {
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    
    if (!supabaseUrl || !supabaseServiceKey) {
      return [];
    }
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    const { data, error } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);
    
    if (error || !data) {
      return [];
    }
    
    return data.map(r => r.role as AppRole);
  } catch (error) {
    console.error("Get roles error:", error);
    return [];
  }
}

export function forbiddenResponse(
  message: string, 
  corsHeaders: Record<string, string>
): Response {
  return new Response(
    JSON.stringify({ 
      error: "Forbidden",
      message,
    }),
    {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    }
  );
}

// ============================================================
// UTILITY: Get client identifier for rate limiting
// ============================================================

export function getClientIdentifier(req: Request, userId?: string): string {
  // Prefer user ID for authenticated requests
  if (userId) {
    return `user:${userId}`;
  }
  
  // Fall back to IP address
  const forwardedFor = req.headers.get("x-forwarded-for");
  const realIp = req.headers.get("x-real-ip");
  const cfConnectingIp = req.headers.get("cf-connecting-ip");
  
  const ip = cfConnectingIp || realIp || forwardedFor?.split(",")[0]?.trim() || "unknown";
  return `ip:${ip}`;
}

// ============================================================
// UTILITY: Create secure response with all headers
// ============================================================

export function secureResponse(
  body: any,
  status: number,
  corsHeaders: Record<string, string>,
  rateLimitResult?: RateLimitResult
): Response {
  const headers: Record<string, string> = {
    ...corsHeaders,
    "Content-Type": "application/json",
    // Security headers
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "X-XSS-Protection": "1; mode=block",
    "Referrer-Policy": "strict-origin-when-cross-origin",
  };
  
  if (rateLimitResult) {
    const rateLimitHeaders = getRateLimitHeaders(rateLimitResult);
    Object.assign(headers, rateLimitHeaders);
    // Remove empty Retry-After
    if (headers["Retry-After"] === "") {
      delete headers["Retry-After"];
    }
  }
  
  return new Response(JSON.stringify(body), { status, headers });
}

// ============================================================
// MIDDLEWARE: Complete security check pipeline
// ============================================================

export interface SecurityCheckOptions {
  requireAuth?: boolean;
  requiredRole?: AppRole;
  functionName?: string;
}

export interface SecurityCheckResult {
  passed: boolean;
  response?: Response;
  user?: any;
  corsHeaders: Record<string, string>;
  rateLimitResult?: RateLimitResult;
}

export async function performSecurityChecks(
  req: Request,
  options: SecurityCheckOptions = {}
): Promise<SecurityCheckResult> {
  const origin = req.headers.get("Origin");
  const corsHeaders = getCorsHeaders(origin);
  
  // 1. CORS check
  const corsResponse = handleCors(req);
  if (corsResponse) {
    return { passed: corsResponse.status === 204, response: corsResponse, corsHeaders };
  }
  
  // 2. Authentication (if required)
  let user = null;
  if (options.requireAuth) {
    const authResult = await authenticateRequest(req);
    if (!authResult.authenticated) {
      return {
        passed: false,
        response: authErrorResponse(authResult.error || "Unauthorized", corsHeaders),
        corsHeaders,
      };
    }
    user = authResult.user;
  } else {
    // Try to get user anyway for better rate limiting
    const authResult = await authenticateRequest(req);
    if (authResult.authenticated) {
      user = authResult.user;
    }
  }
  
  // 3. Rate limiting
  const clientId = getClientIdentifier(req, user?.id);
  const rateLimitResult = checkRateLimit(clientId, options.functionName);
  
  if (!rateLimitResult.allowed) {
    return {
      passed: false,
      response: rateLimitResponse(rateLimitResult, corsHeaders),
      corsHeaders,
      rateLimitResult,
    };
  }
  
  // 4. Authorization (if required)
  if (options.requiredRole && user) {
    const hasRole = await checkUserRole(user.id, options.requiredRole);
    if (!hasRole) {
      return {
        passed: false,
        response: forbiddenResponse(
          `This action requires ${options.requiredRole} privileges`,
          corsHeaders
        ),
        corsHeaders,
        user,
        rateLimitResult,
      };
    }
  }
  
  return {
    passed: true,
    user,
    corsHeaders,
    rateLimitResult,
  };
}
