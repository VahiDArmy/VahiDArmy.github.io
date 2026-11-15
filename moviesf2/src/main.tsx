import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './styles/tokens.css';
import './styles/base.css';
import './styles/layout.css';
import './styles/components.css';
import './styles/views.css';
import './styles/ai.css';
import './styles/responsive.css';
import { Root } from './App';
import { applyAppearance, getSettings } from './data/settings';

applyAppearance(getSettings());

const container = document.getElementById('root');
if (!container) throw new Error('The root element is missing from index.html.');

createRoot(container).render(
  <StrictMode>
    <Root />
  </StrictMode>,
);
