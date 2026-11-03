import React, { useState } from 'react';

/**
 * Lightweight SVG charts for the admin analytics screens.
 * Follows the dataviz rules: thin marks, 2px gaps, rounded data-ends, recessive grid,
 * hover tooltip on every chart, text in ink tokens (never series colour).
 */

const GRID = '#f1e6d8';
const AXIS_TEXT = '#78716c'; // stone-500

function niceMax(v: number) {
  if (v <= 0) return 1;
  const p = Math.pow(10, Math.floor(Math.log10(v)));
  const n = v / p;
  const step = n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10;
  return step * p;
}

const compact = (n: number) => (n >= 1e5 ? `${(n / 1e5).toFixed(1)}L` : n >= 1000 ? `${Math.round(n / 1000)}k` : String(n));
const shortDate = (iso: string) => new Date(iso + 'T00:00:00').toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });

const Tooltip: React.FC<{ leftPct: number; children: React.ReactNode }> = ({ leftPct, children }) => (
  <div
    className="absolute top-0 z-10 pointer-events-none bg-ink text-white text-[11px] rounded-lg px-2.5 py-1.5 shadow-lg whitespace-nowrap"
    style={{ left: `${leftPct}%`, transform: `translateX(${leftPct > 70 ? '-100%' : leftPct < 20 ? '0' : '-50%'})` }}
  >
    {children}
  </div>
);

export const DailyBarChart: React.FC<{
  data: { date: string; value: number }[];
  color: string;
  valueLabel: string;
  height?: number;
}> = ({ data, color, valueLabel, height = 200 }) => {
  const [hover, setHover] = useState<number | null>(null);
  const W = 720;
  const H = height;
  const padL = 40;
  const padB = 22;
  const padT = 34;
  const max = niceMax(Math.max(...data.map(d => d.value)));
  const plotW = W - padL;
  const plotH = H - padB - padT;
  const slot = plotW / data.length;
  const barW = Math.max(2, slot - 2); // 2px surface gap between bars
  const ticks = [0, 0.5, 1].map(f => f * max);

  return (
    <div className="relative" onMouseLeave={() => setHover(null)}>
      {hover !== null && (
        <Tooltip leftPct={((padL + slot * hover + slot / 2) / W) * 100}>
          <div className="font-bold">{shortDate(data[hover].date)}</div>
          <div>
            {data[hover].value.toLocaleString('en-IN')} {valueLabel}
          </div>
        </Tooltip>
      )}
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height }} role="img" aria-label={`${valueLabel} per day, last ${data.length} days`}>
        {ticks.map(t => {
          const y = padT + plotH - (t / max) * plotH;
          return (
            <g key={t}>
              <line x1={padL} x2={W} y1={y} y2={y} stroke={GRID} strokeWidth={1} />
              <text x={padL - 6} y={y + 3} textAnchor="end" fontSize={10} fill={AXIS_TEXT}>
                {compact(t)}
              </text>
            </g>
          );
        })}
        {data.map((d, i) => {
          const h = Math.max(1, (d.value / max) * plotH);
          const x = padL + i * slot + 1;
          const y = padT + plotH - h;
          const r = Math.min(4, barW / 2);
          // rounded top only, flat on the baseline
          const path = `M${x},${y + h} L${x},${y + r} Q${x},${y} ${x + r},${y} L${x + barW - r},${y} Q${x + barW},${y} ${x + barW},${y + r} L${x + barW},${y + h} Z`;
          return (
            <g key={d.date}>
              <path d={path} fill={color} opacity={hover === null || hover === i ? 1 : 0.45} />
              <rect x={padL + i * slot} y={padT} width={slot} height={plotH} fill="transparent" onMouseEnter={() => setHover(i)} />
            </g>
          );
        })}
        {data.map((d, i) =>
          i % 5 === 0 || i === data.length - 1 ? (
            <text key={'l' + d.date} x={padL + i * slot + slot / 2} y={H - 6} textAnchor="middle" fontSize={10} fill={AXIS_TEXT}>
              {shortDate(d.date)}
            </text>
          ) : null
        )}
      </svg>
    </div>
  );
};

