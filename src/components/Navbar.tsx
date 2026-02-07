import { useState } from "react";
import { motion } from "framer-motion";
import { Menu, X, LogOut, Coins, Settings, UserCircle, MessageCircle, Sparkles } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import logo from "@/assets/logo.png";

const navLinks = [
  { label: "Explore", href: "/#explore" },
  { label: "Creators", href: "/#creators" },
  { label: "AI Studio", href: "/ai-studio" },
  { label: "Get BREAD", href: "/#bread" },
];

const Navbar = () => {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { user, profile, wallet, creditWallet, signOut } = useAuth();
  const navigate = useNavigate();

  const isCreator = profile?.is_creator;

  return (
    <motion.nav
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.5 }}
      className="fixed top-0 left-0 right-0 z-50 glass border-b border-border"
    >
      <div className="container mx-auto flex items-center justify-between h-20 px-4">
        <a href="/" className="flex items-center gap-2">
          <img src={logo} alt="Dope Chicks" className="h-20 w-20 object-contain mix-blend-screen drop-shadow-[0_0_15px_hsl(42,80%,55%,0.3)]" />
        </a>

        {/* Desktop Nav */}
        <div className="hidden md:flex items-center gap-8">
          {navLinks.map((link) => (
            <a
              key={link.label}
              href={link.href}
              className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              {link.label}
            </a>
          ))}
        </div>

        <div className="hidden md:flex items-center gap-3">
          {user ? (
            <>
              {/* Show BREAD for fans, CREDITS for creators */}
              {isCreator ? (
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-muted border border-primary/30">
                  <Sparkles className="h-3.5 w-3.5 text-primary" />
                  <span className="text-xs font-bold text-primary">{creditWallet?.balance ?? 0} Credits</span>
                </div>
              ) : (
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-muted border border-border">
                  <Coins className="h-3.5 w-3.5 text-accent" />
                  <span className="text-xs font-bold text-gradient-gold">{wallet?.balance ?? 0} BREAD</span>
                </div>
              )}
              <span className="text-sm text-muted-foreground">{profile?.display_name || user.email}</span>
              {isCreator && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => navigate(`/creator/${(profile.display_name || "").toLowerCase().replace(/\s+/g, "")}`)}
                  className="text-muted-foreground hover:text-foreground text-xs"
                >
                  <UserCircle className="h-4 w-4 mr-1" /> My Profile
                </Button>
              )}
              <Button variant="ghost" size="icon" onClick={() => navigate("/messages")} className="text-muted-foreground hover:text-foreground">
                <MessageCircle className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" onClick={() => navigate("/settings")} className="text-muted-foreground hover:text-foreground">
                <Settings className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" onClick={signOut} className="text-muted-foreground hover:text-foreground">
                <LogOut className="h-4 w-4" />
              </Button>
            </>
          ) : (
            <>
              <Button variant="ghost" className="text-sm" onClick={() => navigate("/auth")}>Log In</Button>
              <Button className="bg-gradient-purple text-primary-foreground text-sm font-semibold hover:opacity-90" onClick={() => navigate("/auth")}>
                Sign Up Free
              </Button>
            </>
          )}
        </div>

        {/* Mobile toggle */}
        <button className="md:hidden text-foreground" onClick={() => setMobileOpen(!mobileOpen)}>
          {mobileOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </div>

      {/* Mobile Menu */}
      {mobileOpen && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          className="md:hidden glass border-b border-border px-4 pb-4"
        >
          <div className="flex flex-col gap-3">
            {navLinks.map((link) => (
              <a
                key={link.label}
                href={link.href}
                className="py-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
                onClick={() => setMobileOpen(false)}
              >
                {link.label}
              </a>
            ))}
            {user ? (
              <div className="flex items-center justify-between pt-2">
                <div className="flex items-center gap-2">
                  {isCreator ? (
                    <>
                      <Sparkles className="h-4 w-4 text-primary" />
                      <span className="text-sm font-bold text-primary">{creditWallet?.balance ?? 0} Credits</span>
                    </>
                  ) : (
                    <>
                      <Coins className="h-4 w-4 text-accent" />
                      <span className="text-sm font-bold text-gradient-gold">{wallet?.balance ?? 0} BREAD</span>
                    </>
                  )}
                </div>
                <Button variant="ghost" size="sm" onClick={signOut}>Sign Out</Button>
              </div>
            ) : (
              <div className="flex gap-2 pt-2">
                <Button variant="ghost" className="flex-1 text-sm" onClick={() => { navigate("/auth"); setMobileOpen(false); }}>Log In</Button>
                <Button className="flex-1 bg-gradient-purple text-primary-foreground text-sm font-semibold" onClick={() => { navigate("/auth"); setMobileOpen(false); }}>Sign Up</Button>
              </div>
            )}
          </div>
        </motion.div>
      )}
    </motion.nav>
  );
};

export default Navbar;
