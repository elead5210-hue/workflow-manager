import { Navigate, Route, Routes } from 'react-router-dom'
import Layout from './components/Layout'
import { DataProvider } from './data/DataProvider'
import WorkflowPage from './features/workflow/WorkflowPage'
import TeamPage from './features/team/TeamPage'

export default function App() {
  return (
    <DataProvider>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<Navigate to="/workflow" replace />} />
          <Route path="/workflow" element={<WorkflowPage />} />
          <Route path="/team" element={<TeamPage />} />
          <Route path="*" element={<Navigate to="/workflow" replace />} />
        </Route>
      </Routes>
    </DataProvider>
  )
}