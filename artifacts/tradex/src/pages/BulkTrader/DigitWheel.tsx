interface DigitWheelProps {
  digit: number;
  percentage: number;
  isLastDigit?: boolean;
  isHighest?: boolean;
  isLowest?: boolean;
  isBarrier?: boolean;
  onClick?: () => void;
  /** When set, hides the Even/Odd badge (irrelevant for Over/Under and Matches/Differs) */
  showEvenOddBadge?: boolean;
}

const RADIUS = 26;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

export default function DigitWheel({
  digit,
  percentage,
  isLastDigit,
  isHighest,
  isLowest,
  isBarrier,
  onClick,
  showEvenOddBadge = true,
}: DigitWheelProps) {
  const isEven = digit % 2 === 0;
  const dashOffset = CIRCUMFERENCE - (Math.min(Math.max(percentage, 0), 100) / 100) * CIRCUMFERENCE;

  const ringColor = isBarrier
    ? "#a855f7"
    : isHighest
      ? "#22c55e"
      : isLowest
        ? "#ef4444"
        : "hsl(var(--primary))";

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      className={`flex flex-col items-center gap-1.5 rounded-lg transition-transform ${
        onClick ? "cursor-pointer hover:scale-105 active:scale-95" : "cursor-default"
      } ${isBarrier ? "ring-2 ring-purple-500 ring-offset-2 ring-offset-background rounded-full" : ""}`}
    >
      <div className="relative flex items-center justify-center w-16 h-16">
        <svg viewBox="0 0 60 60" className="w-16 h-16 -rotate-90">
          <circle cx="30" cy="30" r={RADIUS} fill="none" stroke="currentColor" strokeWidth="4" className="text-muted/40" />
          <circle
            cx="30"
            cy="30"
            r={RADIUS}
            fill="none"
            stroke={ringColor}
            strokeWidth="4"
            strokeLinecap="round"
            strokeDasharray={CIRCUMFERENCE}
            strokeDashoffset={dashOffset}
            className="transition-[stroke-dashoffset] duration-300 ease-out"
          />
        </svg>
        <div className="absolute flex flex-col items-center">
          <span className="text-sm font-bold text-foreground">{digit}</span>
          <span className="text-[10px] text-muted-foreground">{percentage.toFixed(1)}%</span>
        </div>
        {isLastDigit && (
          <svg
            viewBox="0 0 10 8"
            className="absolute -bottom-2 w-2.5 h-2 text-primary"
            fill="currentColor"
          >
            <path d="M5 8 L0 0 L10 0 Z" />
          </svg>
        )}
      </div>
      {showEvenOddBadge && (
        <span
          className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${
            isEven ? "bg-teal-500/15 text-teal-600 dark:text-teal-400" : "bg-red-500/15 text-red-600 dark:text-red-400"
          }`}
        >
          {isEven ? "E" : "O"}
        </span>
      )}
    </button>
  );
}
