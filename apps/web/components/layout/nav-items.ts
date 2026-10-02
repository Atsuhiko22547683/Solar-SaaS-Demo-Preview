// サイドバーのナビゲーション定義（唯一の情報源）。
//
// 以前は (wholesaler) / (dealer) / (saas-admin) / (common) の各 layout.tsx が
// それぞれ同じ内容を複製して持っており、(common) 側だけが更新から取り残されて
// いた。その結果、通知・プロフィール・監査ログへ移動した瞬間にメニュー構成が
// 別物（「製品カタログ」が消え、設定配下が旧名称に変わる）になっていた。
//
// ナビゲーションは「機能の地図」なので、どの画面でも同一でなければならない。
// 全レイアウトはこのモジュールだけを参照する。
import {
  Home,
  Calendar,
  Users,
  LineChart,
  Settings,
  Wallet,
  Package,
  CreditCard,
  type NavEntry,
} from "@/components/layout/role-shell";
import { isNavHrefAllowedWhileBlocked } from "@/lib/billing/access";
import { labels } from "@/lib/i18n/labels";
import { hasCapability } from "@/lib/permissions/can";

/**
 * 一時的に通常導線から外すトップレベル項目。
 *
 * route / component / data / API / permission はそのまま残し、ここから
 * ラベルを外すだけで再表示できる。個々の画面側では hide しない
 * （複数箇所に散らすと「今どこから消しているか」が追えなくなるため）。
 */
const HIDDEN_NAV_LABELS: readonly string[] = ["BIツール"];

/** 卸業者テナントのナビゲーション。 */
export const wholesalerNav: NavEntry[] = [
  { label: "ホーム", href: "/dashboard", icon: Home },
  {
    label: "イベント管理",
    icon: Calendar,
    children: [
      { label: "レーンイベント一覧", href: "/line-events" },
      { label: "単発イベント一覧", href: "/events" },
      { label: "場所取り対応状況", href: "/venue-negotiations" },
      { label: "取引先希望一覧", href: "/lane-preferences" },
    ],
  },
  {
    label: "顧客管理",
    icon: Users,
    children: [
      { label: "顧客一覧", href: "/customers" },
      // URL は互換性維持のため /customers/maekaku のまま（表示名のみ「コール一覧」へ変更）。
      { label: "コール一覧", href: "/customers/maekaku" },
      { label: "アポイント一覧", href: "/appointments" },
      { label: "契約一覧", href: "/contracts" },
      { label: "ローン審査一覧", href: "/loan-reviews" },
      { label: "施工一覧", href: "/constructions" },
      { label: "申請一覧", href: "/applications" },
    ],
  },
  {
    label: "手数料管理",
    icon: Wallet,
    children: [
      { label: "手数料一覧", href: "/commissions" },
      { label: "手数料設定", href: "/commissions/settings" },
    ],
  },
  {
    label: "製品カタログ",
    icon: Package,
    // 並び順は画面のタブ・登録ダイアログのセレクトと同一
    // （@solar/contracts の CATALOG_CATEGORY_VALUES の順）。
    // ここだけ順序が違うと、同じ機能が場所によって別物に見えるため。
    children: [
      { label: "PV", href: "/product-catalog/pv" },
      { label: "BT", href: "/product-catalog/bt" },
      { label: "エコキュート", href: "/product-catalog/eco-cute" },
      { label: "IH", href: "/product-catalog/ih" },
      { label: "プレゼント品", href: "/product-catalog/gift" },
      { label: "その他", href: "/product-catalog/other" },
    ],
  },
  {
    label: "BIツール",
    icon: LineChart,
    children: [
      { label: "ダッシュボード", href: "/bi", upcoming: true },
      { label: "市況分析", href: "/bi/analysis", upcoming: true },
    ],
  },
  // 決済管理はトップレベル。設定配下ではない（権限カテゴリも設定とは別）。
  { label: "決済管理", href: "/payments", icon: CreditCard },
  {
    label: "設定",
    icon: Settings,
    children: [
      // スタッフ（Salesperson）はイベント管理配下から設定配下へ移動。
      // URL は互換性維持のため /salespeople のまま（表示名のみ変更）。
      { label: "スタッフ一覧", href: "/salespeople" },
      // 二次店管理は既存の Relationship マスタ画面を再利用する（新マスタは作らない）。
      { label: "取引先管理", href: "/masters/relationships" },
      // 本アプリへログインできる User の管理。スタッフ一覧とは別概念。
      { label: "システムユーザー", href: "/members" },
      { label: "エリア・場所管理", href: "/masters" },
    ],
  },
];

