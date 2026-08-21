export default function Loading() {
  return (
    <div className="state" aria-busy="true" aria-live="polite">
      <div className="skeleton-grid" style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(220px,1fr))', gap:'1rem', width:'100%', maxWidth:960, margin:'0 auto' }}>
        {Array.from({length:6}).map((_,i)=>(
          <div key={i} className="skeleton-card" style={{ height:280, background:'var(--surface)', border:'1px solid var(--line)', borderRadius:12, overflow:'hidden' }}>
            <div style={{ height:180, background:'linear-gradient(90deg,var(--surface-3) 25%,var(--surface) 50%,var(--surface-3) 75%)', backgroundSize:'200% 100%', animation:'shimmer 1.4s infinite' }} />
            <div style={{ padding:'0.9rem' }}>
              <div style={{ height:14, width:'70%', background:'var(--line)', borderRadius:6, marginBottom:8, animation:'shimmer 1.4s infinite' }} />
              <div style={{ height:12, width:'50%', background:'var(--line)', borderRadius:6 }} />
            </div>
          </div>
        ))}
      </div>
      <span className="spinner" style={{ marginTop:'1.2rem' }} aria-hidden="true" /> Loading…
      <style>{`@keyframes shimmer{0%{background-position:-200% 0}100%{background-position:200% 0}}`}</style>
    </div>
  );
}
