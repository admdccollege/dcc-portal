import { Fragment } from "react";

export type TTEntry = { id: string; day_of_week: number; period_no: number; subject: string; detail: string; room: string | null };
export const DAY_NAMES = ["", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

/** Read-only weekly grid; `renderCell` can wrap entries with edit controls. */
export function TimetableGrid({ periods, entries, renderEntry, renderEmpty }: {
  periods: { period_no: number; start_time: string; end_time: string }[];
  entries: TTEntry[];
  renderEntry?: (e: TTEntry) => React.ReactNode;
  renderEmpty?: (day: number, period: number) => React.ReactNode;
}) {
  const at = (d: number, p: number) => entries.filter((e) => e.day_of_week === d && e.period_no === p);
  return (
    <div className="print-area overflow-x-auto rounded-xl border bg-card">
      <div className="grid min-w-[760px]" style={{ gridTemplateColumns: `90px repeat(${periods.length}, minmax(0, 1fr))` }}>
        <div className="border-b bg-muted/60 p-2 text-xs font-semibold">Day</div>
        {periods.map((p) => (
          <div key={p.period_no} className="border-b border-l bg-muted/60 p-2 text-center text-xs font-semibold">
            P{p.period_no}<span className="block font-normal text-muted-foreground">{p.start_time.slice(0, 5)}–{p.end_time.slice(0, 5)}</span>
          </div>
        ))}
        {[1, 2, 3, 4, 5, 6].map((d) => (
          <Fragment key={d}>
            <div className="border-b p-2 text-sm font-medium">{DAY_NAMES[d]}</div>
            {periods.map((p) => {
              const items = at(d, p.period_no);
              return (
                <div key={p.period_no} className="min-h-16 border-b border-l p-1.5">
                  {items.map((e) => (
                    <div key={e.id} className="mb-1 rounded-md bg-primary/10 px-2 py-1 text-xs">
                      {renderEntry ? renderEntry(e) : (
                        <>
                          <p className="font-semibold text-primary">{e.subject}</p>
                          <p className="text-muted-foreground">{e.detail}{e.room ? ` · ${e.room}` : ""}</p>
                        </>
                      )}
                    </div>
                  ))}
                  {items.length === 0 && renderEmpty?.(d, p.period_no)}
                </div>
              );
            })}
          </Fragment>
        ))}
      </div>
    </div>
  );
}
