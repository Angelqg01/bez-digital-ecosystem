const EXTENSION_MESSAGE_CHANNEL_ERROR =
  'A listener indicated an asynchronous response by returning true, but the message channel closed before a response was received'

export function installDevConsoleGuards() {
  if (!import.meta.env.DEV || typeof window === 'undefined') return

  window.addEventListener('unhandledrejection', event => {
    const message = event.reason?.message || String(event.reason || '')

    if (message.includes(EXTENSION_MESSAGE_CHANNEL_ERROR)) {
      event.preventDefault()
    }
  })
}
