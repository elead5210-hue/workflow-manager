import { Navigate, Route, Routes } from 'react-router-dom'
import Layout from './components/Layout'
import WorkflowPage from './features/workflow/WorkflowPage'
import TeamPage from './features/team/TeamPage'

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Navigate to="/workflow" replace />} />
        <Route path="/workflow" element={<WorkflowPage />} />
        <Route path="/team" element={<TeamPage />} />
        <Route path="*" element={<Navigate to="/workflow" replace />} />
      </Route>
    </Routes>
  )
}