"use client";

// 依頼先代理店の表示（提出フォーム共通）。**入力欄ではない**。
//
// 今回のデモ構成は「代理店 1 社に、複数のパートナー会社が参加する」。提出物がどの代理店
// 宛かは、認証情報（所属パートナー会社の取引関係）と、催事から登録した場合はその催事の
// 担当会社から、サーバー側で確定する。ブラウザから代理店 ID を送らせない。
//
// ここは「どこ宛の提出になるか」を利用者に示すだけの読み取り専用表示。
// 取引関係が 1 件に確定しないときは、その旨を出して運用側に直してもらう
// （黙ってどれかを選ぶと、別の代理店の配下にデータが入る事故になる）。

import { PartnerFormField } from "@/components/partner/partner-form";
import { labels } from "@/lib/i18n/labels";

export interface PartnerOriginOption {
  id: string;
  name: string;
}

const t = labels.partner.lanePreference;
const c = labels.partner.common;

export function PartnerOriginNotice({ options }: { options: PartnerOriginOption[] }) {
  const value =
    options.length === 1
      ? (options[0]?.name ?? c.dash)
      : options.length === 0
        ? c.dash
        : // 取引先が 1 社に決まらない状態。提出先を推測しない。
          labels.partner.errors.ambiguousOrigin;

  return (
    <PartnerFormField label={t.originLabel} htmlFor="origin-notice">
      <p id="origin-notice" className="text-body-light text-sm">
        {value}
      </p>
    </PartnerFormField>
  );
}
