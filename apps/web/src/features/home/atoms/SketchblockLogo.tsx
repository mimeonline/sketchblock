type SketchblockLogoProps = {
  className?: string;
  /** onDark: light block for dark backgrounds. onLight: navy block for light backgrounds. */
  variant?: "onDark" | "onLight";
};

/**
 * Sketchblock-Signet: Eine offene Blockkontur wird von einer freien S-Linie durchlaufen.
 */
export function SketchblockLogo({ className, variant = "onDark" }: SketchblockLogoProps) {
  const blockStroke = variant === "onDark" ? "#f8fafc" : "#0f2350";
  const sketchStroke = variant === "onDark" ? "#34d399" : "#0f8b6d";

  return (
    <svg
      viewBox="0 0 48 48"
      className={className}
      role="img"
      aria-label="Sketchblock"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M38 5H15C9.477 5 5 9.477 5 15V33C5 38.523 9.477 43 15 43H38"
        stroke={blockStroke}
        strokeWidth="5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M40 14C35.5 9.5 22.5 10 18.5 17C14.5 24.5 34 21.5 31.5 30C29 38 17 38 11.5 33.5"
        stroke={sketchStroke}
        strokeWidth="4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
