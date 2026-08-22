-- KICKPOINT Email Notifications Table & Configuration
-- Stores email notification logs, delivery statuses, idempotency keys, and Resend message IDs.

CREATE TABLE IF NOT EXISTS public.email_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL,
  recipient_email TEXT NOT NULL,
  recipient_type TEXT NOT NULL CHECK (recipient_type IN ('admin', 'customer')),
  order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
  order_code TEXT,
  subject TEXT NOT NULL,
  body_html TEXT,
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
CREATE INDEX IF NOT EXISTS idx_email_notif_order_id ON public.email_notifications(order_id);
CREATE INDEX IF NOT EXISTS idx_email_notif_status ON public.email_notifications(status);
CREATE INDEX IF NOT EXISTS idx_email_notif_event_type ON public.email_notifications(event_type);
CREATE INDEX IF NOT EXISTS idx_email_notif_created_at ON public.email_notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_email_notif_idempotency ON public.email_notifications(idempotency_key);

-- Security: Enable RLS
ALTER TABLE public.email_notifications ENABLE ROW LEVEL SECURITY;

-- Grants
GRANT ALL ON public.email_notifications TO service_role;
GRANT SELECT ON public.email_notifications TO authenticated;

-- RLS Policy: Authenticated staff can view email notifications
CREATE POLICY "Staff can view email notifications"
  ON public.email_notifications
  FOR SELECT
  TO authenticated
  USING (public.is_staff(auth.uid()));
