const ITEMS = [
  'Aerodynamics',
  'CFD / OpenFOAM',
  'Propulsion',
  'MATLAB',
  'Orbital Mechanics',
  'SolidWorks',
  'Avionics',
  'Python',
  'Control Systems',
  'Composites',
  'Mission Design',
  'Wind Tunnel Testing',
]

export function MarqueeStrip() {
  const row = (key: string) => (
    <div key={key} className="flex shrink-0 items-center gap-12 pr-12" aria-hidden={key === 'b'}>
      {ITEMS.map((item) => (
        <span key={item} className="flex items-center gap-12">
          <span className="text-sm font-medium tracking-wide text-slate-500 whitespace-nowrap">
            {item}
          </span>
          <svg width="8" height="8" viewBox="0 0 8 8" className="shrink-0 opacity-40">
            <path d="M4 0 L4.9 3.1 L8 4 L4.9 4.9 L4 8 L3.1 4.9 L0 4 L3.1 3.1 Z" fill="#818cf8" />
          </svg>
        </span>
      ))}
    </div>
  )

  return (
    <div className="relative z-[2] py-10 border-y border-white/[0.05] bg-white/[0.012]">
      <div className="marquee">
        <div className="marquee__track">
          {row('a')}
          {row('b')}
        </div>
      </div>
    </div>
  )
}
