import { NavLink, Outlet } from 'react-router-dom'
import './Layout.css'

const navLinks = [
  { to: '/workflow', label: 'Workflow' },
  { to: '/team', label: 'Team' },
]

export default function Layout() {
  return (
    <div className="layout">
      <a className="layout__skip-link" href="#main-content">
        Skip to main content
      </a>
      <header className="layout__header">
        <div className="layout__header-inner">
          <span className="layout__brand">Workflow Manager</span>
          <nav className="layout__nav" aria-label="Main navigation">
            {navLinks.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                className={({ isActive }) =>
                  isActive
                    ? 'layout__nav-link layout__nav-link--active'
                    : 'layout__nav-link'
                }
              >
                {link.label}
              </NavLink>
            ))}
          </nav>
        </div>
      </header>
      <main className="layout__main" id="main-content" tabIndex={-1}>
        <Outlet />
      </main>
    </div>
  )
}