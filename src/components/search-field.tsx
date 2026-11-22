"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";

export function SearchField({
  defaultValue,
  placeholder,
}: {
  defaultValue?: string;
  placeholder: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const urlQ = searchParams.get("q") ?? defaultValue ?? "";
  const [value, setValue] = useState(urlQ);

  useEffect(() => {
    setValue(urlQ);
  }, [urlQ]);

  useEffect(() => {
    const q = value.trim();
    if (q === urlQ.trim()) return;
    const t = window.setTimeout(() => {
      const params = new URLSearchParams();
      if (q) params.set("q", q);
      const next = params.toString() ? `${pathname}?${params}` : pathname;
      router.replace(next, { scroll: false });
    }, 300);
    return () => window.clearTimeout(t);
  }, [value, urlQ, pathname, router]);

  return (
    <div className="relative">
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={placeholder}
        name="client-search"
        autoComplete="off"
        autoCorrect="off"
        spellCheck={false}
        className="w-64 pl-9 md:w-80"
      />
    </div>
  );
}
