import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { ClerkProvider } from '@clerk/clerk-react'
import './index.css'
import App from './App.tsx'
import { LanguageProvider } from './i18n'
import { ThemeProvider } from './hooks/useTheme'
import { clerkAppearance } from './lib/clerkTheme'
import ErrorBoundary from './components/ErrorBoundary'

const CLERK_PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY

const root = document.getElementById('root')!

if (!CLERK_PUBLISHABLE_KEY) {
  // Render a meaningful error instead of throwing (which would leave a blank page)
  root.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:center;height:100vh;font-family:system-ui,sans-serif;text-align:center;padding:2rem;">
      <div>
        <h1 style="font-size:1.25rem;font-weight:600;margin-bottom:0.5rem;">Configuration Error</h1>
        <p style="color:#666;font-size:0.875rem;">Missing VITE_CLERK_PUBLISHABLE_KEY environment variable.</p>
      </div>
    </div>
  `
} else {
  createRoot(root).render(
    <StrictMode>
      <ErrorBoundary>
        <ClerkProvider publishableKey={CLERK_PUBLISHABLE_KEY} appearance={clerkAppearance}>
          <ThemeProvider>
            <LanguageProvider>
              <App />
            </LanguageProvider>
          </ThemeProvider>
        </ClerkProvider>
      </ErrorBoundary>
    </StrictMode>,
  )
}
