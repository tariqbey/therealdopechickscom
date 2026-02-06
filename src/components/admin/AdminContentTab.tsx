import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { motion } from "framer-motion";
import { Trash2, Eye, AlertTriangle, CheckCircle, XCircle, Search, Image } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";

interface Generation {
  id: string;
  user_id: string;
  generation_type: string;
  prompt: string | null;
  result_url: string | null;
  status: string;
  cost: number;
  created_at: string;
}

const AdminContentTab = () => {
  const [generations, setGenerations] = useState<Generation[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchGenerations = async () => {
    setLoading(true);
    let query = supabase
      .from("ai_generations")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100);

    if (statusFilter !== "all") {
      query = query.eq("status", statusFilter);
    }

    const { data } = await query;
    setGenerations((data as Generation[]) || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchGenerations();
  }, [statusFilter]);

  const callAdminAction = async (action: string, params: Record<string, unknown>) => {
    const res = await supabase.functions.invoke("admin-actions", {
      body: { action, ...params },
    });
    if (res.error) throw new Error(res.error.message);
    return res.data;
  };

  const deleteGeneration = async (id: string) => {
    setActionLoading(id);
    try {
      await callAdminAction("delete_generation", { generation_id: id });
      toast.success("Generation deleted");
      fetchGenerations();
    } catch (e: any) {
      toast.error(e.message);
    }
    setActionLoading(null);
  };

  const updateStatus = async (id: string, status: string) => {
    setActionLoading(id);
    try {
      await callAdminAction("update_generation_status", { generation_id: id, status });
      toast.success(`Status updated to ${status}`);
      fetchGenerations();
    } catch (e: any) {
      toast.error(e.message);
    }
    setActionLoading(null);
  };

  const filteredGenerations = generations.filter(
    (g) =>
      !search ||
      (g.prompt || "").toLowerCase().includes(search.toLowerCase()) ||
      g.generation_type.toLowerCase().includes(search.toLowerCase())
  );

  const statusBadge = (status: string) => {
    const variants: Record<string, { icon: typeof CheckCircle; className: string }> = {
      completed: { icon: CheckCircle, className: "bg-green-500/10 text-green-400 border-green-500/20" },
      pending: { icon: AlertTriangle, className: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20" },
      failed: { icon: XCircle, className: "bg-destructive/10 text-destructive border-destructive/20" },
      flagged: { icon: AlertTriangle, className: "bg-orange-500/10 text-orange-400 border-orange-500/20" },
    };
    const v = variants[status] || variants.pending;
    const Icon = v.icon;
    return (
      <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full border ${v.className}`}>
        <Icon className="h-3 w-3" />
        {status}
      </span>
    );
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by prompt or type..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-36 h-9 text-xs">
            <SelectValue placeholder="Filter status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="failed">Failed</SelectItem>
            <SelectItem value="flagged">Flagged</SelectItem>
          </SelectContent>
        </Select>
        <span className="text-sm text-muted-foreground">{filteredGenerations.length} items</span>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-48">
          <div className="animate-pulse text-muted-foreground">Loading content…</div>
        </div>
      ) : filteredGenerations.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-48 text-muted-foreground">
          <Image className="h-8 w-8 mb-2" />
          <p className="text-sm">No AI generations found</p>
        </div>
      ) : (
        <div className="rounded-xl bg-gradient-card border border-border p-6">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-muted-foreground text-left border-b border-border">
                  <th className="pb-3 font-medium">Type</th>
                  <th className="pb-3 font-medium">Prompt</th>
                  <th className="pb-3 font-medium">Status</th>
                  <th className="pb-3 font-medium">Cost</th>
                  <th className="pb-3 font-medium">Created</th>
                  <th className="pb-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredGenerations.map((g) => (
                  <tr key={g.id} className="text-foreground">
                    <td className="py-3">
                      <Badge variant="outline" className="text-xs">
                        {g.generation_type}
                      </Badge>
                    </td>
                    <td className="py-3 max-w-[200px] truncate text-muted-foreground" title={g.prompt || ""}>
                      {g.prompt || "—"}
                    </td>
                    <td className="py-3">{statusBadge(g.status)}</td>
                    <td className="py-3 text-muted-foreground">{g.cost} 🍞</td>
                    <td className="py-3 text-muted-foreground">
                      {new Date(g.created_at).toLocaleDateString()}
                    </td>
                    <td className="py-3">
                      <div className="flex items-center gap-1">
                        {g.result_url && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 text-xs"
                            onClick={() => window.open(g.result_url!, "_blank")}
                          >
                            <Eye className="h-3 w-3" />
                          </Button>
                        )}
                        <Select
                          value={g.status}
                          onValueChange={(val) => updateStatus(g.id, val)}
                          disabled={actionLoading === g.id}
                        >
                          <SelectTrigger className="w-24 h-7 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="completed">Completed</SelectItem>
                            <SelectItem value="pending">Pending</SelectItem>
                            <SelectItem value="flagged">Flagged</SelectItem>
                            <SelectItem value="failed">Failed</SelectItem>
                          </SelectContent>
                        </Select>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 text-xs text-destructive hover:bg-destructive/10"
                              disabled={actionLoading === g.id}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete generation?</AlertDialogTitle>
                              <AlertDialogDescription>
                                This will permanently remove this AI generation. This cannot be undone.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction onClick={() => deleteGeneration(g.id)}>
                                Delete
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </motion.div>
  );
};

export default AdminContentTab;
