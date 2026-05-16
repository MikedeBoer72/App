export function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export function yesterdayISO(ref?: string): string {
  const base = ref ? new Date(ref + 'T00:00:00') : new Date();
  base.setDate(base.getDate() - 1);
  return base.toISOString().slice(0, 10);
}

export function addDays(iso: string, days: number): string {
  const d = new Date(iso + 'T00:00:00');
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export function lastNDays(n: number): string[] {
  const today = todayISO();
  const out: string[] = [];
  for (let i = n - 1; i >= 0; i--) {
    out.push(addDays(today, -i));
  }
  return out;
}

export function shortLabel(iso: string): string {
  const d = new Date(iso + 'T00:00:00');
  return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d.getDay()];
}

export function greeting(now = new Date()): string {
  const h = now.getHours();
  if (h < 5) return 'Burning the midnight oil';
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  if (h < 21) return 'Good evening';
  return 'Good night';
}
