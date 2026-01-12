import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/contexts/AuthContext";
import { useLeetCode } from "@/hooks/useLeetCode";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  CheckCircle2,
  ExternalLink,
  Loader2,
  Link2,
  RefreshCw,
  AlertCircle,
  Copy,
} from "lucide-react";

export function LeetCodeVerification() {
  const { profile } = useAuth();
  const { loading, startVerification, completeVerification, syncStats } = useLeetCode();
  const { toast } = useToast();
  
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<"username" | "verify" | "complete">("username");
  const [username, setUsername] = useState(profile?.leetcode_username || "");
  const [token, setToken] = useState("");
  const [instruction, setInstruction] = useState("");

  const [currentName, setCurrentName] = useState("");

  const handleStartVerification = async () => {
    if (!username.trim()) {
      toast({
        variant: "destructive",
        title: "Username required",
        description: "Please enter your LeetCode username",
      });
      return;
    }

    const result = await startVerification(username.trim());
    
    if (result.success && result.token) {
      setToken(result.token);
      setInstruction(result.instruction || "");
      setCurrentName(result.currentName || "");
      setStep("verify");
    } else {
      toast({
        variant: "destructive",
        title: "Verification failed",
        description: result.message || "Could not start verification",
      });
    }
  };

  const handleCompleteVerification = async () => {
    const result = await completeVerification(token);
    
    if (result.verified) {
      setStep("complete");
      setTimeout(() => {
        setOpen(false);
        setStep("username");
      }, 2000);
    } else {
      toast({
        variant: "destructive",
        title: "Not verified",
        description: result.message || "Token not found in your profile",
      });
    }
  };

  const copyToken = () => {
    navigator.clipboard.writeText(token);
    toast({
      title: "Copied!",
      description: "Token copied to clipboard",
    });
  };

  const handleSync = async () => {
    await syncStats();
  };

  if (profile?.leetcode_verified) {
    return (
      <div className="bg-card rounded-xl border border-border shadow-card p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-foreground">LeetCode Account</h3>
          <Badge variant="success" className="gap-1">
            <CheckCircle2 className="h-3 w-3" />
            Verified
          </Badge>
        </div>
        <div className="flex items-center justify-between">
          <div>
            <p className="font-medium text-foreground">{profile.leetcode_username}</p>
            <p className="text-sm text-muted-foreground">
              Last synced: {profile.last_stats_sync 
                ? new Date(profile.last_stats_sync).toLocaleDateString() 
                : "Never"}
            </p>
          </div>
          <Button 
            variant="outline" 
            size="sm" 
            className="gap-2"
            onClick={handleSync}
            disabled={loading}
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            Sync Stats
          </Button>
        </div>
      </div>
    );
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <div className="bg-card rounded-xl border border-border shadow-card p-6 cursor-pointer hover:border-primary/50 transition-colors">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-foreground">LeetCode Account</h3>
            <Badge variant="warning" className="gap-1">
              <AlertCircle className="h-3 w-3" />
              Not Connected
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground mb-4">
            Connect your LeetCode account to verify your problem solutions and sync your stats.
          </p>
          <Button className="w-full gap-2">
            <Link2 className="h-4 w-4" />
            Connect LeetCode
          </Button>
        </div>
      </DialogTrigger>
      
      <DialogContent className="sm:max-w-md">
        {step === "username" && (
          <>
            <DialogHeader>
              <DialogTitle>Connect LeetCode Account</DialogTitle>
              <DialogDescription>
                Enter your LeetCode username to start the verification process.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 pt-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">LeetCode Username</label>
                <input
                  type="text"
                  placeholder="your_username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full px-4 py-3 rounded-lg bg-muted border border-border text-foreground placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                />
              </div>
              <Button 
                className="w-full" 
                onClick={handleStartVerification}
                disabled={loading}
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  "Continue"
                )}
              </Button>
            </div>
          </>
        )}

        {step === "verify" && (
          <>
            <DialogHeader>
              <DialogTitle>Verify Ownership</DialogTitle>
              <DialogDescription>
                Temporarily change your LeetCode display name to verify your account.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 pt-4">
              {currentName && (
                <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3">
                  <p className="text-xs text-amber-600 dark:text-amber-400 font-medium mb-1">Your current LeetCode display name:</p>
                  <p className="font-semibold text-foreground">{currentName}</p>
                </div>
              )}
              
              <div className="bg-primary/10 border border-primary/30 rounded-lg p-4">
                <p className="text-sm text-primary font-medium mb-2">Change it to this token:</p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 bg-background rounded px-3 py-2 font-mono text-lg text-primary font-bold">
                    {token}
                  </code>
                  <Button variant="outline" size="icon" onClick={copyToken}>
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              
              <div className="text-sm text-muted-foreground space-y-1.5">
                <p>1. Click "Open LeetCode" → go to Profile settings</p>
                <p>2. Replace your <strong>Name</strong> with the token above</p>
                <p>3. Save changes and click "Verify"</p>
              </div>
              
              <p className="text-xs text-muted-foreground bg-muted/50 rounded-lg p-2 text-center">
                ✨ After verification, you can change your name back to <strong>{currentName || "your original name"}</strong>
              </p>

              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  className="flex-1 gap-2"
                  onClick={() => window.open("https://leetcode.com/profile/", "_blank")}
                >
                  <ExternalLink className="h-4 w-4" />
                  Open LeetCode
                </Button>
                <Button 
                  className="flex-1"
                  onClick={handleCompleteVerification}
                  disabled={loading}
                >
                  {loading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    "Verify"
                  )}
                </Button>
              </div>
            </div>
          </>
        )}

        {step === "complete" && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-success">
                <CheckCircle2 className="h-5 w-5" />
                Verified!
              </DialogTitle>
              <DialogDescription>
                Your LeetCode account has been connected successfully.
              </DialogDescription>
            </DialogHeader>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
