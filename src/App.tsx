import { Navigate, Route, Routes } from 'react-router-dom'
import Layout from './components/Layout'
import { DataProvider } from './data/DataProvider'
import WorkflowPage from './features/workflow/WorkflowPage'
import TeamPage from './features/team/TeamPage'
import AppsPage from './features/apps/AppsPage'
import DataPage from './features/data/DataPage'

export default function App() {
  return (
    <DataProvider>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<Navigate to="/workflow" replace />} />
          <Route path="/workflow" element={<WorkflowPage />} />
          <Route path="/team" element={<TeamPage />} />
          <Route path="/apps" element={<AppsPage />} />
          <Route path="/data" element={<DataPage />} />
          <Route path="*" element={<Navigate to="/workflow" replace />} />
        </Route>
      </Routes>
    </DataProvider>
  )
}