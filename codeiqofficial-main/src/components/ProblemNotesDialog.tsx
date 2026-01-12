import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { usePaymentAccess } from "@/hooks/usePaymentAccess";
import { FeatureLockOverlay } from "./FeatureLockOverlay";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { StickyNote, Save, Loader2, Trash2, Eye, Edit3, Lock } from "lucide-react";

interface ProblemNotesDialogProps {
  problemId: string;
  problemTitle: string;
  existingNotes?: string | null;
  hasProgress?: boolean;
}

export function ProblemNotesDialog({
  problemId,
  problemTitle,
  existingNotes,
  hasProgress,
}: ProblemNotesDialogProps) {
  const { user } = useAuth();
  const { hasNotes, paidFeaturesEnabled } = usePaymentAccess();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [notes, setNotes] = useState(existingNotes || "");
  const [activeTab, setActiveTab] = useState<string>(existingNotes?.trim() ? "preview" : "edit");

  // Check if user has notes access OR if paid features are disabled (free platform mode)
  const hasNotesAccess = !paidFeaturesEnabled || hasNotes;

  const saveNotes = useMutation({
    mutationFn: async (newNotes: string) => {
      if (!user) throw new Error("Not authenticated");

      if (hasProgress) {
        const { error } = await supabase
          .from("user_problem_progress")
          .update({ notes: newNotes || null })
          .eq("user_id", user.id)
          .eq("problem_id", problemId);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("user_problem_progress")
          .insert({
            user_id: user.id,
            problem_id: problemId,
            notes: newNotes || null,
            status: "unsolved",
          });

        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user-progress"] });
      toast.success("Notes saved successfully");
      setOpen(false);
    },
    onError: (error) => {
      console.error("Failed to save notes:", error);
      toast.error("Failed to save notes");
    },
  });

  const deleteNotes = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Not authenticated");

      const { error } = await supabase
        .from("user_problem_progress")
        .update({ notes: null })
        .eq("user_id", user.id)
        .eq("problem_id", problemId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user-progress"] });
      setNotes("");
      toast.success("Notes deleted");
      setOpen(false);
    },
    onError: (error) => {
      console.error("Failed to delete notes:", error);
      toast.error("Failed to delete notes");
    },
  });

  const handleSave = () => {
    saveNotes.mutate(notes.trim());
  };

  const handleDelete = () => {
    if (confirm("Are you sure you want to delete these notes?")) {
      deleteNotes.mutate();
    }
  };

  const hasExistingNotes = !!existingNotes?.trim();

  // If user doesn't have notes access, show locked state
  if (!hasNotesAccess) {
    return (
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="relative h-8 w-8 text-muted-foreground"
            title="Pro feature: Add notes"
          >
            <StickyNote className="h-4 w-4" />
            <Lock className="absolute -top-1 -right-1 h-3 w-3 text-primary" />
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <StickyNote className="h-5 w-5 text-primary" />
              Problem Notes
            </DialogTitle>
          </DialogHeader>
          <FeatureLockOverlay
            featureName="Unlock Notes Feature"
            featureDescription="Add personal notes to problems with Markdown support, code syntax highlighting, and more."
            icon={<StickyNote className="h-8 w-8 text-primary" />}
            onClose={() => setOpen(false)}
          />
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={`relative h-8 w-8 ${hasExistingNotes ? "text-primary" : "text-muted-foreground"}`}
          title={hasExistingNotes ? "View notes" : "Add notes"}
        >
          <StickyNote className="h-4 w-4" />
          {hasExistingNotes && (
            <span className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-primary" />
          )}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <StickyNote className="h-5 w-5 text-primary" />
            Problem Notes
          </DialogTitle>
          <Badge variant="secondary" className="w-fit text-xs mt-2">
            {problemTitle}
          </Badge>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col min-h-0">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="edit" className="gap-2">
              <Edit3 className="h-4 w-4" />
              Edit
            </TabsTrigger>
            <TabsTrigger value="preview" className="gap-2">
              <Eye className="h-4 w-4" />
              Preview
            </TabsTrigger>
          </TabsList>

          <TabsContent value="edit" className="flex-1 mt-4 min-h-0">
            <Textarea
              placeholder={`Write your notes in Markdown...

## Approach
Use two pointers technique

## Time Complexity
O(n)

## Code
\`\`\`python
def solution(nums):
    left, right = 0, len(nums) - 1
    while left < right:
        # logic here
        pass
\`\`\`

## Key Insights
- Edge case: empty array
- Remember to handle duplicates`}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="min-h-[300px] h-full resize-none font-mono text-sm"
            />
          </TabsContent>

          <TabsContent value="preview" className="flex-1 mt-4 min-h-0 overflow-auto">
            <div className="prose prose-sm dark:prose-invert max-w-none p-4 bg-muted/30 rounded-lg min-h-[300px] overflow-auto">
              {notes.trim() ? (
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  components={{
                    code({ node, className, children, ...props }) {
                      const match = /language-(\w+)/.exec(className || "");
                      const isInline = !match && !className;
                      
                      if (isInline) {
                        return (
                          <code 
                            className="bg-muted px-1.5 py-0.5 rounded text-sm font-mono text-primary"
                            {...props}
                          >
                            {children}
                          </code>
                        );
                      }
                      
                      return (
                        <SyntaxHighlighter
                          style={oneDark}
                          language={match ? match[1] : "text"}
                          PreTag="div"
                          className="rounded-lg !my-4 text-sm"
                          showLineNumbers
                          customStyle={{
                            margin: 0,
                            borderRadius: "0.5rem",
                          }}
                        >
                          {String(children).replace(/\n$/, "")}
                        </SyntaxHighlighter>
                      );
                    },
                    h1: ({ children }) => (
                      <h1 className="text-xl font-bold text-foreground border-b border-border pb-2 mb-4">
                        {children}
                      </h1>
                    ),
                    h2: ({ children }) => (
                      <h2 className="text-lg font-semibold text-foreground mt-6 mb-3">
                        {children}
                      </h2>
                    ),
                    h3: ({ children }) => (
                      <h3 className="text-base font-semibold text-foreground mt-4 mb-2">
                        {children}
                      </h3>
                    ),
                    p: ({ children }) => (
                      <p className="text-muted-foreground mb-3 leading-relaxed">
                        {children}
                      </p>
                    ),
                    ul: ({ children }) => (
                      <ul className="list-disc list-inside text-muted-foreground mb-3 space-y-1">
                        {children}
                      </ul>
                    ),
                    ol: ({ children }) => (
                      <ol className="list-decimal list-inside text-muted-foreground mb-3 space-y-1">
                        {children}
                      </ol>
                    ),
                    blockquote: ({ children }) => (
                      <blockquote className="border-l-4 border-primary pl-4 italic text-muted-foreground my-4">
                        {children}
                      </blockquote>
                    ),
                    a: ({ href, children }) => (
                      <a 
                        href={href} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-primary hover:underline"
                      >
                        {children}
                      </a>
                    ),
                    table: ({ children }) => (
                      <div className="overflow-x-auto my-4">
                        <table className="min-w-full border border-border rounded-lg">
                          {children}
                        </table>
                      </div>
                    ),
                    th: ({ children }) => (
                      <th className="border border-border bg-muted px-3 py-2 text-left font-semibold text-foreground">
                        {children}
                      </th>
                    ),
                    td: ({ children }) => (
                      <td className="border border-border px-3 py-2 text-muted-foreground">
                        {children}
                      </td>
                    ),
                  }}
                >
                  {notes}
                </ReactMarkdown>
              ) : (
                <p className="text-muted-foreground italic">
                  Start typing in the Edit tab to see your notes rendered here...
                </p>
              )}
            </div>
          </TabsContent>
        </Tabs>

        <div className="flex items-center justify-between pt-4 border-t border-border mt-4">
          <div className="text-xs text-muted-foreground">
            Supports Markdown with syntax highlighting
          </div>
          <div className="flex gap-2">
            {hasExistingNotes && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleDelete}
                disabled={deleteNotes.isPending}
                className="text-destructive hover:text-destructive"
              >
                {deleteNotes.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4" />
                )}
                <span className="ml-2">Delete</span>
              </Button>
            )}
            <Button
              onClick={handleSave}
              disabled={saveNotes.isPending}
              size="sm"
            >
              {saveNotes.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              <span className="ml-2">Save Notes</span>
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
