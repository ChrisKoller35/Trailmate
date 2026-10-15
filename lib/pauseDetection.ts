const PAUSE_SPEED_THRESHOLD = 0.3; // m/s
const PAUSE_ACCURACY_THRESHOLD = 20; // meters
const PAUSE_DURATION_THRESHOLD = 60_000; // 60 seconds in ms

export class PauseDetector {
  private pauseStartTime: number | null = null;
  private totalPauseDurationMs: number = 0;
  private paused: boolean = false;

  checkPause(speed: number | null, accuracy: number | null): boolean {
    const isSlowEnough = speed === null || speed < PAUSE_SPEED_THRESHOLD;
    const isAccurateEnough = accuracy === null || accuracy < PAUSE_ACCURACY_THRESHOLD;

    if (isSlowEnough && isAccurateEnough) {
      if (this.pauseStartTime === null) {
        this.pauseStartTime = Date.now();
      }

      const elapsed = Date.now() - this.pauseStartTime;
      if (elapsed >= PAUSE_DURATION_THRESHOLD) {
        if (!this.paused) {
          this.paused = true;
        }
        return true;
      }
    } else {
      // Moving again — accumulate pause duration if was paused
      if (this.paused && this.pauseStartTime !== null) {
        this.totalPauseDurationMs += Date.now() - this.pauseStartTime;
      }
      this.pauseStartTime = null;
      this.paused = false;
    }

    return false;
  }

  getTotalPauseDuration(): number {
    let total = this.totalPauseDurationMs;
    if (this.paused && this.pauseStartTime !== null) {
      total += Date.now() - this.pauseStartTime;
    }
    return total;
  }

  isCurrentlyPaused(): boolean {
    return this.paused;
  }

  reset(): void {
    this.pauseStartTime = null;
    this.totalPauseDurationMs = 0;
    this.paused = false;
  }
}
