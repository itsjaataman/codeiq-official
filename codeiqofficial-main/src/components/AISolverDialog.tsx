import { useState, useCallback, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useAuth } from "@/contexts/AuthContext";
import { usePaymentAccess } from "@/hooks/usePaymentAccess";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { LanguageSelectionDialog } from "./LanguageSelectionDialog";
import { AIGeneratingAnimation } from "./AIGeneratingAnimation";
import { FeatureLockOverlay } from "./FeatureLockOverlay";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";
import {
  Loader2,
  Copy,
  Save,
  RefreshCw,
  Bot,
  Settings,
  CheckCircle2,
  History,
  Sparkles,
} from "lucide-react";

interface AISolverDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  problemId: string;
  problemTitle: string;
  leetcodeId?: number | null;
  onNotesSaved?: () => void;
}

const languageNames: Record<string, string> = {
  java: "Java",
  python: "Python",
  cpp: "C++",
  c: "C",
};

export function AISolverDialog({
  open,
  onOpenChange,
  problemId,
  problemTitle,
  leetcodeId,
  onNotesSaved,
}: AISolverDialogProps) {
  const { user, profile } = useAuth();
  const { hasAiSolver, paidFeaturesEnabled } = usePaymentAccess();
  const [showLanguageDialog, setShowLanguageDialog] = useState(false);
  const [solution, setSolution] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isCheckingCache, setIsCheckingCache] = useState(false);
  const [hasGenerated, setHasGenerated] = useState(false);
  const [isCached, setIsCached] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isCopied, setIsCopied] = useState(false);

  const currentLanguage = profile?.preferred_dsa_language;

  // Check for cached solution when dialog opens
  useEffect(() => {
    if (open && user && currentLanguage) {
      checkCachedSolution();
    }
  }, [open, user, currentLanguage, problemId]);

  const checkCachedSolution = async () => {
    if (!user) return;

    setIsCheckingCache(true);
    try {
      const { data } = await supabase
        .from("user_problem_progress")
        .select("ai_solution, ai_solution_language")
        .eq("user_id", user.id)
        .eq("problem_id", problemId)
        .maybeSingle();

      if (data?.ai_solution && data?.ai_solution_language === currentLanguage) {
        setSolution(data.ai_solution);
        setHasGenerated(true);
        setIsCached(true);
      }
    } catch (error) {
      console.error("Error checking cached solution:", error);
    } finally {
      setIsCheckingCache(false);
    }
  };

  const saveSolutionToCache = async (solutionText: string, language: string) => {
    if (!user) return;

    try {
      const { data: existing } = await supabase
        .from("user_problem_progress")
        .select("id")
        .eq("user_id", user.id)
        .eq("problem_id", problemId)
        .maybeSingle();

      if (existing) {
        await supabase
          .from("user_problem_progress")
          .update({
            ai_solution: solutionText,
            ai_solution_language: language,
          })
          .eq("id", existing.id);
      } else {
        await supabase.from("user_problem_progress").insert({
          user_id: user.id,
          problem_id: problemId,
          status: "unsolved",
          ai_solution: solutionText,
          ai_solution_language: language,
        });
      }
    } catch (error) {
      console.error("Error caching solution:", error);
    }
  };

  const streamSolution = useCallback(async (language: string) => {
    setIsLoading(true);
    setSolution("");
    setHasGenerated(true);
    setIsCached(false);

    let fullSolution = "";

    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-solver`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({
            problemId: leetcodeId || problemId,
            problemTitle,
            language,
          }),
        }
      );

      if (!response.ok) {
        if (response.status === 429) {
          let msg = "AI quota exceeded. Please try again later.";
          try {
            const err = await response.json();
            msg = err?.message || err?.error || msg;
          } catch {
            // ignore
          }
          toast.error(msg);
          setIsLoading(false);
          return;
        }
        const errorData = await response.json();
        throw new Error(errorData.error || errorData.message || "Failed to generate solution");
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error("No response body");

      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        // Process line by line
        let newlineIndex: number;
        while ((newlineIndex = buffer.indexOf("\n")) !== -1) {
          let line = buffer.slice(0, newlineIndex);
          buffer = buffer.slice(newlineIndex + 1);

          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (line.startsWith(":") || line.trim() === "") continue;
          if (!line.startsWith("data: ")) continue;

          const jsonStr = line.slice(6).trim();
          if (jsonStr === "[DONE]") continue;

          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) {
              fullSolution += content;
              setSolution((prev) => prev + content);
            }
          } catch {
            // Incomplete JSON, put it back
            buffer = line + "\n" + buffer;
            break;
          }
        }
      }

      // Process remaining buffer
      if (buffer.trim()) {
        for (let raw of buffer.split("\n")) {
          if (!raw) continue;
          if (raw.endsWith("\r")) raw = raw.slice(0, -1);
          if (raw.startsWith(":") || raw.trim() === "") continue;
          if (!raw.startsWith("data: ")) continue;
          const jsonStr = raw.slice(6).trim();
          if (jsonStr === "[DONE]") continue;
          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) {
              fullSolution += content;
              setSolution((prev) => prev + content);
            }
          } catch { /* ignore */ }
        }
      }

      // Save solution to cache after successful generation
      if (fullSolution) {
        await saveSolutionToCache(fullSolution, language);
      }
    } catch (error: any) {
      console.error("Error streaming solution:", error);
      toast.error(error.message || "Failed to generate solution");
    } finally {
      setIsLoading(false);
    }
  }, [leetcodeId, problemId, problemTitle, user]);

  const handleGenerate = () => {
    if (!currentLanguage) {
      setShowLanguageDialog(true);
    } else {
      streamSolution(currentLanguage);
    }
  };

  const handleLanguageSelected = (language: string) => {
    // When language changes, always generate new solution
    streamSolution(language);
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(solution);
      setIsCopied(true);
      toast.success("Solution copied to clipboard!");
      setTimeout(() => setIsCopied(false), 2000);
    } catch {
      toast.error("Failed to copy");
    }
  };

  const handleSaveAsNotes = async () => {
    if (!user || !solution) return;

    setIsSaving(true);
    try {
      // First check if progress exists
      const { data: existing } = await supabase
        .from("user_problem_progress")
        .select("id, notes")
        .eq("user_id", user.id)
        .eq("problem_id", problemId)
        .maybeSingle();

      const notesHeader = `## AI Solution (${languageNames[currentLanguage || "python"]})\n\n`;
      const newNotes = notesHeader + solution;

      if (existing) {
        // Update existing
        const combinedNotes = existing.notes 
          ? existing.notes + "\n\n---\n\n" + newNotes 
          : newNotes;

        const { error } = await supabase
          .from("user_problem_progress")
          .update({ notes: combinedNotes })
          .eq("id", existing.id);

        if (error) throw error;
      } else {
        // Create new progress entry
        const { error } = await supabase
          .from("user_problem_progress")
          .insert({
            user_id: user.id,
            problem_id: problemId,
            status: "in_progress",
            notes: newNotes,
          });

        if (error) throw error;
      }

      toast.success("Solution saved to notes!");
      onNotesSaved?.();
    } catch (error: any) {
      console.error("Error saving notes:", error);
      toast.error("Failed to save notes");
    } finally {
      setIsSaving(false);
    }
  };

  const handleRegenerate = () => {
    if (currentLanguage) {
      streamSolution(currentLanguage);
    }
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      // Reset state when closing
      setSolution("");
      setHasGenerated(false);
      setIsCached(false);
    }
    onOpenChange(newOpen);
  };

  // Check if user has AI solver access
  const hasAiAccess = !paidFeaturesEnabled || hasAiSolver;

  // If locked, show upgrade prompt
  if (!hasAiAccess) {
    return (
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Bot className="h-5 w-5 text-primary" />
              AI Problem Solver
            </DialogTitle>
          </DialogHeader>
          <FeatureLockOverlay
            featureName="Unlock AI Solver"
            featureDescription="Get step-by-step AI-powered solutions with intuition, approach, code, and complexity analysis."
            icon={<Bot className="h-8 w-8 text-primary" />}
            onClose={() => handleOpenChange(false)}
          />
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="sm:max-w-4xl max-h-[90vh] flex flex-col">
          <DialogHeader className="flex-shrink-0">
            <DialogTitle className="flex items-center gap-2">
              <Bot className="h-5 w-5 text-primary" />
              AI Problem Solver
              {isCached && (
                <Badge variant="outline" className="ml-2 gap-1 text-xs">
                  <History className="h-3 w-3" />
                  Cached
                </Badge>
              )}
            </DialogTitle>
            <div className="flex items-center gap-2 mt-2">
              <Badge variant="secondary">{problemTitle}</Badge>
              {currentLanguage && (
                <Badge variant="outline" className="gap-1">
                  {languageNames[currentLanguage]}
                  <button
                    onClick={() => setShowLanguageDialog(true)}
                    className="ml-1 hover:text-primary"
                  >
                    <Settings className="h-3 w-3" />
                  </button>
                </Badge>
              )}
            </div>
          </DialogHeader>

          <div className="flex-1 min-h-0">
            {isCheckingCache ? (
              <div className="flex items-center gap-3 py-12 justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
                <span className="text-muted-foreground">Loading...</span>
              </div>
            ) : !hasGenerated ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="relative mb-6">
                  <div className="absolute inset-0 bg-primary/20 blur-xl rounded-full" />
                  <Sparkles className="h-16 w-16 text-primary relative z-10" />
                </div>
                <h3 className="text-lg font-semibold mb-2">
                  Ready to solve this problem?
                </h3>
                <p className="text-muted-foreground mb-6 max-w-md">
                  Click the button below to generate a step-by-step solution with 
                  intuition, approach, code, and complexity analysis.
                </p>
                <Button size="lg" onClick={handleGenerate} className="gap-2">
                  <Bot className="h-5 w-5" />
                  Generate Solution
                </Button>
              </div>
            ) : (
              <ScrollArea className="h-[50vh] pr-4">
                <div className="prose prose-sm dark:prose-invert max-w-none">
                  {isLoading && !solution && (
                    <AIGeneratingAnimation />
                  )}
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    components={{
                      code({ node, className, children, ...props }) {
                        const match = /language-(\w+)/.exec(className || "");
                        const isInline = !match;
                        
                        if (isInline) {
                          return (
                            <code className="bg-muted px-1.5 py-0.5 rounded text-sm" {...props}>
                              {children}
                            </code>
                          );
                        }

                        return (
                          <SyntaxHighlighter
                            style={oneDark}
                            language={match[1]}
                            PreTag="div"
                            className="rounded-lg !my-4"
                          >
                            {String(children).replace(/\n$/, "")}
                          </SyntaxHighlighter>
                        );
                      },
                    }}
                  >
                    {solution}
                  </ReactMarkdown>
                  {isLoading && solution && (
                    <div className="inline-flex items-center gap-1 text-primary">
                      <span className="animate-pulse">▌</span>
                    </div>
                  )}
                </div>
              </ScrollArea>
            )}
          </div>

          {hasGenerated && solution && !isLoading && (
            <div className="flex items-center justify-between gap-3 pt-4 border-t flex-shrink-0">
              <Button variant="outline" onClick={handleRegenerate} className="gap-2">
                <RefreshCw className="h-4 w-4" />
                Regenerate
              </Button>
              <div className="flex gap-2">
                <Button variant="outline" onClick={handleCopy} className="gap-2">
                  {isCopied ? (
                    <>
                      <CheckCircle2 className="h-4 w-4 text-success" />
                      Copied!
                    </>
                  ) : (
                    <>
                      <Copy className="h-4 w-4" />
                      Copy
                    </>
                  )}
                </Button>
                <Button onClick={handleSaveAsNotes} disabled={isSaving} className="gap-2">
                  {isSaving ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4" />
                      Save as Notes
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <LanguageSelectionDialog
        open={showLanguageDialog}
        onOpenChange={setShowLanguageDialog}
        onLanguageSelected={handleLanguageSelected}
      />
    </>
  );
}
