CREATE TABLE IF NOT EXISTS public.email_notifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  idempotency_key TEXT NOT NULL UNIQUE,
  event_type TEXT NOT NULL,
  recipient_email TEXT NOT NULL,
  recipient_type TEXT NOT NULL DEFAULT 'admin',
  order_id UUID NULL,
  order_code TEXT NULL,
  subject TEXT NOT NULL,
  body_html TEXT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  provider_message_id TEXT NULL,
  error_message TEXT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  sent_at TIMESTAMP WITH TIME ZONE NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS email_notifications_created_at_idx ON public.email_notifications (created_at DESC);
CREATE INDEX IF NOT EXISTS email_notifications_order_id_idx ON public.email_notifications (order_id);

GRANT SELECT ON public.email_notifications TO authenticated;
GRANT ALL ON public.email_notifications TO service_role;

ALTER TABLE public.email_notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff can view email notifications" ON public.email_notifications;
CREATE POLICY "Staff can view email notifications"
ON public.email_notifications
FOR SELECT
TO authenticated
USING (public.is_staff(auth.uid()));