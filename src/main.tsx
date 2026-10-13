import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { PostHogProvider } from 'posthog-js/react';
import App from './App.tsx';
import './index.css';

const POSTHOG_KEY =
  (import.meta.env.VITE_PUBLIC_POSTHOG_KEY as string | undefined) ||
  'phc_xqroJmmWbhTmjdvmZfCmQGYeufborDqJyNNe97Qis64Q';
const POSTHOG_HOST =
  (import.meta.env.VITE_PUBLIC_POSTHOG_HOST as string | undefined) ||
  'https://us.i.posthog.com';

const posthogOptions = {
  api_host: POSTHOG_HOST,
  defaults: '2025-05-24',
  capture_exceptions: true,
  debug: import.meta.env.MODE === 'development',
  // Session replays should not ingest the browser console.
  enable_recording_console_log: false,
  // No web-vitals / network-timing events — page views and custom events still flow.
  capture_performance: false,
};

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <PostHogProvider apiKey={POSTHOG_KEY} options={posthogOptions}>
      {/* No ConvexProvider: nothing reads Convex in the browser, and its client kept a
          websocket open for every visitor. Admin writes are mirrored over HTTP in lib/convexMirror. */}
      <App />
    </PostHogProvider>
  </StrictMode>
);
