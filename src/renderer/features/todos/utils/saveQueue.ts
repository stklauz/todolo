export type SaveReason = 'immediate' | 'debounced';

type OnSave = () => Promise<void> | void;

/**
 * Simple debounced save queue for a single channel.
 * Consumers provide an onSave closure that captures current data to persist.
 */
export class SaveQueue {
  private timer: number | null = null;

  private onSave: OnSave;

  constructor(onSave: OnSave) {
    this.onSave = onSave;
  }

  enqueue(reason: SaveReason, delayMs = 200): void {
    if (reason === 'immediate') {
      this.cancel();
      void this.safeSave();
      return;
    }
    if (this.timer) {
      window.clearTimeout(this.timer);
    }
    this.timer = window.setTimeout(
      () => {
        this.timer = null;
        void this.safeSave();
      },
      Math.max(0, delayMs | 0),
    );
  }

  flush(): void {
    this.cancel();
    void this.safeSave();
  }

  cancel(): void {
    if (this.timer) {
      window.clearTimeout(this.timer);
      this.timer = null;
    }
  }

  private async safeSave(): Promise<void> {
    try {
      await this.onSave();
    } catch {
      // Caller should log errors from the provided onSave
    }
  }
}
