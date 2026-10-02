// Zero-dependency charts for the support dashboard.
// Intentionally no chart library: simple CSS bars + an inline-SVG sparkline.
// All data items are optionally interactive via an `onSelect(label)` callback.

function formatLabel(value) {
  if (value === null || value === undefined || value === '') return 'Unspecified'
  return String(value)
}

const PRIORITY_RANK = { Critical: 0, High: 1, Medium: 2, Low: 3 }

/**
 * Horizontal CSS bar chart from a { label: count } map.
 * `order` optionally fixes the row order (e.g. priority severity).
 * `onSelect(label)` makes each row an interactive filter trigger.
 * `selected` highlights the active row.
 */
export function BarChart({ title, data, order, emptyLabel = 'No data yet.', onSelect, selected }) {
  let entries = Object.entries(data || {})
  if (order === 'priority') {
    entries = entries.sort(
      (a, b) => (PRIORITY_RANK[a[0]] ?? 99) - (PRIORITY_RANK[b[0]] ?? 99),
    )
  } else {
    entries = entries.sort((a, b) => b[1] - a[1])
  }

  const max = entries.reduce((peak, [, count]) => Math.max(peak, count), 0)
  const interactive = typeof onSelect === 'function'

  return (
    <div className="chart-card">
      <h4 className="chart-title">{title}</h4>
      {entries.length === 0 ? (
        <p className="chart-empty">{emptyLabel}</p>
      ) : (
        <ul className="bar-chart" role="list">
          {entries.map(([label, count]) => {
            const widthPct = max > 0 ? Math.round((count / max) * 100) : 0
            const slug = formatLabel(label).toLowerCase().replace(/\s+/g, '-')
            const isSelected = selected != null && String(selected) === String(label)
            const rowClass = `bar-row${interactive ? ' bar-row-clickable' : ''}${isSelected ? ' bar-row-selected' : ''}`
            const content = (
              <>
                <span className="bar-label" title={formatLabel(label)}>
                  {formatLabel(label)}
                </span>
                <span className="bar-track" aria-hidden="true">
                  <span
                    className={`bar-fill bar-fill-${slug}`}
                    style={{ width: `${widthPct}%` }}
                  />
                </span>
                <span className="bar-value">{count}</span>
              </>
            )
            if (!interactive) {
              return <li key={label} className={rowClass}>{content}</li>
            }
            return (
              <li key={label} className={rowClass}>
                <button
                  type="button"
                  className="bar-row-button"
                  aria-pressed={isSelected}
                  title={`Show ${formatLabel(label)} tickets (${count})`}
                  onClick={() => onSelect(label)}
                >
                  {content}
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

/**
 * Inline-SVG trend for a series: [{ date, count }, ...] (oldest first).
 * Renders a readable per-day axis (short weekday + count) and, when
 * `onSelect(date)` is provided, lets the user click a day to drill in.
 */
export function Sparkline({ title, series, onSelect, selected }) {
  const points = Array.isArray(series) ? series : []
  const width = 320
  const height = 80
  const pad = 6
  const max = points.reduce((peak, point) => Math.max(peak, point.count), 0)
  const total = points.reduce((sum, point) => sum + point.count, 0)
  const interactive = typeof onSelect === 'function'

  const stepX = points.length > 1 ? (width - pad * 2) / (points.length - 1) : 0
  const scaleY = max > 0 ? (height - pad * 2) / max : 0

  const coords = points.map((point, index) => {
    const x = pad + index * stepX
    const y = height - pad - point.count * scaleY
    return [x, y]
  })

  const linePath = coords.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ')
  const areaPath =
    coords.length > 0
      ? `${linePath} L${coords[coords.length - 1][0].toFixed(1)},${height - pad} L${coords[0][0].toFixed(1)},${height - pad} Z`
      : ''

  const weekday = (iso) => {
    const parsed = new Date(`${iso}T00:00:00`)
    return Number.isNaN(parsed.getTime())
      ? iso
      : parsed.toLocaleDateString(undefined, { weekday: 'short' })
  }

  return (
    <div className="chart-card">
      <h4 className="chart-title">{title}</h4>
      {points.length === 0 ? (
        <p className="chart-empty">No recent activity.</p>
      ) : (
        <>
          <svg
            className="sparkline"
            viewBox={`0 0 ${width} ${height}`}
            role="img"
            aria-label={`${title}: ${total} tickets over the last ${points.length} days`}
            preserveAspectRatio="none"
          >
            {areaPath && <path className="sparkline-area" d={areaPath} />}
            <path className="sparkline-line" d={linePath} fill="none" />
            {coords.map(([x, y], index) => (
              <circle
                key={points[index].date}
                className={`sparkline-dot${selected === points[index].date ? ' sparkline-dot-selected' : ''}`}
                cx={x}
                cy={y}
                r="3"
              />
            ))}
          </svg>

          {/* Readable, clickable per-day axis so each point has context. */}
          <ul className="trend-days" role="list">
            {points.map((point) => {
              const isSelected = selected === point.date
              const cellClass = `trend-day${interactive ? ' trend-day-clickable' : ''}${isSelected ? ' trend-day-selected' : ''}`
              const label = (
                <>
                  <span className="trend-day-weekday">{weekday(point.date)}</span>
                  <span className="trend-day-count">{point.count}</span>
                  <span className="trend-day-date">{point.date.slice(5)}</span>
                </>
              )
              if (!interactive) {
                return <li key={point.date} className={cellClass} title={`${point.date}: ${point.count} created`}>{label}</li>
              }
              return (
                <li key={point.date} className={cellClass}>
                  <button
                    type="button"
                    className="trend-day-button"
                    aria-pressed={isSelected}
                    title={`Show tickets created on ${point.date} (${point.count})`}
                    onClick={() => onSelect(point.date)}
                  >
                    {label}
                  </button>
                </li>
              )
            })}
          </ul>

          <div className="sparkline-footer">
            <span>{points[0]?.date}</span>
            <span>{total} new</span>
            <span>{points[points.length - 1]?.date}</span>
          </div>
        </>
      )}
    </div>
  )
}
