-- 1) Limpiar historial de movimientos de inventario de pruebas (no altera stock)
DELETE FROM public.inventory_movements;

-- 2) Tabla de notificaciones de WhatsApp
CREATE TABLE IF NOT EXISTS public.whatsapp_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  idempotency_key text NOT NULL UNIQUE,
  event_type text NOT NULL,
  recipient_phone text NOT NULL,
  recipient_type text NOT NULL DEFAULT 'admin',
  order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  order_code text,
  message text NOT NULL,
  template_name text,
  status text NOT NULL DEFAULT 'pending',
  provider_message_id text,
  error_message text,
  attempts integer NOT NULL DEFAULT 0,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.whatsapp_notifications TO authenticated;
GRANT ALL ON public.whatsapp_notifications TO service_role;

ALTER TABLE public.whatsapp_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "whatsapp notifications staff read"
  ON public.whatsapp_notifications
  FOR SELECT
  TO authenticated
  USING (public.is_staff(auth.uid()));

CREATE INDEX IF NOT EXISTS whatsapp_notifications_provider_msg_idx
  ON public.whatsapp_notifications (provider_message_id);
CREATE INDEX IF NOT EXISTS whatsapp_notifications_created_idx
  ON public.whatsapp_notifications (created_at DESC);

CREATE TRIGGER whatsapp_notifications_touch
  BEFORE UPDATE ON public.whatsapp_notifications
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();