import { useEffect } from "react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import UserGuide from "@/components/UserGuide";
import { useSetting } from "@/hooks/usePlatform";

const GuidePage = () => {
  const site = useSetting("site");
  useEffect(() => { document.title = `Help & Guide · ${site.site_name}`; }, [site.site_name]);
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container mx-auto px-4 pt-24 pb-16">
        <UserGuide />
      </div>
      <Footer />
    </div>
  );
};

export default GuidePage;
