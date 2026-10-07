import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import { seedIfNeeded } from './db'
import './styles/global.css'

const root = createRoot(document.getElementById('root')!)

/** Returns the technical reason behind a failure, for display below the explanation. */
function describeError(error: unknown): string {
  if (error instanceof Error && error.message) return error.message
  return typeof error === 'string' && error ? error : 'Unknown database error'
}

function render(seedError?: unknown) {
  root.render(
    <StrictMode>
      {seedError ? (
        <div role="alert" style={{ padding: '1rem' }}>
          <h1>Storage unavailable</h1>
          <p>
            This app keeps your team and workflow in your browser's local database
            (IndexedDB), and that database could not be opened.
          </p>
          <p>This usually happens when:</p>
          <ul>
            <li>
              the page is open in a private or incognito window that blocks site
              storage,
            </li>
            <li>
              the browser is set to block site data or cookies for this site, or
            </li>
            <li>the device has run out of storage space.</li>
          </ul>
          <p>
            Open the app in a normal browser window, allow site data for this
            site in your browser settings, then reload the page.
          </p>
          <p>
            <button type="button" onClick={() => window.location.reload()}>
              Reload the page
            </button>
          </p>
          <p>Technical details: {describeError(seedError)}</p>
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