import { Button } from '../components/Button'

export function ProfileLoadErrorScreen({
  onRetry,
  onSignOut,
}: {
  onRetry: () => void
  onSignOut: () => void
}) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 p-4">
      <div className="w-full max-w-md rounded-xl border border-gray-200 bg-white p-8 text-center shadow-sm">
        <h1 className="text-lg font-semibold text-gray-900">We couldn&apos;t load your account</h1>
        <p className="mt-2 text-sm text-gray-600">
          You&apos;re signed in, but your profile could not be loaded. This is usually temporary.
        </p>
        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Button type="button" onClick={onRetry}>
            Try again
          </Button>
          <Button type="button" variant="secondary" onClick={onSignOut}>
            Log out
          </Button>
        </div>
      </div>
    </div>
  )
}
