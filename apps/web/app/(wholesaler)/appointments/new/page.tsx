// S-034 (new) — 卸業者側 アポ登録フォーム (T-04-08 / F-033 / docs/04 §1.3).
//
// Minimal RSC wrapper around the AppointmentForm client component.
// customerId can be pre-populated via a ?customerId query param
// (e.g. from the customer detail page).

import { Breadcrumb } from "@/components/ui/breadcrumb";
import { labels } from "@/lib/i18n/labels";

import { createAppointmentAction } from "../actions";
import { AppointmentForm } from "../appointment-form";

interface PageProps {
  searchParams: Promise<{ customerId?: string }>;
}

export default async function NewAppointmentPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const t = labels.appointment;
  const bc = labels.breadcrumb.items;

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <Breadcrumb
        items={[{ label: bc.appointments, href: "/appointments" }, { label: bc.appointmentNew }]}
      />
      <h1 className="text-ink text-xl font-bold">{t.new}</h1>
      <AppointmentForm
        mode={{ kind: "create", initialCustomerId: params.customerId }}
        onSubmitAction={createAppointmentAction}
        redirectTo="/appointments"
      />
    </div>
  );
}
