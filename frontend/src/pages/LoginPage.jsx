import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAppState } from '../state/AppStateProvider.jsx';
import loginIllustration from '../assets/login-illustration.svg';

const LoginPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { auth, login } = useAppState();

  const [credentials, setCredentials] = useState({ username: '', password: '' });
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const from = location.state?.from?.pathname || '/dashboard';

  useEffect(() => {
    if (auth.isAuthenticated) {
      navigate(from, { replace: true });
    }
  }, [auth.isAuthenticated, from, navigate]);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setCredentials((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    setError('');
    const result = await login(credentials);
    setSubmitting(false);

    if (!result.ok) {
      setError(result.message ?? 'Login failed');
      return;
    }

    navigate(from, { replace: true });
  };

  return (
    <div className="min-vh-100 d-flex align-items-center justify-content-center bg-light">
      <div className="container">
        <div className="row align-items-center justify-content-center g-4">
          <div className="col-lg-5 text-center">
            <img
              src={loginIllustration}
              alt="Laundry illustration"
              className="img-fluid rounded shadow-sm"
              loading="lazy"
            />
          </div>
          <div className="col-lg-4">
            <div className="card p-4">
              <h1 className="h4 fw-bold text-center mb-3">Laundry Room Login</h1>
              <p className="text-muted small text-center mb-4">
                Enter your credentials to access the billing dashboard.
              </p>

              <form onSubmit={handleSubmit} className="d-grid gap-3">
                <div>
                  <label htmlFor="username" className="form-label fw-semibold">
                    Username
                  </label>
                  <input
                    id="username"
                    name="username"
                    type="text"
                    className="form-control form-control-lg"
                    placeholder="Laundry Room"
                    autoComplete="username"
                    value={credentials.username}
                    onChange={handleChange}
                    required
                  />
                </div>

                <div>
                  <label htmlFor="password" className="form-label fw-semibold">
                    Password
                  </label>
                  <input
                    id="password"
                    name="password"
                    type="password"
                    className="form-control form-control-lg"
                    placeholder="••••••••"
                    autoComplete="current-password"
                    value={credentials.password}
                    onChange={handleChange}
                    required
                  />
                </div>

                {error && (
                  <div className="alert alert-danger py-2 mb-0" role="alert">
                    {error}
                  </div>
                )}

                <button type="submit" className="btn btn-brand btn-lg mt-2" disabled={submitting}>
                  {submitting ? 'Signing in…' : 'Login'}
                </button>
              </form>

              <p className="text-center small text-muted mt-4 mb-0">
                Tip: default credentials are <strong>“Laundry Room”</strong> /{' '}
                <strong>“LaundryRoom@123”</strong>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;

