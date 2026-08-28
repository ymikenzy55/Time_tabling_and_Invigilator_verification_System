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
            position="top-right"
            toastOptions={{
              style: { borderRadius: '10px', border: '1px solid #e5e7eb', fontSize: '14px' },
            }}
          />
        </ConfirmProvider>
      </AuthProvider>
    </BrowserRouter>
  </QueryClientProvider>
);

export default App;
