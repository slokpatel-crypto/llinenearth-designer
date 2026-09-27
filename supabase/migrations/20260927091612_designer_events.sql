-- Preserve the append-only event ledger while allowing Designer decisions,
-- customer feedback, and authenticated operator corrections.
begin;

alter table public.style_events
  drop constraint if exists style_events_type_allowed,
  add constraint style_events_type_allowed check (
    type in (
      'session_started', 'answer_selected', 'looks_generated', 'look_selected',
      'render_requested', 'render_completed', 'whatsapp_clicked',
      'visit_logged', 'sale_logged', 'operator_note', 'customer_updated',
      'lead_status_changed', 'order_status_changed', 'measurements_updated',
      'payment_logged', 'appointment_updated',
      'designer_recommendation', 'designer_preview_opened',
      'designer_feedback', 'designer_override'
    )
  );

commit;
