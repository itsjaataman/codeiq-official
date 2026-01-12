import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

interface LanguageSelectionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onLanguageSelected: (language: string) => void;
}

const languages = [
  { id: "java", name: "Java", icon: "☕", description: "Object-oriented, verbose but clear" },
  { id: "cpp", name: "C++", icon: "⚡", description: "Fast, powerful STL" },
  { id: "c", name: "C", icon: "🔧", description: "Low-level, efficient" },
  { id: "csharp", name: "C#", icon: "🎯", description: ".NET ecosystem, modern syntax" },
  { id: "python", name: "Python", icon: "🐍", description: "Concise and readable (Python 2)" },
  { id: "python3", name: "Python3", icon: "🐍", description: "Modern Python, recommended" },
];

export function LanguageSelectionDialog({
  open,
  onOpenChange,
  onLanguageSelected,
}: LanguageSelectionDialogProps) {
  const { user, refreshProfile } = useAuth();
  const [selectedLanguage, setSelectedLanguage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!selectedLanguage || !user) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ preferred_dsa_language: selectedLanguage })
        .eq("user_id", user.id);

      if (error) throw error;

      await refreshProfile();
      toast.success("Language preference saved!");
      onLanguageSelected(selectedLanguage);
      onOpenChange(false);
    } catch (error: any) {
      console.error("Error saving language preference:", error);
      toast.error("Failed to save language preference");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Choose Your DSA Language</DialogTitle>
          <DialogDescription>
            Select your preferred programming language for solving DSA problems. 
            You can change this later in Settings.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 py-4">
          {languages.map((lang) => (
            <button
              key={lang.id}
              onClick={() => setSelectedLanguage(lang.id)}
              className={`p-4 rounded-xl border-2 transition-all text-left ${
                selectedLanguage === lang.id
                  ? "border-primary bg-primary/10"
                  : "border-border hover:border-primary/50 hover:bg-muted/50"
              }`}
            >
              <div className="text-2xl mb-2">{lang.icon}</div>
              <div className="font-semibold text-foreground">{lang.name}</div>
              <div className="text-xs text-muted-foreground mt-1">{lang.description}</div>
            </button>
          ))}
        </div>

        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={!selectedLanguage || saving}>
            {saving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              "Continue"
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
