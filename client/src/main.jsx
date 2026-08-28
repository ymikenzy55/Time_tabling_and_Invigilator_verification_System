import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

const hidePreloader = () => {
  const el = document.getElementById('app-preloader');
  if (!el) return;
  const alreadyShown = sessionStorage.getItem('uenr:preloaderShown') === '1';
  const delay = alreadyShown ? 0 : 700;
  window.setTimeout(() => {
    el.classList.add('hide');
    window.setTimeout(() => el.remove(), 450);
    sessionStorage.setItem('uenr:preloaderShown', '1');
  }, delay);
};

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

if (document.readyState === 'complete') hidePreloader();
else window.addEventListener('load', hidePreloader);

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  });
}
