import type { ReactNode } from 'react'
import { AppShell } from './app/AppShell'
import { type Route, useRoute } from './app/router'
import { SyncProvider } from './app/sync-context'
import { UIProvider } from './app/ui-context'
import { useDueReminders } from './app/useReminders'
import { StoreProvider } from './data/store'
import { Dashboard } from './features/dashboard/Dashboard'
import { DebtsPage } from './features/debts/DebtsPage'
import { ReportsPage } from './features/reports/ReportsPage'
import { SettingsPage } from './features/settings/SettingsPage'
import { TransactionsPage } from './features/transactions/TransactionsPage'

export default function App() {
  return (
    <StoreProvider>
      <SyncProvider>
        <UIProvider>
          <Main />
        </UIProvider>
      </SyncProvider>
    </StoreProvider>
  )
}

function Main() {
  const [route, go] = useRoute()
  const due = useDueReminders()
  const pages: Record<Route, ReactNode> = {
    home: <Dashboard onNavigate={go} />,
    transactions: <TransactionsPage />,
    debts: <DebtsPage />,
    reports: <ReportsPage />,
    settings: <SettingsPage />,
  }
  return (
    <AppShell route={route} onNavigate={go} badges={{ debts: due.length }}>
      <div key={route} className="animate-fade-in">
        {pages[route]}
      </div>
    </AppShell>
  )
}
