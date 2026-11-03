/** Dates are stored as YYYY-MM-DD strings in IST, which is how GST documents are dated. */
export function todayIST(addDays = 0) {
  const d = new Date(Date.now() + 5.5 * 3600 * 1000 + addDays * 86400000);
  return d.toISOString().slice(0, 10);
}

export const isoDate = /^\d{4}-\d{2}-\d{2}$/;
