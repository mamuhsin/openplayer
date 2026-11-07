export async function startAudio(audio, signal) {
  signal.throwIfAborted()
  let onAbort
  const cancelled = new Promise((_, reject) => {
    onAbort = () => reject(signal.reason)
    signal.addEventListener('abort', onAbort, { once: true })
  })
  try {
    await Promise.race([audio.play(), cancelled])
    signal.throwIfAborted()
  } finally {
    signal.removeEventListener('abort', onAbort)
  }
}

export function restorePosition(audio, seconds) {
  if (!Number.isFinite(seconds) || seconds <= 0 || !Number.isFinite(audio.duration)) return
  audio.currentTime = Math.min(seconds, Math.max(0, audio.duration - 0.1))
}

// Check progress without rerendering the player or polling during a pause.
export function watchAudioStalls(audio, onStall, delay = 7000) {
  let timer
  let lastPosition
  let lastProgress
  const stop = () => {
    clearTimeout(timer)
    timer = undefined
  }
  const check = () => {
    timer = undefined
    if (audio.paused || audio.ended) return
    recordProgress()
    const remaining = delay - (Date.now() - lastProgress)
    if (remaining > 0) timer = setTimeout(check, remaining)
    else onStall(audio.currentTime)
  }
  function recordProgress() {
    if (Math.abs(audio.currentTime - lastPosition) < 0.05) return
    lastPosition = audio.currentTime
    lastProgress = Date.now()
  }
  const restart = () => {
    stop()
    if (audio.paused || audio.ended) return
    lastPosition = audio.currentTime
    lastProgress = Date.now()
    timer = setTimeout(check, delay)
  }
  const listeners = {
    playing: restart,
    seeking: restart,
    timeupdate: recordProgress,
    pause: stop,
    ended: stop,
    emptied: stop,
    error: stop,
  }
  for (const [event, listener] of Object.entries(listeners)) audio.addEventListener(event, listener)
  return () => {
    stop()
    for (const [event, listener] of Object.entries(listeners)) audio.removeEventListener(event, listener)
  }
}

export function upcomingTracks(queue, currentId, wrap = false) {
  const index = queue.findIndex(track => track.id === currentId)
  const remaining = queue.slice(index + 1)
  return wrap && index > 0 ? remaining.concat(queue.slice(0, index)) : remaining
}

export function shuffledTracks(tracks) {
  const order = [...tracks]
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    const track = order[i]
    order[i] = order[j]
    order[j] = track
  }
  return order
}
