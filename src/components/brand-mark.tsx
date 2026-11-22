import { cn } from "@/lib/utils";

export function BrandMark({
  className,
  size = "md",
}: {
  className?: string;
  size?: "sm" | "md" | "lg";
}) {
  const px = size === "lg" ? "h-11 w-11" : size === "sm" ? "h-8 w-8" : "h-9 w-9";
  return (
    <span
      className={cn(
        "relative inline-flex items-center justify-center overflow-hidden rounded-xl bg-sidebar text-sidebar-foreground shadow-sm",
        px,
        className,
      )}
      aria-hidden
    >
      <svg viewBox="0 0 32 32" className="h-[70%] w-[70%]" fill="none">
        <path d="M6 7h20l-12 9h12v9H6l12-9H6V7z" fill="currentColor" />
      </svg>
      <span className="absolute bottom-0.5 right-0.5 h-2 w-2 rounded-sm bg-poster-vermillion" />
    </span>
  );
}
