/** Retry keys are not credentials. Keep one key for each reviewed payload while the sheet lives;
 * an ambiguous network failure can then retry the same submission without creating a new intent.
 * Nothing in this map is persisted to disk.
 */
export class ApplicationIntent {
  private keys = new Map<string, string>();
  forPayload(jobId: string, resumeId: string | null, note: string): string {
    const signature = JSON.stringify([jobId, resumeId, note.trim()]);
    let key = this.keys.get(signature);
    if (!key) {
      key = `mobile-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}-${this.keys.size}`;
      this.keys.set(signature, key);
    }
    return key;
  }
}
