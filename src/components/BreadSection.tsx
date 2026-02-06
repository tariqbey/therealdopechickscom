import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Coins, Zap, Shield, ArrowRight } from "lucide-react";

const packages = [
  { amount: 100, price: 10, popular: false },
  { amount: 250, price: 20, popular: false },
  { amount: 500, price: 40, popular: true },
  { amount: 1000, price: 75, popular: false },
  { amount: 2500, price: 175, popular: false },
];

const BreadSection = () => {
  return (
    <section id="bread" className="py-20 relative overflow-hidden">
      {/* Subtle bg glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-primary/5 blur-[120px]" />

      <div className="container mx-auto px-4 relative">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-12"
        >
          <div className="flex items-center justify-center gap-2 mb-3">
            <Coins className="h-5 w-5 text-accent" />
            <span className="text-xs font-bold uppercase tracking-widest text-accent">
              Platform Currency
            </span>
          </div>
          <h2 className="text-4xl md:text-5xl font-black mb-4">
            Get Your <span className="text-gradient-gold italic">BREAD</span>
          </h2>
          <p className="text-muted-foreground max-w-md mx-auto">
            BREAD is the currency that powers everything on Dope Chicks — subscriptions, tips, PPV content, and AI tools.
          </p>
        </motion.div>

        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 max-w-4xl mx-auto mb-12">
          {packages.map((pkg, i) => (
            <motion.div
              key={pkg.amount}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.08 }}
              className={`relative rounded-xl p-4 text-center border transition-colors cursor-pointer hover:border-primary/40 ${
                pkg.popular
                  ? "bg-gradient-card border-accent/40 glow-gold"
                  : "bg-gradient-card border-border"
              }`}
            >
              {pkg.popular && (
                <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 px-3 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-accent text-accent-foreground rounded-full">
                  Best Value
                </span>
              )}
              <div className="text-2xl font-black text-gradient-gold mb-1">{pkg.amount}</div>
              <div className="text-xs text-muted-foreground mb-1">BREAD</div>
              <div className="text-lg font-bold text-foreground">${pkg.price}</div>
              <Button
                size="sm"
                className="w-full mt-3 h-8 text-xs bg-gradient-purple text-primary-foreground font-semibold hover:opacity-90"
              >
                Buy
              </Button>
            </motion.div>
          ))}
        </div>

        {/* Features */}
        <div className="grid md:grid-cols-3 gap-6 max-w-3xl mx-auto">
          {[
            { icon: Zap, title: "Instant Access", desc: "Use BREAD immediately for any content or AI tool" },
            { icon: Shield, title: "Secure Payments", desc: "Stripe-powered transactions with full encryption" },
            { icon: Coins, title: "Creator Cashout", desc: "Creators convert BREAD to real money anytime" },
          ].map(({ icon: Icon, title, desc }) => (
            <div key={title} className="text-center">
              <Icon className="h-8 w-8 text-primary mx-auto mb-2" />
              <h3 className="font-bold text-sm mb-1">{title}</h3>
              <p className="text-xs text-muted-foreground">{desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default BreadSection;
