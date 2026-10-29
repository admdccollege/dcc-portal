"use client";

import {
  Bar, BarChart, CartesianGrid, Cell, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis
} from "recharts";

export type ChartFormat = "number" | "percent" | "inr" | "inr_k";
const FORMATTERS: Record<ChartFormat, (v: number) => string> = {
  number: (v) => v.toLocaleString("en-IN"),
  percent: (v) => `${v}%`,
  inr: (v) => `₹${v.toLocaleString("en-IN")}`,
  inr_k: (v) => (Math.abs(v) >= 1000 ? `₹${(v / 1000).toFixed(0)}k` : `₹${v}`),
};

type Datum = { label: string; value: number | null; color?: string; hint?: string };

const axis = { stroke: "var(--muted-foreground)", fontSize: 12, tickLine: false, axisLine: false } as const;

type TipProps = { active?: boolean; payload?: ReadonlyArray<{ payload?: unknown }>; format?: (v: number) => string };

function ChartTooltip({ active, payload, format }: TipProps) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload as Datum;
  return (
    <div className="rounded-md border bg-popover px-3 py-2 text-xs shadow-md">
      <p className="font-medium text-popover-foreground">{d.label}</p>
      <p className="text-muted-foreground tabular-nums">{d.value === null ? "No data" : format ? format(d.value) : d.value}</p>
      {d.hint && <p className="text-muted-foreground">{d.hint}</p>}
    </div>
  );
}

/** Single-series bar chart (magnitude). Optional per-bar colour for status bars (always paired with labels). */
export function SimpleBarChart({ data, height = 260, format: fmt = "number", horizontal = false, ariaLabel }: {
  data: Datum[];
  height?: number;
  format?: ChartFormat;
  horizontal?: boolean;
  ariaLabel: string;
}) {
  const format = FORMATTERS[fmt];
  return (
    <div role="img" aria-label={ariaLabel} style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout={horizontal ? "vertical" : "horizontal"} margin={{ top: 8, right: 12, bottom: 4, left: horizontal ? 8 : -12 }} barCategoryGap={horizontal ? 6 : "22%"}>
          <CartesianGrid stroke="var(--chart-grid)" vertical={horizontal} horizontal={!horizontal} />
          {horizontal ? (
            <>
              <XAxis type="number" {...axis} tickFormatter={format} allowDecimals={false} />
              <YAxis type="category" dataKey="label" {...axis} width={110} />
            </>
          ) : (
            <>
              <XAxis dataKey="label" {...axis} interval={0} tick={{ fontSize: 11 }} />
              <YAxis {...axis} tickFormatter={format} allowDecimals={false} />
            </>
          )}
          <Tooltip cursor={{ fill: "var(--muted)", opacity: 0.6 }} content={(p) => <ChartTooltip active={p.active} payload={p.payload} format={format} />} />
          <Bar dataKey="value" radius={horizontal ? [0, 4, 4, 0] : [4, 4, 0, 0]} maxBarSize={36} stroke="var(--card)" strokeWidth={2}>
            {data.map((d, i) => <Cell key={i} fill={d.color ?? "var(--chart-1)"} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function SimpleLineChart({ data, height = 260, format: fmt = "number", ariaLabel }: { data: Datum[]; height?: number; format?: ChartFormat; ariaLabel: string }) {
  const format = FORMATTERS[fmt];
  return (
    <div role="img" aria-label={ariaLabel} style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 16, bottom: 4, left: 4 }}>
          <CartesianGrid stroke="var(--chart-grid)" vertical={false} />
          <XAxis dataKey="label" {...axis} />
          <YAxis {...axis} tickFormatter={format} width={70} />
          <Tooltip cursor={{ stroke: "var(--muted-foreground)", strokeDasharray: "3 3" }} content={(p) => <ChartTooltip active={p.active} payload={p.payload} format={format} />} />
          <Line type="monotone" dataKey="value" stroke="var(--chart-1)" strokeWidth={2} dot={{ r: 4, strokeWidth: 2, stroke: "var(--card)", fill: "var(--chart-1)" }} activeDot={{ r: 6 }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
