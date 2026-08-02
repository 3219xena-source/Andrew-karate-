/**
 * Entry point.
 *
 * Mounts the application and fails loudly if the root element is missing,
 * rather than silently rendering nothing.
 */

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App.tsx';
import { installTestHooks } from './systems/testHooks.ts';
import './styles/design-system.css';
import './styles/screens.css';

const container = document.getElementById('root');

if (!container) {
  throw new Error('Root element #root was not found in index.html; the game cannot mount.');
}

// Deterministic automation hooks. They drive the same systems the UI drives
// and cannot set a result directly — see `systems/testHooks.ts`.
installTestHooks();

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
