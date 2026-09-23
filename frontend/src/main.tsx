import { Component, type ErrorInfo, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { AppProvider } from './app/AppContext';
import { AppointmentProvider } from './features/appointments/AppointmentContext';
import Router from './app/Router';
import './styles/original.css';
import './styles/app.css';
class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Page failed to render', error, info.componentStack);
  }
  render() {
    return this.state.failed ? (
      <div className="loading-screen">
        <div className="card">
          <h2>Unable to display this page</h2>
          <p>Please reload the page and try again.</p>
          <button className="btn" onClick={() => window.location.reload()}>
            Reload
          </button>
        </div>
      </div>
    ) : (
      this.props.children
    );
  }
}
createRoot(document.getElementById('root')!).render(
  <ErrorBoundary>
    <BrowserRouter>
      <AppProvider>
        <AppointmentProvider>
          <Router />
        </AppointmentProvider>
      </AppProvider>
    </BrowserRouter>
  </ErrorBoundary>,
);
