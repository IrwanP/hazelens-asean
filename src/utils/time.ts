/**
 * ISO / UTC Time formatting utilities for HazeLens ASEAN
 * Ensures all timestamps labeled UTC genuinely use UTC methods (getUTCHours, getUTCMinutes).
 */

export function formatUtcTime(isoString: string | null | undefined): string {
  if (!isoString) return 'Live';
  const d = new Date(isoString);
  if (isNaN(d.getTime())) return 'Live';
  const hours = String(d.getUTCHours()).padStart(2, '0');
  const minutes = String(d.getUTCMinutes()).padStart(2, '0');
  return `${hours}:${minutes} UTC`;
}

export function formatUtcDateTime(isoString: string | null | undefined): string {
  if (!isoString) return 'Live';
  const d = new Date(isoString);
  if (isNaN(d.getTime())) return 'Live';
  const year = d.getUTCFullYear();
  const month = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  const hours = String(d.getUTCHours()).padStart(2, '0');
  const minutes = String(d.getUTCMinutes()).padStart(2, '0');
  return `${year}-${month}-${day} ${hours}:${minutes} UTC`;
}
