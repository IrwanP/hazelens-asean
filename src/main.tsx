import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import { GoogleMapsProvider } from './context/GoogleMapsContext.tsx';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <GoogleMapsProvider>
    <App />
  </GoogleMapsProvider>
);
