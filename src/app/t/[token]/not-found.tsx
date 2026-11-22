import { BrandMark } from "@/components/brand-mark";

export default function TrackingNotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4 text-center">
      <BrandMark size="lg" />
      <p className="mt-4 text-[11px] font-semibold uppercase tracking-[0.22em] text-poster-vermillion">
        Ziloty
      </p>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight">Link not found</h1>
      <p className="mt-2 max-w-sm text-sm text-muted-foreground">
        This tracking page is no longer available. Ask your Ziloty specialist for a new link.
      </p>
    </div>
  );
}
