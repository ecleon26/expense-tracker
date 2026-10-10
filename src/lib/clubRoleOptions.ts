/** Club team roles collected at student signup (stored in profiles.club_role). */
const CLUB_ROLE_LABELS = [
  'Tech Core',
  'Operations & PR',
  'Design',
  'Social Media',
  'Marketing',
  'Sponsorship',
  'Treasurer',
  'Secretary',
  'Faculty Advisor',
] as const

export type ClubRole = (typeof CLUB_ROLE_LABELS)[number]

export const CLUB_ROLE_OPTIONS = CLUB_ROLE_LABELS.map((label) => ({
  value: label,
  label,
}))

export const clubRoleZodEnum = [...CLUB_ROLE_LABELS] as [ClubRole, ...ClubRole[]]
