import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import Index from "./pages/Index";
import CreatorProfile from "./pages/CreatorProfile";
import AIStudio from "./pages/AIStudio";
import Auth from "./pages/Auth";
import ProfileSettings from "./pages/ProfileSettings";
import GenerationHistory from "./pages/GenerationHistory";
import VideoPlayerPage from "./pages/VideoPlayerPage";
import AdminDashboard from "./pages/AdminDashboard";
import Install from "./pages/Install";
import AvatarBuilder from "./pages/AvatarBuilder";
import CreatorTiers from "./pages/CreatorTiers";
import Messages from "./pages/Messages";
import NotFound from "./pages/NotFound";
import PWAInstallBanner from "./components/PWAInstallBanner";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/creator/:handle" element={<CreatorProfile />} />
            <Route path="/ai-studio" element={<AIStudio />} />
            <Route path="/settings" element={<ProfileSettings />} />
            <Route path="/settings/tiers" element={<CreatorTiers />} />
            <Route path="/history" element={<GenerationHistory />} />
            <Route path="/player" element={<VideoPlayerPage />} />
            <Route path="/admin" element={<AdminDashboard />} />
            <Route path="/install" element={<Install />} />
            <Route path="/avatar-builder" element={<AvatarBuilder />} />
            <Route path="/messages" element={<Messages />} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
          <PWAInstallBanner />
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
