import { cn } from "@ai-video/ui/lib/utils";

export function BrandMark({
  className,
  light = false,
}: {
  className?: string;
  light?: boolean;
}) {
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <span className="relative block h-9 w-12" aria-hidden="true">
        <span
          className={cn(
            "absolute left-0 top-0 size-9 rounded-full",
            light ? "bg-[#f3f0ee]" : "bg-[#141413]",
          )}
        />
        <span
          className={cn(
            "absolute right-0 top-0 size-9 rounded-full border-[1.5px] bg-[#f37338]/90",
            light ? "border-[#f3f0ee]" : "border-[#141413] mix-blend-multiply",
          )}
        />
      </span>
      <span
        className={cn(
          "text-[15px] font-semibold tracking-[-0.03em]",
          light && "text-[#f3f0ee]",
        )}
      >
        AI Video
      </span>
    </div>
  );
}
