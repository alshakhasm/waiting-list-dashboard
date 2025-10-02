import React from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './ui/App';
import { ErrorBoundary } from './ui/ErrorBoundary';

const container = document.getElementById('root')!;
console.log('[UI] Bootstrapping React app...');
createRoot(container).render(
	<ErrorBoundary>
		<App />
	</ErrorBoundary>
);
