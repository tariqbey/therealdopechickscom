import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { motion } from "framer-motion";
import { Shield, Check, X, Search, Loader2, Eye, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface PendingUser {
  id: string;
  user_id: string;
  display_name: string | null;
  avatar_url: string | null;
  is_creator: boolean;
  approval_status: string;
  id_photo_url: string | null;
  date_of_birth: string | null;
  created_at: string;
}

const AdminSecurityTab = () => {
  const [users, setUsers] = useState<PendingUser[]>([]);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"pending" | "approved" | "rejected" | "all">("pending");
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [viewingPhoto, setViewingPhoto] = useState<string | null>(null);

  const fetchUsers = async () => {
    setLoading(true);
    const query = supabase.from("profiles").select("*").order("created_at", { ascending: false });
    const { data } = filter !== "all"
      ? await (query as any).eq("approval_status", filter)
      : await query;
    setUsers((data as unknown as PendingUser[]) || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchUsers();
  }, [filter]);

  const handleApproval = async (userId: string, status: "approved" | "rejected") => {
    setActionLoading(userId);
    try {
      const res = await supabase.functions.invoke("admin-actions", {
        body: { action: "update_approval", user_id: userId, approval_status: status },
      });
      if (res.error) throw new Error(res.error.message);
      toast.success(`User ${status}`);
      fetchUsers();
    } catch (e: any) {
      toast.error(e.message);
    }
    setActionLoading(null);
  };

  const filtered = users.filter(
    (u) => !search || (u.display_name || "").toLowerCase().includes(search.toLowerCase())
  );

  const pendingCount = users.filter((u) => u.approval_status === "pending").length;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Pending", value: pendingCount, color: "text-yellow-500" },
          { label: "Approved", value: users.filter((u) => u.approval_status === "approved").length, color: "text-green-500" },
          { label: "Rejected", value: users.filter((u) => u.approval_status === "rejected").length, color: "text-red-500" },
        ].map((s) => (
          <div key={s.label} className="rounded-xl bg-gradient-card border border-border p-4 text-center">
            <p className={`text-2xl font-black ${s.color}`}>{s.value}</p>
            <p className="text-xs text-muted-foreground">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search users..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <div className="flex gap-1">
          {(["pending", "approved", "rejected", "all"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                filter === f ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground bg-muted"
              }`}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Users List */}
      <div className="rounded-xl bg-gradient-card border border-border p-6">
        {loading ? (
          <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground text-sm">No users found</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-muted-foreground text-left border-b border-border">
                  <th className="pb-3 font-medium">User</th>
                  <th className="pb-3 font-medium">Type</th>
                  <th className="pb-3 font-medium">DOB</th>
                  <th className="pb-3 font-medium">ID Photo</th>
                  <th className="pb-3 font-medium">Status</th>
                  <th className="pb-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map((u) => (
                  <tr key={u.id} className="text-foreground">
                    <td className="py-3 flex items-center gap-3">
                      <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center text-xs font-bold text-muted-foreground">
                        {(u.display_name || "?")[0].toUpperCase()}
                      </div>
                      <span className="font-medium">{u.display_name || "Unknown"}</span>
                    </td>
                    <td className="py-3">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${u.is_creator ? "bg-accent/10 text-accent" : "bg-primary/10 text-primary"}`}>
                        {u.is_creator ? "Creator" : "Fan"}
                      </span>
                    </td>
                    <td className="py-3 text-muted-foreground text-xs">
                      {u.date_of_birth || "Not provided"}
                    </td>
                    <td className="py-3">
                      {u.id_photo_url ? (
                        <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setViewingPhoto(u.id_photo_url)}>
                          <FileText className="h-3 w-3 mr-1" /> View ID
                        </Button>
                      ) : (
                        <span className="text-xs text-muted-foreground">None</span>
                      )}
                    </td>
                    <td className="py-3">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                        u.approval_status === "approved" ? "bg-green-500/10 text-green-500" :
                        u.approval_status === "rejected" ? "bg-red-500/10 text-red-500" :
                        "bg-yellow-500/10 text-yellow-500"
                      }`}>
                        {u.approval_status}
                      </span>
                    </td>
                    <td className="py-3">
                      <div className="flex gap-1">
                        {u.approval_status !== "approved" && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 text-xs text-green-500 hover:text-green-400"
                            disabled={actionLoading === u.user_id}
                            onClick={() => handleApproval(u.user_id, "approved")}
                          >
                            {actionLoading === u.user_id ? <Loader2 className="h-3 w-3 animate-spin" /> : <><Check className="h-3 w-3 mr-1" /> Approve</>}
                          </Button>
                        )}
                        {u.approval_status !== "rejected" && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 text-xs text-red-500 hover:text-red-400"
                            disabled={actionLoading === u.user_id}
                            onClick={() => handleApproval(u.user_id, "rejected")}
                          >
                            <X className="h-3 w-3 mr-1" /> Reject
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ID Photo Viewer */}
      <Dialog open={!!viewingPhoto} onOpenChange={() => setViewingPhoto(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>ID Document</DialogTitle>
          </DialogHeader>
          {viewingPhoto && <img src={viewingPhoto} alt="ID Document" className="w-full rounded-lg" />}
        </DialogContent>
      </Dialog>
    </motion.div>
  );
};

export default AdminSecurityTab;
