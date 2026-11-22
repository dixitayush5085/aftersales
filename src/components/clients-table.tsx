"use client";

import { useRef, type ReactNode } from "react";
import Link from "next/link";
import { useVirtualizer } from "@tanstack/react-virtual";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PlatformPills } from "@/components/status-badge";
import { Badge } from "@/components/ui/badge";
import { AssignForm } from "@/components/assign-form";
import type { ClientListItem } from "@/lib/queries/clients";
import { RelativeTime } from "@/components/relative-time";
import { formatDate, formatInr, gstLabel } from "@/lib/format";
import type { ClientColumn } from "@/types";

type AmOption = { id: string; name: string; email: string };

export function ClientsTable({
  rows,
  ams,
  columns,
}: {
  rows: ClientListItem[];
  ams?: AmOption[];
  columns: ClientColumn[];
}) {
  const showAssign = Boolean(ams);
  const parentRef = useRef<HTMLDivElement>(null);
  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 68,
    overscan: 8,
  });

  if (rows.length <= 50) {
    return (
      <div className="overflow-hidden rounded-2xl border bg-card">
        <Table>
          <TableHeader className="sticky top-0 z-10 bg-card">
            <Header columns={columns} assign={showAssign} />
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <Row key={row.id} row={row} columns={columns} assign={assignCell(row, ams)} />
            ))}
          </TableBody>
        </Table>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border bg-card">
      <Table>
        <TableHeader>
          <Header columns={columns} assign={showAssign} />
        </TableHeader>
      </Table>
      <div ref={parentRef} className="max-h-[640px] overflow-auto">
        <div style={{ height: virtualizer.getTotalSize(), position: "relative" }}>
          {virtualizer.getVirtualItems().map((v) => {
            const row = rows[v.index];
            return (
              <div
                key={row.id}
                className="absolute left-0 right-0 border-b"
                style={{ transform: `translateY(${v.start}px)` }}
              >
                <table className="w-full text-sm">
                  <tbody>
                    <Row row={row} columns={columns} assign={assignCell(row, ams)} />
                  </tbody>
                </table>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function assignCell(row: ClientListItem, ams?: AmOption[]) {
  if (!ams) return undefined;
  if (row.primaryAmId) return null;
  return <AssignForm clientId={row.id} ams={ams} />;
}

function Header({ columns, assign }: { columns: ClientColumn[]; assign: boolean }) {
  return (
    <TableRow>
      {columns.map((col) => (
        <TableHead key={col.key}>{col.label}</TableHead>
      ))}
      {assign ? <TableHead className="w-32" /> : null}
    </TableRow>
  );
}

function Row({
  row,
  columns,
  assign,
}: {
  row: ClientListItem;
  columns: ClientColumn[];
  assign?: ReactNode;
}) {
  return (
    <TableRow className="group">
      {columns.map((col) => (
        <TableCell key={col.key}>{cellValue(col, row)}</TableCell>
      ))}
      {assign !== undefined ? <TableCell>{assign}</TableCell> : null}
    </TableRow>
  );
}

function cellValue(col: ClientColumn, row: ClientListItem): ReactNode {
  switch (col.key) {
    case "name":
      return (
        <>
          <Link href={`/clients/${row.id}`} className="font-medium group-hover:text-primary">
            {row.companyName || row.name}
          </Link>
          {row.companyName && row.name ? (
            <p className="text-xs text-muted-foreground">{row.name}</p>
          ) : null}
        </>
      );
    case "contact":
      return (
        <>
          <p>{row.mobile}</p>
          <p className="text-xs text-muted-foreground">{row.email || row.state}</p>
        </>
      );
    case "gst":
      return <Badge variant={row.gstStatus === "NO" ? "muted" : "info"}>{gstLabel(row.gstStatus)}</Badge>;
    case "planAmount":
      return <span className="tabular-nums">{formatInr(Number(row.salesAmount || 0))}</span>;
    case "platforms":
      return <PlatformPills platforms={row.platforms} />;
    case "owner":
      return (
        <span className="text-muted-foreground">
          {row.primaryAmName || "Unassigned"}
          {row.createdAt ? (
            <p className="text-xs">
              <RelativeTime iso={row.createdAt} />
            </p>
          ) : null}
        </span>
      );
    case "state":
      return row.state || "—";
    case "city":
      return row.city || "—";
    case "saleDate":
      return formatDate(row.saleDate);
    case "sourceCode":
      return row.sourceCode || "—";
    default: {
      const raw = row.customFields[col.key] || "";
      if (col.type === "money") return <span className="tabular-nums">{raw ? formatInr(Number(raw)) : "—"}</span>;
      if (col.type === "date") return raw ? formatDate(raw) : "—";
      return raw || "—";
    }
  }
}
