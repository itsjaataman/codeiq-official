import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAppSettings } from "@/hooks/useAppSettings";
import codeiqLogo from "@/assets/codeiq-logo.png";
import Footer from "@/components/layout/Footer";
import {
  CheckCircle2,
  Code2,
  Trophy,
  BarChart3,
  Building2,
  BookOpen,
  Flame,
  Star,
  ArrowRight,
  RefreshCw,
  Crown,
  Sparkles,
  Rocket,
  Users,
} from "lucide-react";

const features = [
  {
    icon: Code2,
    title: "LeetCode Verified",
    description: "Your solutions are automatically verified against LeetCode submissions. No fake progress.",
  },
  {
    icon: BookOpen,
    title: "Topic-wise Learning",
    description: "Master DSA concepts systematically with curated problem sets organized by topic.",
  },
  {
    icon: Building2,
    title: "Company-wise Practice",
    description: "Practice problems asked by top tech companies like Google, Amazon, and Meta.",
  },
  {
    icon: Flame,
    title: "Streak & Habits",
    description: "Build consistent coding habits with daily streaks and spaced repetition.",
  },
  {
    icon: BarChart3,
    title: "Deep Analytics",
    description: "Track your progress with detailed statistics and performance insights.",
  },
  {
    icon: Trophy,
    title: "Achievements",
    description: "Unlock badges and achievements as you master different topics and skills.",
  },
];

const plans = [
  {
    name: "Basic",
    price: "₹99",
    period: "one-time",
    description: "Perfect for getting started",
    features: [
      "Topic-wise problems",
      "LeetCode verification",
      "Basic streak tracking",
      "Progress analytics",
    ],
    popular: false,
  },
  {
    name: "Pro",
    price: "₹499",
    period: "3 months",
    description: "Most popular choice",
    features: [
      "Everything in Basic",
      "Company-wise problems",
      "Spaced repetition (SRS)",
      "Advanced analytics",
      "Peer comparison",
      "Priority support",
    ],
    popular: true,
  },
  {
    name: "Pro+",
    price: "₹899",
    period: "6 months",
    description: "Best value for serious coders",
    features: [
      "Everything in Pro",
      "Extended access period",
      "College leaderboards",
      "Personal notes",
      "Achievement badges",
    ],
    popular: false,
  },
  {
    name: "Lifetime",
    price: "₹1,499",
    period: "forever",
    description: "One-time investment",
    features: [
      "Everything in Pro+",
      "Lifetime access",
      "All future updates",
      "Exclusive features",
      "VIP support",
    ],
    popular: false,
  },
];

// Stats are now fetched from settings

