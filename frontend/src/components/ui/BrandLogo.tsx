import { cn } from '@/lib/utils'

interface BrandLogoProps {
  className?: string
  size?: 'sm' | 'md' | 'lg'
  showWordmark?: boolean
  wordmarkClassName?: string
}

const sizes = {
  sm: { img: 'h-9 w-9', text: 'text-lg' },
  md: { img: 'h-11 w-11', text: 'text-lg' },
  lg: { img: 'h-14 w-14', text: 'text-2xl' },
} as const

export function BrandLogo({
  className,
  size = 'md',
  showWordmark = true,
  wordmarkClassName,
}: BrandLogoProps) {
  const s = sizes[size]
  return (
    <div className={cn('flex items-center gap-2.5', className)}>
      <img
        src="/logo.png"
        alt="Somali Star Academy"
        className={cn('rounded-full object-cover', s.img)}
      />
      {showWordmark && (
        <span className={cn('font-display font-semibold leading-tight text-white', s.text, wordmarkClassName)}>
          Somali Star <span className="text-gold-400">Academy</span>
        </span>
      )}
    </div>
  )
}
