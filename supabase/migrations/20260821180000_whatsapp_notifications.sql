-- KICKPOINT WhatsApp Notifications Table & Configuration
-- Stores notification logs, delivery statuses, idempotency keys, and Meta message IDs.

CREATE TABLE IF NOT EXISTS public.whatsapp_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL,
  recipient_phone TEXT NOT NULL,
  recipient_type TEXT NOT NULL CHECK (recipient_type IN ('admin', 'customer')),
  order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
  order_code TEXT,
  message TEXT NOT NULL,
  template_name TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed')),
  provider_message_id TEXT,
  error_message TEXT,
  attempts INTEGER NOT NULL DEFAULT 1,
  idempotency_key TEXT UNIQUE NOT NULL,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  sent_at TIMESTAMPTZ
);

-- Indexes for querying and idempotency checks
CREATE INDEX IF NOT EXISTS idx_whatsapp_notif_order_id ON public.whatsapp_notifications(order_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_notif_status ON public.whatsapp_notifications(status);
CREATE INDEX IF NOT EXISTS idx_whatsapp_notif_event_type ON public.whatsapp_notifications(event_type);
CREATE INDEX IF NOT EXISTS idx_whatsapp_notif_created_at ON public.whatsapp_notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_whatsapp_notif_idempotency ON public.whatsapp_notifications(idempotency_key);

-- Security: Enable RLS
ALTER TABLE public.whatsapp_notifications ENABLE ROW LEVEL SECURITY;

-- Grants
GRANT ALL ON public.whatsapp_notifications TO service_role;
GRANT SELECT ON public.whatsapp_notifications TO authenticated;

-- RLS Policy: Authenticated staff can view notification logs
CREATE POLICY "Staff can view whatsapp notifications"
  ON public.whatsapp_notifications
  FOR SELECT
  TO authenticated
  USING (public.is_staff(auth.uid()));