export default function Landing() {
  const { settings, isLoading: settingsLoading } = useAppSettings();
  const paidFeaturesEnabled = settings.paid_features_enabled;
  
  const stats = [
    { value: settings.landing_stats.problems_count, label: "Curated Problems" },
    { value: settings.landing_stats.companies_count, label: "Companies" },
    { value: settings.landing_stats.topics_count, label: "Topics" },
  ];

  // Free mode landing page (no pricing)
  if (!settingsLoading && !paidFeaturesEnabled) {
    return (
      <div className="min-h-screen bg-background">
        {/* Navigation */}
        <nav className="fixed top-0 left-0 right-0 z-50 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <div className="container mx-auto flex h-16 items-center justify-between px-4">
            <Link to="/" className="flex items-center gap-2">
              <img src={codeiqLogo} alt="CodeIQ" className="h-10" />
            </Link>
            <div className="hidden md:flex items-center gap-6">
              <a href="#features" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
                Features
              </a>
              <a href="#how-it-works" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
                How It Works
              </a>
            </div>
            <div className="flex items-center gap-3">
              <Button variant="ghost" asChild>
                <Link to="/auth">Sign In</Link>
              </Button>
              <Button asChild>
                <Link to="/auth">Get Started Free</Link>
              </Button>
            </div>
          </div>
        </nav>

        {/* Hero Section */}
        <section className="relative pt-32 pb-20 overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-background to-success/5" />
          <div className="absolute top-20 right-0 w-96 h-96 bg-primary/10 rounded-full blur-3xl" />
          <div className="absolute bottom-0 left-0 w-96 h-96 bg-success/10 rounded-full blur-3xl" />
          
          <div className="container relative mx-auto px-4">
            <div className="max-w-4xl mx-auto text-center">
              <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold tracking-tight text-foreground mb-6 animate-fade-up">
                Master DSA with{" "}
                <span className="text-gradient-orange">LeetCode-Verified</span>{" "}
                Practice
              </h1>
              
              <p className="text-lg md:text-xl text-muted-foreground mb-8 max-w-2xl mx-auto animate-fade-up delay-200">
                The only platform that verifies your LeetCode submissions in real-time. 
                Track your progress, build streaks, and ace your technical interviews - completely free!
              </p>

              <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-12 animate-fade-up delay-300">
                <Button size="xl" asChild className="gap-2">
                  <Link to="/auth">
                    Start Learning Now
                    <Rocket className="h-5 w-5" />
                  </Link>
                </Button>
                <Button size="xl" variant="outline" asChild>
                  <a href="#features">Explore Features</a>
                </Button>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-3 gap-6 animate-fade-up delay-400">
                {stats.map((stat) => (
                  <div key={stat.label} className="text-center">
                    <div className="text-3xl md:text-4xl font-bold text-primary">{stat.value}</div>
                    <div className="text-sm text-muted-foreground">{stat.label}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section id="features" className="py-20 bg-muted/30">
          <div className="container mx-auto px-4">
            <div className="text-center mb-16">
              <Badge variant="secondary" className="mb-4">
                <Star className="h-3 w-3 mr-1" />
                All Features Included
              </Badge>
              <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
                Everything you need to succeed
              </h2>
              <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                A complete platform designed to help you master data structures and algorithms efficiently.
              </p>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {features.map((feature, index) => (
                <div
                  key={feature.title}
                  className="group bg-card rounded-xl p-6 border border-border shadow-card hover:shadow-card-hover hover:-translate-y-1 transition-all duration-300"
                  style={{ animationDelay: `${index * 100}ms` }}
                >
                  <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 text-primary mb-4 group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                    <feature.icon className="h-6 w-6" />
                  </div>
                  <h3 className="text-lg font-semibold text-foreground mb-2">
                    {feature.title}
                  </h3>
                  <p className="text-muted-foreground">
                    {feature.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* How It Works */}
        <section id="how-it-works" className="py-20">
          <div className="container mx-auto px-4">
            <div className="text-center mb-16">
              <Badge variant="secondary" className="mb-4">
                <RefreshCw className="h-3 w-3 mr-1" />
                How It Works
              </Badge>
              <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
                Simple. Verified. Effective.
              </h2>
            </div>

            <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
              {[
                {
                  step: "01",
                  title: "Connect LeetCode",
                  description: "Link your LeetCode account securely and verify your profile.",
                },
                {
                  step: "02",
                  title: "Practice Problems",
                  description: "Solve curated problems organized by topic or company.",
                },
                {
                  step: "03",
                  title: "Track Progress",
                  description: "Watch your skills grow with verified stats and analytics.",
                },
              ].map((item, index) => (
                <div key={item.step} className="relative text-center">
                  <div className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-primary text-primary-foreground text-2xl font-bold mb-4">
                    {item.step}
                  </div>
                  {index < 2 && (
                    <div className="hidden md:block absolute top-8 left-[60%] w-[80%] border-t-2 border-dashed border-border" />
                  )}
                  <h3 className="text-xl font-semibold text-foreground mb-2">
                    {item.title}
                  </h3>
                  <p className="text-muted-foreground">
                    {item.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Community Stats Section */}
        <section className="py-20 bg-muted/30">
          <div className="container mx-auto px-4">
            <div className="max-w-4xl mx-auto text-center">
              <Badge variant="secondary" className="mb-4">
                <Users className="h-3 w-3 mr-1" />
                Join Our Community
              </Badge>
              <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-8">
                Trusted by developers worldwide
              </h2>
              <div className="grid grid-cols-3 gap-8">
                <div className="p-6 bg-card rounded-xl border border-border">
                  <div className="text-4xl font-bold text-success mb-2">{settings.landing_stats.problems_count}</div>
                  <div className="text-muted-foreground">Problems</div>
                </div>
                <div className="p-6 bg-card rounded-xl border border-border">
                  <div className="text-4xl font-bold text-warning mb-2">{settings.landing_stats.companies_count}</div>
                  <div className="text-muted-foreground">Companies</div>
                </div>
                <div className="p-6 bg-card rounded-xl border border-border">
                  <div className="text-4xl font-bold text-info mb-2">{settings.landing_stats.topics_count}</div>
                  <div className="text-muted-foreground">Topics</div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="py-20">
          <div className="container mx-auto px-4">
            <div className="max-w-4xl mx-auto text-center bg-gradient-to-r from-primary to-success rounded-2xl p-12 shadow-card">
              <h2 className="text-3xl md:text-4xl font-bold text-primary-foreground mb-4">
                Ready to level up your DSA skills?
              </h2>
              <p className="text-lg text-primary-foreground/80 mb-8 max-w-xl mx-auto">
                Join thousands of developers who are already mastering algorithms with CodeIQ - completely free!
              </p>
              <Button size="xl" variant="hero" asChild className="gap-2">
                <Link to="/auth">
                  Get Started Free
                  <ArrowRight className="h-5 w-5" />
                </Link>
              </Button>
            </div>
          </div>
        </section>

        <Footer />
      </div>
    );
  }

  // Paid mode landing page (with pricing)
  return (
    <div className="min-h-screen bg-background">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <Link to="/" className="flex items-center gap-2">
            <img src={codeiqLogo} alt="CodeIQ" className="h-10" />
          </Link>
          <div className="hidden md:flex items-center gap-6">
            <a href="#features" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
              Features
            </a>
            <a href="#pricing" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
              Pricing
            </a>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="ghost" asChild>
              <Link to="/auth">Sign In</Link>
            </Button>
            <Button asChild>
              <Link to="/auth">Get Started</Link>
            </Button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative pt-32 pb-20 overflow-hidden">
        {/* Background */}
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-background to-warning/5" />
        <div className="absolute top-20 right-0 w-96 h-96 bg-primary/10 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-warning/10 rounded-full blur-3xl" />
        
        <div className="container relative mx-auto px-4">
          <div className="max-w-4xl mx-auto text-center">
            <Badge variant="secondary" className="mb-6 animate-fade-up">
              <Flame className="h-3 w-3 mr-1" />
              Level up your DSA skills
            </Badge>
            
            <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold tracking-tight text-foreground mb-6 animate-fade-up delay-100">
              Master DSA with{" "}
              <span className="text-gradient-orange">LeetCode-Verified</span>{" "}
              Practice
            </h1>
            
            <p className="text-lg md:text-xl text-muted-foreground mb-8 max-w-2xl mx-auto animate-fade-up delay-200">
              The only platform that verifies your LeetCode submissions in real-time. 
              Track your progress, build streaks, and ace your technical interviews.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-12 animate-fade-up delay-300">
              <Button size="xl" asChild className="gap-2">
                <Link to="/auth">
                  Start Free Trial
                  <ArrowRight className="h-5 w-5" />
                </Link>
              </Button>
              <Button size="xl" variant="outline" asChild>
                <a href="#features">Learn More</a>
              </Button>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-6 animate-fade-up delay-400">
              {stats.map((stat) => (
                <div key={stat.label} className="text-center">
                  <div className="text-3xl md:text-4xl font-bold text-primary">{stat.value}</div>
                  <div className="text-sm text-muted-foreground">{stat.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <Badge variant="secondary" className="mb-4">
              <Star className="h-3 w-3 mr-1" />
              Features
            </Badge>
            <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
              Everything you need to succeed
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              A complete platform designed to help you master data structures and algorithms efficiently.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature, index) => (
              <div
                key={feature.title}
                className="group bg-card rounded-xl p-6 border border-border shadow-card hover:shadow-card-hover hover:-translate-y-1 transition-all duration-300"
                style={{ animationDelay: `${index * 100}ms` }}
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 text-primary mb-4 group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                  <feature.icon className="h-6 w-6" />
                </div>
                <h3 className="text-lg font-semibold text-foreground mb-2">
                  {feature.title}
                </h3>
                <p className="text-muted-foreground">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <Badge variant="secondary" className="mb-4">
              <RefreshCw className="h-3 w-3 mr-1" />
              How It Works
            </Badge>
            <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
              Simple. Verified. Effective.
            </h2>
          </div>

          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {[
              {
                step: "01",
                title: "Connect LeetCode",
                description: "Link your LeetCode account securely and verify your profile.",
              },
              {
                step: "02",
                title: "Practice Problems",
                description: "Solve curated problems organized by topic or company.",
              },
              {
                step: "03",
                title: "Track Progress",
                description: "Watch your skills grow with verified stats and analytics.",
              },
            ].map((item, index) => (
              <div key={item.step} className="relative text-center">
                <div className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-primary text-primary-foreground text-2xl font-bold mb-4">
                  {item.step}
                </div>
                {index < 2 && (
                  <div className="hidden md:block absolute top-8 left-[60%] w-[80%] border-t-2 border-dashed border-border" />
                )}
                <h3 className="text-xl font-semibold text-foreground mb-2">
                  {item.title}
                </h3>
                <p className="text-muted-foreground">
                  {item.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="py-20 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <Badge variant="secondary" className="mb-4">
              <Crown className="h-3 w-3 mr-1" />
              Pricing
            </Badge>
            <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
              Choose your plan
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Start with a 3-day free trial. No credit card required.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-6xl mx-auto">
            {plans.map((plan) => (
              <div
                key={plan.name}
                className={`relative bg-card rounded-xl p-6 border-2 transition-all duration-300 hover:-translate-y-1 ${
                  plan.popular
                    ? "border-primary shadow-orange"
                    : "border-border shadow-card hover:shadow-card-hover"
                }`}
              >
                {plan.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <Badge variant="premium">Most Popular</Badge>
                  </div>
                )}
                <div className="text-center mb-6">
                  <h3 className="text-xl font-bold text-foreground mb-2">{plan.name}</h3>
                  <div className="flex items-baseline justify-center gap-1">
                    <span className="text-4xl font-extrabold text-foreground">{plan.price}</span>
                    <span className="text-muted-foreground">/{plan.period}</span>
                  </div>
                  <p className="text-sm text-muted-foreground mt-2">{plan.description}</p>
                </div>
                <ul className="space-y-3 mb-6">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2 text-sm">
                      <CheckCircle2 className="h-4 w-4 text-success mt-0.5 shrink-0" />
                      <span className="text-muted-foreground">{feature}</span>
                    </li>
                  ))}
                </ul>
                <Button
                  variant={plan.popular ? "default" : "outline"}
                  className="w-full"
                  asChild
                >
                  <Link to="/auth">Get Started</Link>
                </Button>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto text-center bg-gradient-to-r from-primary to-warning rounded-2xl p-12 shadow-orange">
            <h2 className="text-3xl md:text-4xl font-bold text-primary-foreground mb-4">
              Ready to level up your DSA skills?
            </h2>
            <p className="text-lg text-primary-foreground/80 mb-8 max-w-xl mx-auto">
              Join thousands of developers who are already mastering algorithms with CodeIQ.
            </p>
            <Button size="xl" variant="hero" asChild className="gap-2">
              <Link to="/auth">
                Start Free Trial
                <ArrowRight className="h-5 w-5" />
              </Link>
            </Button>
          </div>
        </div>
      </section>

        <Footer />
    </div>
  );
}
