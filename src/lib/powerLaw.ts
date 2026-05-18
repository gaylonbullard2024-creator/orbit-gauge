// BTC Power Law (Burger/PlanB): log10(price) = A * log10(days_since_genesis) + B
// Genesis: 2009-01-03 00:00:00 UTC

export const POWER_LAW_SLOPE = 5.82;
export const POWER_LAW_INTERCEPT = -17.01;
export const POWER_LAW_SIGMA = 0.46;
const GENESIS_MS = Date.UTC(2009, 0, 3);

export interface PowerLawValues {
  days: number;
  fair: number;
  log10Fair: number;
  bands: {
    p1: number; n1: number;
    p2: number; n2: number;
    p3: number; n3: number;
  };
}

function toMs(date: string | Date): number {
  return typeof date === 'string' ? Date.parse(date) : date.getTime();
}

export function computePowerLaw(date: string | Date = new Date()): PowerLawValues | null {
  const days = (toMs(date) - GENESIS_MS) / 86400000;
  if (!isFinite(days) || days <= 0) return null;
  const log10Fair = POWER_LAW_SLOPE * Math.log10(days) + POWER_LAW_INTERCEPT;
  const fair = Math.pow(10, log10Fair);
  const band = (n: number) => Math.pow(10, log10Fair + n * POWER_LAW_SIGMA);
  return {
    days,
    fair,
    log10Fair,
    bands: {
      p1: band(1), n1: band(-1),
      p2: band(2), n2: band(-2),
      p3: band(3), n3: band(-3),
    },
  };
}

export function computeZScore(price: number, date: string | Date = new Date()): number | null {
  const pl = computePowerLaw(date);
  if (!pl || price <= 0) return null;
  return (Math.log10(price) - pl.log10Fair) / POWER_LAW_SIGMA;
}

export function powerLawScore(z: number | null): number {
  if (z == null) return 2;
  if (z >= 2) return 4;
  if (z >= 1) return 3;
  if (z >= -1) return 2;
  if (z >= -2) return 1;
  return 0;
}

export function powerLawStatus(z: number | null): string {
  if (z == null) return 'N/A';
  if (z >= 2) return 'Cycle Top Risk';
  if (z >= 1) return 'Overheated';
  if (z >= -1) return 'Fair Value';
  if (z >= -2) return 'Accumulation';
  return 'Deep Value';
}

export function powerLawStatusColor(z: number | null): string {
  if (z == null) return 'hsl(215, 15%, 55%)';
  if (z >= 2) return 'hsl(0, 72%, 51%)';
  if (z >= 1) return 'hsl(28, 90%, 55%)';
  if (z >= -1) return 'hsl(45, 90%, 50%)';
  if (z >= -2) return 'hsl(152, 60%, 40%)';
  return 'hsl(220, 70%, 45%)';
}
