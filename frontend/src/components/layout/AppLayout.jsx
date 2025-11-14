import { NavLink, Outlet } from 'react-router-dom';
import clsx from 'clsx';

const AppLayout = () => {
  return (
    <div className="app-shell">
      <div className="app-blur-orb app-blur-orb--1" />
      <div className="app-blur-orb app-blur-orb--2" />

      <header className="app-header">
        <div className="app-header__surface animate-fade-in">
          <div className="app-header__content">
            <div className="app-brand">
              <p className="app-brand__eyebrow">Laundry Room Billing Suite</p>
              <h1 className="app-brand__name">Delightfully Smooth Billing</h1>
              <p className="app-brand__tagline">
                Manage customers, track garments, and print elegant invoices with a truly premium experience.
              </p>
            </div>

            <div className="app-meta">
              <nav className="app-nav" aria-label="Main navigation">
                <NavLink
                  to="/dashboard"
                  className={({ isActive }) => clsx('app-nav__link', { 'app-nav__link--active': isActive })}
                >
                  Dashboard
                </NavLink>
              </nav>

              <div className="app-meta__actions">
                <div className="app-avatar">
                  <span className="app-avatar__dot" aria-hidden="true" />
                  <div className="app-avatar__details">
                    <span className="app-avatar__name">Laundry Room</span>
                    <span className="app-avatar__role">Billing Console</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="app-main">
        <div className="app-main__inner">
          <Outlet />
        </div>
      </main>

      <footer className="app-footer">
        <div className="app-footer__surface animate-fade-in">
          © {new Date().getFullYear()} Laundry Room • Crafted for impeccable garment care experiences.
        </div>
      </footer>
    </div>
  );
};

export default AppLayout;

