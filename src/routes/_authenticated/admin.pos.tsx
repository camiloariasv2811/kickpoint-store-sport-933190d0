import { createFileRoute, Navigate } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/admin/pos")({
  component: () => <Navigate to="/admin/ventas" replace />,
});
