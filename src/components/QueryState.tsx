import { AlertCircle, RefreshCw, Inbox, SearchX } from 'lucide-react'
import { Spinner } from './Spinner'
import { Button } from './Button'

interface QueryStateProps {
  loading?: boolean
  error?: Error | null
  empty?: boolean
  notFound?: boolean
  onRetry?: () => void
  loadingMessage?: string
  errorTitle?: string
  emptyTitle?: string
  emptyDescription?: string
  notFoundTitle?: string
  notFoundDescription?: string
  children?: React.ReactNode
}

/**
 * Unified loading / error / empty / not-found shell for data views.
 * Render it BEFORE the happy path. When none of the state flags are true,
 * it renders children (the happy path).
 */
export function QueryState({
  loading,
  error,
  empty,
  notFound,
  onRetry,
  loadingMessage = 'Loading…',
  errorTitle = 'Failed to load data',
  emptyTitle = 'Nothing here yet',
  emptyDescription,
  notFoundTitle = 'Not found',
  notFoundDescription = 'The item you are looking for does not exist.',
  children,
}: QueryStateProps) {
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-16 text-gray-500">
        <Spinner size="lg" />
        <p className="text-sm">{loadingMessage}</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-16 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-red-100">
          <AlertCircle className="h-7 w-7 text-red-500" />
        </div>
        <div>
          <p className="font-semibold text-gray-800">{errorTitle}</p>
          <p className="mt-1 text-sm text-gray-500">{error.message}</p>
        </div>
        {onRetry && (
          <Button variant="secondary" size="sm" onClick={onRetry}>
            <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
            Try again
          </Button>
        )}
      </div>
    )
  }

  if (notFound) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-16 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-gray-100">
          <SearchX className="h-7 w-7 text-gray-400" />
        </div>
        <div>
          <p className="font-semibold text-gray-800">{notFoundTitle}</p>
          <p className="mt-1 text-sm text-gray-500">{notFoundDescription}</p>
        </div>
      </div>
    )
  }

  if (empty) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-16 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-gray-100">
          <Inbox className="h-7 w-7 text-gray-400" />
        </div>
        <div>
          <p className="font-semibold text-gray-800">{emptyTitle}</p>
          {emptyDescription && (
            <p className="mt-1 text-sm text-gray-500">{emptyDescription}</p>
          )}
        </div>
      </div>
    )
  }

  return <>{children}</>
}
