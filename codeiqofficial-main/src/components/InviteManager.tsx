import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Copy, UserPlus, Check, Clock, Users } from "lucide-react";
import { format } from "date-fns";

function generateInviteCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

export function InviteManager() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [copied, setCopied] = useState<string | null>(null);

  const { data: invites = [], isLoading } = useQuery({
    queryKey: ["my-invites", user?.id],
    queryFn: async () => {
      if (!user) return [];

      const { data, error } = await supabase
        .from("invite_codes")
        .select("*")
        .eq("created_by", user.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const createInvite = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Not authenticated");

      const code = generateInviteCode();
      const { error } = await supabase.from("invite_codes").insert({
        code,
        created_by: user.id,
      });

      if (error) throw error;
      return code;
    },
    onSuccess: (code) => {
      queryClient.invalidateQueries({ queryKey: ["my-invites", user?.id] });
      toast.success(`Invite code created: ${code}`);
    },
    onError: (error) => {
      console.error("Failed to create invite:", error);
      toast.error("Failed to create invite code");
    },
  });

  const copyToClipboard = async (code: string) => {
    const inviteUrl = `${window.location.origin}/auth?invite=${code}`;
    await navigator.clipboard.writeText(inviteUrl);
    setCopied(code);
    toast.success("Invite link copied to clipboard!");
    setTimeout(() => setCopied(null), 2000);
  };

  const activeInvites = invites.filter(
    (inv) => !inv.used_by && new Date(inv.expires_at) > new Date()
  );
  const usedInvites = invites.filter((inv) => inv.used_by);

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <Users className="h-5 w-5 text-primary" />
          <h3 className="font-semibold text-foreground">Invite Friends</h3>
        </div>
        <Badge variant="secondary">{activeInvites.length} active</Badge>
      </div>

      <p className="text-sm text-muted-foreground mb-4">
        Generate a unique invite link to share with friends. They'll be able to sign up using your link.
      </p>

      <Button
        onClick={() => createInvite.mutate()}
        disabled={createInvite.isPending}
        className="w-full mb-4"
      >
        <UserPlus className="h-4 w-4 mr-2" />
        {createInvite.isPending ? "Creating..." : "Generate Invite Link"}
      </Button>

      {activeInvites.length > 0 && (
        <div className="mb-4 p-3 rounded-lg bg-primary/5 border border-primary/20">
          <p className="text-xs text-muted-foreground mb-2">Your latest invite link:</p>
          <div className="flex items-center gap-2">
            <Input 
              readOnly 
              value={`${window.location.origin}/auth?invite=${activeInvites[0].code}`}
              className="text-xs font-mono"
            />
            <Button
              variant="outline"
              size="icon"
              onClick={() => copyToClipboard(activeInvites[0].code)}
            >
              {copied === activeInvites[0].code ? (
                <Check className="h-4 w-4 text-success" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>
      )}

      {invites.length > 0 && (
        <div className="space-y-3">
          <h4 className="text-sm font-medium text-foreground">Your Invites</h4>
          {invites.slice(0, 5).map((invite) => {
            const isUsed = !!invite.used_by;
            const isExpired = new Date(invite.expires_at) <= new Date();
            const status = isUsed ? "used" : isExpired ? "expired" : "active";

            return (
              <div
                key={invite.id}
                className="flex items-center justify-between p-3 rounded-lg bg-muted/50 border border-border"
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`h-8 w-8 rounded-lg flex items-center justify-center ${
                      status === "used"
                        ? "bg-success/10 text-success"
                        : status === "expired"
                        ? "bg-muted text-muted-foreground"
                        : "bg-primary/10 text-primary"
                    }`}
                  >
                    {status === "used" ? (
                      <Check className="h-4 w-4" />
                    ) : (
                      <Clock className="h-4 w-4" />
                    )}
                  </div>
                  <div>
                    <p className="font-mono text-sm font-medium">{invite.code}</p>
                    <p className="text-xs text-muted-foreground">
                      {status === "used"
                        ? `Used ${format(new Date(invite.used_at!), "MMM d")}`
                        : status === "expired"
                        ? "Expired"
                        : `Expires ${format(new Date(invite.expires_at), "MMM d")}`}
                    </p>
                  </div>
                </div>
                {status === "active" && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => copyToClipboard(invite.code)}
                  >
                    {copied === invite.code ? (
                      <Check className="h-4 w-4 text-success" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                )}
                {status === "used" && (
                  <Badge variant="secondary" className="text-xs">
                    Redeemed
                  </Badge>
                )}
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}
