type SketchblockLogoProps = {
  className?: string;
  /** onDark: light block for dark backgrounds. onLight: navy block for light backgrounds. */
  variant?: "onDark" | "onLight";
};

/** A stacked drawing sheet with a single, open sketch stroke. */
export function SketchblockLogo({ className, variant = "onDark" }: SketchblockLogoProps) {
  const blockStroke = variant === "onDark" ? "var(--sidebar-foreground)" : "var(--foreground)";
  const sketchStroke = variant === "onDark" ? "var(--sidebar-primary)" : "var(--primary)";

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
        d="M10 16H7a3 3 0 0 0-3 3v21a4 4 0 0 0 4 4h22a3 3 0 0 0 3-3v-3"
        stroke={blockStroke}
        strokeWidth="2.5"
        opacity="0.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M39 5H16a5 5 0 0 0-5 5v22a5 5 0 0 0 5 5h22a5 5 0 0 0 5-5V18"
        stroke={blockStroke}
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M20 28l5-12 5 11L43 7"
        stroke={sketchStroke}
        strokeWidth="3.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
