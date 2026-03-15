import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import AppLayout from "@/components/AppLayout";
import Auth from "./pages/Auth";
import Index from "./pages/Index";
import Units from "./pages/Units";
import Tenants from "./pages/Tenants";
import Contracts from "./pages/Contracts";
import Payments from "./pages/Payments";
import Utilities from "./pages/Utilities";
import Notifications from "./pages/Notifications";
import Users from "./pages/Users";
import Landlords from "./pages/Landlords";
import Help from "./pages/Help";
import ContractTemplate from "./pages/ContractTemplate";
import IPTU from "./pages/IPTU";
import Reports from "./pages/Reports";
import TenantPortal from "./pages/TenantPortal";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

/** Route for admin/manager/operator/viewer roles — redirects tenants */
const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { session, profile, loading } = useAuth();
  if (loading) return <div className="flex min-h-screen items-center justify-center"><p className="text-muted-foreground">Carregando...</p></div>;
  if (!session) return <Navigate to="/auth" replace />;
  // Redirect tenants to their portal
  if (profile?.role === "tenant") return <Navigate to="/portal" replace />;
  return <AppLayout>{children}</AppLayout>;
};

/** Route exclusively for tenants */
const TenantRoute = ({ children }: { children: React.ReactNode }) => {
  const { session, profile, loading } = useAuth();
  if (loading) return <div className="flex min-h-screen items-center justify-center"><p className="text-muted-foreground">Carregando...</p></div>;
  if (!session) return <Navigate to="/auth" replace />;
  // Non-tenant users go to main dashboard
  if (profile && profile.role !== "tenant") return <Navigate to="/" replace />;
  return <AppLayout>{children}</AppLayout>;
};

const AuthRoute = () => {
  const { session, profile, loading } = useAuth();
  if (loading) return null;
  if (session) {
    if (profile?.role === "tenant") return <Navigate to="/portal" replace />;
    return <Navigate to="/" replace />;
  }
  return <Auth />;
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/auth" element={<AuthRoute />} />
            <Route path="/" element={<ProtectedRoute><Index /></ProtectedRoute>} />
            <Route path="/units" element={<ProtectedRoute><Units /></ProtectedRoute>} />
            <Route path="/tenants" element={<ProtectedRoute><Tenants /></ProtectedRoute>} />
            <Route path="/contracts" element={<ProtectedRoute><Contracts /></ProtectedRoute>} />
            <Route path="/payments" element={<ProtectedRoute><Payments /></ProtectedRoute>} />
            <Route path="/utilities" element={<ProtectedRoute><Utilities /></ProtectedRoute>} />
            <Route path="/notifications" element={<ProtectedRoute><Notifications /></ProtectedRoute>} />
            <Route path="/users" element={<ProtectedRoute><Users /></ProtectedRoute>} />
            <Route path="/landlords" element={<ProtectedRoute><Landlords /></ProtectedRoute>} />
            <Route path="/help" element={<ProtectedRoute><Help /></ProtectedRoute>} />
            <Route path="/contract-template" element={<ProtectedRoute><ContractTemplate /></ProtectedRoute>} />
            <Route path="/iptu" element={<ProtectedRoute><IPTU /></ProtectedRoute>} />
            <Route path="/reports" element={<ProtectedRoute><Reports /></ProtectedRoute>} />
            <Route path="/portal" element={<TenantRoute><TenantPortal /></TenantRoute>} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
