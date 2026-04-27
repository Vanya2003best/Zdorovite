/**
 * Typed emit helpers for in-app notifications. Server-only — call from
 * server actions, NEVER from client components.
 *
 * Each helper goes through the SECURITY DEFINER public.emit_notification
 * RPC, which bypasses RLS so the emitter (e.g. trainer) can write a row
 * for the recipient (e.g. client). The RPC rejects auth.uid() == target
 * to prevent self-spam.
 *
 * Failure mode: notifications are NICE TO HAVE — never let a notify call
 * fail the primary action. We catch and console.error instead of throwing.
 */
import { createClient } from "@/lib/supabase/server";
import type { NotificationKind } from "@/lib/db/notifications";

type EmitArgs = {
  to: string;
  kind: NotificationKind;
  title: string;
  body?: string;
  link?: string;
  relatedId?: string;
};

async function emit(args: EmitArgs): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("emit_notification", {
    target_user_id: args.to,
    notif_kind: args.kind,
    notif_title: args.title,
    notif_body: args.body ?? null,
    notif_link: args.link ?? null,
    notif_related_id: args.relatedId ?? null,
  });
  if (error) {
    // Best-effort — log and move on. The primary action already succeeded.
    console.error("notify emit failed", { kind: args.kind, to: args.to, error: error.message });
  }
}

export const notify = {
  bookingRequested(args: { trainerId: string; clientName: string; whenLabel: string; bookingId: string }) {
    return emit({
      to: args.trainerId,
      kind: "booking_requested",
      title: `${args.clientName} prosi o sesję`,
      body: args.whenLabel,
      link: "/studio/bookings",
      relatedId: args.bookingId,
    });
  },

  bookingConfirmed(args: { clientId: string; trainerName: string; whenLabel: string; bookingId: string }) {
    return emit({
      to: args.clientId,
      kind: "booking_confirmed",
      title: `${args.trainerName} potwierdził(a) Twoją rezerwację`,
      body: args.whenLabel,
      link: "/account/bookings",
      relatedId: args.bookingId,
    });
  },

  bookingDeclined(args: { clientId: string; trainerName: string; whenLabel: string; bookingId: string }) {
    return emit({
      to: args.clientId,
      kind: "booking_declined",
      title: `${args.trainerName} odrzucił(a) prośbę o sesję`,
      body: args.whenLabel,
      link: "/account/bookings",
      relatedId: args.bookingId,
    });
  },

  bookingCancelled(args: {
    to: string;
    actorName: string;
    whenLabel: string;
    bookingId: string;
    reason?: string;
    /** "/studio/bookings" if recipient is the trainer, "/account/bookings" if the client. */
    link: string;
  }) {
    return emit({
      to: args.to,
      kind: "booking_cancelled",
      title: `${args.actorName} anulował(a) sesję`,
      body: args.reason ? `${args.whenLabel} · powód: ${args.reason}` : args.whenLabel,
      link: args.link,
      relatedId: args.bookingId,
    });
  },

  reschedulePropose(args: {
    to: string;
    fromName: string;
    proposedLabel: string;
    rescheduleId: string;
    /** Deep-link to the chat thread with the OTHER party (so recipient can accept/decline inline). */
    link: string;
  }) {
    return emit({
      to: args.to,
      kind: "reschedule_proposed",
      title: `${args.fromName} proponuje nowy termin`,
      body: args.proposedLabel,
      link: args.link,
      relatedId: args.rescheduleId,
    });
  },

  rescheduleAccepted(args: { to: string; otherName: string; proposedLabel: string; rescheduleId: string; link: string }) {
    return emit({
      to: args.to,
      kind: "reschedule_accepted",
      title: `${args.otherName} zaakceptował(a) zmianę terminu`,
      body: args.proposedLabel,
      link: args.link,
      relatedId: args.rescheduleId,
    });
  },

  rescheduleDeclined(args: { to: string; otherName: string; rescheduleId: string; link: string }) {
    return emit({
      to: args.to,
      kind: "reschedule_declined",
      title: `${args.otherName} odrzucił(a) propozycję zmiany terminu`,
      link: args.link,
      relatedId: args.rescheduleId,
    });
  },
};
