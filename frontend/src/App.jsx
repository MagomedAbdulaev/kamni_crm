import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import Layout from './components/Layout.jsx'
import ClientsPage from './pages/ClientsPage.jsx'
import FinancePage from './pages/FinancePage.jsx'
import MainPage from './pages/MainPage.jsx'
import MaterialsPage from './pages/MaterialsPage.jsx'
import NewOrderPage from './pages/NewOrderPage.jsx'
import OrdersPage from './pages/OrdersPage.jsx'
import OrderDetailPage from './pages/OrderDetailPage.jsx'
import ProductTypesPage from './pages/ProductTypesPage.jsx'
import AnalyticsPage from './pages/AnalyticsPage.jsx'
import ManagersPage from './pages/ManagersPage.jsx'
import SettingsPage from './pages/SettingsPage.jsx'

function SectionPage() {
  return (
    <section className="min-h-[190px] overflow-hidden rounded-lg border border-[#e2e7e9] bg-white p-[25px] shadow-[0_8px_24px_rgb(29_50_63_/_4%)]">
      <span className="mb-1 text-[9px] font-bold tracking-[0.7px] text-[#778690]">STONECRM</span>
      <h3 className="mt-[5px] mb-0 font-display text-[17px] font-bold text-[#253440]">Раздел подключён</h3>
    </section>
  )
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<MainPage />} />
          <Route path="orders/new" element={<NewOrderPage />} />
          <Route path="orders" element={<OrdersPage />} />
          <Route path="orders/:orderId" element={<OrderDetailPage />} />
          <Route path="clients" element={<ClientsPage />} />
          <Route path="finance" element={<FinancePage />} />
          <Route path="materials" element={<MaterialsPage />} />
          <Route path="product-types" element={<ProductTypesPage />} />
          <Route path="analytics" element={<AnalyticsPage />} />
          <Route path="managers" element={<ManagersPage />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}

export default App
