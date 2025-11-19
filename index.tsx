import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

// NOTE: The Backend is now a separate process.
// Run 'npm run server' and 'npm run worker' in separate terminals to start the backend.
// The frontend connects to http://localhost:3000 and ws://localhost:8080

// --- BOOTSTRAP UI ---
const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
