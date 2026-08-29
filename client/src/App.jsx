import { BrowserRouter } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'react-hot-toast';
import { queryClient } from '@/lib/queryClient';
import { AuthProvider } from '@/context/AuthContext';
import { AppRoutes } from '@/routes/AppRoutes';
import { ConfirmProvider } from '@/components/ui/ConfirmDialog';
import { InstallPrompt } from '@/components/InstallPrompt';

const App = () => (
  <QueryClientProvider client={queryClient}>
    <BrowserRouter future={{ v7_startTransition: true }}>
      <AuthProvider>
        <ConfirmProvider>
          <AppRoutes />
          <InstallPrompt />
          <Toaster
            position="top-center"
            toastOptions={{
              duration: 4000,
              style: {
                borderRadius: '12px',
                border: '1px solid #e5e7eb',
                background: '#fff',
                color: '#1e293b',
                fontSize: '14px',
                fontWeight: 500,
                padding: '12px 16px',
                boxShadow: '0 4px 24px rgba(0,0,0,0.08), 0 1px 4px rgba(0,0,0,0.04)',
                maxWidth: '480px',
              },
              success: {
                iconTheme: { primary: '#10b981', secondary: '#fff' },
                style: { border: '1px solid #a7f3d0' },
              },
              error: {
                iconTheme: { primary: '#ef4444', secondary: '#fff' },
                style: { border: '1px solid #fecaca' },
              },
            }}
          />
        </ConfirmProvider>
      </AuthProvider>
    </BrowserRouter>
  </QueryClientProvider>
);

export default App;
