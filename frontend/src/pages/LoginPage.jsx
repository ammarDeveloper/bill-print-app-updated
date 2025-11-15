import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAppState } from '../state/AppStateProvider.jsx';

const LoginPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { auth, login } = useAppState();

  const [passcode, setPasscode] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const from = location.state?.from?.pathname || '/dashboard';

  useEffect(() => {
    if (auth.isAuthenticated) {
      navigate(from, { replace: true });
    }
  }, [auth.isAuthenticated, from, navigate]);

  const handleChange = (event) => {
    setPasscode(event.target.value);
    setError('');
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    setError('');
    
    const result = await login({ passcode });
    setSubmitting(false);

    if (!result.ok) {
      setError(result.message ?? 'Invalid passcode');
      return;
    }

    navigate(from, { replace: true });
  };

  return (
    <div className="login-page">
      <div className="login-page__blur-orb login-page__blur-orb--1" />
      <div className="login-page__blur-orb login-page__blur-orb--2" />
      
      <div className="login-page__container">
        <div className="login-page__content animate-fade-in">
          <div className="login-page__brand">
            <h1 className="login-page__title">Laundry Room</h1>
            <p className="login-page__subtitle">Billing Suite</p>
            <p className="login-page__tagline">Enter your passcode to access the dashboard</p>
          </div>

          <form onSubmit={handleSubmit} className="login-page__form animate-fade-up--delayed">
            <div className="login-page__input-group">
              <label htmlFor="passcode" className="login-page__label">
                Passcode
              </label>
              <input
                id="passcode"
                name="passcode"
                type="password"
                className="login-page__input"
                placeholder="Enter passcode"
                autoComplete="off"
                value={passcode}
                onChange={handleChange}
                required
                autoFocus
              />
            </div>

            {error && (
              <div className="login-page__error" role="alert">
                {error}
              </div>
            )}

            <button 
              type="submit" 
              className="login-page__button" 
              disabled={submitting || !passcode.trim()}
            >
              {submitting ? 'Signing in…' : 'Access Dashboard'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;

