"use client";

import { useEffect, useState } from "react";
import { formatDate, formatRelative } from "@/lib/format";

export function RelativeTime({ iso }: { iso: string | Date | null | undefined }) {
  const [text, setText] = useState(() => formatDate(iso));

  useEffect(() => {
    setText(formatRelative(iso) || formatDate(iso));
  }, [iso]);

  return <span suppressHydrationWarning>{text}</span>;
}
