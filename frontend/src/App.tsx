import { Routes, Route, Navigate } from 'react-router-dom'
import { AppShell } from './components/AppShell'
import { TenantProvider } from './lib/tenant'
import { useLiveStream } from './lib/useLiveStream'
import Dashboard from './pages/Dashboard'
import AlertDetail from './pages/AlertDetail'
import Reconciliation from './pages/Reconciliation'
import Rules from './pages/Rules'
import Developer from './pages/Developer'
import Ledger from './pages/Ledger'
import BukuBesar from './pages/BukuBesar'
import FdsQueue from './pages/FdsQueue'
import Audit from './pages/Audit'

export default function App() {
  useLiveStream() // SSE: push updates to every list in real time
  return (
    <TenantProvider>
      <AppShell>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/transaksi" element={<Ledger />} />
          <Route path="/buku-besar" element={<BukuBesar />} />
          <Route path="/fds" element={<FdsQueue />} />
          <Route path="/fds/rules" element={<Rules />} />
          <Route path="/fds/:id" element={<AlertDetail />} />
          <Route path="/rekonsiliasi" element={<Reconciliation />} />
          <Route path="/developer" element={<Developer />} />
          <Route path="/audit" element={<Audit />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AppShell>
    </TenantProvider>
  )
}
