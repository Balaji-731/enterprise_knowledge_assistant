/**
 * Derive crisp 2-letter avatar initials from a user's full name or username.
 */
export function getUserInitials(fullName, username) {
  const parts = (fullName || '').trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  const clean = (fullName || username || 'U').trim();
  return clean.substring(0, 2).toUpperCase();
}
