import { useEffect, useRef, useState } from 'react'
import * as maplibregl from 'maplibre-gl'
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url'

maplibregl.setWorkerUrl(workerUrl)
import 'maplibre-gl/dist/maplibre-gl.css'
import { PieChartLayer } from 'maplibre-gl-pie-charts'
import './App.css'

const LEGEND = [
  { color: '#c4533a', label: 'No high school diploma' },
  { color: '#e09a3e', label: 'High school' },
  { color: '#3d8ea6', label: 'Some college' },
  { color: '#5c8f3a', label: "Bachelor's degree" },
  { color: '#5b4d8a', label: 'Graduate degree' },
]

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
  const piesRef = useRef(new PieChartLayer({
    id: 'education',
    url: '/tl_2025_us_county_points.parquet',
    slices: ['below_hs', 'high_school', 'some_college', 'bachelors', 'graduate'],
    colors: ['#c4533a', '#e09a3e', '#3d8ea6', '#5c8f3a', '#5b4d8a'],
    radius: {
      steps: [
        [8000, 6],
        [20000, 9],
        [50000, 13],
        [150000, 17],
      ],
      fallback: 22,
    },
    opacity: 0.92,
    hole: 0.5,
  }))
  const [status, setStatus] = useState('Loading charts…')

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
        {LEGEND.map((item) => (
          <div className="key" key={item.label}>
            <span className="swatch" style={{ background: item.color }} />
            {item.label}
          </div>
        ))}
        <p id="status">{status}</p>
      </aside>
    </>
  )
}

export default App
