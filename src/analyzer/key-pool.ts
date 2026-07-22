import { GoogleGenAI } from '@google/genai';
import { logger } from '../utils/logger';

/**
 * GeminiKeyPool — Manages multiple Gemini API keys with automatic rotation.
 * 
 * When a key hits rate limit (429 RESOURCE_EXHAUSTED), it instantly rotates
 * to the next available key. Exhausted keys get a 60-second cooldown before
 * being retried. If ALL keys are exhausted, it waits for the shortest
 * cooldown to expire before continuing.
 */
export class GeminiKeyPool {
  private keys: string[];
  private clients: GoogleGenAI[];
  private currentIndex: number = 0;
  private exhaustedUntil: Map<number, number> = new Map(); // key index → timestamp when available again
  private readonly COOLDOWN_MS = 60_000; // 60 seconds cooldown per exhausted key

  constructor(apiKeys: string[]) {
    if (apiKeys.length === 0) {
      throw new Error('GeminiKeyPool requires at least 1 API key');
    }

    this.keys = apiKeys;
    this.clients = apiKeys.map(key => new GoogleGenAI({ apiKey: key }));

    logger.info(`🔑 GeminiKeyPool initialized with ${this.keys.length} API key(s)`);
  }

  /**
   * Returns the total number of keys in the pool.
   */
  get totalKeys(): number {
    return this.keys.length;
  }

  /**
   * Returns the current active key index (1-based for logging).
   */
  get activeKeyNumber(): number {
    return this.currentIndex + 1;
  }

  /**
   * Get the currently active GoogleGenAI client.
   */
  getClient(): GoogleGenAI {
    return this.clients[this.currentIndex]!;
  }

  /**
   * Check if a specific key is currently in cooldown.
   */
  private isExhausted(index: number): boolean {
    const cooldownEnd = this.exhaustedUntil.get(index);
    if (cooldownEnd === undefined) return false;
    
    if (Date.now() >= cooldownEnd) {
      // Cooldown expired, key is available again
      this.exhaustedUntil.delete(index);
      logger.info(`🔓 Gemini key #${index + 1}/${this.totalKeys} cooldown expired — available again`);
      return false;
    }
    return true;
  }

  /**
   * Mark the current key as exhausted and set its cooldown.
   */
  private markExhausted(index: number): void {
    this.exhaustedUntil.set(index, Date.now() + this.COOLDOWN_MS);
    logger.warn(`⛔ Gemini key #${index + 1}/${this.totalKeys} rate-limited — cooldown for ${this.COOLDOWN_MS / 1000}s`);
  }

  /**
   * Rotate to the next available key. Returns true if a key was found,
   * false if all keys are exhausted (caller should wait).
   */
  private rotateToNextAvailable(): boolean {
    const startIndex = this.currentIndex;
    
    for (let i = 1; i <= this.keys.length; i++) {
      const nextIndex = (startIndex + i) % this.keys.length;
      
      if (!this.isExhausted(nextIndex)) {
        this.currentIndex = nextIndex;
        logger.info(`🔄 Rotated to Gemini key #${this.activeKeyNumber}/${this.totalKeys}`);
        return true;
      }
    }

    // All keys exhausted
    return false;
  }

  /**
   * Wait for the shortest cooldown among all exhausted keys to expire.
   */
  private async waitForCooldown(): Promise<void> {
    if (this.exhaustedUntil.size === 0) return;

    // Find the key with the shortest remaining cooldown
    let shortestWait = Infinity;
    let shortestKeyIndex = 0;

    for (const [index, cooldownEnd] of this.exhaustedUntil.entries()) {
      const remaining = cooldownEnd - Date.now();
      if (remaining < shortestWait) {
        shortestWait = remaining;
        shortestKeyIndex = index;
      }
    }

    if (shortestWait <= 0) {
      // A key is already off cooldown
      this.exhaustedUntil.delete(shortestKeyIndex);
      this.currentIndex = shortestKeyIndex;
      return;
    }

    logger.info(`⏳ All ${this.totalKeys} keys exhausted. Waiting ${Math.ceil(shortestWait / 1000)}s for key #${shortestKeyIndex + 1} to come off cooldown...`);
    
    await new Promise(resolve => setTimeout(resolve, shortestWait + 1000)); // +1s buffer
    
    // Clear the cooldown for the key we waited for
    this.exhaustedUntil.delete(shortestKeyIndex);
    this.currentIndex = shortestKeyIndex;
    logger.info(`🔓 Key #${shortestKeyIndex + 1}/${this.totalKeys} is available again. Resuming...`);
  }

  /**
   * Check if an error is a rate limit error (429 / RESOURCE_EXHAUSTED).
   */
  private isRateLimitError(error: unknown): boolean {
    if (error instanceof Error) {
      const msg = error.message.toLowerCase();
      return (
        msg.includes('429') ||
        msg.includes('resource_exhausted') ||
        msg.includes('rate limit') ||
        msg.includes('quota') ||
        msg.includes('too many requests')
      );
    }
    return false;
  }

  /**
   * Generate content using the key pool with automatic rotation on rate limits.
   * This is the main method consumers should use.
   * 
   * @param model - The model to use (e.g., 'gemini-2.5-flash')
   * @param contents - The prompt text
   * @param config - Generation config (schema, temperature, etc.)
   * @returns The response text, or null if all retries failed
   */
  async generateContent(
    model: string,
    contents: string,
    genConfig: {
      responseMimeType?: string;
      responseSchema?: any;
      temperature?: number;
    },
  ): Promise<string | null> {
    let attempts = 0;
    const maxAttempts = this.keys.length * 2; // Allow cycling through all keys twice

    while (attempts < maxAttempts) {
      attempts++;

      // Make sure current key isn't exhausted
      if (this.isExhausted(this.currentIndex)) {
        const found = this.rotateToNextAvailable();
        if (!found) {
          await this.waitForCooldown();
        }
        continue; // retry with new key
      }

      try {
        const client = this.getClient();
        const response = await client.models.generateContent({
          model,
          contents,
          config: genConfig,
        });

        return response.text ?? null;
      } catch (error) {
        if (this.isRateLimitError(error)) {
          this.markExhausted(this.currentIndex);

          const found = this.rotateToNextAvailable();
          if (!found) {
            await this.waitForCooldown();
          }
          // Continue the loop to retry with the new key
        } else {
          // Non-rate-limit error — don't rotate, just fail
          logger.error({ err: error }, 'Gemini API error (non-rate-limit)');
          return null;
        }
      }
    }

    logger.error(`All ${maxAttempts} attempts exhausted across ${this.totalKeys} keys. Giving up.`);
    return null;
  }
}
