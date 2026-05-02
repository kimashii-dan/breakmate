export function shouldTrigger(activeSeconds: number, intervalMin: number): boolean {
  return activeSeconds >= intervalMin * 60;
}
