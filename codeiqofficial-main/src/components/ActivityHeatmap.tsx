import { useMemo, useRef } from "react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface ActivityData {
  date: string;
  count: number;
}

interface ActivityHeatmapProps {
  data: ActivityData[];
}

export function ActivityHeatmap({ data }: ActivityHeatmapProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const { weeks, maxCount } = useMemo(() => {
    // Generate last 365 days
    const today = new Date();
    const days: { date: Date; count: number }[] = [];
    
    for (let i = 364; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split("T")[0];
      const activity = data.find((d) => d.date === dateStr);
      days.push({
        date,
        count: activity?.count || 0,
      });
    }

    // Group by weeks (Sunday-Saturday)
    const weeks: { date: Date; count: number }[][] = [];
    let currentWeek: { date: Date; count: number }[] = [];

    // Add empty cells for the first week if it doesn't start on Sunday
    const firstDay = days[0].date.getDay();
    for (let i = 0; i < firstDay; i++) {
      currentWeek.push({ date: new Date(0), count: -1 }); // -1 indicates empty cell
    }

    days.forEach((day) => {
      currentWeek.push(day);
      if (currentWeek.length === 7) {
        weeks.push(currentWeek);
        currentWeek = [];
      }
    });

    if (currentWeek.length > 0) {
      weeks.push(currentWeek);
    }

    const maxCount = Math.max(...days.map((d) => d.count), 1);

    return { weeks, maxCount };
  }, [data]);

  const getColor = (count: number) => {
    if (count === -1) return "transparent";
    if (count === 0) return "hsl(var(--muted))";
    const intensity = Math.min(count / maxCount, 1);
    if (intensity <= 0.25) return "hsl(var(--success) / 0.3)";
    if (intensity <= 0.5) return "hsl(var(--success) / 0.5)";
    if (intensity <= 0.75) return "hsl(var(--success) / 0.75)";
    return "hsl(var(--success))";
  };

  const months = useMemo(() => {
    const monthLabels: { label: string; weekIndex: number }[] = [];
    let currentMonth = -1;

    weeks.forEach((week, weekIndex) => {
      const firstValidDay = week.find((d) => d.count !== -1);
      if (firstValidDay) {
        const month = firstValidDay.date.getMonth();
        if (month !== currentMonth) {
          currentMonth = month;
          monthLabels.push({
            label: firstValidDay.date.toLocaleDateString("en-US", { month: "short" }),
            weekIndex,
          });
        }
      }
    });

    return monthLabels;
  }, [weeks]);

  const totalContributions = data.reduce((sum, d) => sum + d.count, 0);
  const cellSize = 12; // w-3 = 12px
  const gap = 3;
  const totalWidth = weeks.length * (cellSize + gap);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-sm text-muted-foreground mb-3">
        <span>{totalContributions} problems solved in the last year</span>
      </div>

      <div className="flex gap-1">
        {/* Day labels - fixed position */}
        <div className="flex flex-col gap-[3px] text-xs text-muted-foreground pr-2 shrink-0">
          <span className="h-3 leading-3"></span>
          <span className="h-3 leading-3">Mon</span>
          <span className="h-3 leading-3"></span>
          <span className="h-3 leading-3">Wed</span>
          <span className="h-3 leading-3"></span>
          <span className="h-3 leading-3">Fri</span>
          <span className="h-3 leading-3"></span>
        </div>

        {/* Scrollable container for months and grid */}
        <div 
          ref={scrollContainerRef}
          className="overflow-x-auto overflow-y-hidden flex-1 pb-2"
          style={{ scrollbarWidth: 'thin' }}
        >
          {/* Month labels - inside scroll container */}
          <div 
            className="flex text-xs text-muted-foreground mb-1 h-4"
            style={{ width: `${totalWidth}px` }}
          >
            {months.map((m, i) => (
              <div
                key={i}
                className="absolute text-xs"
                style={{
                  left: `${m.weekIndex * (cellSize + gap)}px`,
                }}
              >
                {m.label}
              </div>
            ))}
          </div>

          {/* Relative wrapper for month positioning */}
          <div className="relative" style={{ width: `${totalWidth}px` }}>
            {/* Month labels positioned absolutely */}
            <div className="absolute -top-5 left-0 right-0 h-4">
              {months.map((m, i) => (
                <span
                  key={i}
                  className="absolute text-xs text-muted-foreground whitespace-nowrap"
                  style={{
                    left: `${m.weekIndex * (cellSize + gap)}px`,
                  }}
                >
                  {m.label}
                </span>
              ))}
            </div>

            {/* Grid */}
            <div className="flex gap-[3px] pt-5">
              <TooltipProvider delayDuration={100}>
                {weeks.map((week, weekIndex) => (
                  <div key={weekIndex} className="flex flex-col gap-[3px]">
                    {week.map((day, dayIndex) => (
                      <Tooltip key={dayIndex}>
                        <TooltipTrigger asChild>
                          <div
                            className="w-3 h-3 rounded-sm transition-colors cursor-pointer hover:ring-1 hover:ring-foreground/20"
                            style={{
                              backgroundColor: getColor(day.count),
                              opacity: day.count === -1 ? 0 : 1,
                            }}
                          />
                        </TooltipTrigger>
                        {day.count !== -1 && (
                          <TooltipContent side="top" className="text-xs z-50">
                            <p className="font-medium">
                              {day.count} problem{day.count !== 1 ? "s" : ""} solved
                            </p>
                            <p className="text-muted-foreground">
                              {day.date.toLocaleDateString("en-US", {
                                weekday: "short",
                                month: "short",
                                day: "numeric",
                                year: "numeric",
                              })}
                            </p>
                          </TooltipContent>
                        )}
                      </Tooltip>
                    ))}
                  </div>
                ))}
              </TooltipProvider>
            </div>
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center justify-end gap-2 text-xs text-muted-foreground mt-2">
        <span>Less</span>
        <div className="flex gap-1">
          <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: "hsl(var(--muted))" }} />
          <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: "hsl(var(--success) / 0.3)" }} />
          <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: "hsl(var(--success) / 0.5)" }} />
          <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: "hsl(var(--success) / 0.75)" }} />
          <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: "hsl(var(--success))" }} />
        </div>
        <span>More</span>
      </div>
    </div>
  );
}