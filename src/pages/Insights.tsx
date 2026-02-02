import { TbFocus2 } from "react-icons/tb";
import { ImEyeBlocked } from "react-icons/im";
import { ImTrophy } from "react-icons/im";
import { useEffect, useState } from "react";
import { formatTotalTime } from "../utils/Helpers";
import { MdToday } from "react-icons/md";
import { IoMdTrendingUp } from "react-icons/io";
import { IoMdTrendingDown } from "react-icons/io";
import { RiArrowDownSFill } from "react-icons/ri";
import { RiArrowUpSFill } from "react-icons/ri";

export interface InsightsData {
  todayTotal: number;
  todayBlocked: number;
  weeklyTotal: number;
  weeklyBlocked: number;
  dailyAverage: number;
  averageBlockedPercentage: number;
  dailyBlockedAverage: number;
  yesterdayTotal: number;
  yesterdayBlocked: number;
  blockedPercentage: number;
  weeklyBlockedPercentage: number;
  yesterdayBlockedPercentage: number;
  timeSpentFromYesterday: number;
  blockedTimeFromYesterday: number;
  focusScoreFromYesterday: number;
  yesterdayFocusScore: number;
  diffFromAverage: number;
  focusScore: number;
  streak: number;
  bestDay: string;
  bestDayBlockedTime: number;
  worstDay: string;
  worstDayBlockedTime: number;
  lastUpdated: number;
}

