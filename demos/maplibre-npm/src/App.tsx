import { useEffect, useRef, useState } from 'react'
import * as maplibregl from 'maplibre-gl'
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url'

maplibregl.setWorkerUrl(workerUrl)
import 'maplibre-gl/dist/maplibre-gl.css'
import { PieChartLayer } from 'maplibre-gl-pie-charts'
import type { PieChartFilter, PieChartFilterCondition, PieChartFilterOperator } from 'maplibre-gl-pie-charts'
import './App.css'

const SLICES = [
  { name: 'below_hs', color: '#c4533a', label: 'No high school diploma' },
  { name: 'high_school', color: '#e09a3e', label: 'High school' },
  { name: 'some_college', color: '#3d8ea6', label: 'Some college' },
  { name: 'bachelors', color: '#5c8f3a', label: "Bachelor's degree" },
  { name: 'graduate', color: '#5b4d8a', label: 'Graduate degree' },
]

const STEPS: [number, number][] = [
  [8000, 6],
  [20000, 9],
  [50000, 13],
  [150000, 17],
]
const FALLBACK = 22

const OPERATORS: PieChartFilterOperator[] = ['>', '>=', '==', '<', '<=']
const SHARE_OPTIONS = Array.from({ length: 21 }, (_, i) => i * 5)
const STEP_OPTIONS = Array.from({ length: STEPS.length + 1 }, (_, i) => i)

type FilterRow = { enabled: boolean, op: PieChartFilterOperator, value: number }

const INITIAL_ROWS: FilterRow[] = [
  ...SLICES.map(() => ({ enabled: false, op: '>' as const, value: 30 })),
  { enabled: false, op: '>=' as const, value: 2 },
]

function stepLabel(index: number) {
  const format = (value: number) => value.toLocaleString()
  if (index === 0) return `0: ≤ ${format(STEPS[0][0])}`
  if (index === STEPS.length) return `${index}: > ${format(STEPS[index - 1][0])}`
  return `${index}: ${format(STEPS[index - 1][0])}–${format(STEPS[index][0])}`
}

function filterFromRows(rows: FilterRow[]): PieChartFilter | null {
  const conditions: PieChartFilterCondition[] = []
  rows.forEach((row, index) => {
    if (!row.enabled) return
    if (index < SLICES.length) {
      conditions.push([row.op, SLICES[index].name, row.value / 100])
    } else {
      conditions.push([row.op, '$step', row.value])
    }
  })
  return conditions.length === 0 ? null : ['all', ...conditions]
}

type StyleLayer = {
  id: string
  source?: string
  'source-layer'?: string
  filter?: unknown[]
  minzoom?: number
}

function showCountyBoundaries(style: { layers: StyleLayer[] }) {
  const boundaries = style.layers.find((layer) => layer.id === 'boundary_3')
  const levelRange = boundaries?.filter?.find((clause) => {
    return Array.isArray(clause) && clause[0] === '<=' && clause[2] === 6
  })
  if (!boundaries || !Array.isArray(levelRange)) return
  levelRange[0] = '<'
  boundaries.minzoom = 4

  const insertAt = style.layers.indexOf(boundaries) + 1
  style.layers.splice(insertAt, 0, {
    id: 'boundary_county',
    type: 'line',
    source: boundaries.source,
    'source-layer': boundaries['source-layer'],
    minzoom: 3,
    filter: [
      'all',
      ['==', ['get', 'admin_level'], 6],
      ['!=', ['get', 'maritime'], 1],
      ['!=', ['get', 'disputed'], 1],
      ['!', ['has', 'claimed_by']],
    ],
    layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: {
      'line-color': '#cc3300',
      'line-width': ['interpolate', ['linear'], ['zoom'], 7, 3, 11, 4],
    },
  } as StyleLayer)
}

