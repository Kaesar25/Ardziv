import { useRef, useState, type PointerEvent } from 'react'
import type { Diagram, DiagramKind } from '../lib/data3'

type Tool = DiagramKind | 'run' | 'pass' | 'erase'
const TOOLS: [Tool, string][] = [
  ['p', 'Joueur'], ['o', 'Adversaire'], ['c', 'Plot'], ['b', 'Ballon'], ['g', 'Mini-but'],
  ['run', 'Course'], ['pass', 'Passe'], ['erase', 'Gomme'],
]
const W = 100
const H = 64

/** Schéma d'exercice : demi-terrain en SVG. Éditable au doigt si `onChange` est fourni. */
export default function DiagramBoard({ value, onChange, height }: { value: Diagram; onChange?: (d: Diagram) => void; height?: number }) {
  const [tool, setTool] = useState<Tool>('p')
  const [start, setStart] = useState<{ x: number; y: number } | null>(null)
  const ref = useRef<SVGSVGElement>(null)
  const edit = !!onChange

  function pos(e: PointerEvent<SVGSVGElement>) {
    const r = ref.current!.getBoundingClientRect()
    return { x: Math.round(((e.clientX - r.left) / r.width) * W * 10) / 10, y: Math.round(((e.clientY - r.top) / r.height) * H * 10) / 10 }
  }
  function onDown(e: PointerEvent<SVGSVGElement>) {
    if (!edit) return
    const p = pos(e)
    if (tool === 'erase') {
      const near = (x: number, y: number) => Math.hypot(x - p.x, y - p.y) < 4
      const i = value.items.findIndex((it) => near(it.x, it.y))
      if (i >= 0) return onChange!({ ...value, items: value.items.filter((_, k) => k !== i) })
      const a = value.arrows.findIndex((ar) => near(ar.x2, ar.y2) || near(ar.x1, ar.y1) || near((ar.x1 + ar.x2) / 2, (ar.y1 + ar.y2) / 2))
      if (a >= 0) onChange!({ ...value, arrows: value.arrows.filter((_, k) => k !== a) })
      return
    }
    if (tool === 'run' || tool === 'pass') {
      if (!start) return setStart(p)
      if (Math.hypot(p.x - start.x, p.y - start.y) > 2) onChange!({ ...value, arrows: [...value.arrows, { x1: start.x, y1: start.y, x2: p.x, y2: p.y, k: tool }] })
      setStart(null)
      return
    }
    onChange!({ ...value, items: [...value.items, { t: tool, x: p.x, y: p.y }] })
  }

  const line = 'rgba(255,255,255,.22)'
  return (
    <div className="stack" style={{ gap: 8 }}>
      {edit && (
        <div className="scroll-x">
          {TOOLS.map(([k, l]) => (
            <button key={k} className={`chip chip--ghost ${tool === k ? 'is-active' : ''}`} style={{ minHeight: 36, padding: '0 12px' }} onClick={() => { setTool(k); setStart(null) }}>{l}</button>
          ))}
          <button className="chip chip--ghost" style={{ minHeight: 36, padding: '0 12px' }} onClick={() => onChange!({ items: [], arrows: [] })}>Tout effacer</button>
        </div>
      )}
      <svg ref={ref} viewBox={`0 0 ${W} ${H}`} onPointerDown={onDown} role="img" aria-label="Schéma de l'exercice"
        style={{ width: '100%', height: height ?? 'auto', aspectRatio: `${W} / ${H}`, borderRadius: 14, background: '#10291B', border: '1px solid #1E4430', touchAction: 'none', cursor: edit ? 'crosshair' : 'default', display: 'block' }}>
        <defs>
          <marker id="ah-run" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="4" markerHeight="4" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" fill="#fff" /></marker>
          <marker id="ah-pass" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="4" markerHeight="4" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" fill="#E9C04A" /></marker>
        </defs>
        <rect x="3" y="3" width={W - 6} height={H - 6} fill="none" stroke={line} strokeWidth="0.5" />
        <line x1={W / 2} y1="3" x2={W / 2} y2={H - 3} stroke={line} strokeWidth="0.5" />
        <circle cx={W / 2} cy={H / 2} r="7" fill="none" stroke={line} strokeWidth="0.5" />
        <rect x="3" y={H / 2 - 14} width="13" height="28" fill="none" stroke={line} strokeWidth="0.5" />
        <rect x={W - 16} y={H / 2 - 14} width="13" height="28" fill="none" stroke={line} strokeWidth="0.5" />
        {value.arrows.map((a, i) => (
          <line key={i} x1={a.x1} y1={a.y1} x2={a.x2} y2={a.y2} stroke={a.k === 'pass' ? '#E9C04A' : '#fff'} strokeWidth="0.7"
            strokeDasharray={a.k === 'run' ? '1.6 1.2' : undefined} markerEnd={`url(#ah-${a.k})`} />
        ))}
        {value.items.map((it, i) => {
          if (it.t === 'p') return <circle key={i} cx={it.x} cy={it.y} r="2.2" fill="#E9C04A" stroke="#0B0B0C" strokeWidth="0.4" />
          if (it.t === 'o') return <circle key={i} cx={it.x} cy={it.y} r="2.2" fill="#E5644E" stroke="#0B0B0C" strokeWidth="0.4" />
          if (it.t === 'c') return <path key={i} d={`M${it.x} ${it.y - 1.8}L${it.x + 1.6} ${it.y + 1.2}H${it.x - 1.6}z`} fill="#FF8A3D" />
          if (it.t === 'b') return <circle key={i} cx={it.x} cy={it.y} r="1.2" fill="#fff" stroke="#0B0B0C" strokeWidth="0.3" />
          return <rect key={i} x={it.x - 1} y={it.y - 3} width="2" height="6" fill="none" stroke="#fff" strokeWidth="0.6" />
        })}
        {start && <circle cx={start.x} cy={start.y} r="1.4" fill="none" stroke="#E9C04A" strokeWidth="0.5" />}
      </svg>
      {edit && <p className="small muted">{tool === 'run' || tool === 'pass' ? (start ? 'Touche le point d’arrivée.' : 'Touche le point de départ.') : tool === 'erase' ? 'Touche un élément pour le retirer.' : 'Touche le terrain pour placer.'}</p>}
    </div>
  )
}
