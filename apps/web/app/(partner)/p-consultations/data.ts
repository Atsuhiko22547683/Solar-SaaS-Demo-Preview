// 場所確保の相談（パートナー側）。
//
// 通常の月次希望提出（LanePreference）とは別建て。「この地域にはこういう特性があるので
// ○○でブースを確保できませんか」という相談を送り、代理店が返信する。
// 汎用のチャットサービスではなく、相談 1 件に紐づくスレッドだけを扱う。

import "server-only";

import { requirePartnerContext, wholesalerNameMap } from "@/lib/partner/context";
import { relationshipFilter, relationshipScope } from "@/lib/partner/scope";
import { withTenant } from "@/lib/tenancy/with-tenant";

import type { PartnerThreadEntry } from "../p-lane-preferences/data";
import type { TxClient } from "@solar/db";

export interface ConsultationRow {
  id: string;
  title: string;
  originName: string;
  area: string | null;
  targetMonth: string | null;
  status: "OPEN" | "ANSWERED" | "CLOSED";
  createdAt: string;
}

export interface ConsultationDetail extends ConsultationRow {
  body: string;
  thread: PartnerThreadEntry[];
}

export interface ConsultationListQuery {
  status?: "OPEN" | "ANSWERED" | "CLOSED";
  keyword?: string;
  month?: string;
  origin?: string;
}

async function resolveNames(tx: TxClient, ids: readonly string[]): Promise<Map<string, string>> {
  const unique = Array.from(new Set(ids.filter(Boolean)));
  if (unique.length === 0) return new Map();
  const rows = await tx.user.findMany({
    where: { id: { in: unique } },
    select: { id: true, name: true },
  });
  return new Map(rows.map((r) => [r.id, r.name]));
}

export interface ConsultationListResult {
  rows: ConsultationRow[];
  originOptions: { id: string; name: string }[];
}

export async function listPartnerConsultations(
  q: ConsultationListQuery,
): Promise<ConsultationListResult> {
  const partner = await requirePartnerContext("partner_consultation.read");
  const names = wholesalerNameMap(partner);

  return withTenant(partner.ctx, async (tx) => {
    const rows = await tx.venueConsultation.findMany({
      where: {
        ...relationshipScope(partner),
        ...relationshipFilter(partner, q.origin),
        ...(q.status ? { status: q.status } : {}),
        ...(q.month ? { targetMonth: q.month } : {}),
        ...(q.keyword
          ? {
              OR: [
                { title: { contains: q.keyword, mode: "insensitive" } },
                { body: { contains: q.keyword, mode: "insensitive" } },
                { area: { contains: q.keyword, mode: "insensitive" } },
              ],
            }
          : {}),
      },
      orderBy: { createdAt: "desc" },
      take: 200,
      select: {
        id: true,
        title: true,
        relationshipId: true,
        area: true,
        targetMonth: true,
        status: true,
        createdAt: true,
      },
    });

    return {
      rows: rows.map((r) => ({
        id: r.id,
        title: r.title,
        originName: names.get(r.relationshipId) ?? "—",
        area: r.area,
        targetMonth: r.targetMonth,
        status: r.status,
        createdAt: r.createdAt.toISOString(),
      })),
      originOptions: partner.relationships.map((r) => ({ id: r.id, name: r.wholesalerName })),
    };
  });
}

export async function getPartnerConsultation(id: string): Promise<ConsultationDetail | null> {
  const partner = await requirePartnerContext("partner_consultation.read");
  const names = wholesalerNameMap(partner);

  return withTenant(partner.ctx, async (tx) => {
    // 閲覧範囲を where に含める（id だけで引かない）。
    const r = await tx.venueConsultation.findFirst({
      where: { id, ...relationshipScope(partner) },
      select: {
        id: true,
        title: true,
        body: true,
        relationshipId: true,
        area: true,
        targetMonth: true,
        status: true,
        createdAt: true,
        messages: {
          orderBy: { createdAt: "asc" },
          select: {
            id: true,
            side: true,
            kind: true,
            body: true,
            authorUserId: true,
            createdAt: true,
          },
        },
      },
    });
    if (!r) return null;

    const userNames = await resolveNames(
      tx,
      r.messages.map((m) => m.authorUserId),
    );

    return {
      id: r.id,
      title: r.title,
      body: r.body,
      originName: names.get(r.relationshipId) ?? "—",
      area: r.area,
      targetMonth: r.targetMonth,
      status: r.status,
      createdAt: r.createdAt.toISOString(),
      thread: r.messages.map((m) => ({
        id: m.id,
        side: m.side,
        kind: m.kind,
        body: m.body,
        authorName: userNames.get(m.authorUserId) ?? null,
        createdAt: m.createdAt.toISOString(),
      })),
    };
  });
}

/** 新規相談フォームの選択肢。 */
export async function getConsultationFormData(): Promise<{
  originOptions: { id: string; name: string }[];
  soleOriginId: string | null;
}> {
  const partner = await requirePartnerContext("partner_consultation.write");
  return {
    originOptions: partner.relationships.map((r) => ({ id: r.id, name: r.wholesalerName })),
    soleOriginId: partner.soleRelationshipId,
  };
}
