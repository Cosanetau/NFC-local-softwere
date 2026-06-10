export const EVENT_TYPES = [
  "START_SHIFT",
  "START_LUNCH",
  "END_LUNCH",
  "START_SMOKE",
  "END_SMOKE",
  "END_SHIFT",
];

export const STATUS = {
  OFF_SHIFT: "Off Shift",
  WORKING: "Working",
  LUNCH: "Lunch Break",
  SMOKE: "Smoke Break",
};

export function nowIso() {
  return new Date().toISOString();
}

export function getWeekStart(date = new Date()) {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  const day = copy.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  copy.setDate(copy.getDate() + diff);
  return copy;
}

export function getThreeWeekWindow() {
  const start = getWeekStart();
  start.setDate(start.getDate() - 14);

  const end = new Date(getWeekStart());
  end.setDate(end.getDate() + 7);

  return {
    startIso: start.toISOString(),
    endIso: end.toISOString(),
  };
}

export function formatDate(value) {
  return new Intl.DateTimeFormat("en-AU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(value));
}

export function formatDay(value) {
  return new Intl.DateTimeFormat("en-AU", { weekday: "long" }).format(new Date(value));
}

export function formatTime(value) {
  if (!value) {
    return "Open";
  }

  return new Intl.DateTimeFormat("en-AU", {
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

export function formatDuration(milliseconds) {
  const minutes = Math.max(0, Math.round(milliseconds / 60000));
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours} hours ${mins} min`;
}

export function minutesBetween(start, end) {
  return Math.max(0, new Date(end).getTime() - new Date(start).getTime());
}
