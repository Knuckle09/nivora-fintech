export function formatINR(minorUnits: number, compact = false) {
  const rupees = minorUnits / 100;
  const hasPaise = Math.abs(minorUnits) % 100 !== 0;
  return compact
    ? new Intl.NumberFormat("en-IN", {
        style: "currency",
        currency: "INR",
        notation: "compact",
        maximumFractionDigits: 1
      }).format(rupees)
    : new Intl.NumberFormat("en-IN", {
        style: "currency",
        currency: "INR",
        minimumFractionDigits: hasPaise ? 2 : 0,
        maximumFractionDigits: hasPaise ? 2 : 0
      }).format(rupees);
}

export function formatDate(date: string, options?: Intl.DateTimeFormatOptions) {
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Kolkata",
    ...options
  }).format(new Date(`${date.slice(0, 10)}T12:00:00+05:30`));
}

export function monthBounds(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit"
  }).formatToParts(date);
  const year = Number(parts.find((part) => part.type === "year")?.value);
  const month = Number(parts.find((part) => part.type === "month")?.value);
  const day = Number(parts.find((part) => part.type === "day")?.value);
  const start = `${year}-${String(month).padStart(2, "0")}-01`;
  const nextDate = new Date(Date.UTC(year, month, 1));
  const end = `${nextDate.getUTCFullYear()}-${String(nextDate.getUTCMonth() + 1).padStart(2, "0")}-01`;
  const previousDate = new Date(Date.UTC(year, month - 2, 1));
  const previousStart = `${previousDate.getUTCFullYear()}-${String(previousDate.getUTCMonth() + 1).padStart(2, "0")}-01`;
  const previousLastDay = new Date(Date.UTC(year, month - 1, 0)).getUTCDate();
  const previousComparableEnd = `${previousDate.getUTCFullYear()}-${String(previousDate.getUTCMonth() + 1).padStart(2, "0")}-${String(Math.min(day, previousLastDay)).padStart(2, "0")}`;

  return { start, end, previousStart, previousComparableEnd };
}

export function monthLabel(date = new Date()) {
  return new Intl.DateTimeFormat("en-IN", {
    month: "long",
    year: "numeric",
    timeZone: "Asia/Kolkata"
  }).format(date);
}
