import { Duration } from './duration'
import { Ratelimit } from '@upstash/ratelimit'
import { kv } from '@vercel/kv'

export default async function ratelimit(
  key: string | null,
  maxRequests: number,
  window: Duration,
) {
  // Skip rate limiting if no Redis credentials are provided
  if (!process.env.KV_REST_API_URL || !process.env.KV_REST_API_TOKEN) {
    console.warn('KV_REST_API_URL or KV_REST_API_TOKEN not set, skipping rate limiting')
    return false
  }

  try {
    const ratelimit = new Ratelimit({
      redis: kv,
      limiter: Ratelimit.slidingWindow(maxRequests, window),
    })

    const { success, limit, reset, remaining } = await ratelimit.limit(
      `ratelimit_${key}`,
    )

    if (!success) {
      return {
        amount: limit,
        reset,
        remaining,
      }
    }
  } catch (error) {
    console.error('Rate limiting error:', error)
    // If Redis is unavailable, allow the request to proceed
    // This prevents Redis connection issues from breaking the app
    return false
  }
}
