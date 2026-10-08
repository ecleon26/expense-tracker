export const queryKeys = {
  clubs: {
    all: () => ['clubs'] as const,
  },
  events: {
    all: () => ['events'] as const,
    active: () => ['events', 'active'] as const,
    byClub: (clubId: string | null) => ['events', 'active', clubId] as const,
  },
  expenses: {
    all: () => ['expenses'] as const,
    myExpenses: () => ['expenses', 'me'] as const,
    pending: () => ['expenses', 'admin', 'review'] as const,
    adminBills: (filters?: Record<string, unknown>) => ['expenses', 'admin', 'bills', filters] as const,
    detail: (id: string) => ['expenses', 'detail', id] as const,
  },
  admin: {
    events: () => ['admin', 'events'] as const,
    history: (filters?: Record<string, unknown>) => ['admin', 'history', filters] as const,
    stats: {
      kpi: (clubId?: string | null) => ['admin', 'stats', 'kpi', clubId ?? null] as const,
      event: (clubId?: string | null) => ['admin', 'stats', 'event', clubId ?? null] as const,
      student: (clubId?: string | null) => ['admin', 'stats', 'student', clubId ?? null] as const,
      month: (clubId?: string | null) => ['admin', 'stats', 'month', clubId ?? null] as const,
      club: () => ['admin', 'stats', 'club'] as const,
      all: () => ['admin', 'stats'] as const,
    },
    students: {
      all: () => ['admin', 'students'] as const,
      detail: (id: string) => ['admin', 'students', id] as const,
    },
  },
  storage: {
    signedUrl: (path: string | null | undefined) => ['signedUrl', path] as const,
  },
}
