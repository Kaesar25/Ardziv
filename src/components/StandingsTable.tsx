import type { Standing } from '../lib/types'

/** Tableau du classement. `compact` : pos, équipe, diff, points. Sinon : J, V, N, D, diff, pts. */
export default function StandingsTable({ rows, compact = false, startAt = 1 }: { rows: Standing[]; compact?: boolean; startAt?: number }) {
  const cols = compact ? '22px minmax(0,1fr) 40px 32px' : '22px minmax(0,1fr) 24px 24px 24px 24px 36px 30px'
  const diff = (r: Standing) => {
    const d = r.goals_for - r.goals_against
    return d > 0 ? `+${d}` : String(d)
  }
  return (
    <div className="stack" style={{ gap: 0 }}>
      {!compact && (
        <div style={{ display: 'grid', gridTemplateColumns: cols, gap: 4, padding: '0 0 6px', fontSize: 11, fontWeight: 700, color: 'var(--muted)', letterSpacing: '0.06em' }}>
          <span>#</span><span>ÉQUIPE</span><span className="center">J</span><span className="center">V</span><span className="center">N</span><span className="center">D</span><span style={{ textAlign: 'right' }}>DIFF</span><span style={{ textAlign: 'right' }}>PTS</span>
        </div>
      )}
      {rows.map((r, i) => {
        const color = r.is_us ? 'var(--gold)' : 'var(--text)'
        const weight = r.is_us ? 700 : 500
        return (
          <div key={r.team} style={{ display: 'grid', gridTemplateColumns: cols, gap: 4, alignItems: 'center', padding: '9px 0', borderTop: '1px solid var(--line)', fontSize: 14 }}>
            <span style={{ fontWeight: 700, color: 'var(--muted)' }}>{startAt + i}</span>
            <span style={{ fontWeight: weight, color, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.team}</span>
            {!compact && (
              <>
                <span className="center muted">{r.played}</span>
                <span className="center muted">{r.won}</span>
                <span className="center muted">{r.drawn}</span>
                <span className="center muted">{r.lost}</span>
              </>
            )}
            <span style={{ textAlign: 'right', fontSize: 13, color: 'var(--muted)' }}>{diff(r)}</span>
            <span style={{ textAlign: 'right', fontWeight: 700, color }}>{r.points}</span>
          </div>
        )
      })}
    </div>
  )
}
