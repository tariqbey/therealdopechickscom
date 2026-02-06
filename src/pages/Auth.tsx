import { useState } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Sparkles, Eye, EyeOff, User, Camera } from "lucide-react";
import logo from "@/assets/logo.png";

const AuthPage = () => {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [isCreator, setIsCreator] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { signIn, signUp, user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    if (mode === "login") {
      const { error } = await signIn(email, password);
      if (error) {
        toast({ title: "Login failed", description: error, variant: "destructive" });
      } else {
        toast({ title: "Welcome back!" });
        // Check if user is admin and redirect accordingly
        const { data: session } = await (await import("@/integrations/supabase/client")).supabase.auth.getSession();
        if (session?.session?.user) {
          const { data: roleData } = await (await import("@/integrations/supabase/client")).supabase
            .from("user_roles")
            .select("role")
            .eq("user_id", session.session.user.id)
            .eq("role", "admin")
            .maybeSingle();
          navigate(roleData ? "/admin" : "/");
        } else {
          navigate("/");
        }
      }
    } else {
      const { error } = await signUp(email, password, displayName, dateOfBirth, isCreator);
      if (error) {
        toast({ title: "Signup failed", description: error, variant: "destructive" });
      } else {
        toast({ title: "Account created!", description: "Check your email to verify your account." });
      }
    }

    setIsLoading(false);
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md"
      >
        <div className="text-center mb-8">
          <a href="/">
            <img src={logo} alt="Dope Chicks" className="h-20 w-auto mx-auto mix-blend-screen drop-shadow-[0_0_15px_hsl(42,80%,55%,0.3)]" />
          </a>
          <p className="text-muted-foreground text-sm mt-2">
            {mode === "login" ? "Welcome back" : "Join the community"}
          </p>
        </div>

        <div className="rounded-xl bg-gradient-card border border-border p-6">
          {/* Tab toggle */}
          <div className="flex rounded-lg bg-muted p-1 mb-6">
            <button
              onClick={() => setMode("login")}
              className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${
                mode === "login" ? "bg-primary text-primary-foreground" : "text-muted-foreground"
              }`}
            >
              Log In
            </button>
            <button
              onClick={() => setMode("signup")}
              className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${
                mode === "signup" ? "bg-primary text-primary-foreground" : "text-muted-foreground"
              }`}
            >
              Sign Up
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === "signup" && (
              <>
                <div>
                  <Label className="text-xs font-bold text-muted-foreground">Display Name</Label>
                  <Input
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="Your display name"
                    required
                    className="bg-muted border-border mt-1"
                  />
                </div>
                <div>
                  <Label className="text-xs font-bold text-muted-foreground">Date of Birth (18+ required)</Label>
                  <Input
                    type="date"
                    value={dateOfBirth}
                    onChange={(e) => setDateOfBirth(e.target.value)}
                    required
                    className="bg-muted border-border mt-1"
                  />
                </div>
                <div>
                  <Label className="text-xs font-bold text-muted-foreground">Account Type</Label>
                  <div className="flex gap-2 mt-1">
                    <button
                      type="button"
                      onClick={() => setIsCreator(false)}
                      className={`flex-1 flex items-center justify-center gap-2 p-3 rounded-lg border text-sm font-medium transition-colors ${
                        !isCreator ? "border-primary bg-primary/10 text-foreground" : "border-border text-muted-foreground"
                      }`}
                    >
                      <User className="h-4 w-4" /> Fan
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsCreator(true)}
                      className={`flex-1 flex items-center justify-center gap-2 p-3 rounded-lg border text-sm font-medium transition-colors ${
                        isCreator ? "border-accent bg-accent/10 text-foreground" : "border-border text-muted-foreground"
                      }`}
                    >
                      <Camera className="h-4 w-4" /> Creator
                    </button>
                  </div>
                </div>
              </>
            )}

            <div>
              <Label className="text-xs font-bold text-muted-foreground">Email</Label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                className="bg-muted border-border mt-1"
              />
            </div>

            <div>
              <Label className="text-xs font-bold text-muted-foreground">Password</Label>
              <div className="relative">
                <Input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  minLength={6}
                  className="bg-muted border-border mt-1 pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <Button
              type="submit"
              disabled={isLoading}
              className="w-full bg-gradient-purple text-primary-foreground font-bold hover:opacity-90"
            >
              {isLoading ? "Please wait..." : mode === "login" ? "Log In" : "Create Account"}
            </Button>
          </form>

          {mode === "signup" && (
            <p className="text-xs text-muted-foreground text-center mt-4">
              By signing up you confirm you are 18+ years old and agree to our Terms of Service.
            </p>
          )}
        </div>
      </motion.div>
    </div>
  );
};

export default AuthPage;
