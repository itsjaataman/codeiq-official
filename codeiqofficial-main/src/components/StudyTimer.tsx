import { useState, useEffect, useCallback } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Play,
  Pause,
  RotateCcw,
  Coffee,
  Brain,
  Timer,
  CheckCircle2,
} from "lucide-react";
import { toast } from "sonner";

type TimerMode = "work" | "shortBreak" | "longBreak";

interface PomodoroSettings {
  workMinutes: number;
  shortBreakMinutes: number;
  longBreakMinutes: number;
  sessionsUntilLongBreak: number;
}

const defaultSettings: PomodoroSettings = {
  workMinutes: 25,
  shortBreakMinutes: 5,
  longBreakMinutes: 15,
  sessionsUntilLongBreak: 4,
};

export function StudyTimer() {
  const [settings] = useState<PomodoroSettings>(defaultSettings);
  const [mode, setMode] = useState<TimerMode>("work");
  const [timeLeft, setTimeLeft] = useState(settings.workMinutes * 60);
  const [isRunning, setIsRunning] = useState(false);
  const [completedSessions, setCompletedSessions] = useState(0);

  const totalTime = useCallback(() => {
    switch (mode) {
      case "work":
        return settings.workMinutes * 60;
      case "shortBreak":
        return settings.shortBreakMinutes * 60;
      case "longBreak":
        return settings.longBreakMinutes * 60;
    }
  }, [mode, settings]);

  const progress = ((totalTime() - timeLeft) / totalTime()) * 100;

  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;

    if (isRunning && timeLeft > 0) {
      interval = setInterval(() => {
        setTimeLeft((prev) => prev - 1);
      }, 1000);
    } else if (timeLeft === 0) {
      // Timer completed
      if (mode === "work") {
        const newSessions = completedSessions + 1;
        setCompletedSessions(newSessions);
        toast.success(`Great work! Session ${newSessions} complete!`);
        
        // Determine next break type
        if (newSessions % settings.sessionsUntilLongBreak === 0) {
          setMode("longBreak");
          setTimeLeft(settings.longBreakMinutes * 60);
          toast.info("Time for a long break! You've earned it.");
        } else {
          setMode("shortBreak");
          setTimeLeft(settings.shortBreakMinutes * 60);
          toast.info("Take a short break!");
        }
      } else {
        // Break completed
        setMode("work");
        setTimeLeft(settings.workMinutes * 60);
        toast.info("Break over! Ready for another session?");
      }
      setIsRunning(false);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isRunning, timeLeft, mode, completedSessions, settings]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const handleReset = () => {
    setIsRunning(false);
    setTimeLeft(totalTime());
  };

  const handleModeChange = (newMode: TimerMode) => {
    setMode(newMode);
    setIsRunning(false);
    switch (newMode) {
      case "work":
        setTimeLeft(settings.workMinutes * 60);
        break;
      case "shortBreak":
        setTimeLeft(settings.shortBreakMinutes * 60);
        break;
      case "longBreak":
        setTimeLeft(settings.longBreakMinutes * 60);
        break;
    }
  };

  const modeConfig = {
    work: {
      label: "Focus Time",
      icon: Brain,
      color: "text-primary",
      bgColor: "bg-primary/10",
      borderColor: "border-primary/30",
    },
    shortBreak: {
      label: "Short Break",
      icon: Coffee,
      color: "text-success",
      bgColor: "bg-success/10",
      borderColor: "border-success/30",
    },
    longBreak: {
      label: "Long Break",
      icon: Coffee,
      color: "text-info",
      bgColor: "bg-info/10",
      borderColor: "border-info/30",
    },
  };

  const currentConfig = modeConfig[mode];
  const Icon = currentConfig.icon;

  return (
    <Card className={`p-6 ${currentConfig.bgColor} border ${currentConfig.borderColor}`}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Timer className={`h-5 w-5 ${currentConfig.color}`} />
          <h3 className="font-semibold text-foreground">Study Timer</h3>
        </div>
        <Badge variant="secondary" className="gap-1">
          <CheckCircle2 className="h-3 w-3" />
          {completedSessions} sessions
        </Badge>
      </div>

      {/* Mode Tabs */}
      <div className="flex gap-1 mb-4 p-1 bg-background/50 rounded-lg">
        {(["work", "shortBreak", "longBreak"] as TimerMode[]).map((m) => (
          <button
            key={m}
            onClick={() => handleModeChange(m)}
            className={`flex-1 py-1.5 px-2 text-xs font-medium rounded-md transition-all ${
              mode === m
                ? `${modeConfig[m].bgColor} ${modeConfig[m].color}`
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {m === "work" ? "Focus" : m === "shortBreak" ? "Short" : "Long"}
          </button>
        ))}
      </div>

      {/* Timer Display */}
      <div className="text-center mb-4">
        <div className="flex items-center justify-center gap-2 mb-2">
          <Icon className={`h-6 w-6 ${currentConfig.color}`} />
          <span className={`text-sm font-medium ${currentConfig.color}`}>
            {currentConfig.label}
          </span>
        </div>
        <div className={`text-5xl font-bold font-mono ${currentConfig.color}`}>
          {formatTime(timeLeft)}
        </div>
      </div>

      {/* Progress Bar */}
      <Progress value={progress} className="h-2 mb-4" />

      {/* Controls */}
      <div className="flex items-center justify-center gap-2">
        <Button
          variant="outline"
          size="icon"
          onClick={handleReset}
          className="h-10 w-10"
        >
          <RotateCcw className="h-4 w-4" />
        </Button>
        <Button
          size="lg"
          onClick={() => setIsRunning(!isRunning)}
          className={`px-8 ${mode === "work" ? "" : "bg-success hover:bg-success/90"}`}
        >
          {isRunning ? (
            <>
              <Pause className="h-4 w-4 mr-2" />
              Pause
            </>
          ) : (
            <>
              <Play className="h-4 w-4 mr-2" />
              {timeLeft === totalTime() ? "Start" : "Resume"}
            </>
          )}
        </Button>
      </div>

      {/* Session Indicators */}
      <div className="flex items-center justify-center gap-2 mt-4">
        {Array.from({ length: settings.sessionsUntilLongBreak }).map((_, i) => (
          <div
            key={i}
            className={`h-2 w-2 rounded-full transition-all ${
              i < completedSessions % settings.sessionsUntilLongBreak
                ? "bg-primary"
                : "bg-muted"
            }`}
          />
        ))}
      </div>
      <p className="text-xs text-center text-muted-foreground mt-2">
        {settings.sessionsUntilLongBreak - (completedSessions % settings.sessionsUntilLongBreak)} sessions until long break
      </p>
    </Card>
  );
}
