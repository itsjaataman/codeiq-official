import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Plus, Trash2, Edit, Loader2, Package, IndianRupee, Calendar, Sparkles, Brain, StickyNote, Building2, RotateCcw, Crown } from "lucide-react";

interface DomainPlan {
  id: string;
  domain_id: string;
  name: string;
  description: string | null;
  price: number;
  duration_days: number;
  features: {
    all_features?: boolean;
    ai_solver?: boolean;
    notes?: boolean;
    company_wise?: boolean;
    revision?: boolean;
  };
  is_combo: boolean;
  is_active: boolean;
  display_order: number;
  created_at: string;
}

interface Domain {
  id: string;
  domain: string;
  description: string | null;
}

const AVAILABLE_FEATURES = [
  { key: "all_features", label: "All Features (Pro)", icon: Crown, description: "Full pro access" },
  { key: "ai_solver", label: "AI Solver", icon: Brain, description: "AI solutions" },
  { key: "notes", label: "Problem Notes", icon: StickyNote, description: "Personal notes" },
  { key: "company_wise", label: "Company Problems", icon: Building2, description: "Company tagged" },
  { key: "revision", label: "Revision System", icon: RotateCcw, description: "Spaced repetition" },
];

const DURATION_OPTIONS = [
  { days: 7, label: "7 Days" },
  { days: 14, label: "14 Days" },
  { days: 30, label: "1 Month" },
  { days: 90, label: "3 Months" },
  { days: 180, label: "6 Months" },
  { days: 365, label: "1 Year" },
  { days: 36500, label: "Lifetime" },
  { days: -1, label: "Custom" },
];

interface Props {
  selectedDomainId: string | null;
  domains: Domain[];
}