export const MultiLineChart: React.FC<{
  dates: string[];
  series: { name: string; color: string; values: number[] }[];
  height?: number;
}> = ({ dates, series, height = 200 }) => {
  const [hover, setHover] = useState<number | null>(null);
  const W = 720;
  const H = height;
  const padL = 40;
  const padR = 78; // room for direct labels at line ends
  const padB = 22;
  const padT = 34;
  const max = niceMax(Math.max(...series.flatMap(s => s.values)));
  const plotW = W - padL - padR;
  const plotH = H - padB - padT;
  const x = (i: number) => padL + (i / (dates.length - 1)) * plotW;
  const y = (v: number) => padT + plotH - (v / max) * plotH;
  const ticks = [0, 0.5, 1].map(f => f * max);

  return (
    <div className="relative" onMouseLeave={() => setHover(null)}>
      {hover !== null && (
        <Tooltip leftPct={(x(hover) / W) * 100}>
          <div className="font-bold mb-0.5">{shortDate(dates[hover])}</div>
          {series.map(s => (
            <div key={s.name} className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full" style={{ background: s.color }} />
              {s.name}: <span className="font-bold">{s.values[hover].toLocaleString('en-IN')}</span>
            </div>
          ))}
        </Tooltip>
      )}
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height }} role="img" aria-label={series.map(s => s.name).join(' vs ')}>
        {ticks.map(t => (
          <g key={t}>
            <line x1={padL} x2={W - padR} y1={y(t)} y2={y(t)} stroke={GRID} strokeWidth={1} />
            <text x={padL - 6} y={y(t) + 3} textAnchor="end" fontSize={10} fill={AXIS_TEXT}>
              {compact(t)}
            </text>
          </g>
        ))}
        {hover !== null && <line x1={x(hover)} x2={x(hover)} y1={padT} y2={padT + plotH} stroke="#d6d3d1" strokeWidth={1} />}
        {series.map(s => (
          <g key={s.name}>
            <polyline
              fill="none"
              stroke={s.color}
              strokeWidth={2}
              strokeLinejoin="round"
              strokeLinecap="round"
              points={s.values.map((v, i) => `${x(i)},${y(v)}`).join(' ')}
            />
            {hover !== null && <circle cx={x(hover)} cy={y(s.values[hover])} r={4} fill={s.color} stroke="#fff" strokeWidth={2} />}
            <text x={W - padR + 6} y={y(s.values[s.values.length - 1]) + 3} fontSize={10} fontWeight={700} fill="#44403c">
              {s.name}
            </text>
          </g>
        ))}
        {dates.map((d, i) =>
          i % 5 === 0 || i === dates.length - 1 ? (
            <text key={d} x={x(i)} y={H - 6} textAnchor="middle" fontSize={10} fill={AXIS_TEXT}>
              {shortDate(d)}
            </text>
          ) : null
        )}
        {/* hit targets */}
        {dates.map((d, i) => (
          <rect
            key={'h' + d}
            x={x(i) - plotW / (dates.length - 1) / 2}
            y={padT}
            width={plotW / (dates.length - 1)}
            height={plotH}
            fill="transparent"
            onMouseEnter={() => setHover(i)}
          />
        ))}
      </svg>
    </div>
  );
};

/** One horizontal 100% bar split into segments, with legend + values (identity never colour-alone). */
export const SegmentBar: React.FC<{ segments: { label: string; value: number; color: string }[] }> = ({ segments }) => {
  const [hover, setHover] = useState<number | null>(null);
  const total = segments.reduce((a, s) => a + s.value, 0) || 1;
  return (
    <div>
      <div className="flex h-4 rounded-md overflow-hidden gap-[2px] bg-white" onMouseLeave={() => setHover(null)}>
        {segments.map((s, i) => (
          <div
            key={s.label}
            title={`${s.label}: ${s.value.toLocaleString('en-IN')} (${((s.value / total) * 100).toFixed(1)}%)`}
            onMouseEnter={() => setHover(i)}
            className="h-full transition-opacity"
            style={{ width: `${(s.value / total) * 100}%`, background: s.color, opacity: hover === null || hover === i ? 1 : 0.45 }}
          />
        ))}
      </div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-2 mt-3">
        {segments.map((s, i) => (
          <div
            key={s.label}
            className={`flex items-center justify-between text-[11px] rounded-lg px-1.5 py-0.5 ${hover === i ? 'bg-mango-50' : ''}`}
            onMouseEnter={() => setHover(i)}
            onMouseLeave={() => setHover(null)}
          >
            <span className="flex items-center gap-1.5 text-stone-700 font-semibold">
              <span className="w-2.5 h-2.5 rounded-sm" style={{ background: s.color }} />
              {s.label}
            </span>
            <span className="font-mono text-stone-500">
              {s.value.toLocaleString('en-IN')} · {((s.value / total) * 100).toFixed(1)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

// Sequential single-hue ramp (mango) for the retention heatmap; light → dark = low → high
const RAMP = ['#fff7ed', '#ffebd3', '#ffd3a6', '#ffb56e', '#ff963d', '#f7781b', '#e25e0e', '#bb460c'];
export function rampColor(pct: number) {
  const idx = Math.min(RAMP.length - 1, Math.max(0, Math.round((pct / 100) * (RAMP.length - 1))));
  return { bg: RAMP[idx], fg: idx >= 5 ? '#ffffff' : '#2a1f17' };
}
