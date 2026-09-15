/** Keep a newer live event from being overwritten by an older REST snapshot. */
export function selectLatestPlayback(current, snapshot) {
  if (!current) return snapshot || null
  if (!snapshot) return current
  return snapshot.serverTime >= current.serverTime ? snapshot : current
}
