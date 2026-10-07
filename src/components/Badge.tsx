type StatusVariant = 'pending' | 'approved' | 'rejected'
type SizeVariant = 'sm' | 'md'

interface BadgeProps {
  status: StatusVariant | string
  size?: SizeVariant
  className?: string
}

const statusClasses: Record<StatusVariant, string> = {
  pending: 'bg-amber-100 text-amber-800 border-amber-200',
  approved: 'bg-green-100 text-green-800 border-green-200',
  rejected: 'bg-red-100 text-red-800 border-red-200',
}

const sizeClasses: Record<SizeVariant, string> = {
  sm: 'px-2 py-0.5 text-xs',
  md: 'px-2.5 py-1 text-xs',
}

export function Badge({ status, size = 'md', className = '' }: BadgeProps) {
  const classes =
    statusClasses[status as StatusVariant] ?? 'bg-gray-100 text-gray-800 border-gray-200'

  return (
    <span
      className={[
        'inline-flex items-center rounded-full border font-medium capitalize',
        classes,
        sizeClasses[size],
        className,
      ].join(' ')}
    >
      {status}
    </span>
  )
}
