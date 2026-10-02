import { cn } from '@/lib/utils'

interface BeneraLogoProps {
  className?: string
  variant?: 'light' | 'dark'
  size?: 'sm' | 'md' | 'lg'
  showTagline?: boolean
}

export function BeneraLogo({
  className,
  variant = 'light',
  size = 'md',
  showTagline = true,
}: BeneraLogoProps) {
  const isLight = variant === 'light'

  // Cores
  const textColor = isLight ? '#FFFFFF' : '#0B3556'
  const subtextColor = isLight ? '#C9A24B' : '#8A7030'
  const dotColor = '#C9A24B'
  const iconBg = isLight ? 'rgba(255, 255, 255, 0.08)' : 'rgba(11, 53, 86, 0.06)'
  const iconBorder = isLight ? 'rgba(201, 162, 75, 0.4)' : 'rgba(11, 53, 86, 0.2)'

  const sizeClasses = {
    sm: 'h-8',
    md: 'h-11',
    lg: 'h-14',
  }

  const iconSizes = {
    sm: { w: 32, h: 32, viewBox: '0 0 32 32' },
    md: { w: 42, h: 42, viewBox: '0 0 42 42' },
    lg: { w: 52, h: 52, viewBox: '0 0 52 52' },
  }

  const curr = iconSizes[size]

  return (
    <div className={cn('inline-flex items-center gap-3 select-none', sizeClasses[size], className)}>
      {/* Símbolo Benera (B estilizado com camadas de remuneração / estratégia de crescimento) */}
      <div className="relative shrink-0 flex items-center justify-center">
        <svg
          width={curr.w}
          height={curr.h}
          viewBox="0 0 44 44"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="transition-transform duration-300 hover:scale-105"
        >
          {/* Base arredondada com borda dourada suave */}
          <rect
            x="1.5"
            y="1.5"
            width="41"
            height="41"
            rx="10"
            fill={iconBg}
            stroke={iconBorder}
            strokeWidth="1.5"
          />

          {/* Estrutura arquitetural 'B' com 3 camadas organizacionais */}
          {/* Coluna mestre vertical */}
          <rect x="11" y="10" width="4" height="24" rx="2" fill={textColor} />

          {/* Camada superior de gestão */}
          <path
            d="M15 10H24.5C27.5376 10 30 12.2386 30 15C30 17.7614 27.5376 20 24.5 20H15V10Z"
            fill={textColor}
            fillOpacity="0.95"
          />

          {/* Camada inferior ampliada (crescimento/escala) com acento dourado */}
          <path
            d="M15 20H26.5C29.8137 20 32.5 22.4624 32.5 25.5C32.5 28.5376 29.8137 31 26.5 31H15V20Z"
            fill={dotColor}
          />

          {/* Vértice de precisão central */}
          <circle cx="21" cy="15" r="1.5" fill={isLight ? '#0B3556' : '#FFFFFF'} />
          <circle cx="22" cy="25.5" r="1.75" fill={isLight ? '#0B3556' : '#FFFFFF'} />
        </svg>
      </div>

      {/* Tipografia da Marca */}
      <div className="flex flex-col justify-center">
        <div className="flex items-baseline tracking-tight">
          <span
            className="font-bold tracking-tight text-xl leading-none uppercase"
            style={{
              color: textColor,
              letterSpacing: '0.04em',
              fontFamily: 'Inter, sans-serif',
              fontWeight: 800,
            }}
          >
            BENERA
          </span>
          <span
            className="inline-block w-1.5 h-1.5 rounded-full ml-1"
            style={{ backgroundColor: dotColor }}
          />
        </div>
        {showTagline && (
          <span
            className="text-[10px] font-semibold tracking-widest uppercase mt-0.5 leading-none"
            style={{
              color: subtextColor,
              letterSpacing: '0.22em',
            }}
          >
            CONSULTORIA
          </span>
        )}
      </div>
    </div>
  )
}
