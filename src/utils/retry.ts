import { logger } from './logger';

/**
 * Utility to wrap asynchronous operations with retry logic.
 * 
 * @param fn The asynchronous function to execute.
 * @param maxRetries Maximum number of retry attempts.
 * @param delayMs Delay in milliseconds between retries.
 * @returns The result of the function `fn`.
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  delayMs: number = 2000
): Promise<T> {
  let attempt = 0;

  while (attempt < maxRetries) {
    try {
      return await fn();
    } catch (error: any) {
      attempt++;
      logger.warn(`Operation failed (Attempt ${attempt}/${maxRetries}): ${error.message}`);
      
      if (attempt >= maxRetries) {
        logger.error(`Operation completely failed after ${maxRetries} attempts.`);
        throw error;
      }

      logger.info(`Waiting ${delayMs}ms before next retry...`);
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  throw new Error('Unreachable code in withRetry');
}
