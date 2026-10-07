export const queryKeys = {
  events: {
    all: () => ['events'] as const,
    active: () => ['events', 'active'] as const,
  },
  expenses: {
    all: () => ['expenses'] as const,
    myExpenses: () => ['expenses', 'me'] as const,
    pending: () => ['expenses', 'admin', 'review'] as const,
  },
  admin: {
    events: () => ['admin', 'events'] as const,
    stats: {
      kpi: () => ['admin', 'stats', 'kpi'] as const,
      event: () => ['admin', 'stats', 'event'] as const,
      student: () => ['admin', 'stats', 'student'] as const,
      month: () => ['admin', 'stats', 'month'] as const,
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
