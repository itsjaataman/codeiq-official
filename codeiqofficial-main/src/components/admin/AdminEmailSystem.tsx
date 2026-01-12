import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Mail, Send, Loader2, Users, Search, CheckCircle2, XCircle, Plus } from "lucide-react";

interface User {
  id: string;
  user_id: string;
  email: string | null;
  full_name: string | null;
  subscription_plan: string | null;
  leetcode_verified: boolean | null;
}

export function AdminEmailSystem() {
  const { user } = useAuth();
  const [subject, setSubject] = useState("");
  const [content, setContent] = useState("");
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [planFilter, setPlanFilter] = useState<string>("all");
  const [verifiedFilter, setVerifiedFilter] = useState<string>("all");
  const [selectAll, setSelectAll] = useState(false);
  const [customEmails, setCustomEmails] = useState("");
  const [recipientMode, setRecipientMode] = useState<"users" | "custom">("users");
  // Fetch all users
  const { data: users = [], isLoading: usersLoading } = useQuery({
    queryKey: ["admin-users-email"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, user_id, email, full_name, subscription_plan, leetcode_verified")
        .not("email", "is", null)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as User[];
    },
  });

  // Filter users based on search and filters
  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      // Search filter
      const matchesSearch = 
        !searchTerm ||
        u.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        u.full_name?.toLowerCase().includes(searchTerm.toLowerCase());

      // Plan filter
      const matchesPlan =
        planFilter === "all" ||
        (planFilter === "free" && (!u.subscription_plan || u.subscription_plan === "free")) ||
        (planFilter === "paid" && u.subscription_plan && u.subscription_plan !== "free") ||
        u.subscription_plan === planFilter;

      // Verified filter
      const matchesVerified =
        verifiedFilter === "all" ||
        (verifiedFilter === "verified" && u.leetcode_verified) ||
        (verifiedFilter === "unverified" && !u.leetcode_verified);

      return matchesSearch && matchesPlan && matchesVerified;
    });
  }, [users, searchTerm, planFilter, verifiedFilter]);

  // Handle select all for filtered users
  const handleSelectAll = (checked: boolean) => {
    setSelectAll(checked);
    if (checked) {
      const emails = filteredUsers
        .map((u) => u.email)
        .filter((email): email is string => !!email);
      setSelectedUsers(emails);
    } else {
      setSelectedUsers([]);
    }
  };

  // Toggle individual user selection
  const toggleUser = (email: string) => {
    setSelectedUsers((prev) =>
      prev.includes(email)
        ? prev.filter((e) => e !== email)
        : [...prev, email]
    );
  };

  // Parse custom emails from comma-separated input
  const parseCustomEmails = (): string[] => {
    return customEmails
      .split(/[,\n]+/)
      .map(e => e.trim())
      .filter(e => e.length > 0 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e));
  };

  // Get final recipients based on mode
  const getFinalRecipients = (): string[] => {
    if (recipientMode === "custom") {
      return parseCustomEmails();
    }
    return selectedUsers;
  };

  const recipientCount = recipientMode === "custom" ? parseCustomEmails().length : selectedUsers.length;

  // Send email mutation
  const sendEmail = useMutation({
    mutationFn: async () => {
      const recipients = getFinalRecipients();
      
      if (!subject.trim() || !content.trim() || recipients.length === 0) {
        throw new Error("Please fill all fields and add recipients");
      }

      const response = await supabase.functions.invoke("admin-email", {
        body: {
          subject: subject.trim(),
          content: content.trim(),
          recipients: recipients,
        },
      });

      if (response.error) throw new Error(response.error.message);
      if (response.data?.error) throw new Error(response.data.error);
      
      return response.data;
    },
    onSuccess: (data) => {
      toast.success(data.message || "Emails sent successfully!");
      setSubject("");
      setContent("");
      setSelectedUsers([]);
      setCustomEmails("");
      setSelectAll(false);
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to send emails");
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 mb-4">
        <Mail className="h-5 w-5 text-primary" />
        <h3 className="font-semibold text-lg">Email System</h3>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Email Composition */}
        <div className="space-y-4">
          <div>
            <Label>Subject</Label>
            <Input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Email subject line"
            />
          </div>

          <div>
            <Label>Content (HTML or Plain Text)</Label>
            <Textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Write your email content here. You can use plain text or HTML tags like <h2>, <p>, <strong>, <a href=''>, etc."
              className="min-h-[200px] font-mono text-sm"
            />
            <p className="text-xs text-muted-foreground mt-1">
              If you include HTML tags, email will be sent as HTML. Otherwise, it will be sent as plain text.
            </p>
          </div>

          {/* Preview - only show if content looks like HTML */}
          {content && /<[a-z][\s\S]*>/i.test(content) && (
            <div>
              <Label>HTML Preview</Label>
              <div 
                className="p-4 border rounded-lg bg-muted/30 prose prose-sm max-w-none dark:prose-invert"
                dangerouslySetInnerHTML={{ __html: content }}
              />
            </div>
          )}

          <Button
            className="w-full"
            onClick={() => sendEmail.mutate()}
            disabled={sendEmail.isPending || !subject.trim() || !content.trim() || recipientCount === 0}
          >
            {sendEmail.isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Sending...
              </>
            ) : (
              <>
                <Send className="h-4 w-4 mr-2" />
                Send to {recipientCount} {recipientCount === 1 ? "Recipient" : "Recipients"}
              </>
            )}
          </Button>
        </div>

        {/* Recipient Selection */}
        <div className="space-y-4">
          <Tabs value={recipientMode} onValueChange={(v) => setRecipientMode(v as "users" | "custom")}>
            <TabsList className="w-full">
              <TabsTrigger value="users" className="flex-1">
                <Users className="h-4 w-4 mr-2" />
                Select Users
              </TabsTrigger>
              <TabsTrigger value="custom" className="flex-1">
                <Plus className="h-4 w-4 mr-2" />
                Custom Emails
              </TabsTrigger>
            </TabsList>

            <TabsContent value="custom" className="space-y-4 mt-4">
              <div>
                <Label>Enter Email Addresses</Label>
                <Textarea
                  value={customEmails}
                  onChange={(e) => setCustomEmails(e.target.value)}
                  placeholder="Enter emails separated by commas or new lines:&#10;user1@example.com, user2@example.com&#10;user3@example.com"
                  className="min-h-[200px] font-mono text-sm"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Separate emails with commas (,) or new lines. Invalid emails will be ignored.
                </p>
              </div>
              
              {customEmails && (
                <div className="p-3 bg-muted/50 rounded-lg">
                  <p className="text-sm font-medium mb-2">
                    Valid emails found: {parseCustomEmails().length}
                  </p>
                  <div className="flex flex-wrap gap-1 max-h-[100px] overflow-auto">
                    {parseCustomEmails().map((email, i) => (
                      <Badge key={i} variant="secondary" className="text-xs">
                        {email}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </TabsContent>

            <TabsContent value="users" className="space-y-4 mt-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">
                    {selectedUsers.length} selected / {filteredUsers.length} filtered
                  </span>
                </div>
                <Badge variant="secondary">{users.length} total users</Badge>
              </div>

              {/* Filters */}
              <div className="grid grid-cols-3 gap-2">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-9"
                  />
                </div>
                <Select value={planFilter} onValueChange={setPlanFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="Plan" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Plans</SelectItem>
                    <SelectItem value="free">Free</SelectItem>
                    <SelectItem value="paid">Paid (Any)</SelectItem>
                    <SelectItem value="basic">Basic</SelectItem>
                    <SelectItem value="pro">Pro</SelectItem>
                    <SelectItem value="lifetime">Lifetime</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={verifiedFilter} onValueChange={setVerifiedFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="verified">LeetCode Verified</SelectItem>
                    <SelectItem value="unverified">Not Verified</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Select All */}
              <div className="flex items-center gap-2 p-2 bg-muted/50 rounded-lg">
                <Checkbox
                  id="selectAll"
                  checked={selectAll}
                  onCheckedChange={handleSelectAll}
                />
                <label htmlFor="selectAll" className="text-sm cursor-pointer">
                  Select all {filteredUsers.length} filtered users
                </label>
              </div>

              {/* User List */}
              <ScrollArea className="h-[350px] border rounded-lg">
                {usersLoading ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-primary" />
                  </div>
                ) : filteredUsers.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No users match the filters
                  </div>
                ) : (
                  <div className="p-2 space-y-1">
                    {filteredUsers.map((u) => (
                      <div
                        key={u.id}
                        className={`flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-colors ${
                          selectedUsers.includes(u.email || "")
                            ? "bg-primary/10 border border-primary/30"
                            : "hover:bg-muted/50"
                        }`}
                        onClick={() => u.email && toggleUser(u.email)}
                      >
                        <Checkbox
                          checked={selectedUsers.includes(u.email || "")}
                          onCheckedChange={() => u.email && toggleUser(u.email)}
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">
                            {u.full_name || "No name"}
                          </p>
                          <p className="text-xs text-muted-foreground truncate">
                            {u.email}
                          </p>
                        </div>
                        <div className="flex items-center gap-1">
                          {u.leetcode_verified ? (
                            <CheckCircle2 className="h-3 w-3 text-success" />
                          ) : (
                            <XCircle className="h-3 w-3 text-muted-foreground" />
                          )}
                          <Badge variant="outline" className="text-xs">
                            {u.subscription_plan || "free"}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
