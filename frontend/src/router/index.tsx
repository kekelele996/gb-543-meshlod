import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import AppShell from '../components/layout/AppShell';
import Login from '../pages/Login';
import Assets from '../pages/Assets';
import AssetDetail from '../pages/AssetDetail';
import PipelineNew from '../pages/PipelineNew';
import Runs from '../pages/Runs';
import RunDetail from '../pages/RunDetail';
import { RequireAuth } from './guards';

export default function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route
          path="/"
          element={
            <RequireAuth>
              <AppShell />
            </RequireAuth>
          }
        >
          <Route index element={<Navigate to="/assets" replace />} />
          <Route path="assets" element={<Assets />} />
          <Route path="assets/:id" element={<AssetDetail />} />
          <Route path="pipelines/new" element={<PipelineNew />} />
          <Route path="runs" element={<Runs />} />
          <Route path="runs/:id" element={<RunDetail />} />
        </Route>
        <Route path="*" element={<Navigate to="/assets" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
