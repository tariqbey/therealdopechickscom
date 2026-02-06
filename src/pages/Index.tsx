import Navbar from "@/components/Navbar";
import HeroSection from "@/components/HeroSection";
import FeaturedCreators from "@/components/FeaturedCreators";
import BreadSection from "@/components/BreadSection";
import AIStudioPreview from "@/components/AIStudioPreview";
import Footer from "@/components/Footer";

const Index = () => {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <HeroSection />
      <FeaturedCreators />
      <BreadSection />
      <AIStudioPreview />
      <Footer />
    </div>
  );
};

export default Index;
