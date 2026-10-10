import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

// Single-series magnitude bars: one hue (sequential blue, step 500), rounded
// data-ends, recessive grid/axes, ink-colored labels — not the series color.
// See the dataviz skill's color-formula/marks-and-anatomy references.
const BAR_FILL = '#256abf'
const GRID = '#e1e0d9'
const AXIS = '#c3c2b7'
const MUTED = '#898781'

function ChartTooltip({ active, payload, label, suffix = '' }) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs shadow-md">
      <p className="font-semibold text-slate-800">{label}</p>
      <p className="text-slate-500">
        {payload[0].value}
        {suffix}
      </p>
    </div>
  )
}

export function UtilizationChart({ data, dataKey = 'utilizationPct', categoryKey = 'room', suffix = '%', height = 240 }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
        <CartesianGrid vertical={false} stroke={GRID} />
        <XAxis dataKey={categoryKey} tick={{ fill: MUTED, fontSize: 11 }} axisLine={{ stroke: AXIS }} tickLine={false} />
        <YAxis tick={{ fill: MUTED, fontSize: 11 }} axisLine={false} tickLine={false} width={36} />
        <Tooltip cursor={{ fill: 'rgba(37,106,191,0.06)' }} content={<ChartTooltip suffix={suffix} />} />
        <Bar dataKey={dataKey} fill={BAR_FILL} radius={[4, 4, 0, 0]} maxBarSize={36} />
      </BarChart>
    </ResponsiveContainer>
  )
}
