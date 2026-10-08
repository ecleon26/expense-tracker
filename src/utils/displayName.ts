/** Display name for a student or admin profile; falls back to email when full_name is empty. */
export function displayPersonName(
  person: { full_name?: string | null; email?: string | null } | null | undefined,
  fallback = 'Unknown'
): string {
  if (!person) return fallback
  const name = person.full_name?.trim()
  if (name) return name
  const email = person.email?.trim()
  if (email) return email
  return fallback
}

/** Audit log actor: prefer actor_name, then actor_email. */
export function displayActorName(
  item: { actor_name?: string | null; actor_email?: string | null } | null | undefined
): string {
  if (!item) return 'Unknown'
  const name = item.actor_name?.trim()
  if (name) return name
  const email = item.actor_email?.trim()
  if (email) return email
  return 'Unknown'
}