function App() {
  const mapRef = useRef<maplibregl.Map | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const dialogRef = useRef<HTMLDialogElement>(null)
  const piesRef = useRef(new PieChartLayer({
    id: 'education',
    url: '/tl_2025_us_county_points.parquet',
    slices: SLICES.map((slice) => slice.name),
    colors: SLICES.map((slice) => slice.color),
    radius: { steps: STEPS, fallback: FALLBACK },
    opacity: 0.92,
    hole: 0.5,
  }))
  const [status, setStatus] = useState('Loading charts…')
  const [rows, setRows] = useState(INITIAL_ROWS)

  useEffect(() => {
    piesRef.current.setFilter(filterFromRows(rows))
  }, [rows])

  function updateRow(index: number, change: Partial<FilterRow>) {
    setRows((current) => current.map((row, i) => (i === index ? { ...row, ...change } : row)))
  }

  useEffect(() => {
    let cancelled = false

    async function start() {
      const response = await fetch('https://tiles.openfreemap.org/styles/positron')
      if (!response.ok) throw new Error(`Failed to fetch basemap style: ${response.status}`)
      const style = await response.json() as { layers: StyleLayer[] }
      showCountyBoundaries(style)
      if (cancelled || !containerRef.current) return

      const map = new maplibregl.Map({
        container: containerRef.current,
        style: style as maplibregl.StyleSpecification,
        center: [-98.5, 39.5],
        zoom: 3.6,
      })
      mapRef.current = map
      map.addControl(new maplibregl.NavigationControl(), 'top-right')

      map.on('load', () => {
        const currentMap = mapRef.current
        const pies = piesRef.current
        if (!currentMap) return
        currentMap.addLayer(pies)
        pies.loaded.then(() => {
          if (!cancelled) setStatus(`${pies.count.toLocaleString()} counties`)
        }).catch((error: Error) => {
          if (!cancelled) setStatus(error.message)
        })
      })
    }

    start().catch((error: Error) => {
      if (!cancelled) setStatus(error.message)
    })

    return () => {
      cancelled = true
      mapRef.current?.remove()
      mapRef.current = null
    }
  }, [])

  return (
    <>
      <div ref={containerRef} id="map" />
      <aside id="panel">
        <h1>Educational attainment</h1>
        <p id="note">Population age 25 and older</p>
        {SLICES.map((item) => (
          <div className="key" key={item.name}>
            <span className="swatch" style={{ background: item.color }} />
            {item.label}
          </div>
        ))}
        <p id="status">{status}</p>
        <button type="button" id="open-filter" onClick={() => dialogRef.current?.show()}>
          Filter charts
        </button>
      </aside>
      <dialog ref={dialogRef} id="filter-dialog">
        <h2>Filter charts</h2>
        <p className="hint">Checked rows must all pass for a county to be drawn.</p>
        <table>
          <thead>
            <tr>
              <th>Apply</th>
              <th>Attribute</th>
              <th>Operator</th>
              <th>Value</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => {
              const isStep = index === SLICES.length
              const label = isStep ? 'Total population (size step)' : `${SLICES[index].label} share`
              return (
                <tr key={label}>
                  <td>
                    <input
                      type="checkbox"
                      aria-label={`Apply ${label} filter`}
                      checked={row.enabled}
                      onChange={(event) => updateRow(index, { enabled: event.target.checked })}
                    />
                  </td>
                  <td>{label}</td>
                  <td>
                    <select
                      aria-label={`${label} operator`}
                      value={row.op}
                      onChange={(event) => updateRow(index, { op: event.target.value as PieChartFilterOperator })}
                    >
                      {OPERATORS.map((op) => <option key={op} value={op}>{op}</option>)}
                    </select>
                  </td>
                  <td>
                    <select
                      aria-label={`${label} value`}
                      value={row.value}
                      onChange={(event) => updateRow(index, { value: Number(event.target.value) })}
                    >
                      {isStep
                        ? STEP_OPTIONS.map((step) => <option key={step} value={step}>{stepLabel(step)}</option>)
                        : SHARE_OPTIONS.map((share) => <option key={share} value={share}>{share}%</option>)}
                    </select>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        <div className="actions">
          <button type="button" onClick={() => setRows(INITIAL_ROWS)}>Clear</button>
          <button type="button" onClick={() => dialogRef.current?.close()}>Close</button>
        </div>
      </dialog>
    </>
  )
}

export default App
