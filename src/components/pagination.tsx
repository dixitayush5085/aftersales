import Link from "next/link";
import { Button } from "@/components/ui/button";

export function Pagination({
  page,
  pageCount,
  hrefFor,
}: {
  page: number;
  pageCount: number;
  hrefFor: (page: number) => string;
}) {
  if (pageCount <= 1) return null;
  return (
    <div className="flex items-center justify-between pt-4 text-sm text-muted-foreground">
      <span>
        Page {page} of {pageCount}
      </span>
      <div className="flex gap-2">
        <Button variant="outline" size="sm" asChild disabled={page <= 1}>
          <Link href={hrefFor(Math.max(1, page - 1))}>Previous</Link>
        </Button>
        <Button variant="outline" size="sm" asChild disabled={page >= pageCount}>
          <Link href={hrefFor(Math.min(pageCount, page + 1))}>Next</Link>
        </Button>
      </div>
    </div>
  );
}
