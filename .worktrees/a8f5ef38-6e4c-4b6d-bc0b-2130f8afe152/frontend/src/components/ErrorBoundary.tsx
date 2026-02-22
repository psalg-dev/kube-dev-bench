import { Component, type ErrorInfo, type ReactNode } from 'react';
import Button from './ui/Button';
import './ErrorBoundary.css';

type ErrorBoundaryProps = {
  children: ReactNode;
};

type ErrorBoundaryState = {
  hasError: boolean;
  error?: Error | null;
};

export default class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = {
    hasError: false,
    error: null,
  };

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Unhandled UI error', error, info);
  }

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <div className="error-boundary">
        <div className="error-boundary-card">
          <h2>Something went wrong</h2>
          <p>
            The app ran into an unexpected error. Reload to try again.
          </p>
          {this.state.error?.message && (
            <pre className="error-boundary-message">{this.state.error.message}</pre>
          )}
          <Button variant="primary" onClick={this.handleReload}>
            Reload app
          </Button>
        </div>
      </div>
    );
  }
}
