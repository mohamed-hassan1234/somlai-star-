import { cn } from '@/lib/utils'
import { GraduationCap } from 'lucide-react'

interface BrandLogoProps {
  className?: string
  size?: 'sm' | 'md' | 'lg'
  showWordmark?: boolean
  wordmarkClassName?: string
}

const sizes = {
  sm: { box: 'h-9 w-9 rounded-xl', icon: 'h-5 w-5', text: 'text-lg' },
  md: { box: 'h-11 w-11 rounded-2xl', icon: 'h-6 w-6', text: 'text-lg' },
  lg: { box: 'h-14 w-14 rounded-2xl', icon: 'h-8 w-8', text: 'text-2xl' },
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
      <div
        className={cn(
          'flex items-center justify-center bg-gradient-to-br from-gold-400 to-gold-600 text-navy-900 shadow-sm shadow-gold-500/30',
          s.box,
        )}
      >
        <GraduationCap className={s.icon} />
      </div>
      {showWordmark && (
        <span className={cn('font-display font-semibold leading-tight text-white', s.text, wordmarkClassName)}>
          Somali Star <span className="text-gold-400">Academy</span>
        </span>
      )}
    </div>
  )
}
