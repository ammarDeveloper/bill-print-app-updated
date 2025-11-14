import { Link } from 'react-router-dom';

const NotFoundPage = () => (
  <div className="min-vh-100 d-flex align-items-center justify-content-center bg-light">
    <div className="text-center">
      <h1 className="display-5 fw-bold mb-3">404</h1>
      <p className="lead mb-4">We couldn’t find the page you were looking for.</p>
      <Link to="/dashboard" className="btn btn-primary">
        Go to Dashboard
      </Link>
    </div>
  </div>
);

export default NotFoundPage;

