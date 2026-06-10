import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Eye, LogOut, Loader2 } from "lucide-react";
import { getImpersonation, stopImpersonation, type ImpersonationInfo } from "@/lib/impersonation";

/**
 * Fixed banner shown while an admin is signed in as another user.
 * One click returns to the admin's own session.
 */
const ImpersonationBar = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [info, setInfo] = useState<ImpersonationInfo | null>(null);
  const [returning, setReturning] = useState(false);

  useEffect(() => {
    setInfo(getImpersonation());
  }, [user?.id]);

  if (!info || !user || user.id !== info.user_id) return null;

  const handleReturn = async () => {
    setReturning(true);
    await stopImpersonation();
    setReturning(false);
    setInfo(null);
    navigate("/admin");
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 z-[100] bg-accent text-accent-foreground px-4 py-2 flex items-center justify-center gap-3 shadow-lg">
      <Eye className="h-4 w-4 shrink-0" />
      <span className="text-sm font-bold truncate">
        Viewing as {info.display_name} — everything you do happens as this user
      </span>
      <Button
        size="sm"
        variant="secondary"
        className="h-7 text-xs font-bold shrink-0"
        onClick={handleReturn}
        disabled={returning}
      >
        {returning ? (
          <Loader2 className="h-3 w-3 animate-spin" />
        ) : (
          <><LogOut className="h-3 w-3 mr-1" /> Return to Admin</>
        )}
      </Button>
    </div>
  );
};

export default ImpersonationBar;
