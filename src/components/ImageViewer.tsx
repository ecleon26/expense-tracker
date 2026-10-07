import { useState } from 'react'
import { useSignedUrl } from '../hooks/useSignedUrl'
import { Spinner } from './Spinner'
import { RotateCw, ZoomIn, ZoomOut } from 'lucide-react'

interface ImageViewerProps {
  path: string | null
  alt?: string
}

export function ImageViewer({ path, alt = 'Bill image' }: ImageViewerProps) {
  const { data: url, isLoading, error } = useSignedUrl(path)
  const [rotation, setRotation] = useState(0)
  const [scale, setScale] = useState(1)

  if (!path) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-gray-100 text-sm text-gray-500">
        No image path provided
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="flex h-64 w-full items-center justify-center bg-gray-50">
        <Spinner size="md" label="Loading image…" />
      </div>
    )
  }

  if (error || !url) {
    return (
      <div className="flex h-64 w-full items-center justify-center bg-red-50 text-sm text-red-600">
        Failed to load image
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center gap-4">
      {/* Controls */}
      <div className="flex gap-2 rounded-lg bg-gray-100 p-1">
        <button
          onClick={() => setScale((s) => Math.max(0.5, s - 0.25))}
          className="rounded p-2 text-gray-700 hover:bg-white hover:shadow-sm focus:outline-none focus:ring-2 focus:ring-accent-500"
          aria-label="Zoom out"
        >
          <ZoomOut className="h-4 w-4" aria-hidden="true" />
        </button>
        <button
          onClick={() => setScale(1)}
          className="rounded px-2 py-1 text-xs text-gray-600 hover:bg-white hover:shadow-sm focus:outline-none focus:ring-2 focus:ring-accent-500"
          aria-label="Reset zoom"
        >
          {Math.round(scale * 100)}%
        </button>
        <button
          onClick={() => setScale((s) => Math.min(3, s + 0.25))}
          className="rounded p-2 text-gray-700 hover:bg-white hover:shadow-sm focus:outline-none focus:ring-2 focus:ring-accent-500"
          aria-label="Zoom in"
        >
          <ZoomIn className="h-4 w-4" aria-hidden="true" />
        </button>
        <button
          onClick={() => setRotation((r) => (r + 90) % 360)}
          className="rounded p-2 text-gray-700 hover:bg-white hover:shadow-sm focus:outline-none focus:ring-2 focus:ring-accent-500"
          aria-label="Rotate 90 degrees clockwise"
        >
          <RotateCw className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>

      {/* Image Container */}
      <div className="relative w-full overflow-hidden rounded-lg border border-gray-200 bg-gray-50 shadow-inner" style={{ minHeight: '300px' }}>
        <div className="absolute inset-0 flex items-center justify-center overflow-auto p-4">
          <img
            src={url}
            alt={alt}
            className="max-h-full max-w-full origin-center transition-transform duration-200"
            style={{
              transform: `scale(${scale}) rotate(${rotation}deg)`,
            }}
          />
        </div>
      </div>
    </div>
  )
}
