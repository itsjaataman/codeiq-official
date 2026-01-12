import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY');
    const GEMINI_MODEL = Deno.env.get('GEMINI_MODEL') || 'gemini-2.5-pro';
    const FALLBACK_GEMINI_MODEL = Deno.env.get('GEMINI_FALLBACK_MODEL') || 'gemini-2.5-flash';
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    if (!GEMINI_API_KEY) {
      console.error('GEMINI_API_KEY is not configured');
      return new Response(
        JSON.stringify({ error: 'AI service not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { problemId, problemTitle, language } = await req.json();

    if (!problemId || !problemTitle || !language) {
      return new Response(
        JSON.stringify({ error: 'Missing required parameters: problemId, problemTitle, language' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const cacheKey = String(problemId);
    
    // Initialize Supabase client with service role for cache operations
    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);

    // Check cache first
    const { data: cachedSolution } = await supabase
      .from('ai_solution_cache')
      .select('id, solution')
      .eq('problem_id', cacheKey)
      .eq('language', language)
      .maybeSingle();

    if (cachedSolution?.solution) {
      console.log(`Cache HIT for problem ${problemId} in ${language}`);
      
      // Increment usage count in background
      supabase
        .from('ai_solution_cache')
        .update({ usage_count: (cachedSolution as any).usage_count + 1 || 1 })
        .eq('id', cachedSolution.id)
        .then(() => {});

      // Return cached solution as SSE stream for compatibility
      const encoder = new TextEncoder();
      const stream = new ReadableStream({
        start(controller) {
          const openAIFormat = {
            choices: [{ delta: { content: cachedSolution.solution } }]
          };
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(openAIFormat)}\n\n`));
          controller.enqueue(encoder.encode('data: [DONE]\n\n'));
          controller.close();
        }
      });

      return new Response(stream, {
        headers: {
          ...corsHeaders,
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
          'X-Cache': 'HIT',
        },
      });
    }

    console.log(`Cache MISS for problem ${problemId} in ${language} - generating new solution`);

    const languageMap: Record<string, string> = {
      'java': 'Java',
      'cpp': 'C++',
      'c': 'C',
      'csharp': 'C#',
      'python': 'Python',
      'python3': 'Python 3',
    };

    const languageName = languageMap[language] || language;

    const prompt = `Please solve the LeetCode problem '${problemId}. ${problemTitle}'. Follow these steps:

1. **First Intuition**: Provide a high-level explanation of your approach.

2. **Problem-Solving Approach**: Break down the solution into clear, logical steps.

3. **Code Implementation**: Provide the solution in ${languageName} code. Use proper code blocks with syntax highlighting.

4. **Complexity Analysis**: Analyze the time and space complexity of your solution. Use proper mathematical notation (e.g., O(n²), O(log n)).

Format your response with clear markdown headers for each section. Make sure code blocks use the correct language identifier for syntax highlighting.`;

    const callGemini = async (model: string) => {
      return await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse&key=${GEMINI_API_KEY}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            contents: [
              {
                role: 'user',
                parts: [
                  {
                    text: `You are an expert competitive programmer and DSA teacher. You provide clear, well-explained solutions to LeetCode problems. Always use proper markdown formatting with headers and code blocks. For code blocks, always specify the language for syntax highlighting.\n\n${prompt}`
                  }
                ]
              }
            ],
            generationConfig: {
              temperature: 0.7,
              maxOutputTokens: 4096,
            }
          }),
        }
      );
    };

    // Use Gemini API with streaming (retry once with fallback model if quota is exhausted)
    let usedModel = GEMINI_MODEL;
    let response = await callGemini(usedModel);

    if (!response.ok && response.status === 429 && usedModel !== FALLBACK_GEMINI_MODEL) {
      const firstErrorText = await response.text();
      console.error('Gemini API error:', response.status, firstErrorText);

      console.log(`Retrying with fallback model: ${FALLBACK_GEMINI_MODEL}`);
      usedModel = FALLBACK_GEMINI_MODEL;
      response = await callGemini(usedModel);
    }

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Gemini API error:', response.status, errorText);

      // Best-effort parse for Retry-After seconds (Gemini returns retryDelay like "6s")
      let retryAfterSeconds: number | null = null;
      try {
        const parsed = JSON.parse(errorText);
        const retryDelay = parsed?.error?.details?.find((d: any) => d['@type']?.includes('RetryInfo'))?.retryDelay as string | undefined;
        if (retryDelay && typeof retryDelay === 'string' && retryDelay.endsWith('s')) {
          const n = Number.parseInt(retryDelay.slice(0, -1), 10);
          if (Number.isFinite(n)) retryAfterSeconds = n;
        }
      } catch {
        // ignore
      }

      if (response.status === 429) {
        return new Response(
          JSON.stringify({
            error: 'Gemini quota exceeded',
            message: 'Your Gemini API key has no remaining quota for this model (or billing is not enabled). Please enable billing / increase quota, then try again.',
            model: usedModel,
            retryAfterSeconds,
          }),
          {
            status: 429,
            headers: {
              ...corsHeaders,
              ...(retryAfterSeconds ? { 'Retry-After': String(retryAfterSeconds) } : {}),
              'Content-Type': 'application/json',
            },
          }
        );
      }

      return new Response(
        JSON.stringify({ error: `AI service error: ${response.status}`, model: usedModel }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Transform Gemini SSE format to OpenAI-compatible format and collect full solution
    const { readable, writable } = new TransformStream();
    const writer = writable.getWriter();
    const encoder = new TextEncoder();
    let fullSolution = '';

    (async () => {
      const reader = response.body?.getReader();
      if (!reader) return;

      const decoder = new TextDecoder();
      let buffer = '';

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const jsonStr = line.slice(6).trim();
              if (!jsonStr || jsonStr === '[DONE]') continue;

              try {
                const parsed = JSON.parse(jsonStr);
                const text = parsed.candidates?.[0]?.content?.parts?.[0]?.text;
                
                if (text) {
                  fullSolution += text;
                  // Convert to OpenAI-compatible format
                  const openAIFormat = {
                    choices: [{ delta: { content: text } }]
                  };
                  await writer.write(encoder.encode(`data: ${JSON.stringify(openAIFormat)}\n\n`));
                }
              } catch {
                // Skip malformed JSON
              }
            }
          }
        }

        // Process remaining buffer
        if (buffer.startsWith('data: ')) {
          const jsonStr = buffer.slice(6).trim();
          if (jsonStr && jsonStr !== '[DONE]') {
            try {
              const parsed = JSON.parse(jsonStr);
              const text = parsed.candidates?.[0]?.content?.parts?.[0]?.text;
              if (text) {
                fullSolution += text;
                const openAIFormat = {
                  choices: [{ delta: { content: text } }]
                };
                await writer.write(encoder.encode(`data: ${JSON.stringify(openAIFormat)}\n\n`));
              }
            } catch {
              // Skip malformed JSON
            }
          }
        }

        await writer.write(encoder.encode('data: [DONE]\n\n'));

        // Save to cache after successful generation
        if (fullSolution.length > 100) {
          console.log(`Caching solution for problem ${problemId} in ${language}`);
          await supabase
            .from('ai_solution_cache')
            .upsert({
              problem_id: cacheKey,
              problem_title: problemTitle,
              language: language,
              solution: fullSolution,
              usage_count: 1,
            }, {
              onConflict: 'problem_id,language',
            });
        }
      } catch (error) {
        console.error('Stream processing error:', error);
      } finally {
        await writer.close();
      }
    })();

    return new Response(readable, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'X-Cache': 'MISS',
      },
    });
  } catch (error: unknown) {
    console.error('Error in ai-solver function:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
