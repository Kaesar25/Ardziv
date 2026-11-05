interface IconProps { size?: number; stroke?: string; fill?: string }

const base = (size: number, stroke: string, fill: string) => ({
  width: size, height: size, viewBox: '0 0 24 24', fill, stroke, strokeWidth: 1.8,
  strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, 'aria-hidden': true,
})

export const IconHome = ({ size = 24, stroke = 'currentColor', fill = 'none' }: IconProps) => (
  <svg {...base(size, stroke, fill)}><path d="M3 10.5 12 3l9 7.5V21h-6v-6H9v6H3z" /></svg>
)
export const IconCalendar = ({ size = 24, stroke = 'currentColor', fill = 'none' }: IconProps) => (
  <svg {...base(size, stroke, fill)}><path d="M4 6h16v15H4zM4 10h16M8 3v4M16 3v4" /></svg>
)
export const IconUsers = ({ size = 24, stroke = 'currentColor', fill = 'none' }: IconProps) => (
  <svg {...base(size, stroke, fill)}><path d="M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM2.5 20c.8-3.5 3.4-5.5 6.5-5.5s5.7 2 6.5 5.5M16 4.5a3.3 3.3 0 0 1 0 6.4M18 14.8c1.8.7 3 2.5 3.5 5.2" /></svg>
)
export const IconChart = ({ size = 24, stroke = 'currentColor', fill = 'none' }: IconProps) => (
  <svg {...base(size, stroke, fill)}><path d="M5 20V11M12 20V4M19 20v-7" /></svg>
)
export const IconGrid = ({ size = 24, stroke = 'currentColor', fill = 'none' }: IconProps) => (
  <svg {...base(size, stroke, fill)}><path d="M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z" /></svg>
)
export const IconArrow = ({ size = 18, stroke = 'currentColor' }: IconProps) => (
  <svg {...base(size, stroke, 'none')} strokeWidth={2.2}><path d="M5 12h14M13 6l6 6-6 6" /></svg>
)
export const IconBack = ({ size = 16, stroke = 'currentColor' }: IconProps) => (
  <svg {...base(size, stroke, 'none')} strokeWidth={2.4}><path d="M19 12H5M11 6l-6 6 6 6" /></svg>
)
export const IconPlus = ({ size = 20, stroke = 'currentColor' }: IconProps) => (
  <svg {...base(size, stroke, 'none')} strokeWidth={2.4}><path d="M12 5v14M5 12h14" /></svg>
)
export const IconCheck = ({ size = 20, stroke = 'currentColor' }: IconProps) => (
  <svg {...base(size, stroke, 'none')} strokeWidth={2.8}><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
)
