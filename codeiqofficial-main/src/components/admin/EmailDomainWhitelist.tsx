import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Plus, Trash2, Edit, Loader2, Globe, Sparkles, StickyNote, Building2, RotateCcw, Brain, Percent, Package } from "lucide-react";
import { DomainPlansManager } from "./DomainPlansManager";

interface EmailDomain {
  id: string;
  domain: string;
  features: {
    all_features?: boolean;
    ai_solver?: boolean;
    notes?: boolean;
    company_wise?: boolean;
    revision?: boolean;
  };
  description: string | null;
  is_active: boolean;
  discount_percent: number;
  created_at: string;
}

const AVAILABLE_FEATURES = [
  { key: "all_features", label: "All Features (Pro Access)", icon: Sparkles, description: "Full pro access to everything" },
  { key: "ai_solver", label: "AI Solver", icon: Brain, description: "AI-powered solution explanations" },
  { key: "notes", label: "Problem Notes", icon: StickyNote, description: "Personal notes on problems" },
  { key: "company_wise", label: "Company-wise Problems", icon: Building2, description: "Access to company tagged problems" },
  { key: "revision", label: "Revision System", icon: RotateCcw, description: "Spaced repetition for review" },
];

export function EmailDomainWhitelist() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingDomain, setEditingDomain] = useState<EmailDomain | null>(null);
  const [selectedDomainId, setSelectedDomainId] = useState<string | null>(null);
  const [showPlansManager, setShowPlansManager] = useState(false);
  
  const [form, setForm] = useState({
    domain: "",
    description: "",
    features: {} as Record<string, boolean>,
    discount_percent: 0,
  });

  const { data: domains = [], isLoading } = useQuery({
    queryKey: ["email-domain-whitelist"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("email_domain_whitelist")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as EmailDomain[];
    },
  });

  // Fetch plan counts for all domains
  const { data: planCounts = {} } = useQuery({
    queryKey: ["domain-plan-counts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("domain_plans")
        .select("domain_id, is_active");

      if (error) throw error;
      
      const counts: Record<string, { total: number; active: number }> = {};
      data?.forEach((plan) => {
        if (!counts[plan.domain_id]) {
          counts[plan.domain_id] = { total: 0, active: 0 };
        }
        counts[plan.domain_id].total++;
        if (plan.is_active) {
          counts[plan.domain_id].active++;
        }
      });
      return counts;
    },
  });

  const saveDomain = useMutation({
    mutationFn: async (isEdit: boolean) => {
      const domainData = {
        domain: form.domain.toLowerCase().trim().replace(/^@/, ""),
        description: form.description.trim() || null,
        features: form.features,
        discount_percent: form.discount_percent,
        is_active: true,
        created_by: user?.id,
      };

      if (isEdit && editingDomain) {
        const { error } = await supabase
          .from("email_domain_whitelist")
          .update(domainData)
          .eq("id", editingDomain.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("email_domain_whitelist")
          .insert(domainData);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["email-domain-whitelist"] });
      setDialogOpen(false);
      resetForm();
      toast.success(editingDomain ? "Domain updated" : "Domain added");
    },
    onError: (error: any) => {
      toast.error(error.message?.includes("duplicate") ? "Domain already exists" : "Failed to save domain");
    },
  });

  const toggleDomainActive = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      const { error } = await supabase
        .from("email_domain_whitelist")
        .update({ is_active: isActive })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["email-domain-whitelist"] });
      toast.success("Domain status updated");
    },
  });

  const deleteDomain = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("email_domain_whitelist")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["email-domain-whitelist"] });
      toast.success("Domain deleted");
    },
  });

  const resetForm = () => {
    setForm({ domain: "", description: "", features: {}, discount_percent: 0 });
    setEditingDomain(null);
  };

  const openEditDialog = (domain: EmailDomain) => {
    setEditingDomain(domain);
    setForm({
      domain: domain.domain,
      description: domain.description || "",
      features: domain.features || {},
      discount_percent: domain.discount_percent || 0,
    });
    setDialogOpen(true);
  };

  const toggleFeature = (key: string) => {
    setForm(prev => ({
      ...prev,
      features: {
        ...prev.features,
        [key]: !prev.features[key],
      },
    }));
  };

  const getEnabledFeatures = (features: EmailDomain["features"]) => {
    if (!features) return [];
    return Object.entries(features)
      .filter(([_, enabled]) => enabled)
      .map(([key]) => AVAILABLE_FEATURES.find(f => f.key === key)?.label || key);
  };

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="font-semibold text-lg flex items-center gap-2">
            <Globe className="h-5 w-5" />
            Email Domain Whitelist
          </h3>
          <p className="text-sm text-muted-foreground">
            Users with these email domains get free access to selected features
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) resetForm();
        }}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              Add Domain
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>{editingDomain ? "Edit Domain" : "Add Domain Whitelist"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label>Email Domain</Label>
                <Input
                  value={form.domain}
                  onChange={(e) => setForm({ ...form, domain: e.target.value })}
                  placeholder="example.edu.in"
                />
                <p className="text-xs text-muted-foreground">
                  Users with @{form.domain || "domain"} emails will get access
                </p>
              </div>

              <div className="space-y-2">
                <Label>Description (optional)</Label>
                <Input
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="e.g., College name or organization"
                />
              </div>

              <div className="space-y-3">
                <Label>Features to Enable</Label>
                <div className="space-y-2">
                  {AVAILABLE_FEATURES.map((feature) => (
                    <div
                      key={feature.key}
                      className={`flex items-center space-x-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                        form.features[feature.key] ? "bg-primary/10 border-primary" : "hover:bg-muted"
                      }`}
                      onClick={() => toggleFeature(feature.key)}
                    >
                      <Checkbox
                        checked={form.features[feature.key] || false}
                        onCheckedChange={() => toggleFeature(feature.key)}
                      />
                      <feature.icon className="h-4 w-4 text-muted-foreground" />
                      <div className="flex-1">
                        <p className="text-sm font-medium">{feature.label}</p>
                        <p className="text-xs text-muted-foreground">{feature.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Percent className="h-4 w-4" />
                  Discount Percentage
                </Label>
                <Input
                  type="number"
                  min="0"
                  max="100"
                  value={form.discount_percent}
                  onChange={(e) => setForm({ ...form, discount_percent: Math.min(100, Math.max(0, parseInt(e.target.value) || 0)) })}
                  placeholder="0"
                />
                <p className="text-xs text-muted-foreground">
                  {form.discount_percent > 0 
                    ? `Users will get ${form.discount_percent}% off automatically applied at checkout`
                    : "No automatic discount (set 100 for free access)"}
                </p>
              </div>

              <Button
                className="w-full"
                onClick={() => saveDomain.mutate(!!editingDomain)}
                disabled={saveDomain.isPending || !form.domain.trim() || Object.values(form.features).filter(Boolean).length === 0}
              >
                {saveDomain.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : editingDomain ? "Update Domain" : "Add Domain"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : domains.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          <Globe className="h-12 w-12 mx-auto mb-3 opacity-50" />
          <p>No domains configured yet</p>
          <p className="text-sm">Add a domain to give users free access to features</p>
        </div>
      ) : (
        <div className="space-y-3">
          {domains.map((domain) => (
            <div
              key={domain.id}
              className={`p-4 rounded-lg border ${domain.is_active ? "bg-card" : "bg-muted/50 opacity-60"} ${selectedDomainId === domain.id ? "ring-2 ring-primary" : ""}`}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <code className="text-lg font-semibold text-primary">@{domain.domain}</code>
                    {!domain.is_active && <Badge variant="secondary">Disabled</Badge>}
                  </div>
                  {domain.description && (
                    <p className="text-sm text-muted-foreground mb-2">{domain.description}</p>
                  )}
                  <div className="flex flex-wrap gap-1 mb-2">
                    {getEnabledFeatures(domain.features).map((feature) => (
                      <Badge key={feature} variant="outline" className="text-xs">
                        {feature}
                      </Badge>
                    ))}
                  </div>
                  {domain.discount_percent > 0 && (
                    <Badge variant="secondary" className="text-xs bg-success/10 text-success border-success/30">
                      <Percent className="h-3 w-3 mr-1" />
                      {domain.discount_percent}% discount auto-applied
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Button 
                    variant={selectedDomainId === domain.id && showPlansManager ? "default" : "outline"} 
                    size="sm"
                    onClick={() => {
                      setSelectedDomainId(domain.id);
                      setShowPlansManager(true);
                    }}
                    className="gap-1"
                  >
                    <Package className="h-3 w-3" />
                    {planCounts[domain.id]?.active 
                      ? `${planCounts[domain.id].active} Plan${planCounts[domain.id].active > 1 ? 's' : ''}` 
                      : "Add Pricing"}
                  </Button>
                  <Switch
                    checked={domain.is_active}
                    onCheckedChange={(checked) => toggleDomainActive.mutate({ id: domain.id, isActive: checked })}
                  />
                  <Button variant="ghost" size="icon" onClick={() => openEditDialog(domain)}>
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-destructive hover:text-destructive"
                    onClick={() => {
                      if (confirm(`Delete domain @${domain.domain}?`)) {
                        deleteDomain.mutate(domain.id);
                      }
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Domain Plans Manager */}
      {showPlansManager && (
        <div className="mt-6">
          <DomainPlansManager 
            selectedDomainId={selectedDomainId} 
            domains={domains.map(d => ({ id: d.id, domain: d.domain, description: d.description }))}
          />
        </div>
      )}
    </Card>
  );
}
