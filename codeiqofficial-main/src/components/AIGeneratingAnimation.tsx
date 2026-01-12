import { Bot, Sparkles, Code2, Zap, Brain, Lightbulb } from "lucide-react";

const floatingIcons = [
  { Icon: Code2, delay: "0s", position: "top-4 left-8" },
  { Icon: Zap, delay: "0.5s", position: "top-8 right-12" },
  { Icon: Brain, delay: "1s", position: "bottom-8 left-12" },
  { Icon: Lightbulb, delay: "1.5s", position: "bottom-4 right-8" },
];

export function AIGeneratingAnimation() {
  return (
    <div className="flex flex-col items-center justify-center py-12 relative">
      {/* Floating icons */}
      {floatingIcons.map(({ Icon, delay, position }, index) => (
        <div
          key={index}
          className={`absolute ${position} opacity-20`}
          style={{
            animation: `float 3s ease-in-out infinite`,
            animationDelay: delay,
          }}
        >
          <Icon className="h-6 w-6 text-primary" />
        </div>
      ))}

      {/* Main animation container */}
      <div className="relative">
        {/* Outer glow ring */}
        <div className="absolute inset-0 rounded-full bg-primary/20 blur-2xl animate-pulse scale-150" />
        
        {/* Rotating ring */}
        <div 
          className="absolute inset-0 rounded-full border-2 border-dashed border-primary/30"
          style={{
            animation: "spin 8s linear infinite",
            width: "120px",
            height: "120px",
            left: "-10px",
            top: "-10px",
          }}
        />
        
        {/* Secondary rotating ring */}
        <div 
          className="absolute inset-0 rounded-full border-2 border-dotted border-primary/20"
          style={{
            animation: "spin 12s linear infinite reverse",
            width: "140px",
            height: "140px",
            left: "-20px",
            top: "-20px",
          }}
        />

        {/* Center bot icon */}
        <div className="relative z-10 flex h-24 w-24 items-center justify-center rounded-full bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/30">
          <Bot className="h-12 w-12 text-primary animate-pulse" />
        </div>

        {/* Orbiting sparkle */}
        <div
          className="absolute"
          style={{
            animation: "orbit 3s linear infinite",
            width: "100%",
            height: "100%",
            left: 0,
            top: 0,
          }}
        >
          <Sparkles 
            className="h-5 w-5 text-warning absolute -top-2 left-1/2 -translate-x-1/2" 
          />
        </div>
      </div>

      {/* Text content */}
      <div className="mt-8 text-center relative z-10">
        <h3 className="text-lg font-semibold text-foreground mb-2 flex items-center justify-center gap-2">
          <span className="inline-block animate-pulse">AI is thinking</span>
          <span className="flex gap-1">
            <span className="inline-block animate-bounce" style={{ animationDelay: "0ms" }}>.</span>
            <span className="inline-block animate-bounce" style={{ animationDelay: "150ms" }}>.</span>
            <span className="inline-block animate-bounce" style={{ animationDelay: "300ms" }}>.</span>
          </span>
        </h3>
        <p className="text-sm text-muted-foreground max-w-xs">
          Analyzing the problem and crafting a step-by-step solution
        </p>
      </div>

      {/* Progress indicators */}
      <div className="mt-6 flex items-center gap-3">
        {["Analyzing", "Coding", "Optimizing"].map((step, index) => (
          <div
            key={step}
            className="flex items-center gap-1.5 text-xs"
            style={{
              animation: "fadeInOut 2s ease-in-out infinite",
              animationDelay: `${index * 0.7}s`,
            }}
          >
            <div className="h-1.5 w-1.5 rounded-full bg-primary" />
            <span className="text-muted-foreground">{step}</span>
          </div>
        ))}
      </div>

      <style>{`
        @keyframes float {
          0%, 100% { transform: translateY(0) rotate(0deg); }
          50% { transform: translateY(-10px) rotate(5deg); }
        }
        
        @keyframes orbit {
          from { transform: rotate(0deg) translateX(50px) rotate(0deg); }
          to { transform: rotate(360deg) translateX(50px) rotate(-360deg); }
        }
        
        @keyframes fadeInOut {
          0%, 100% { opacity: 0.3; }
          50% { opacity: 1; }
        }
      `}</style>
    </div>
  );
}
