export function shouldTrigger(activeSeconds: number, intervalMin: number): boolean {
  return activeSeconds >= intervalMin * 60;
}

export function shouldPause(lastHeartbeatAt: number): boolean {
  return Date.now() - lastHeartbeatAt >= 60_000;
}
