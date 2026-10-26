/* Main App Component - Handles routing, auth provider and layout */
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { Toaster } from '@/components/ui/toaster'
import { Toaster as Sonner } from '@/components/ui/sonner'
import { TooltipProvider } from '@/components/ui/tooltip'
import { AuthProvider } from '@/contexts/AuthContext'
import Layout from './components/Layout'
import Index from './pages/Index'
import ForgotPassword from './pages/ForgotPassword'
import ResetPassword from './pages/ResetPassword'
import VerifyEmail from './pages/VerifyEmail'
import Dashboard from './pages/Dashboard'
import PainelConvites from './pages/PainelConvites'
import PainelProjetos from './pages/PainelProjetos'
import MinhaFila from './pages/MinhaFila'
import PainelOperacional from './pages/PainelOperacional'
import SharePointBrowser from './pages/SharePointBrowser'
import AceitarConvite from './pages/AceitarConvite'
import NotFound from './pages/NotFound'

// ONLY IMPORT AND RENDER WORKING PAGES, NEVER ADD PLACEHOLDER COMPONENTS OR PAGES IN THIS FILE
// AVOID REMOVING ANY CONTEXT PROVIDERS FROM THIS FILE (e.g. TooltipProvider, Toaster, Sonner)

const App = () => (
  <BrowserRouter>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <Routes>
          <Route element={<Layout />}>
            <Route path="/" element={<Index />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/verify-email" element={<VerifyEmail />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/convites" element={<PainelConvites />} />
            <Route path="/projetos" element={<PainelProjetos />} />
            <Route path="/fila" element={<MinhaFila />} />
            <Route path="/painel" element={<PainelOperacional />} />
            <Route path="/sharepoint" element={<SharePointBrowser />} />
            <Route path="/ativar-acesso" element={<AceitarConvite />} />
          </Route>
          <Route path="*" element={<NotFound />} />
        </Routes>
      </TooltipProvider>
    </AuthProvider>
  </BrowserRouter>
)

export default App
