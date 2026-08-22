import { createFileRoute, Navigate } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/admin/caja")({
  component: () => <Navigate to="/admin/ventas" replace />,
});
