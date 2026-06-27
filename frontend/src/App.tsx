import { Routes, Route, Navigate } from 'react-router-dom'
import { AppShell } from './components/AppShell'
import Dashboard from './pages/Dashboard'
import AlertDetail from './pages/AlertDetail'
import Reconciliation from './pages/Reconciliation'
import Rules from './pages/Rules'
import { FdsQueue, Placeholder } from './pages/Placeholder'

export default function App() {
  return (
    <AppShell>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/transaksi" element={<Placeholder title="Transaksi / Ledger" />} />
        <Route path="/fds" element={<FdsQueue />} />
        <Route path="/fds/rules" element={<Rules />} />
        <Route path="/fds/:id" element={<AlertDetail />} />
        <Route path="/rekonsiliasi" element={<Reconciliation />} />
        <Route path="/audit" element={<Placeholder title="Audit Log" />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AppShell>
  )
}
