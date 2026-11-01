import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./hooks/useAuth";
import Layout from "./components/Layout";
import Login from "./pages/Login";
import Landing from "./pages/Landing";
import Home from "./pages/Home";
import Medicines from "./pages/Medicines";
import Water from "./pages/Water";
import Walking from "./pages/Walking";
import Respirometer from "./pages/Respirometer";
import Appointments from "./pages/Appointments";
import MedicalReports from "./pages/MedicalReports";
import AdminMedicines from "./pages/admin/AdminMedicines";
import Inventory from "./pages/admin/Inventory";
import AdminAppointments from "./pages/admin/AdminAppointments";
import Reports from "./pages/admin/Reports";
import Settings from "./pages/admin/Settings";

export default function App() {
  const { role, isAdmin } = useAuth();

  return (
    <Routes>
      {/* Public landing page – no auth needed */}
      <Route path="/welcome" element={<Landing />} />

      {!role ? (
        <Route path="*" element={<Login />} />
      ) : (
        <Route element={<Layout />}>
          <Route index element={<Home />} />
          <Route path="medicines"      element={<Medicines />} />
          <Route path="water"          element={<Water />} />
          <Route path="walking"        element={<Walking />} />
          <Route path="respirometer"   element={<Respirometer />} />
          <Route path="appointments"   element={<Appointments />} />
          {/* Medical reports: accessible by both roles */}
          <Route path="medical-reports" element={<MedicalReports />} />
          {isAdmin && (
            <>
              <Route path="admin/medicines"    element={<AdminMedicines />} />
              <Route path="admin/inventory"    element={<Inventory />} />
              <Route path="admin/appointments" element={<AdminAppointments />} />
              <Route path="admin/reports"      element={<Reports />} />
              <Route path="admin/settings"     element={<Settings />} />
            </>
          )}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      )}
    </Routes>
  );
}
