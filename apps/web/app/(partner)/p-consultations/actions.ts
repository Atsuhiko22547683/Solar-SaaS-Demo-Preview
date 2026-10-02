"use server";

// 場所確保の相談の送信と、相談スレッドへの投稿（パートナー側）。

import {
  PartnerThreadPostSchema,
  VenueConsultationCreateSchema,
  type PartnerThreadPostInput,
  type VenueConsultationCreateInput,
} from "@solar/contracts";
import { revalidatePath } from "next/cache";

import { NotFoundError } from "@/lib/errors";
import { labels } from "@/lib/i18n/labels";
import { requirePartnerContext, resolveRelationship } from "@/lib/partner/context";
import { relationshipScope } from "@/lib/partner/scope";
import { withTenant } from "@/lib/tenancy/with-tenant";

const BASE = "/p-consultations";

export async function createVenueConsultationAction(
  input: VenueConsultationCreateInput,
): Promise<{ id: string }> {
  const partner = await requirePartnerContext("partner_consultation.write");
  const parsed = VenueConsultationCreateSchema.parse(input);
  // 相談先の代理店は候補の中から確定させる（送信値をそのまま書き込み先にしない）。
  const origin = resolveRelationship(partner, parsed.relationshipId);

  const created = await withTenant(partner.ctx, async (tx) => {
    const row = await tx.venueConsultation.create({
      data: {
        wholesalerId: origin.wholesalerId,
        relationshipId: origin.id,
        targetMonth: parsed.targetMonth ?? null,
        area: parsed.area ?? null,
        title: parsed.title,
        body: parsed.body,
        createdByUserId: partner.userId,
      },
      select: { id: true },
    });
    // 相談の本文もスレッドの先頭に置き、以降のやり取りと同じ並びで読めるようにする。
    await tx.venueConsultationMessage.create({
      data: {
        venueConsultationId: row.id,
        side: "DEALER",
        kind: "SUBMISSION",
        body: parsed.body,
        authorUserId: partner.userId,
      },
    });
    return row;
  });

  revalidatePath(BASE);
  return created;
}

export async function postConsultationMessageAction(
  input: PartnerThreadPostInput,
): Promise<{ ok: true }> {
  const partner = await requirePartnerContext("partner_consultation.write");
  const parsed = PartnerThreadPostSchema.parse(input);

  await withTenant(partner.ctx, async (tx) => {
    const consultation = await tx.venueConsultation.findFirst({
      where: { id: parsed.targetId, ...relationshipScope(partner) },
      select: { id: true },
    });
    if (!consultation) throw new NotFoundError(labels.partner.errors.notFound);

    await tx.venueConsultationMessage.create({
      data: {
        venueConsultationId: consultation.id,
        side: "DEALER",
        kind: "MESSAGE",
        body: parsed.body,
        authorUserId: partner.userId,
      },
    });
  });

  revalidatePath(`${BASE}/${parsed.targetId}`);
  return { ok: true };
}
