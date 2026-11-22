import type { SeriesPoint } from "@/lib/types";
import { fmtBRL } from "@/lib/format";

/** Gráfico de barras em SVG (sem dependências). Comissão diária com tooltip nativo. */
export function CommissionChart({ data }: { data: SeriesPoint[] }) {
  if (!data.length) return <div className="py-10 text-center text-sm text-muted">Sem dados no período.</div>;
  const W = 720;
  const H = 200;
  const pad = { l: 8, r: 8, t: 8, b: 22 };
  const max = Math.max(...data.map((d) => d.commission_brl), 1);
  const bw = (W - pad.l - pad.r) / data.length;
  const ticks = [0, Math.floor((data.length - 1) / 2), data.length - 1];
  return (
    <figure>
      <svg viewBox={`0 0 ${W} ${H}`} className="h-52 w-full" role="img" aria-label="Comissão diária">
        {[0.25, 0.5, 0.75, 1].map((f) => (
          <line key={f} x1={pad.l} x2={W - pad.r} y1={pad.t + (H - pad.t - pad.b) * (1 - f)} y2={pad.t + (H - pad.t - pad.b) * (1 - f)} stroke="var(--border)" strokeDasharray="3 4" />
        ))}
        {data.map((d, i) => {
          const h = ((H - pad.t - pad.b) * d.commission_brl) / max;
          return (
            <rect key={d.day} x={pad.l + i * bw + bw * 0.15} y={H - pad.b - h} width={bw * 0.7} height={Math.max(h, 1)} rx={2} fill="var(--accent-2)" opacity={0.85}>
              <title>{`${d.day}: ${fmtBRL(d.commission_brl)} · ${d.orders} pedidos`}</title>
            </rect>
          );
        })}
        {ticks.map((i) => (
          <text key={i} x={pad.l + i * bw + bw / 2} y={H - 6} textAnchor="middle" fontSize="11" fill="var(--muted)">
            {data[i].day.slice(5).split("-").reverse().join("/")}
          </text>
        ))}
      </svg>
      <figcaption className="mt-1 text-xs text-muted">Máximo diário: {fmtBRL(max)}</figcaption>
    </figure>
  );
}
