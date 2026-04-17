import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import { Toaster as SonnerToaster } from 'sonner';

import AppLayout from '@/components/layout/AppLayout';
import ImportarXML from '@/pages/ImportarXML';
import NotasFiscais from '@/pages/NotasFiscais';
import RelatorioXML from '@/pages/RelatorioXML';
import Bonus from '@/pages/Bonus';
import DadosLogisticos from '@/pages/DadosLogisticos';
import DashboardExpedicao from '@/pages/DashboardExpedicao';
import Expedicoes from '@/pages/Expedicoes';
import Configuracoes from '@/pages/Configuracoes';

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError, navigateToLogin } = useAuth();

  if (isLoadingPublicSettings || isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-background">
        <div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  if (authError) {
    if (authError.type === 'user_not_registered') return <UserNotRegisteredError />;
    if (authError.type === 'auth_required') { navigateToLogin(); return null; }
  }

  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route path="/" element={<ImportarXML />} />
        <Route path="/notas" element={<NotasFiscais />} />
        <Route path="/relatorio" element={<RelatorioXML />} />
        <Route path="/bonus" element={<Bonus />} />
        <Route path="/logistica" element={<DadosLogisticos />} />
        <Route path="/dashboard" element={<DashboardExpedicao />} />
        <Route path="/expedicoes" element={<Expedicoes />} />
        <Route path="/configuracoes" element={<Configuracoes />} />
      </Route>
      <Route path="*" element={<PageNotFound />} />
    </Routes>
  );
};

function App() {
  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <Router>
          <AuthenticatedApp />
        </Router>
        <Toaster />
        <SonnerToaster richColors position="top-right" />
      </QueryClientProvider>
    </AuthProvider>
  );
}

export default App;