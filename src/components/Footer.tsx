import logo from "@/assets/logo.png";

const Footer = () => {
  return (
    <footer className="border-t border-border py-12">
      <div className="container mx-auto px-4">
        <div className="grid md:grid-cols-4 gap-8 mb-8">
          <div>
            <img src={logo} alt="Dope Chicks" className="h-8 mb-3" />
            <p className="text-xs text-muted-foreground">
              The premium platform for exclusive content and AI-powered creation.
            </p>
          </div>

          {[
            { title: "Platform", links: ["Explore", "Creators", "AI Studio", "Get BREAD"] },
            { title: "Company", links: ["About", "Careers", "Press", "Contact"] },
            { title: "Legal", links: ["Terms of Service", "Privacy Policy", "Content Guidelines", "DMCA"] },
          ].map((col) => (
            <div key={col.title}>
              <h4 className="font-bold text-sm mb-3">{col.title}</h4>
              <ul className="space-y-2">
                {col.links.map((link) => (
                  <li key={link}>
                    <a href="#" className="text-xs text-muted-foreground hover:text-foreground transition-colors">
                      {link}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="border-t border-border pt-6 flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-xs text-muted-foreground">
            © 2026 Dope Chicks. All rights reserved. 18+ only.
          </p>
          <p className="text-xs text-muted-foreground">
            Powered by BREAD 🍞
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
