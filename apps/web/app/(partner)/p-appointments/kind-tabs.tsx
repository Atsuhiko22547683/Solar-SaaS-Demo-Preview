"use client";

// アポイント登録画面のタブ（初訪アポ / 訪問アポ）。
//
// 選択状態は URL クエリ（?type=first-visit / ?type=visit）に持たせる。
// 再読み込みやブックマーク、E2E からの直接指定でも同じタブが開くようにするため、
// クライアント側の state には持たない。

import Link from "next/link";

import { labels } from "@/lib/i18n/labels";

import { KIND_PARAM_TO_KIND, PARTNER_KIND_PARAMS } from "./kind";

import type { PartnerAppointmentKindParam } from "./kind";

const t = labels.partner.appointmentKind;

export function AppointmentKindTabs({ current }: { current: PartnerAppointmentKindParam }) {
  return (
    <nav aria-label={t.tabsAriaLabel} className="border-hairline-light border-b">
      <ul className="flex flex-wrap gap-1">
        {PARTNER_KIND_PARAMS.map((param) => {
          const active = param === current;
          return (
            <li key={param}>
              <Link
                href={`/p-appointments/new?type=${param}`}
                aria-current={active ? "page" : undefined}
                className={[
                  "focus-visible:ring-primary/40 -mb-px inline-flex h-11 items-center rounded-t-sm border-b-2 px-4 text-sm transition-colors focus:outline-none focus-visible:ring-2 sm:h-10 sm:px-3",
                  active
                    ? "border-primary text-ink font-semibold"
                    : "text-mute-light hover:text-ink border-transparent",
                ].join(" ")}
              >
                {t.labels[KIND_PARAM_TO_KIND[param]]}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
