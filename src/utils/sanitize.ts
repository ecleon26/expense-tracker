export function sanitizeSearchTerm(term: string): string {
  if (!term) return '';
  
  // Trim and limit to 60 characters
  let sanitized = term.trim().slice(0, 60);
  
  // Remove special characters: , ( ) " ' \ * % _
  // These have special meaning in PostgREST and LIKE filters.
  sanitized = sanitized.replace(/[,()"'\\*%_]/g, ' ');
  
  // Clean up extra spaces that might have been introduced by replacement
  sanitized = sanitized.replace(/\s+/g, ' ').trim();
  
  return sanitized;
}
