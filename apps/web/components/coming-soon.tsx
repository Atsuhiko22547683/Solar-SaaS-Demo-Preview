import { Card } from "@/components/ui/card";
import { labels } from "@/lib/i18n/labels";

/**
 * 未実装画面のプレースホルダ。
 *
 * 「この画面は準備中です。」だけを中央に大きく置くと、実装漏れというより
 * 壊れた画面に見える。この画面が何を担うのか・いつ入るのかを添えて、
 * 意図された未完成であることが分かるようにする。
 * サイドバー側にも同じ意味の「準備中」バッジを出しているので、
 * 利用者は押す前に未実装だと分かる。
 */
export function ComingSoon({ title, description }: { title: string; description?: string }) {
  const t = labels.common;
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <h1 className="text-ink text-xl font-bold">{title}</h1>
        <span className="text-mute-light border-hairline-light rounded-sm border px-1.5 py-0.5 text-[11px]">
          {labels.nav.upcoming}
        </span>
      </div>
      <Card className="px-4 py-8">
        <p className="text-ink text-sm font-medium">{t.comingSoon}</p>
        {description ? <p className="text-mute-light mt-1 text-[13px]">{description}</p> : null}
      </Card>
    </div>
  );
}
