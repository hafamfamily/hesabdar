import { AppShell } from './app/AppShell'
import { useRoute } from './app/router'
import { UIProvider } from './app/ui-context'
import { StoreProvider } from './data/store'
import { Dashboard } from './features/dashboard/Dashboard'
import { ReportsPage } from './features/reports/ReportsPage'
import { SettingsPage } from './features/settings/SettingsPage'
import { TransactionsPage } from './features/transactions/TransactionsPage'

export default function App() {
  const [route, go] = useRoute()
  return (
    <StoreProvider>
      <UIProvider>
        <AppShell route={route} onNavigate={go}>
          <div key={route} className="animate-fade-in">
            {route === 'home' && <Dashboard onNavigate={go} />}
            {route === 'transactions' && <TransactionsPage />}
            {route === 'reports' && <ReportsPage />}
            {route === 'settings' && <SettingsPage />}
          </div>
        </AppShell>
      </UIProvider>
    </StoreProvider>
  )
}
