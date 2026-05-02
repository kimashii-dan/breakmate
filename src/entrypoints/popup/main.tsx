import { StrictMode } from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import '../../assets/tailwind.css';
import { initTheme } from '../../lib/theme';

initTheme();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
