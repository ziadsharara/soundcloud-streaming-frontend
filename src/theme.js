import { ref } from 'vue'

const storedTheme = (() => {
  try {
    return window.localStorage.getItem('soundstream:theme')
  } catch {
    return null
  }
})()

const theme = ref(
  storedTheme === 'light' || storedTheme === 'dark'
    ? storedTheme
    : window.matchMedia?.('(prefers-color-scheme: light)').matches
      ? 'light'
      : 'dark',
)

function applyTheme() {
  document.documentElement.dataset.theme = theme.value
  document.documentElement.style.colorScheme = theme.value
}

applyTheme()

export function useTheme() {
  function toggleTheme() {
    theme.value = theme.value === 'dark' ? 'light' : 'dark'
    applyTheme()
    try {
      window.localStorage.setItem('soundstream:theme', theme.value)
    } catch {
      // Browsers can block storage; the in-memory preference still works.
    }
  }

  return { theme, toggleTheme }
}
