/** Keep a newer live event from being overwritten by an older REST snapshot. */
export function selectLatestPlayback(current, snapshot) {
  if (!current) return snapshot || null
  if (!snapshot) return current
  return snapshot.serverTime >= current.serverTime ? snapshot : current
}

/**
 * Whether the host jumped, rather than simply played on.
 *
 * A listener only corrects drift beyond a couple of seconds, which would quietly ignore a short
 * scrub. Comparing where the host actually is against where they would have been had they kept
 * playing tells the two apart, so a jump is followed exactly and steady playing is left alone.
 */
export function looksLikeSeek(previous, next, toleranceMs = 1200) {
  if (!previous || !next || previous.trackUrl !== next.trackUrl) return false
  const elapsed = Math.max(0, next.serverTime - previous.serverTime)
  const predicted = previous.positionMs + (previous.playing ? elapsed : 0)
  return Math.abs(next.positionMs - predicted) > toleranceMs
}
