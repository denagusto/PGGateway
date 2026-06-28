import { Routes, Route, Navigate } from 'react-router-dom'
import { AppShell } from './components/AppShell'
import { ToastProvider } from './components/ui/Toast'
import { TenantProvider } from './lib/tenant'
import { AuthProvider, useAuth } from './lib/auth'
import { useLiveStream } from './lib/useLiveStream'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import AlertDetail from './pages/AlertDetail'
import Reconciliation from './pages/Reconciliation'
import Rules from './pages/Rules'
import Developer from './pages/Developer'
import DeveloperSandbox from './pages/DeveloperSandbox'
import DeveloperPlayground from './pages/DeveloperPlayground'
import DeveloperLogs from './pages/DeveloperLogs'
import Ledger from './pages/Ledger'
import BukuBesar from './pages/BukuBesar'
import FdsQueue from './pages/FdsQueue'
import FdsAnalytics from './pages/FdsAnalytics'
import FdsDetectors from './pages/FdsDetectors'
import FdsModel from './pages/FdsModel'
import FdsLists from './pages/FdsLists'
import FdsSimulation from './pages/FdsSimulation'
import FdsInvestigation from './pages/FdsInvestigation'
import FdsCopilot from './pages/FdsCopilot'
import Audit from './pages/Audit'
import Platform from './pages/Platform'

export default function App() {
  return (
    <ToastProvider>
      <AuthProvider>
        <Gate />
      </AuthProvider>
    </ToastProvider>
  )
}

function Gate() {
  const { user, ready } = useAuth()
  if (!ready) return <div className="grid min-h-screen place-items-center bg-bg text-muted">Memuat…</div>
  if (!user) return <Login />
  return <AuthedApp />
}

function AuthedApp() {
  useLiveStream() // SSE: push updates to every list in real time
  return (
    <TenantProvider>
      <AppShell>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/transaksi" element={<Ledger />} />
          <Route path="/buku-besar" element={<BukuBesar />} />
          <Route path="/fds" element={<FdsQueue />} />
          <Route path="/fds/analytics" element={<FdsAnalytics />} />
          <Route path="/fds/detectors" element={<FdsDetectors />} />
          <Route path="/fds/model" element={<FdsModel />} />
          <Route path="/fds/lists" element={<FdsLists />} />
          <Route path="/fds/simulation" element={<FdsSimulation />} />
          <Route path="/fds/investigation" element={<FdsInvestigation />} />
          <Route path="/fds/copilot" element={<FdsCopilot />} />
          <Route path="/fds/rules" element={<Rules />} />
          <Route path="/fds/:id" element={<AlertDetail />} />
          <Route path="/rekonsiliasi" element={<Reconciliation />} />
          <Route path="/developer" element={<Developer />} />
          <Route path="/developer/sandbox" element={<DeveloperSandbox />} />
          <Route path="/developer/playground" element={<DeveloperPlayground />} />
          <Route path="/developer/logs" element={<DeveloperLogs />} />
          <Route path="/platform" element={<Platform />} />
          <Route path="/audit" element={<Audit />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AppShell>
    </TenantProvider>
  )
}
