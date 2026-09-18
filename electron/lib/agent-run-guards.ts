export function isRetryableOpenRouterError(message: string): boolean {
  return /idle timeout|504/i.test(message)
}

export function shouldEmitIterationWarning(iterationsRemaining: number): boolean {
  return iterationsRemaining <= 3 && iterationsRemaining >= 0
}