export default function Insights() {
  const [insights, setInsights] = useState<InsightsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadInsights = async () => {
      try {
        const data = await chrome.storage.local.get(["insights"]);
        if (data.insights) {
          setInsights(data.insights as InsightsData);
        }
        setLoading(false);
      } catch (error) {
        console.error("Failed to load insights:", error);
        setLoading(false);
      }
    };

    loadInsights();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handleStorageChange = (changes: any, area: string) => {
      if (area === "local" && changes.insights) {
        setInsights(changes.insights.newValue);
      }
    };

    chrome.storage.onChanged.addListener(handleStorageChange);

    return () => {
      chrome.storage.onChanged.removeListener(handleStorageChange);
    };
  }, []);

  if (!insights) {
    return (
      <div className="w-full h-full justify-center items-center">
        <div className="text-sub-text">No data available yet. Start browsing to see your insights!</div>;
      </div>
    );
  }

  if (loading) {
    return (
      <div className="w-full h-full justify-center items-center">
        <div className="text-sub-text">Loading insights...</div>;
      </div>
    );
  }

  const {
    focusScore,
    streak,
    timeSpentFromYesterday,
    blockedTimeFromYesterday,
    focusScoreFromYesterday,
    yesterdayFocusScore,
    blockedPercentage,
    averageBlockedPercentage,
    weeklyBlocked,
    todayBlocked,
    todayTotal,
    yesterdayBlocked,
    yesterdayTotal,
    dailyBlockedAverage,
    bestDay,
    bestDayBlockedTime,
    worstDay,
    worstDayBlockedTime,
  } = insights || {
    focusScore: 0,
    streak: 0,
    timeSpentFromYesterday: 0,
    blockedTimeFromYesterday: 0,
    focusScoreFromYesterday: 0,
    yesterdayFocusScore: 0,
    blockedPercentage: 0,
    averageBlockPercentage: 0,
    yesterdayBlockedPercentage: 0,
    diffFromAverage: 0,
    weeklyBlocked: 0,
    todayBlocked: 0,
    todayTotal: 0,
    yesterdayBlocked: 0,
    yesterdayTotal: 0,
    dailyAverage: 0,
    dailyBlockedAverage: 0,
    bestDay: "",
    bestDayBlockedTime: 0,
    worstDay: "",
    worstDayBlockedTime: 0,
  };

  const getFocusQuote = () => {
    // Score > 90
    if (focusScore >= 90) {
      return streak > 2
        ? `${streak} day streak! You are completely locked in.`
        : "Elite focus today. You're controlling your time perfectly.";
    }

    // Score 80 - 89
    if (focusScore >= 80) {
      return streak > 0
        ? "Solid consistency. Keep the momentum going!"
        : "Great session. You're making intentional choices.";
    }

    // Score < 80 but improved by at least 5 points
    if (focusScoreFromYesterday >= 5) {
      return `Moving in the right direction! ${Math.abs(focusScoreFromYesterday)} points up from yesterday.`;
    }

    // Score dropped by more than 10 points
    if (focusScoreFromYesterday <= -10) {
      return "Focus is slipping today. Don't let this become a pattern.";
    }

    return "Every day is a fresh start. reclaim your attention.";
  };

  const getBlockedQuote = () => {
    // Basically no distractions
    if (todayBlocked < 300) {
      return "Almost zero distractions today. Impressive discipline!";
    }

    // Better than average (> 20% improvement)
    if (dailyBlockedAverage > 0 && todayBlocked < dailyBlockedAverage * 0.8) {
      const diff = (((dailyBlockedAverage - todayBlocked) / dailyBlockedAverage) * 100).toFixed(0);
      return `${diff}% less distracted than usual. Keep it up!`;
    }

    // Roughly Average (Within 10% of average)
    if (dailyBlockedAverage > 0 && Math.abs(todayBlocked - dailyBlockedAverage) / dailyBlockedAverage < 0.1) {
      return "A typical day. Try to shave off 10 minutes tomorrow.";
    }

    // Significantly worse (> 20% worse)
    if (dailyBlockedAverage > 0 && todayBlocked > dailyBlockedAverage * 1.2) {
      const diff = (((todayBlocked - dailyBlockedAverage) / dailyBlockedAverage) * 100).toFixed(0);
      return `Distractions are up ${diff}% today. Time to lock it back in.`;
    }

    return "Stay conscious of your browsing habits.";
  };

  const getComparisonQuote = () => {
    // More total time but LESS blocked time (best scenario)
    if (timeSpentFromYesterday < -10 && blockedTimeFromYesterday > 10) {
      return "Got something important? Screen time is up with less distraction.";
    }

    // Less total time AND Less blocked time
    if (blockedTimeFromYesterday > 0 && timeSpentFromYesterday > 0) {
      return "Spending time wisely! Less time online & less distractions!";
    }

    // Improved Discipline only
    if (blockedTimeFromYesterday > 5) {
      return "Blocked time is down. You're resisting the urge to scroll.";
    }

    // Reduced Screen Time only
    if (timeSpentFromYesterday > 5) {
      return "Less screen time overall. That's healthy progress!";
    }

    return "Tomorrow is a new opportunity to improve your stats.";
  };

  const getRecordsQuote = () => {
    const diff = (((worstDayBlockedTime - bestDayBlockedTime) / worstDayBlockedTime) * 100).toFixed(0);

    // Basically no distractions
    if (bestDayBlockedTime < 300) {
      return `Your were truly locked in on ${bestDay}! Keep it up, you got this!`;
    }

    // Large gap between best and worst
    if (worstDayBlockedTime - bestDayBlockedTime > 3600) {
      return `${diff}% difference between ${bestDay} & ${worstDay}. Consistency is key!`;
    }

    // Small gap good consistency
    if (worstDayBlockedTime > 0 && worstDayBlockedTime - bestDayBlockedTime < 900) {
      return "You are remarkably consistent with your habits. Keep it up!";
    }

    return "Build your best days by staying intentional.";
  };

  return (
    <div className="flex flex-col w-full h-full mt-2">
      <div className="grid grid-cols-2 grid-rows-2 gap-2 w-full h-full">
        {/* Focus Score Card */}
        <div
          style={{ "--delay": `50ms` } as React.CSSProperties}
          className="animate-fade-up animate-stagger flex flex-col border-2 border-bg-light transition-all duration-300 p-2"
        >
          <div className="flex items-center gap-1 mb-1">
            <TbFocus2 className="size-4 text-secondary" />
            <span className="text-[12px] text-secondary uppercase">Current Session</span>
          </div>
          <div className="flex-1 flex flex-col">
            <div className="flex-1 flex flex-col justify-center gap-1">
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-sub-text uppercase">Lock In Score</span>
                <span
                  className={`text-sm font-semibold flex items-center justify-center gap-1 ${focusScoreFromYesterday >= 0 ? "text-green-500" : "text-red-500"}`}
                >
                  {focusScoreFromYesterday >= 0 ? <IoMdTrendingUp /> : <IoMdTrendingDown />}
                  {focusScore}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-sub-text uppercase">Streak</span>
                <span className="text-sm font-semibold text-text">{streak}d</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-sub-text uppercase">vs Yesterday</span>
                <span
                  className={`text-sm font-semibold ${focusScoreFromYesterday >= 0 ? "text-green-500" : "text-red-500"}`}
                >
                  <span className="text-text">{yesterdayFocusScore} </span>({focusScoreFromYesterday > 0 ? "+" : ""}
                  {focusScoreFromYesterday})
                </span>
              </div>
            </div>

            <div className="mt-1 pt-1 border-t border-bg-light">
              <p className="text-[10px] text-sub-text leading-tight tracking-wide">{getFocusQuote()}</p>
            </div>
          </div>
        </div>

        {/* Blocked Stats Card */}
        <div
          style={{ "--delay": `100ms` } as React.CSSProperties}
          className="animate-fade-up animate-stagger flex flex-col border-2 border-bg-light transition-all duration-300 p-2"
        >
          <div className="flex items-center gap-1 mb-1">
            <ImEyeBlocked className="size-4 text-secondary" />
            <span className="text-[12px] text-secondary uppercase">Blocked</span>
          </div>
          <div className="flex-1 flex flex-col">
            <div className="flex-1 flex flex-col justify-center gap-1">
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-sub-text uppercase">Today</span>
                <span className="text-sm font-semibold text-text">
                  {formatTotalTime(todayBlocked)}{" "}
                  <span className="text-secondary font-normal">({blockedPercentage.toFixed(0)}%)</span>
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-sub-text uppercase">Daily Avg</span>
                <span className="text-sm font-semibold text-text">
                  {formatTotalTime(dailyBlockedAverage)}{" "}
                  <span className="text-secondary font-normal">({averageBlockedPercentage.toFixed(0)}%)</span>
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-sub-text uppercase">Weekly</span>
                <span className="text-sm font-semibold text-text">{formatTotalTime(weeklyBlocked)}</span>
              </div>
            </div>
            <div className="mt-1 pt-1 border-t border-bg-light">
              <p className="text-[10px] text-sub-text leading-tight tracking-wide">{getBlockedQuote()}</p>
            </div>
          </div>
        </div>

        {/* Comparison Card */}
        <div
          style={{ "--delay": `150ms` } as React.CSSProperties}
          className="animate-fade-up animate-stagger flex flex-col border-2 border-bg-light transition-all duration-300 p-2"
        >
          <div className="flex items-center gap-1 mb-1">
            <MdToday className="size-4 text-secondary" />
            <span className="text-[12px] text-secondary uppercase">vs Yesterday</span>
          </div>
          <div className="flex-1 flex flex-col">
            <div className="flex-1 flex flex-col justify-center">
              <div className="flex items-center justify-center">
                <span className="text-[10px] text-sub-text uppercase">Overall</span>
                <span
                  className={`text-[10px] font-semibold flex-row flex items-center ${timeSpentFromYesterday > 0 ? "text-green-500" : "text-red-500"}`}
                >
                  {timeSpentFromYesterday > 0 ? (
                    <RiArrowDownSFill className="size-3" />
                  ) : (
                    <RiArrowUpSFill className="size-3" />
                  )}
                  {Math.abs(timeSpentFromYesterday).toFixed(0)}%
                </span>
              </div>
              <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 mb-1 w-full">
                <span className="text-sm font-semibold text-primary text-right tabular-nums leading-none">
                  {formatTotalTime(todayTotal)}
                </span>
                <span className="text-sm font-semibold text-text leading-none">vs</span>
                <span className="text-sm font-semibold text-secondary text-left tabular-nums leading-none">
                  {formatTotalTime(yesterdayTotal)}
                </span>
              </div>
              <div className="flex items-center justify-center mt-1">
                <span className="text-[10px] text-sub-text uppercase">Blocked</span>
                <span
                  className={`text-[10px] font-semibold flex-row flex items-center ${blockedTimeFromYesterday > 0 ? "text-green-500" : "text-red-500"}`}
                >
                  {blockedTimeFromYesterday > 0 ? (
                    <RiArrowDownSFill className="size-3" />
                  ) : (
                    <RiArrowUpSFill className="size-3" />
                  )}
                  {Math.abs(blockedTimeFromYesterday).toFixed(0)}%
                </span>
              </div>
              <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 mb-1 w-full">
                <span className="text-sm font-semibold text-primary text-right tabular-nums leading-none">
                  {formatTotalTime(todayBlocked)}
                </span>
                <span className="text-sm font-semibold text-text leading-none">vs</span>
                <span className="text-sm font-semibold text-secondary text-left leading-none">
                  {formatTotalTime(yesterdayBlocked)}
                </span>
              </div>
            </div>
            <div className="mt-1 pt-1 border-t border-bg-light justify-start">
              <p className="text-[10px] text-sub-text leading-tight tracking-wide">{getComparisonQuote()}</p>
            </div>
          </div>
        </div>

        {/* Records Card */}
        <div
          style={{ "--delay": `200ms` } as React.CSSProperties}
          className="animate-fade-up animate-stagger flex flex-col border-2 border-bg-light transition-all duration-300 p-2"
        >
          <div className="flex items-center gap-1 mb-1">
            <ImTrophy className="size-4 text-secondary" />
            <span className="text-[12px] text-secondary uppercase">Best Days</span>
          </div>
          <div className="flex-1 flex flex-col">
            <div className="flex-1 flex flex-col justify-center gap-1">
              <div className="flex items-center justify-between">
                <div className="flex flex-col">
                  <span className="text-[10px] text-green-500 uppercase">Least Blocked</span>
                  <span className="text-[10px] text-sub-text uppercase">{bestDay}</span>
                </div>
                <span className="text-sm font-semibold text-text">{formatTotalTime(bestDayBlockedTime)}</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex flex-col">
                  <span className="text-[10px] text-red-500 uppercase">Most Blocked</span>
                  <span className="text-[10px] text-sub-text uppercase">{worstDay}</span>
                </div>
                <span className="text-sm font-semibold text-text">{formatTotalTime(worstDayBlockedTime)}</span>
              </div>
              <div className="mt-1 pt-1 border-t border-bg-light">
                <p className="text-[10px] text-sub-text leading-tight tracking-wide">{getRecordsQuote()}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