export function DomainPlansManager({ selectedDomainId, domains }: Props) {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<DomainPlan | null>(null);
  
  const [form, setForm] = useState({
    name: "",
    description: "",
    price: 0,
    duration_days: 30,
    custom_duration: "",
    is_custom_duration: false,
    features: {} as Record<string, boolean>,
    is_combo: false,
  });

  const { data: plans = [], isLoading } = useQuery({
    queryKey: ["domain-plans", selectedDomainId],
    queryFn: async () => {
      if (!selectedDomainId) return [];
      const { data, error } = await supabase
        .from("domain_plans")
        .select("*")
        .eq("domain_id", selectedDomainId)
        .order("display_order", { ascending: true });

      if (error) throw error;
      return data as DomainPlan[];
    },
    enabled: !!selectedDomainId,
  });

  const savePlan = useMutation({
    mutationFn: async (isEdit: boolean) => {
      const finalDuration = form.is_custom_duration 
        ? Math.max(1, parseInt(form.custom_duration) || 1)
        : form.duration_days;
      
      const planData = {
        domain_id: selectedDomainId,
        name: form.name.trim(),
        description: form.description.trim() || null,
        price: form.price,
        duration_days: finalDuration,
        features: form.features,
        is_combo: form.is_combo,
        is_active: true,
      };

      if (isEdit && editingPlan) {
        const { error } = await supabase
          .from("domain_plans")
          .update(planData)
          .eq("id", editingPlan.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("domain_plans")
          .insert(planData);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["domain-plans", selectedDomainId] });
      setDialogOpen(false);
      resetForm();
      toast.success(editingPlan ? "Plan updated" : "Plan created");
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to save plan");
    },
  });

  const togglePlanActive = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      const { error } = await supabase
        .from("domain_plans")
        .update({ is_active: isActive })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["domain-plans", selectedDomainId] });
      toast.success("Plan status updated");
    },
  });

  const deletePlan = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("domain_plans")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["domain-plans", selectedDomainId] });
      toast.success("Plan deleted");
    },
  });

  const resetForm = () => {
    setForm({ name: "", description: "", price: 0, duration_days: 30, custom_duration: "", is_custom_duration: false, features: {}, is_combo: false });
    setEditingPlan(null);
  };

  const handleDurationChange = (value: string) => {
    const days = parseInt(value);
    if (days === -1) {
      setForm({ ...form, is_custom_duration: true, duration_days: 30 });
    } else {
      setForm({ ...form, is_custom_duration: false, duration_days: days, custom_duration: "" });
    }
  };

  const openEditDialog = (plan: DomainPlan) => {
    const isPreset = DURATION_OPTIONS.some(opt => opt.days === plan.duration_days && opt.days !== -1);
    setEditingPlan(plan);
    setForm({
      name: plan.name,
      description: plan.description || "",
      price: plan.price,
      duration_days: isPreset ? plan.duration_days : 30,
      custom_duration: isPreset ? "" : plan.duration_days.toString(),
      is_custom_duration: !isPreset,
      features: plan.features || {},
      is_combo: plan.is_combo,
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

  const getEnabledFeatures = (features: DomainPlan["features"]) => {
    if (!features) return [];
    return Object.entries(features)
      .filter(([_, enabled]) => enabled)
      .map(([key]) => AVAILABLE_FEATURES.find(f => f.key === key)?.label || key);
  };

  const getDurationLabel = (days: number) => {
    return DURATION_OPTIONS.find(d => d.days === days)?.label || `${days} days`;
  };

  const selectedDomain = domains.find(d => d.id === selectedDomainId);

  if (!selectedDomainId) {
    return (
      <Card className="p-6">
        <div className="text-center py-8 text-muted-foreground">
          <Package className="h-12 w-12 mx-auto mb-3 opacity-50" />
          <p>Select a domain to manage its plans</p>
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="font-semibold text-lg flex items-center gap-2">
            <Package className="h-5 w-5" />
            Plans for @{selectedDomain?.domain}
          </h3>
          <p className="text-sm text-muted-foreground">
            Custom pricing and feature combos for this domain
          </p>
        </div>
        <Button 
          className="gap-2" 
          onClick={() => {
            resetForm();
            setDialogOpen(true);
          }}
        >
          <Plus className="h-4 w-4" />
          Add Plan
        </Button>
      </div>

      <Dialog open={dialogOpen} onOpenChange={(open) => {
        setDialogOpen(open);
        if (!open) resetForm();
      }}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingPlan ? "Edit Plan" : "Create Domain Plan"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label>Plan Name</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="e.g., Student Pro, Semester Pack"
              />
            </div>

            <div className="space-y-2">
              <Label>Description (optional)</Label>
              <Input
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="e.g., Best value for students"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <IndianRupee className="h-4 w-4" />
                  Price (₹)
                </Label>
                <Input
                  type="number"
                  min="0"
                  value={form.price}
                  onChange={(e) => setForm({ ...form, price: Math.max(0, parseInt(e.target.value) || 0) })}
                  placeholder="0"
                />
                <p className="text-xs text-muted-foreground">
                  {form.price === 0 ? "Free access" : `₹${form.price}`}
                </p>
              </div>

              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  Duration
                </Label>
                <Select
                  value={form.is_custom_duration ? "-1" : form.duration_days.toString()}
                  onValueChange={handleDurationChange}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DURATION_OPTIONS.map((option) => (
                      <SelectItem key={option.days} value={option.days.toString()}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {form.is_custom_duration && (
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      min="1"
                      value={form.custom_duration}
                      onChange={(e) => setForm({ ...form, custom_duration: e.target.value })}
                      placeholder="Enter days"
                      className="flex-1"
                    />
                    <span className="text-sm text-muted-foreground">days</span>
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-3">
              <Label>Features Included</Label>
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

            <div className="flex items-center space-x-3 p-3 rounded-lg border">
              <Checkbox
                checked={form.is_combo}
                onCheckedChange={(checked) => setForm({ ...form, is_combo: !!checked })}
              />
              <div className="flex-1">
                <p className="text-sm font-medium flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-primary" />
                  Combo Plan
                </p>
                <p className="text-xs text-muted-foreground">Mark as a special combo offer</p>
              </div>
            </div>

            <Button
              className="w-full"
              onClick={() => savePlan.mutate(!!editingPlan)}
              disabled={savePlan.isPending || !form.name.trim() || Object.values(form.features).filter(Boolean).length === 0}
            >
              {savePlan.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : editingPlan ? "Update Plan" : "Create Plan"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {isLoading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : plans.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          <Package className="h-12 w-12 mx-auto mb-3 opacity-50" />
          <p>No plans created yet</p>
          <p className="text-sm">Add custom plans for @{selectedDomain?.domain} users</p>
        </div>
      ) : (
        <div className="space-y-3">
          {plans.map((plan) => (
            <div
              key={plan.id}
              className={`p-4 rounded-lg border ${plan.is_active ? "bg-card" : "bg-muted/50 opacity-60"}`}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-semibold">{plan.name}</span>
                    {plan.is_combo && (
                      <Badge className="bg-gradient-to-r from-primary to-accent text-primary-foreground">
                        <Sparkles className="h-3 w-3 mr-1" />
                        Combo
                      </Badge>
                    )}
                    {!plan.is_active && <Badge variant="secondary">Disabled</Badge>}
                  </div>
                  {plan.description && (
                    <p className="text-sm text-muted-foreground mb-2">{plan.description}</p>
                  )}
                  <div className="flex items-center gap-3 mb-2 text-sm">
                    <span className="font-medium text-primary">
                      {plan.price === 0 ? "Free" : `₹${plan.price}`}
                    </span>
                    <span className="text-muted-foreground">•</span>
                    <span className="text-muted-foreground">{getDurationLabel(plan.duration_days)}</span>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {getEnabledFeatures(plan.features).map((feature) => (
                      <Badge key={feature} variant="outline" className="text-xs">
                        {feature}
                      </Badge>
                    ))}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    checked={plan.is_active}
                    onCheckedChange={(checked) => togglePlanActive.mutate({ id: plan.id, isActive: checked })}
                  />
                  <Button variant="ghost" size="icon" onClick={() => openEditDialog(plan)}>
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-destructive hover:text-destructive"
                    onClick={() => {
                      if (confirm(`Delete plan "${plan.name}"?`)) {
                        deletePlan.mutate(plan.id);
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
    </Card>
  );
}