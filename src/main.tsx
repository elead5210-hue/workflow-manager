import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import { seedIfNeeded } from './db'
import './styles/global.css'

const root = createRoot(document.getElementById('root')!)

function render(seedError?: unknown) {
  root.render(
    <StrictMode>
      {seedError ? (
        <div role="alert" style={{ padding: '1rem' }}>
          <h1>Storage unavailable</h1>
          <p>
            The app could not open its local database. Private browsing or blocked
            site storage can cause this. Please check your browser settings and
            reload the page.
          </p>
          <p>
            {seedError instanceof Error ? seedError.message : String(seedError)}
          </p>
        </div>
      ) : (
        <BrowserRouter>
          <App />
        </BrowserRouter>
      )}
    </StrictMode>,
  )
}

// Seed once, outside React, so StrictMode double invocation cannot run it twice.
// Routes only render after seeding has finished.
seedIfNeeded().then(
  () => render(),
  (error: unknown) => render(error ?? new Error('Unknown database error')),
)