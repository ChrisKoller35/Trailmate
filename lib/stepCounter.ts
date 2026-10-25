// lib/stepCounter.ts
// Pedometer.watchStepCount zählt nach jedem Abonnieren (z. B. nach einer
// Pause) wieder ab 0. Der Stand vor dem Abo wird als Basis dazugezählt.

function safeCount(value: number): number {
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;
}

export function totalSteps(stepsBefore: number, sessionSteps: number): number {
  return safeCount(stepsBefore) + safeCount(sessionSteps);
}
