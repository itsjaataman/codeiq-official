import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Plus,
  Trash2,
  Edit,
  Loader2,
  Building2,
  ArrowLeft,
  ChevronRight,
  ExternalLink,
  Upload,
  FileUp,
  CheckCircle2,
  XCircle,
  Download,
} from "lucide-react";

interface Company {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  description: string | null;
  display_order: number;
  problem_count: number;
  created_at: string;
}

interface Problem {
  id: string;
  title: string;
  slug: string;
  difficulty: string;
  leetcode_slug: string | null;
  leetcode_id: number | null;
  company_id: string | null;
  topic_id: string;
}

interface Topic {
  id: string;
  name: string;
  slug: string;
  icon: string | null;
}

export function CompanyManagement() {
  const queryClient = useQueryClient();
  const [companyDialogOpen, setCompanyDialogOpen] = useState(false);
  const [problemDialogOpen, setProblemDialogOpen] = useState(false);
  const [bulkImportDialogOpen, setBulkImportDialogOpen] = useState(false);
  const [editingCompany, setEditingCompany] = useState<Company | null>(null);
  const [editingProblem, setEditingProblem] = useState<Problem | null>(null);
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);
  const [companyForm, setCompanyForm] = useState({
    name: "",
    description: "",
    display_order: "0",
  });
  const [problemForm, setProblemForm] = useState({
    title: "",
    slug: "",
    difficulty: "easy",
    topic_id: "",
    leetcode_slug: "",
    leetcode_id: "",
  });
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [searchProblems, setSearchProblems] = useState("");
  
  // Bulk import state
  const [importedProblems, setImportedProblems] = useState<any[]>([]);
  const [importErrors, setImportErrors] = useState<string[]>([]);
  const [isImporting, setIsImporting] = useState(false);
  const [importPreview, setImportPreview] = useState(false);

  // Fetch companies
  const { data: companies = [], isLoading: companiesLoading } = useQuery({
    queryKey: ["admin-companies"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("companies")
        .select("*")
        .order("display_order");
      if (error) throw error;
      return data as Company[];
    },
  });

  // Fetch topics for problem creation
  const { data: topics = [] } = useQuery({
    queryKey: ["admin-topics-for-company"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("topics")
        .select("id, name, slug, icon")
        .order("display_order");
      if (error) throw error;
      return data as Topic[];
    },
  });

  // Fetch problems for selected company
  const { data: companyProblems = [], isLoading: problemsLoading } = useQuery({
    queryKey: ["company-problems", selectedCompany?.id],
    queryFn: async () => {
      if (!selectedCompany) return [];
      const { data, error } = await supabase
        .from("problems")
        .select("id, title, slug, difficulty, leetcode_slug, leetcode_id, company_id, topic_id")
        .eq("company_id", selectedCompany.id)
        .order("display_order");
      if (error) throw error;
      return data as Problem[];
    },
    enabled: !!selectedCompany,
  });

  // Create/Update company
  const saveCompany = useMutation({
    mutationFn: async () => {
      let logoUrl = editingCompany?.logo_url || null;

      // Upload logo if provided
      if (logoFile) {
        const fileExt = logoFile.name.split('.').pop();
        const fileName = `${Date.now()}.${fileExt}`;
        
        const { error: uploadError } = await supabase.storage
          .from("company-logos")
          .upload(fileName, logoFile);

        if (uploadError) throw uploadError;

        const { data: urlData } = supabase.storage
          .from("company-logos")
          .getPublicUrl(fileName);

        logoUrl = urlData.publicUrl;
      }

      const companyData = {
        name: companyForm.name.trim(),
        slug: companyForm.name.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, ""),
        description: companyForm.description.trim() || null,
        display_order: parseInt(companyForm.display_order) || 0,
        logo_url: logoUrl,
      };

      if (editingCompany) {
        const { error } = await supabase
          .from("companies")
          .update(companyData)
          .eq("id", editingCompany.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("companies").insert(companyData);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-companies"] });
      setCompanyDialogOpen(false);
      setEditingCompany(null);
      resetCompanyForm();
      toast.success(editingCompany ? "Company updated" : "Company created");
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to save company");
    },
  });

  // Delete company
  const deleteCompany = useMutation({
    mutationFn: async (id: string) => {
      // First remove company_id from problems
      await supabase
        .from("problems")
        .update({ company_id: null })
        .eq("company_id", id);

      const { error } = await supabase.from("companies").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-companies"] });
      toast.success("Company deleted");
    },
  });

  // Create/Update problem for company
  const saveProblem = useMutation({
    mutationFn: async () => {
      if (!selectedCompany) throw new Error("No company selected");

      const problemData = {
        title: problemForm.title.trim(),
        slug: problemForm.slug.trim() || problemForm.title.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, ""),
        difficulty: problemForm.difficulty,
        topic_id: problemForm.topic_id,
        leetcode_slug: problemForm.leetcode_slug.trim() || null,
        leetcode_id: problemForm.leetcode_id ? parseInt(problemForm.leetcode_id) : null,
        company_id: selectedCompany.id,
        problem_type: "company_wise",
      };

      if (editingProblem) {
        const { error } = await supabase
          .from("problems")
          .update(problemData)
          .eq("id", editingProblem.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("problems").insert(problemData);
        if (error) throw error;
      }

      // Update problem count
      const { count } = await supabase
        .from("problems")
        .select("id", { count: "exact", head: true })
        .eq("company_id", selectedCompany.id);

      await supabase
        .from("companies")
        .update({ problem_count: count || 0 })
        .eq("id", selectedCompany.id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["company-problems", selectedCompany?.id] });
      queryClient.invalidateQueries({ queryKey: ["admin-companies"] });
      setProblemDialogOpen(false);
      setEditingProblem(null);
      resetProblemForm();
      toast.success(editingProblem ? "Problem updated" : "Problem added");
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to save problem");
    },
  });

  // Delete problem
  const deleteProblem = useMutation({
    mutationFn: async (problemId: string) => {
      const { error } = await supabase.from("problems").delete().eq("id", problemId);
      if (error) throw error;

      // Update problem count
      if (selectedCompany) {
        const { count } = await supabase
          .from("problems")
          .select("id", { count: "exact", head: true })
          .eq("company_id", selectedCompany.id);

        await supabase
          .from("companies")
          .update({ problem_count: count || 0 })
          .eq("id", selectedCompany.id);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["company-problems", selectedCompany?.id] });
      queryClient.invalidateQueries({ queryKey: ["admin-companies"] });
      toast.success("Problem deleted");
    },
  });

  const resetCompanyForm = () => {
    setCompanyForm({ name: "", description: "", display_order: "0" });
    setLogoFile(null);
  };

  const resetProblemForm = () => {
    setProblemForm({
      title: "",
      slug: "",
      difficulty: "easy",
      topic_id: "",
      leetcode_slug: "",
      leetcode_id: "",
    });
  };

  const openEditCompany = (company: Company) => {
    setEditingCompany(company);
    setCompanyForm({
      name: company.name,
      description: company.description || "",
      display_order: company.display_order.toString(),
    });
    setCompanyDialogOpen(true);
  };

  const openEditProblem = (problem: Problem) => {
    setEditingProblem(problem);
    setProblemForm({
      title: problem.title,
      slug: problem.slug,
      difficulty: problem.difficulty,
      topic_id: problem.topic_id,
      leetcode_slug: problem.leetcode_slug || "",
      leetcode_id: problem.leetcode_id?.toString() || "",
    });
    setProblemDialogOpen(true);
  };

  const filteredProblems = companyProblems.filter(p =>
    p.title.toLowerCase().includes(searchProblems.toLowerCase())
  );

  // Bulk import helper functions
  const parseCSV = (text: string): any[] => {
    const lines = text.trim().split('\n');
    if (lines.length < 2) return [];
    
    const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/"/g, ''));
    const problemsList: any[] = [];
    
    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].match(/(".*?"|[^",]+)(?=\s*,|\s*$)/g) || [];
      const cleanValues = values.map(v => v.trim().replace(/^"|"$/g, ''));
      
      const problem: any = {};
      headers.forEach((header, index) => {
        problem[header] = cleanValues[index] || '';
      });
      problemsList.push(problem);
    }
    
    return problemsList;
  };

  const parseJSON = (text: string): any[] => {
    const data = JSON.parse(text);
    return Array.isArray(data) ? data : [data];
  };

  const validateProblem = (problem: any, index: number): { valid: boolean; error?: string; data?: any } => {
    const title = problem.title?.trim();
    const difficulty = problem.difficulty?.toLowerCase()?.trim();
    const topicName = problem.topic?.trim() || problem.topic_name?.trim();
    const topicId = problem.topic_id?.trim();
    
    if (!title) {
      return { valid: false, error: `Row ${index + 1}: Missing title` };
    }
    
    if (!['easy', 'medium', 'hard'].includes(difficulty)) {
      return { valid: false, error: `Row ${index + 1}: Invalid difficulty "${difficulty}" (must be easy, medium, or hard)` };
    }
    
    let resolvedTopicId = topicId;
    if (!resolvedTopicId && topicName) {
      const matchedTopic = topics.find(t => 
        t.name.toLowerCase() === topicName.toLowerCase() || 
        t.slug.toLowerCase() === topicName.toLowerCase()
      );
      if (matchedTopic) {
        resolvedTopicId = matchedTopic.id;
      }
    }
    
    if (!resolvedTopicId) {
      return { valid: false, error: `Row ${index + 1}: Topic "${topicName || 'unknown'}" not found. Create the topic first.` };
    }
    
    return {
      valid: true,
      data: {
        title,
        slug: problem.slug?.trim() || title.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''),
        difficulty,
        topic_id: resolvedTopicId,
        leetcode_slug: problem.leetcode_slug?.trim() || null,
        leetcode_id: problem.leetcode_id ? parseInt(problem.leetcode_id) : null,
        company_id: selectedCompany?.id,
        problem_type: 'company_wise',
      }
    };
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    
    setImportErrors([]);
    setImportedProblems([]);
    setImportPreview(false);
    
    try {
      const text = await file.text();
      let parsedProblems: any[];
      
      if (file.name.endsWith('.json')) {
        parsedProblems = parseJSON(text);
      } else if (file.name.endsWith('.csv')) {
        parsedProblems = parseCSV(text);
      } else {
        toast.error('Please upload a CSV or JSON file');
        return;
      }
      
      if (parsedProblems.length === 0) {
        toast.error('No problems found in file');
        return;
      }
      
      const errors: string[] = [];
      const validProblems: any[] = [];
      
      parsedProblems.forEach((problem, index) => {
        const result = validateProblem(problem, index);
        if (result.valid && result.data) {
          validProblems.push(result.data);
        } else if (result.error) {
          errors.push(result.error);
        }
      });
      
      setImportedProblems(validProblems);
      setImportErrors(errors);
      setImportPreview(true);
      
      if (validProblems.length === 0) {
        toast.error('No valid problems found');
      } else {
        toast.success(`Found ${validProblems.length} valid problems`);
      }
    } catch (error: any) {
      console.error('Error parsing file:', error);
      toast.error(`Error parsing file: ${error.message}`);
    }
    
    event.target.value = '';
  };

  const executeBulkImport = async () => {
    if (importedProblems.length === 0 || !selectedCompany) return;
    
    setIsImporting(true);
    
    try {
      const { error } = await supabase.from('problems').insert(importedProblems);
      
      if (error) throw error;

      // Update problem count
      const { count } = await supabase
        .from("problems")
        .select("id", { count: "exact", head: true })
        .eq("company_id", selectedCompany.id);

      await supabase
        .from("companies")
        .update({ problem_count: count || 0 })
        .eq("id", selectedCompany.id);
      
      queryClient.invalidateQueries({ queryKey: ['company-problems', selectedCompany.id] });
      queryClient.invalidateQueries({ queryKey: ['admin-companies'] });
      
      toast.success(`Successfully imported ${importedProblems.length} problems`);
      setBulkImportDialogOpen(false);
      setImportedProblems([]);
      setImportErrors([]);
      setImportPreview(false);
    } catch (error: any) {
      console.error('Error importing problems:', error);
      toast.error(`Import failed: ${error.message}`);
    } finally {
      setIsImporting(false);
    }
  };

  if (companiesLoading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  // Show company problems view
  if (selectedCompany) {
    return (
      <Card className="p-6">
        <div className="flex items-center gap-4 mb-6">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => {
              setSelectedCompany(null);
              setSearchProblems("");
            }}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex items-center gap-3 flex-1">
            {selectedCompany.logo_url ? (
              <img src={selectedCompany.logo_url} alt={selectedCompany.name} className="h-12 w-12 rounded-lg object-cover" />
            ) : (
              <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
                <span className="text-primary font-bold text-lg">{selectedCompany.name.charAt(0)}</span>
              </div>
            )}
            <div>
              <h3 className="font-semibold text-lg">{selectedCompany.name}</h3>
              <p className="text-sm text-muted-foreground">{companyProblems.length} problems</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Input
              placeholder="Search problems..."
              value={searchProblems}
              onChange={(e) => setSearchProblems(e.target.value)}
              className="w-64"
            />
            <Dialog open={bulkImportDialogOpen} onOpenChange={(open) => {
              setBulkImportDialogOpen(open);
              if (!open) {
                setImportedProblems([]);
                setImportErrors([]);
                setImportPreview(false);
              }
            }}>
              <DialogTrigger asChild>
                <Button variant="outline" className="gap-2">
                  <Upload className="h-4 w-4" />
                  Import
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>Bulk Import Problems - {selectedCompany.name}</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 pt-4">
                  {!importPreview ? (
                    <>
                      <div className="border-2 border-dashed border-border rounded-lg p-8 text-center">
                        <FileUp className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                        <p className="text-sm text-muted-foreground mb-4">Upload CSV or JSON file</p>
                        <div className="flex items-center justify-center gap-3">
                          <Label htmlFor="company-file-upload" className="cursor-pointer">
                            <Button asChild>
                              <span><Upload className="h-4 w-4 mr-2" />Select File</span>
                            </Button>
                          </Label>
                        </div>
                        <Input 
                          id="company-file-upload" 
                          type="file" 
                          accept=".csv,.json" 
                          className="hidden" 
                          onChange={handleFileUpload} 
                        />
                      </div>
                      
                      {/* Download Templates */}
                      <div className="flex items-center justify-center gap-3 p-3 bg-muted/50 rounded-lg">
                        <span className="text-sm text-muted-foreground">Download template:</span>
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-1"
                          onClick={() => {
                            const csvContent = `title,difficulty,topic,leetcode_slug,leetcode_id
Two Sum,easy,Arrays & Hashing,two-sum,1
Valid Anagram,easy,Arrays & Hashing,valid-anagram,242
Reverse Linked List,easy,Linked List,reverse-linked-list,206`;
                            const blob = new Blob([csvContent], { type: 'text/csv' });
                            const url = URL.createObjectURL(blob);
                            const a = document.createElement('a');
                            a.href = url;
                            a.download = 'company_problems_template.csv';
                            a.click();
                            URL.revokeObjectURL(url);
                          }}
                        >
                          <Download className="h-3 w-3" />
                          CSV
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-1"
                          onClick={() => {
                            const jsonContent = JSON.stringify([
                              { title: "Two Sum", difficulty: "easy", topic: "Arrays & Hashing", leetcode_slug: "two-sum", leetcode_id: 1 },
                              { title: "Valid Anagram", difficulty: "easy", topic: "Arrays & Hashing", leetcode_slug: "valid-anagram", leetcode_id: 242 },
                              { title: "Reverse Linked List", difficulty: "easy", topic: "Linked List", leetcode_slug: "reverse-linked-list", leetcode_id: 206 }
                            ], null, 2);
                            const blob = new Blob([jsonContent], { type: 'application/json' });
                            const url = URL.createObjectURL(blob);
                            const a = document.createElement('a');
                            a.href = url;
                            a.download = 'company_problems_template.json';
                            a.click();
                            URL.revokeObjectURL(url);
                          }}
                        >
                          <Download className="h-3 w-3" />
                          JSON
                        </Button>
                      </div>
                      
                      <div className="text-xs text-muted-foreground space-y-1">
                        <p className="font-medium">Required columns:</p>
                        <p>• <code>title</code> - Problem title</p>
                        <p>• <code>difficulty</code> - easy, medium, or hard</p>
                        <p>• <code>topic</code> or <code>topic_name</code> - Topic name or slug</p>
                        <p className="font-medium mt-2">Optional columns:</p>
                        <p>• <code>slug</code>, <code>leetcode_slug</code>, <code>leetcode_id</code></p>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="flex items-center gap-4 text-sm">
                        <span className="flex items-center gap-1 text-green-600">
                          <CheckCircle2 className="h-4 w-4" />
                          {importedProblems.length} valid
                        </span>
                        {importErrors.length > 0 && (
                          <span className="flex items-center gap-1 text-destructive">
                            <XCircle className="h-4 w-4" />
                            {importErrors.length} errors
                          </span>
                        )}
                      </div>
                      {importErrors.length > 0 && (
                        <ScrollArea className="h-24 border rounded-lg p-2 bg-destructive/5">
                          <div className="text-xs text-destructive space-y-1">
                            {importErrors.slice(0, 10).map((error, i) => (
                              <p key={i}>{error}</p>
                            ))}
                            {importErrors.length > 10 && (
                              <p className="font-medium">...and {importErrors.length - 10} more errors</p>
                            )}
                          </div>
                        </ScrollArea>
                      )}
                      {importedProblems.length > 0 && (
                        <ScrollArea className="h-48 border rounded-lg">
                          <table className="w-full text-sm">
                            <thead className="bg-muted sticky top-0">
                              <tr>
                                <th className="text-left px-3 py-2">Title</th>
                                <th className="text-left px-3 py-2">Difficulty</th>
                                <th className="text-left px-3 py-2">Topic</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y">
                              {importedProblems.map((p, i) => {
                                const topic = topics.find(t => t.id === p.topic_id);
                                return (
                                  <tr key={i}>
                                    <td className="px-3 py-2">{p.title}</td>
                                    <td className="px-3 py-2">
                                      <Badge variant={p.difficulty as any}>{p.difficulty}</Badge>
                                    </td>
                                    <td className="px-3 py-2 text-muted-foreground">
                                      {topic?.icon} {topic?.name}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </ScrollArea>
                      )}
                      <div className="flex gap-3">
                        <Button 
                          variant="outline" 
                          onClick={() => { 
                            setImportPreview(false); 
                            setImportedProblems([]); 
                            setImportErrors([]);
                          }} 
                          className="flex-1"
                        >
                          Upload Different
                        </Button>
                        <Button 
                          onClick={executeBulkImport} 
                          disabled={isImporting || importedProblems.length === 0} 
                          className="flex-1"
                        >
                          {isImporting ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            `Import ${importedProblems.length} Problems`
                          )}
                        </Button>
                      </div>
                    </>
                  )}
                </div>
              </DialogContent>
            </Dialog>
            <Dialog open={problemDialogOpen} onOpenChange={(open) => {
              setProblemDialogOpen(open);
              if (!open) {
                setEditingProblem(null);
                resetProblemForm();
              }
            }}>
              <DialogTrigger asChild>
                <Button className="gap-2">
                  <Plus className="h-4 w-4" />
                  Add Problem
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{editingProblem ? "Edit Problem" : "Add Problem"}</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 pt-4">
                  <div>
                    <Label>Title</Label>
                    <Input
                      value={problemForm.title}
                      onChange={(e) => setProblemForm({ ...problemForm, title: e.target.value })}
                      placeholder="Two Sum"
                    />
                  </div>
                  <div>
                    <Label>Slug (URL-friendly, optional)</Label>
                    <Input
                      value={problemForm.slug}
                      onChange={(e) => setProblemForm({ ...problemForm, slug: e.target.value })}
                      placeholder="two-sum"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Difficulty</Label>
                      <Select value={problemForm.difficulty} onValueChange={(v) => setProblemForm({ ...problemForm, difficulty: v })}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="easy">Easy</SelectItem>
                          <SelectItem value="medium">Medium</SelectItem>
                          <SelectItem value="hard">Hard</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Topic</Label>
                      <Select value={problemForm.topic_id} onValueChange={(v) => setProblemForm({ ...problemForm, topic_id: v })}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select topic" />
                        </SelectTrigger>
                        <SelectContent>
                          {topics.map((t) => (
                            <SelectItem key={t.id} value={t.id}>
                              {t.icon} {t.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>LeetCode Slug</Label>
                      <Input
                        value={problemForm.leetcode_slug}
                        onChange={(e) => setProblemForm({ ...problemForm, leetcode_slug: e.target.value })}
                        placeholder="two-sum"
                      />
                    </div>
                    <div>
                      <Label>LeetCode ID</Label>
                      <Input
                        type="number"
                        value={problemForm.leetcode_id}
                        onChange={(e) => setProblemForm({ ...problemForm, leetcode_id: e.target.value })}
                        placeholder="1"
                      />
                    </div>
                  </div>
                  <Button
                    className="w-full"
                    onClick={() => saveProblem.mutate()}
                    disabled={saveProblem.isPending || !problemForm.title.trim() || !problemForm.topic_id}
                  >
                    {saveProblem.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : editingProblem ? "Update Problem" : "Add Problem"}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {problemsLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : filteredProblems.length === 0 ? (
          <div className="text-center py-12">
            <Building2 className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">No problems yet</h3>
            <p className="text-muted-foreground mb-4">
              Add problems to {selectedCompany.name}
            </p>
            <Button onClick={() => setProblemDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add Problem
            </Button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left text-xs font-medium text-muted-foreground uppercase px-4 py-3">Problem</th>
                  <th className="text-left text-xs font-medium text-muted-foreground uppercase px-4 py-3">Difficulty</th>
                  <th className="text-left text-xs font-medium text-muted-foreground uppercase px-4 py-3">Topic</th>
                  <th className="text-left text-xs font-medium text-muted-foreground uppercase px-4 py-3">LeetCode</th>
                  <th className="text-right text-xs font-medium text-muted-foreground uppercase px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredProblems.map((problem) => {
                  const topic = topics.find(t => t.id === problem.topic_id);
                  return (
                    <tr key={problem.id} className="hover:bg-muted/30">
                      <td className="px-4 py-3">
                        <p className="font-medium">{problem.title}</p>
                        <code className="text-xs text-muted-foreground">{problem.slug}</code>
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={problem.difficulty as any}>
                          {problem.difficulty.charAt(0).toUpperCase() + problem.difficulty.slice(1)}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">
                        {topic?.icon} {topic?.name}
                      </td>
                      <td className="px-4 py-3">
                        {problem.leetcode_slug ? (
                          <a
                            href={`https://leetcode.com/problems/${problem.leetcode_slug}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm text-primary hover:underline flex items-center gap-1"
                          >
                            #{problem.leetcode_id}
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        ) : (
                          <span className="text-sm text-muted-foreground">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openEditProblem(problem)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-destructive hover:text-destructive"
                            onClick={() => {
                              if (confirm("Delete this problem?")) {
                                deleteProblem.mutate(problem.id);
                              }
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    );
  }

  // Show companies list
  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="font-semibold text-lg">Company Management</h3>
          <p className="text-sm text-muted-foreground">Add companies and manage their problems</p>
        </div>
        <Dialog open={companyDialogOpen} onOpenChange={(open) => {
          setCompanyDialogOpen(open);
          if (!open) {
            setEditingCompany(null);
            resetCompanyForm();
          }
        }}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              Add Company
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingCompany ? "Edit Company" : "Add New Company"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-4">
              <div>
                <Label>Company Name</Label>
                <Input
                  value={companyForm.name}
                  onChange={(e) => setCompanyForm({ ...companyForm, name: e.target.value })}
                  placeholder="e.g., Google"
                />
              </div>
              <div>
                <Label>Description (Optional)</Label>
                <Textarea
                  value={companyForm.description}
                  onChange={(e) => setCompanyForm({ ...companyForm, description: e.target.value })}
                  placeholder="Brief description..."
                  rows={2}
                />
              </div>
              <div>
                <Label>Logo (Optional)</Label>
                <div className="flex items-center gap-4 mt-2">
                  {(editingCompany?.logo_url || logoFile) && (
                    <div className="h-12 w-12 rounded-lg bg-muted flex items-center justify-center overflow-hidden">
                      {logoFile ? (
                        <img src={URL.createObjectURL(logoFile)} alt="Logo preview" className="h-full w-full object-cover" />
                      ) : editingCompany?.logo_url ? (
                        <img src={editingCompany.logo_url} alt="Logo" className="h-full w-full object-cover" />
                      ) : null}
                    </div>
                  )}
                  <Input
                    type="file"
                    accept="image/*"
                    onChange={(e) => setLogoFile(e.target.files?.[0] || null)}
                    className="flex-1"
                  />
                </div>
              </div>
              <div>
                <Label>Display Order</Label>
                <Input
                  type="number"
                  value={companyForm.display_order}
                  onChange={(e) => setCompanyForm({ ...companyForm, display_order: e.target.value })}
                  placeholder="0"
                />
              </div>
              <Button
                className="w-full"
                onClick={() => saveCompany.mutate()}
                disabled={saveCompany.isPending || !companyForm.name.trim()}
              >
                {saveCompany.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : editingCompany ? "Update Company" : "Create Company"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {companies.length === 0 ? (
        <div className="text-center py-12">
          <Building2 className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium mb-2">No companies yet</h3>
          <p className="text-muted-foreground mb-4">
            Add companies and manage their interview problems
          </p>
          <Button onClick={() => setCompanyDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Add Company
          </Button>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left text-xs font-medium text-muted-foreground uppercase px-4 py-3">Company</th>
                <th className="text-left text-xs font-medium text-muted-foreground uppercase px-4 py-3">Problems</th>
                <th className="text-left text-xs font-medium text-muted-foreground uppercase px-4 py-3">Order</th>
                <th className="text-right text-xs font-medium text-muted-foreground uppercase px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {companies.map((company) => (
                <tr key={company.id} className="hover:bg-muted/30">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      {company.logo_url ? (
                        <img src={company.logo_url} alt={company.name} className="h-10 w-10 rounded-lg object-cover" />
                      ) : (
                        <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                          <span className="text-primary font-bold">{company.name.charAt(0)}</span>
                        </div>
                      )}
                      <div>
                        <p className="font-medium">{company.name}</p>
                        {company.description && (
                          <p className="text-xs text-muted-foreground line-clamp-1">{company.description}</p>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant="secondary">{company.problem_count || 0} problems</Badge>
                  </td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">
                    {company.display_order}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-1"
                        onClick={() => setSelectedCompany(company)}
                      >
                        Manage Problems
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => openEditCompany(company)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-destructive hover:text-destructive"
                        onClick={() => {
                          if (confirm("Delete this company? Problems will be unassigned.")) {
                            deleteCompany.mutate(company.id);
                          }
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
