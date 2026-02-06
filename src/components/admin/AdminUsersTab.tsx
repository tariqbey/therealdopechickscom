import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { motion } from "framer-motion";
import { Eye, Shield, UserCheck, UserX, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

interface UserRow {
  id: string;
  user_id: string;
  display_name: string | null;
  avatar_url: string | null;
  is_creator: boolean;
  created_at: string;
}

interface UserRole {
  user_id: string;
  role: string;
}

interface AdminUsersTabProps {
  users: UserRow[];
  onRefresh: () => void;
}

const AdminUsersTab = ({ users, onRefresh }: AdminUsersTabProps) => {
  const [search, setSearch] = useState("");
  const [roles, setRoles] = useState<Record<string, string>>({});
  const [loadingAction, setLoadingAction] = useState<string | null>(null);

  const filteredUsers = users.filter(
    (u) =>
      !search ||
      (u.display_name || "").toLowerCase().includes(search.toLowerCase())
  );

  const callAdminAction = async (action: string, params: Record<string, unknown>) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    const res = await supabase.functions.invoke("admin-actions", {
      body: { action, ...params },
    });
    if (res.error) throw new Error(res.error.message);
    return res.data;
  };

  const fetchRoles = async () => {
    const { data } = await supabase.from("user_roles").select("user_id, role");
    if (data) {
      const map: Record<string, string> = {};
      (data as UserRole[]).forEach((r) => (map[r.user_id] = r.role));
      setRoles(map);
    }
  };

  // Fetch roles on mount
  useState(() => {
    fetchRoles();
  });

  const toggleCreator = async (userId: string, currentValue: boolean) => {
    setLoadingAction(userId + "-creator");
    try {
      await callAdminAction("toggle_creator", {
        user_id: userId,
        is_creator: !currentValue,
      });
      toast.success(`User ${!currentValue ? "promoted to Creator" : "set to Fan"}`);
      onRefresh();
    } catch (e: any) {
      toast.error(e.message);
    }
    setLoadingAction(null);
  };

  const setRole = async (userId: string, role: string) => {
    setLoadingAction(userId + "-role");
    try {
      if (role === "none") {
        await callAdminAction("remove_role", { user_id: userId });
        toast.success("Role removed");
      } else {
        await callAdminAction("set_role", { user_id: userId, role });
        toast.success(`Role set to ${role}`);
      }
      fetchRoles();
    } catch (e: any) {
      toast.error(e.message);
    }
    setLoadingAction(null);
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search users..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <span className="text-sm text-muted-foreground">{filteredUsers.length} users</span>
      </div>

      <div className="rounded-xl bg-gradient-card border border-border p-6">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-muted-foreground text-left border-b border-border">
                <th className="pb-3 font-medium">User</th>
                <th className="pb-3 font-medium">Creator</th>
                <th className="pb-3 font-medium">Role</th>
                <th className="pb-3 font-medium">Joined</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filteredUsers.map((u) => (
                <tr key={u.id} className="text-foreground">
                  <td className="py-3 flex items-center gap-3">
                    <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center text-xs font-bold text-muted-foreground">
                      {(u.display_name || "?")[0].toUpperCase()}
                    </div>
                    <span className="font-medium">{u.display_name || "Unknown"}</span>
                  </td>
                  <td className="py-3">
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={u.is_creator}
                        onCheckedChange={() => toggleCreator(u.user_id, u.is_creator)}
                        disabled={loadingAction === u.user_id + "-creator"}
                      />
                      <span className="text-xs text-muted-foreground">
                        {u.is_creator ? "Creator" : "Fan"}
                      </span>
                    </div>
                  </td>
                  <td className="py-3">
                    <Select
                      value={roles[u.user_id] || "none"}
                      onValueChange={(val) => setRole(u.user_id, val)}
                      disabled={loadingAction === u.user_id + "-role"}
                    >
                      <SelectTrigger className="w-32 h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">No role</SelectItem>
                        <SelectItem value="user">User</SelectItem>
                        <SelectItem value="moderator">Moderator</SelectItem>
                        <SelectItem value="admin">Admin</SelectItem>
                      </SelectContent>
                    </Select>
                  </td>
                  <td className="py-3 text-muted-foreground">
                    {new Date(u.created_at).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </motion.div>
  );
};

export default AdminUsersTab;