/** 二次店テナントのナビゲーション。 */
export const dealerNav: NavEntry[] = [
  { label: "ホーム", href: "/d-dashboard", icon: Home },
  {
    label: "イベント",
    icon: Calendar,
    children: [
      { label: "公開イベント", href: "/visible-event-candidates" },
      { label: "担当イベント", href: "/d-events" },
    ],
  },
  {
    label: "顧客管理",
    icon: Users,
    children: [
      { label: "顧客一覧", href: "/d-customers" },
      { label: "アポ一覧", href: "/d-appointments" },
      { label: "商談", href: "/d-deals" },
      { label: "契約", href: "/d-contracts" },
    ],
  },
  { label: "成績", href: "/monthly", icon: LineChart },
  {
    label: "設定",
    icon: Settings,
    children: [
      { label: "月次報告", href: "/d-monthly-reports" },
      { label: "インセンティブ", href: "/incentives" },
      { label: "メンバー", href: "/d-members" },
      { label: "マエカク結果", href: "/d-notifications/pre-call" },
    ],
  },
];

/** SaaS 運営者のナビゲーション。 */
export const saasAdminNav: NavEntry[] = [
  { label: "ホーム", href: "/saas-admin-dashboard", icon: Home },
  {
    label: "テナント管理",
    icon: Users,
    children: [
      { label: "テナント一覧", href: "/tenants" },
      { label: "プラン管理", href: "/plans" },
      { label: "請求状況", href: "/billing" },
    ],
  },
];

/**
 * ロールに対応するナビゲーションを返す。
 * 判定順は app/page.tsx のリダイレクトと同じ（SaaS 運営 → 二次店 → 卸業者）。
 */
export function navForRoles(roles: readonly string[], isSaasAdmin: boolean): NavEntry[] {
  if (isSaasAdmin) return saasAdminNav;
  if (roles.some((r) => r.startsWith("DEALER_"))) return dealerNav;
  return wholesalerNavFor(roles);
}

/**
 * 決済の問題で利用停止中のとき、ホームと決済管理以外を押せない状態にする。
 *
 * 項目自体は消さない — 消すと「機能が無くなった」ように見えるため、
 * 「支払いにより利用停止中」だと分かる形で残す。押せる／押せないの境界は
 * lib/billing/access.ts が持ち、レイアウトのガードと同じ判定を使う。
 */
export function applyBillingBlockToNav(items: NavEntry[]): NavEntry[] {
  const reason = labels.billing.navDisabledReason;
  return items.map((entry) => {
    if ("children" in entry) {
      const children = entry.children.map((child) =>
        isNavHrefAllowedWhileBlocked(child.href)
          ? child
          : { ...child, disabled: true, disabledReason: reason },
      );
      return {
        ...entry,
        children,
        disabled: children.every((c) => c.disabled),
        disabledReason: reason,
      };
    }
    if (isNavHrefAllowedWhileBlocked(entry.href)) return entry;
    return { ...entry, disabled: true, disabledReason: reason };
  });
}

/**
 * 卸業者ナビをシステムロールで絞る。
 *
 * 設定       — OWNER / SYSTEM_ADMIN
 * 決済管理   — OWNER / GENERAL_USER
 *
 * 単純な上下関係ではないので、包含判定ではなく can.ts の capability を使う。
 * 隠すのは導線だけで、実際の遮断はページ側のガード（403）が行う。
 */
export function wholesalerNavFor(roles: readonly string[]): NavEntry[] {
  const canSettings = hasCapability(roles, "settings");
  const canPayment = hasCapability(roles, "payment");
  return wholesalerNav.filter((entry) => {
    // 一時非表示の項目（機能自体は残っている）。
    if (HIDDEN_NAV_LABELS.includes(entry.label)) return false;
    if (entry.label === "設定") return canSettings;
    if (entry.label === "決済管理") return canPayment;
    return true;
  });
}
