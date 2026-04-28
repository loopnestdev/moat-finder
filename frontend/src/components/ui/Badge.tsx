import type { ReactNode } from "react";

interface BadgeProps {
  variant?: "default" | "green" | "yellow" | "red" | "orange" | "blue";
  children: ReactNode;
  className?: string;
}

const variantClasses: Record<NonNullable<BadgeProps["variant"]>, string> = {
  default: "bg-navy-700 text-cream-muted border border-navy-600",
  green: "bg-green/10 text-green border border-green/30",
  yellow: "bg-amber-400/10 text-amber-400 border border-amber-400/30",
  red: "bg-red-900/30 text-red-400 border border-red-700/30",
  orange: "bg-orange-900/30 text-orange-400 border border-orange-700/30",
  blue: "bg-blue-900/30 text-blue-400 border border-blue-700/30",
};

export default function Badge({
  variant = "default",
  children,
  className = "",
}: BadgeProps) {
  return (
    <span
      className={[
        "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium",
        variantClasses[variant],
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {children}
    </span>
  );
}
