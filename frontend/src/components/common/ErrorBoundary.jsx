import { Component } from 'react';

class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('Error caught by boundary:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '2rem',
          background: '#070912',
          color: '#f4f7ff'
        }}>
          <div style={{
            maxWidth: '600px',
            padding: '2rem',
            background: 'rgba(16, 19, 35, 0.72)',
            borderRadius: '20px',
            border: '1px solid rgba(255, 255, 255, 0.14)'
          }}>
            <h1 style={{ marginTop: 0, color: '#f87171' }}>Something went wrong</h1>
            <p style={{ color: 'rgba(184, 198, 255, 0.65)' }}>
              {this.state.error?.message || 'An unexpected error occurred'}
            </p>
            <button
              onClick={() => {
                this.setState({ hasError: false, error: null });
                window.location.reload();
              }}
              style={{
                padding: '0.75rem 1.5rem',
                background: '#6a5af9',
                border: 'none',
                borderRadius: '14px',
                color: '#fff',
                cursor: 'pointer',
                marginTop: '1rem'
              }}
            >
              Reload Page
            </button>
            <details style={{ marginTop: '1rem', color: 'rgba(184, 198, 255, 0.65)' }}>
              <summary style={{ cursor: 'pointer' }}>Error Details</summary>
              <pre style={{
                marginTop: '0.5rem',
                padding: '1rem',
                background: 'rgba(0, 0, 0, 0.3)',
                borderRadius: '8px',
                overflow: 'auto',
                fontSize: '0.875rem'
              }}>
                {this.state.error?.stack || String(this.state.error)}
              </pre>
            </details>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;

