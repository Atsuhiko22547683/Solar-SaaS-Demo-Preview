// Centralised Japanese UI labels.
//
// Every user-facing string rendered by the role-group layouts and the
// authentication pages must live here (docs/CLAUDE.md "i18n 辞書 1 箇所
// 集約" rule). Component files import this object and read keyed strings;
// they never hard-code Japanese text.

export const labels = {
  // 画面上のロゴ表記に合わせる（ロゴ画像の alt / オンボーディング見出しに使われる）。
  brand: "BizOrch",
  brandTagline: "太陽光卸・取引先営業管理 SaaS",

  // 製品カタログ（PV / 蓄電池）。MVP ではプレースホルダ。
  // 二次店ポータル（Partner 環境）。Google フォームの置き換えに絞った 4 画面。
  //
  // 項目ラベルは既存のフォーム準拠定義（labels.customerReport /
  // labels.resultReport）と揃える。フォームに無い項目は足さない。
  // アプリ全体が落ちたときの最後の受け皿（app/global-error.tsx）。
  // 内部情報は出さず、再試行の導線だけを示す。
  globalError: {
    title: "エラーが発生しました",
    body: "一時的な問題の可能性があります。お手数ですが、再度お試しください。",
    retry: "再読み込み",
  },

  partner: {
    /** スタッフサイトのサイト名（ヘッダ表示）。 */
    title: "パートナーポータル",
    /** 管理者サイトのサイト名。別 URL・別プロセスで動くので名前も分ける。 */
    adminTitle: "パートナー管理ポータル",
    /** もう一方のサイトへの導線（両方の利用資格を持つ本人だけに出す）。 */
    switchToStaff: "スタッフサイトへ",
    switchToAdmin: "管理者サイトへ",
    nav: {
      ariaLabel: "パートナーメニュー",
      /** 狭い画面の開閉メニュー。 */
      menuOpen: "メニューを開く",
      menuClose: "メニューを閉じる",
      menu: "メニュー",
      home: "トップ",
      appointments: "アポイント",
      contracts: "成約報告",
      reports: "催事日報",
      salespeople: "販売員",
      catalog: "カタログ",
      customers: "顧客情報",
      shifts: "催事シフト",
      /** 本人の販売員情報。タブの端に置く。 */
      profile: "個人設定",
      /** 二次店管理者のみ。 */
      accounts: "アカウント",
      commissions: "手数料",
      lanePreferences: "出店希望",
      consultations: "場所相談",
    },
    common: {
      register: "登録する",
      registering: "登録中…",
      save: "保存",
      saving: "保存中…",
      cancel: "キャンセル",
      edit: "編集",
      backToList: "一覧へ戻る",
      required: "必須",
      optional: "（任意）",
      notSet: "未設定",
      dash: "—",
      /** 検証で弾かれたが、項目を特定できなかったときの案内。生の JSON は出さない。 */
      validationFailed: "入力内容を確認してください。",
      created: "登録しました",
      updated: "保存しました",
      resultCount: "{total}件",
      /** 自社（ログイン中のパートナー会社）を指す表示。 */
      selfCompany: "自社",
      sent: "送信しました",
    },
    /** 一覧共通の検索・絞り込み・並べ替え・ページ分割。 */
    list: {
      filterTitle: "検索・絞り込み",
      apply: "検索",
      clear: "条件をクリア",
      advanced: "詳細条件",
      /** 詳細条件に値が入っているときの印。 */
      advancedActive: "条件あり",
      /** 横スクロールできる表であることの案内（狭い画面のみ）。 */
      tableScrollHint: "横にスクロールできます",
      all: "すべて",
      from: "開始",
      to: "終了",
      min: "下限",
      max: "上限",
      keywordPlaceholder: "部分一致",
      sortLabel: "並べ替え",
      asc: "昇順",
      desc: "降順",
      sortedAsc: "昇順で並べ替え中",
      sortedDesc: "降順で並べ替え中",
      resultCount: "該当 {total}件",
      pageOf: "{page} / {pageCount} ページ",
      prev: "前へ",
      next: "次へ",
      noMatch: "条件に一致するデータがありません",
      noMatchHint: "条件を変更するか、「条件をクリア」で全件に戻せます。",
      /** 選択中の区分では使えない条件の注記。 */
      notApplicable: "この区分では使えない条件です",
      /** 区分「すべて」で初訪アポ専用の条件を指定したときの注記。 */
      firstVisitOnlyApplied:
        "顧客名・催事場所・初回訪問アポ日時の条件は初訪アポにのみ適用され、訪問アポは表示されません",
      /** カテゴリ変更で選択中のメーカーが対象外になった旨。 */
      makerReset: "選択していたメーカーはこのカテゴリにないため「すべて」に戻しました",
      /** マスキング中は氏名検索・並べ替えを使えない旨。 */
      maskedNameSearchDisabled: "お客様名は非表示設定のため検索・並べ替えに使えません",
      /** 管理者だけに出る「提出したスタッフ」の条件・列。 */
      submittedBy: "提出スタッフ",
      submittedByColumn: "提出者",
      /** 管理者向け一覧の対象範囲。 */
      adminScopeNote: "自社が取り扱う内容をすべて表示しています（本人提出分に限りません）",
    },
    home: {
      title: "パートナーポータル",
      subtitle: "自社のスタッフ・提出情報・顧客を管理できます。",
      /** スタッフ向けトップの説明。各業務への入口を中心に置く。 */
      staffSubtitle:
        "アポイント・成約報告・催事日報の登録と、カタログ・自社顧客・催事シフトの確認を行えます。",
      /** 所属表示（加盟店番号は認証情報から自動表示。入力はさせない）。 */
      belongLabel: "ご所属",
      franchiseNoLabel: "加盟店番号",
      /** 今週の本人の催事シフト（スタッフトップ）。 */
      week: {
        title: "週間カレンダー",
        /** 当日の割当。複数あればすべて出す。 */
        todayTitle: "今日の催事シフト",
        /** 当日が無いときは直近の今後の予定を出す。 */
        nextTitle: "次の催事シフト",
        noTodayHint: "今日の配置はありません。次の予定を表示しています。",
        emptyUpcoming: "今後の配置はありません。配置されるとここに表示されます。",
        prev: "先週",
        current: "今週",
        next: "来週",
        empty: "この週に自分の配置はありません",
        registerAppointment: "この催事からアポ登録",
        /** 日報も同じ催事・開催日から入力する。 */
        registerReport: "この催事から日報を入力",
        openShiftDetail: "シフトの詳細を見る",
        openShifts: "催事シフトをすべて見る",
      },
      cards: {
        appointments: {
          title: "アポイント",
          body: "初訪アポ・訪問アポを登録・確認します。",
          action: "アポイントを登録",
          list: "登録済みのアポイント",
        },
        contracts: {
          title: "成約",
          body: "成約した案件を登録・確認します。",
          action: "成約を登録",
          list: "登録済みの成約",
        },
        reports: {
          title: "催事日報",
          body: "催事の実績を登録・確認します。",
          action: "催事日報を登録",
          list: "登録済みの催事日報",
        },
        salespeople: {
          title: "販売員",
          body: "自社に所属する販売員を登録・確認します。",
          action: "販売員を登録",
          list: "登録済みの販売員",
        },
        catalog: {
          title: "カタログ",
          body: "代理店が公開している商品カタログを確認します。",
          action: "カタログを見る",
        },
        customers: {
          title: "顧客情報",
          body: "自社が取り扱う顧客と商談を確認・更新します。",
          action: "顧客を見る",
        },
        shifts: {
          title: "シフト",
          body: "自分に割り当てられた催事の予定を確認します。",
          action: "シフトを見る",
        },
      },
      /**
       * 二次店管理者のトップ。9 業務を 3 つのまとまりで並べる。
       * スタッフ向けカード（cards）とは説明文が違うので別に持つ
       * （同じ画面でも、見るデータの範囲が「本人」か「自社」かで意味が変わるため）。
       */
      adminSections: {
        submissions: {
          title: "提出情報の管理",
          body: "自社スタッフが提出した内容を確認・管理します。",
        },
        organization: {
          title: "組織の管理",
          body: "自社の販売員とログイン利用者を管理します。",
        },
        business: {
          title: "取引・顧客",
          body: "顧客・営業フィー・出店希望・シフトを管理します。",
        },
      },
      adminCards: {
        appointments: {
          title: "アポイント管理",
          body: "自社スタッフが登録した初訪アポ・訪問アポを区別して確認します。",
          list: "アポイントを管理",
        },
        contracts: {
          title: "成約報告管理",
          body: "自社スタッフから提出された成約報告を確認します。",
          list: "成約報告を管理",
        },
        reports: {
          title: "催事日報管理",
          body: "稼働時間・活動実績・所感を含む催事日報を確認します。",
          list: "催事日報を管理",
        },
        salespeople: {
          title: "スタッフ情報管理",
          body: "自社に所属する販売員の登録情報を登録・確認・更新します。",
          action: "販売員を登録",
          list: "販売員を管理",
        },
        accounts: {
          title: "利用者アカウント管理",
          body: "ログインの利用開始・停止、利用区分、販売員との紐付けを管理します。",
          list: "アカウントを管理",
        },
        commissions: {
          title: "手数料管理",
          body: "自社に適用されている営業フィーの率と確定額を確認します。",
          list: "営業フィーを見る",
        },
        customers: {
          title: "自社顧客管理",
          body: "自社顧客の情報を閲覧・編集・削除します。",
          list: "自社顧客を管理",
        },
        lanePreferences: {
          title: "出店希望の提出",
          body: "対象月ごとに、レーン単位で希望店舗・希望日程を提出します。",
          action: "希望を提出",
          list: "提出した出店希望",
        },
        consultations: {
          title: "場所確保の相談",
          body: "地域の特性を伝えて、ブースの確保を代理店へ相談します。",
          action: "相談を送る",
          list: "相談の一覧",
        },
        shifts: {
          title: "催事シフト",
          body: "開催日・時間の順に配置を確認し、スタッフを配置します。",
          action: "スタッフを配置",
          list: "催事シフトを見る",
        },
      },
    },
    /**
     * サイトの取り違え案内。
     * スタッフサイトと管理者サイトは別 URL で動くので、開くサイトを間違えたときに
     * 正しいサイトへの入口を出す（黙って 404 や空の画面にしない）。
     */
    siteMismatch: {
      staffSiteName: "パートナースタッフサイト",
      adminSiteName: "パートナー管理者サイト",
      /** スタッフサイトを管理者ロールだけの利用者が開いたとき。 */
      staffTitle: "このサイトはパートナースタッフ向けです",
      staffBody:
        "お使いのアカウントはパートナー管理者です。管理業務はパートナー管理者サイトからご利用ください。",
      /** 管理者サイトをスタッフロールだけの利用者が開いたとき。 */
      adminTitle: "このサイトはパートナー管理者向けです",
      adminBody:
        "お使いのアカウントはパートナースタッフです。日々の登録・確認はパートナースタッフサイトからご利用ください。",
      /** 二次店アカウントですらない場合。 */
      notDealerTitle: "このサイトはパートナー会社専用です",
      notDealerBody:
        "代理店アカウント・運営者アカウントではご利用いただけません。所属に合ったサイトからご利用ください。",
      openOther: "{site}を開く",
      signOut: "サインアウト",
    },
    // アポイント（Google フォーム「住設事業部/加盟店-①初訪アポフォーム」準拠）。
    appointment: {
      /** 催事からの登録（トップの「この催事からアポ登録」）。 */
      eventPicker: {
        title: "どの催事からの登録ですか",
        hint: "直近で自分が配置されている催事です。対象を選ぶと、催事の情報を初期入力します。",
        none: "催事を指定せずに登録",
        empty: "直近に配置されている催事がありません。催事を指定せずに登録できます。",
      },
      eventContext: {
        title: "この催事からの登録",
        venue: "催事場所",
        date: "催事日程",
        origin: "依頼元代理店",
        company: "所属会社",
        registeredBy: "登録者",
        registeredByHint:
          "実際に操作した利用者として記録されます。接客した担当者とは別に残ります。",
        change: "催事を選び直す",
      },
      listTitle: "アポイント一覧",
      newTitle: "アポイントを登録",
      editTitle: "アポイントを編集",
      detailTitle: "アポイント詳細",
      empty: "登録されたアポイントがありません",
      emptyCta: "「アポイントを登録」から追加してください。",
      sections: {
        org: "体制",
        event: "催事",
        customer: "お客様情報",
        appointment: "アポ・マエカク",
        note: "備考",
      },
      fields: {
        franchiseNo: "加盟店番号",
        tossGetter: "トス獲得者",
        closeCompany: "クローズ会社",
        salesRep: "営業担当者",
        channel: "販売チャネル",
        eventDate: "催事実施日",
        venuePlace: "催事場所",
        eventType: "催事種別",
        boothArea: "催事ブース場所",
        faceToFace: "対面者",
        customerName: "お客様名",
        kana: "フリガナ",
        landline: "固定電話番号",
        mobile: "携帯番号",
        postalCode: "郵便番号",
        prefecture: "都道府県",
        cityAddress: "市区町村・番地",
        maekakuPreferredAt: "マエカク電話希望日時",
        maekakuOperator: "マエカク実施者",
        firstVisitAt: "初回訪問アポ日時",
        note: "備考",
        createdAt: "登録日時",
      },
      /** 催事実施日の補足（訪販は訪問日を入れる旨。フォームの注記に合わせる）。 */
      eventDateHint: "訪問販売の場合は訪問日を入力してください",
      boothAreaNoteHint: "「その他」を選んだときだけ入力してください",
      fromEventBadge: "登録済み催事から",
      /** 条件付き項目の注記。 */
      venueChainHint: "販売チャネルが「催事」のときに入力します",
      faceToFaceHint: "販売チャネルが「訪問販売」のときに入力します",
      /** クローズ会社の選択肢が自社しか無いときの注記。 */
      closeCompanyHint: "取引のある会社から選択します",
      boothAreaLabels: {
        ENTRANCE: "店頭入口付近",
        REFORM_CORNER: "リフォームコーナー付近",
        OTHER: "その他",
      } as Record<string, string>,
      /** 初訪アポフォームの催事種別（カインズ / 島忠 / コメリ）。 */
      venueChainLabels: {
        CAINZ: "カインズ",
        SHIMACHU: "島忠",
        KOMERI: "コメリ",
      } as Record<string, string>,
      salesChannelLabels: {
        VISIT_SALES: "訪問販売",
        INBOUND: "反響",
        EVENT: "催事",
        REFERRAL: "紹介",
        OTHER: "その他",
      } as Record<string, string>,
      faceToFaceLabels: {
        SOVEREIGN: "主権者",
        NON_SOVEREIGN: "非主権者",
      } as Record<string, string>,
      boothAreaNote: "ブース場所（その他の内容）",
      venueChain: "催事種別",
      columns: {
        kind: "アポ区分",
        customerName: "お客様名",
        closeDept: "クローズ部署",
        firstVisitAt: "初回訪問アポ日時",
        venuePlace: "催事場所",
        createdAt: "登録日時",
      },
      filters: {
        kind: "アポ区分",
        customerName: "お客様名",
        venuePlace: "催事場所",
        firstVisitAt: "初回訪問アポ日時",
        createdAt: "登録日",
        tossDept: "トス部署",
        closeDept: "クローズ部署",
        salesperson: "営業担当者",
        channel: "販売チャネル",
      },
    },
    /** アポイント区分（Google フォーム 2 種の別）。 */
    appointmentKind: {
      tabsAriaLabel: "アポイント区分",
      labels: {
        FIRST_VISIT: "初訪アポ",
        VISIT: "訪問アポ",
      } as Record<string, string>,
      /** 登録後は区分を変えられない旨（別フォームの項目が食い違うため）。 */
      lockedHint: "登録後にアポ区分は変更できません",
    },
    /** 訪問アポ（Google フォーム「住設事業部/加盟店-②訪問アポフォーム」準拠・5 項目）。 */
    visitAppointment: {
      newTitle: "訪問アポを登録",
      editTitle: "訪問アポを編集",
      detailTitle: "訪問アポ詳細",
      fields: {
        franchiseNo: "加盟店番号",
        customer: "対象の顧客",
        customerHint:
          "登録済みの顧客から選ぶと、代理店の顧客詳細からこの報告を確認できます。分からないときは未選択のままで構いません。",
        customerNone: "顧客を指定しない",
        tossDept: "トス部署",
        maekakuOperator: "マエカク実施者",
        closeDept: "クローズ部署",
        salesRep: "営業担当者",
        channel: "販売チャネル",
        createdAt: "登録日時",
      },
    },
    /** カタログ（代理店の商品マスタをスタッフ向けに閲覧専用で出す）。仕入値は出さない。 */
    catalog: {
      listTitle: "カタログ",
      listSubtitle: "代理店が公開している商品です（閲覧のみ）",
      detailTitle: "商品詳細",
      empty: "公開されている商品がありません",
      emptyCta: "代理店が商品を登録すると、ここに表示されます。",
      allCategories: "すべて",
      filterAriaLabel: "カテゴリ",
      fields: {
        category: "カテゴリ",
        maker: "メーカー",
        name: "商品名",
        modelNo: "型番",
        series: "シリーズ",
        capacity: "容量",
        dealerPrice: "卸値",
        listPrice: "希望販売価格",
        effectiveFrom: "適用開始日",
        effectiveTo: "適用終了日",
        warrantyYears: "保証年数",
        batteryFunctionType: "機能区分",
        note: "備考",
      },
      /** 資料・ファイル添付は既存の商品マスタに無い旨（ダウンロード導線を出さない理由）。 */
      noDocumentsNote: "商品資料の添付機能はありません。",
      categoryLabels: {
        PANEL: "PV",
        BATTERY: "蓄電池",
        POWER_CONDITIONER: "パワコン",
        MOUNT: "架台",
        SET: "セット",
        OTHER_PART: "その他",
        ECO_CUTE: "エコキュート",
        IH: "IH",
        GIFT: "プレゼント品",
      } as Record<string, string>,
      batteryFunctionTypeLabels: {
        SINGLE: "単機能",
        SPECIFIC_LOAD: "特定負荷",
        FULL_LOAD: "全負荷",
      } as Record<string, string>,
      columns: {
        category: "カテゴリ",
        maker: "メーカー",
        name: "商品名",
        modelNo: "型番",
        capacity: "容量",
        dealerPrice: "卸値",
      },
      filters: {
        category: "カテゴリ",
        maker: "メーカー",
        keyword: "商品名・型番",
        dealerPrice: "卸値",
        series: "シリーズ",
        capacity: "容量",
        batteryFunctionType: "機能区分",
      },
    },
    /** 顧客情報（本人が担当する顧客・商談）。編集できるのは商談情報だけ。 */
    customer: {
      listTitle: "顧客情報",
      listSubtitle: "自分が担当者として割り当てられている顧客です",
      detailTitle: "顧客・商談",
      empty: "担当している顧客がありません",
      emptyCta: "担当者として割り当てられると、ここに表示されます。",
      sections: {
        customer: "お客様情報（閲覧のみ）",
        deals: "商談",
      },
      /** 顧客の基本情報は変えられない旨。 */
      readOnlyNote: "氏名・住所・連絡先などの基本情報はこの画面では変更できません。",
      assignment: {
        tossUp: "トス獲得者",
        closing: "営業担当者",
        deal: "商談担当",
      },
      fields: {
        name: "お客様名",
        kana: "フリガナ",
        phone: "電話番号",
        address: "住所",
        status: "顧客ステータス",
        registeredAt: "登録日",
      },
      deal: {
        editTitle: "商談情報を編集",
        empty: "商談がまだありません",
        fields: {
          status: "ステータス",
          proposedProduct: "提案商品",
          proposedAmount: "提案金額",
          expectedContractDate: "契約予定日",
          lostReason: "失注理由",
          nextAction: "次回アクション",
          note: "備考",
          updatedAt: "更新日時",
        },
        statusLabels: {
          VISIT_PLANNED: "訪問予定",
          VISITED: "訪問済み",
          PROPOSING: "提案中",
          QUOTED: "見積提示",
          CONSIDERING: "検討中",
          LIKELY_CONTRACT: "契約見込み",
          CONTRACTED: "契約",
          LOST: "失注",
        } as Record<string, string>,
        /** ステータスは既存の遷移規則に従う旨。 */
        statusHint: "ステータスは定められた順序でのみ進められます",
        edit: "商談を編集",
      },
      columns: {
        name: "お客様名",
        assignment: "担当区分",
        dealStatus: "商談ステータス",
        registeredAt: "登録日",
        updatedAt: "更新日時",
      },
      filters: {
        name: "お客様名",
        kana: "フリガナ",
        phone: "電話番号",
        address: "住所",
        /** 登録元の催事と、商談履歴に紐づく催事の両方を探す。 */
        venue: "過去の催事場所",
        dealStatus: "商談ステータス（自社）",
        salesChannel: "販売チャネル",
        registeredAt: "登録日",
        /** 管理者のみ。 */
        salesperson: "担当販売員",
        status: "顧客ステータス",
        /** 管理者は自社の商談が対象（スタッフは本人担当の商談）。 */
        dealStatusAdmin: "商談ステータス（自社）",
      },
      /** 二次店管理者向け（自社顧客の管理）。スタッフ向けとは対象範囲が違う。 */
      admin: {
        listTitle: "自社顧客",
        listSubtitle: "自社が登録・担当している顧客です",
        empty: "自社顧客がありません",
        emptyCta: "アポイントを登録すると、ここに表示されます。",
        detailTitle: "自社顧客",
        edit: "顧客情報を編集",
        editTitle: "顧客情報を編集",
        editHint: "変更できるのは連絡先・住所・担当者・ステータス・備考です。",
        delete: "この顧客を削除",
        deleteTitle: "顧客の削除",
        deleteConfirm:
          "この顧客と、紐づく商談・アポイント・活動履歴をすべて削除します。元に戻せません。",
        deleteConfirmField: "削除するにはお客様名を入力してください",
        /** 一緒に消える関連データの内訳（削除前に必ず出す）。 */
        impactTitle: "一緒に削除されるデータ",
        impactNone: "紐づく商談・アポイント・履歴はありません",
        impact: {
          deals: "商談",
          appointments: "アポイント",
          activities: "活動履歴",
          tasks: "タスク",
          callLogs: "通話ログ",
          messages: "メッセージ",
          loanReviews: "ローン審査",
          existingEquipments: "既存設備",
          contracts: "契約",
          files: "添付ファイル",
        } as Record<string, string>,
        impactUnit: "{n}件",
        deleted: "削除しました",
        /** 削除できない場合の理由。 */
        blockedByContract: "契約が紐づいているため削除できません。代理店にご連絡ください。",
        blockedByFile: "添付ファイルが登録されているため削除できません。代理店にご連絡ください。",
        nameMismatch: "入力されたお客様名が一致しません",
        /** マスキング設定で個人情報が伏せられているときは編集させない。 */
        maskedEditDisabled:
          "個人情報が非表示の設定のため、この画面からは編集できません。代理店にご確認ください。",
        columns: {
          salesperson: "担当販売員",
          status: "ステータス",
        },
        fields: {
          tossUpSalesperson: "トス獲得者",
          closingSalesperson: "営業担当者",
          landlinePhone: "固定電話",
          mobilePhone: "携帯電話",
          postalCode: "郵便番号",
          prefecture: "都道府県",
          city: "市区町村",
          addressLine: "番地以降",
          note: "備考",
        },
        statusLabels: {
          NEW: "新規",
          PRE_CALL_WAIT: "マエカク待ち",
          PRE_CALL_DONE: "マエカク済み",
          VISIT_PLANNED: "訪問予定",
          IN_NEGOTIATION: "商談中",
          CONTRACTED: "契約",
          LOST: "失注",
          IN_CONSTRUCTION: "工事中",
          COMPLETED: "完了",
        } as Record<string, string>,
      },
    },
    /** 商談履歴（接点の積み重ね）と業務情報の更新。 */
    negotiation: {
      title: "商談履歴",
      hint: "いつ・どこで・誰が・何を行い、どうなったかを 1 件ずつ残します。接点が増えるほど回数が積み上がります。",
      empty: "商談履歴はまだありません",
      seq: "{n}回目",
      add: "接点を記録",
      addTitle: "接点を記録する",
      editTitle: "記録を修正する",
      editHint: "誤記の修正では商談回数は増えません。",
      fields: {
        occurredAt: "日時",
        category: "種別",
        detail: "内容・結果",
        event: "催事（どこで）",
        eventNone: "催事を指定しない",
        assignee: "接客した担当者",
        assigneeHint: "実際に操作した利用者は別に記録されます。",
        amount: "提示金額（円）",
      },
      categories: {
        tossup: "トスアップ",
        event: "催事",
        appointment: "アポイント",
        visit: "訪問",
        quote: "見積提示",
        phone: "電話",
        email: "メール",
        other: "その他",
      },
      createdBy: "登録者",
      updatedBy: "最終更新",
      save: "記録する",
      saved: "記録しました",
      cancelEdit: "やめる",
      status: {
        title: "現在の商談状況",
        dealStatus: "商談ステータス",
        maekakuStatus: "マエカクステータス",
        nextAppointmentAt: "次回アポ日程",
        nextAction: "次回アクション",
        assignee: "担当者",
        assigneeHint: "引継ぎ・共同対応のときに変更します。過去の履歴は残ります。",
        save: "更新する",
        saved: "更新しました",
      },
      dealStatuses: {
        negotiating: "商談中",
        contracted: "契約済",
        cancelled: "解約",
        lost: "失注",
      },
      maekakuStatuses: {
        pending: "未実施",
        done: "実施済",
        unnecessary: "不要",
      },
      contractReport: {
        title: "成約報告",
        note: "「契約済」への変更と、成約報告の提出は別の操作です。ステータスを変えても成約報告は提出されません。",
        open: "成約報告を登録する",
        countLabel: "自社の提出済み成約報告: {n}件",
        noContractNote: "金額・粗利・インセンティブに関わる正式な契約はここでは作成されません。",
      },
      errors: { failed: "保存できませんでした" },
    },
    /** シフト（本人に割り当てられた催事）。登録・変更はしない。 */
    /** 個人設定（本人の販売員情報）。正本は販売員マスタで、別表は作らない。 */
    profile: {
      title: "個人設定",
      subtitle: "登録されているご自身の情報を確認・変更できます",
      sections: {
        fixed: "変更できない項目",
        editable: "ご自身の情報",
      },
      fixedHint:
        "所属会社・加盟店番号・利用状態・サインイン用のメールアドレスは変更できません。変更が必要なときは自社の管理者へご連絡ください。",
      emailHint: "連絡先のメールアドレスです。サインインに使うメールアドレスは変わりません。",
      fields: {
        companyName: "所属会社",
        franchiseNo: "加盟店番号",
        loginEmail: "サインイン用メールアドレス",
        isActive: "利用状態",
      },
      activeYes: "利用中",
      activeNo: "停止中",
      errors: {
        noSalesperson:
          "ご自身の販売員情報が見つかりません。自社の管理者に、アカウントと販売員情報の紐付けをご依頼ください。",
      },
    },

    /** 催事シフトの出退勤（本人の打刻）。保存先は EventShift の実績列。 */
    attendance: {
      clockIn: "出勤",
      clockOut: "退勤",
      clockedInAt: "出勤",
      clockedOutAt: "退勤",
      worked: "勤務時間",
      stateLabel: "勤務状態",
      /** 休憩を控除しないことを必ず添える。 */
      workedNote: "休憩時間は控除していません",
      state: {
        NOT_CHECKED_IN: "未出勤",
        WORKING: "勤務中",
        DONE: "退勤済み",
      },
      /** 当日でない割当に出す説明。 */
      notTodayHint: "開催日当日に出勤できます",
      needCheckInHint: "出勤すると、この催事のアポ登録と日報入力ができます",
      clockedInHint: "出勤済みです。アポ登録と日報入力ができます",
      doneHint: "退勤済みです。この催事の日報は引き続き提出できます",
      errors: {
        notYourShift: "対象のシフトが見つかりません",
        notToday: "出勤できるのは開催日当日です",
        notCheckedIn: "出勤の記録がありません",
        clockOutBeforeIn: "退勤時刻が出勤時刻より前になります",
        clockInFailed: "出勤を記録できませんでした",
        clockOutFailed: "退勤を記録できませんでした",
        needCheckIn: "この催事に出勤してから登録してください",
      },
    },
    shift: {
      /** 催事シフトから日報へ。対象の催事・開催日を引き継ぐ。 */
      registerReport: "この催事から日報を入力",
      listTitle: "シフト",
      listSubtitle: "自分に割り当てられている催事の予定です（閲覧のみ）",
      empty: "割り当てられているシフトがありません",
      emptyCta: "代理店が催事の担当に割り当てると、ここに表示されます。",
      /** 販売員との紐付けが無いアカウントに出す案内。 */
      noSalespersonLink:
        "このアカウントは販売員情報と紐付いていないため、催事の割当を表示できません。代理店にご確認ください。",
      columns: {
        date: "開催日",
        venue: "開催場所",
        time: "時間",
        role: "役割",
        note: "備考",
        startAt: "開始時刻",
        source: "区分",
      },
      filters: {
        date: "日付",
        venue: "開催場所",
        source: "区分",
      },
      /** 時間の記録が無い割当（催事単位の割当）に出す表記。 */
      timeUnset: "催事の時間に準ずる",
      sources: {
        event: "催事担当",
        shift: "勤務シフト",
      },
      /** 二次店管理者向け（自社ユーザー全員のシフト状況）。 */
      admin: {
        listTitle: "シフト管理",
        listSubtitle: "自社ユーザーのイベントに対するシフト状況です（閲覧のみ）",
        empty: "自社ユーザーのシフトがありません",
        emptyCta: "代理店が催事の担当に割り当てると、ここに表示されます。",
        /** 販売員と紐付いていないアカウントがある旨。 */
        unlinkedNote:
          "販売員情報と紐付いていない利用者の催事割当は表示できません。アカウント管理から紐付けてください。",
        columns: { member: "担当者" },
        filters: { member: "担当者" },
      },
      /** 催事シフト（再構築版）。名称はメニュー・見出しとも「催事シフト」。 */
      title: "催事シフト",
      subtitle: "開催日・時間の順に、開催場所と配置スタッフを確認します",
      prevMonth: "前月",
      thisMonth: "当月",
      nextMonth: "翌月",
      monthLabel: "表示する月",
      monthApply: "表示",
      viewList: "一覧",
      viewCalendar: "カレンダー",
      viewLabel: "表示方法",
      monthEmpty: "この月に対象の催事はありません",
      dayEmpty: "配置はありません",
      unassigned: "未配置",
      staffCount: "{n}名",
      timeUnknown: "開催時間未設定",
      planned: "予定",
      actual: "実績",
      actualUnset: "実績なし",
      /** 配置（管理者のみ）。 */
      assign: {
        title: "スタッフを配置する",
        subtitle: "月内の対象催事・開催日をまとめて選び、複数スタッフを一度に配置します",
        open: "配置する",
        targets: "対象の催事・開催日",
        targetsHint: "複数選べます。予定時間は開催時間を初期値にしています（変更できます）。",
        targetsEmpty: "この月に配置できる催事がありません",
        staff: "配置するスタッフ",
        staffHint: "選んだ開催日の時間に別の催事へ配置済みのスタッフは選べません。",
        staffEmpty: "配置できるスタッフがいません",
        role: "役割",
        note: "備考",
        submit: "配置する",
        submitting: "配置中…",
        done: "配置しました",
        busyNote: "（同時刻に別の催事へ配置済み）",
        travelTitle: "移動条件",
        travelHint:
          "出発地点はスタッフの自宅住所、移動手段は公共交通機関を想定しています。最終的な配置は管理者が判断します。",
        transitUnavailable: "経路情報は未取得（駅すぱあと未接続）",
        homeAddressUnset: "自宅住所が未登録",
        selectTargetsFirst: "先に対象の催事・開催日を選んでください",
      },
      /** 役割（業務上の一次値域）。旧値は rolesLegacy 側で表示する。 */
      roles: {
        CATCH: "キャッチ",
        TOSS: "トス",
      },
      roleHints: {
        CATCH: "ブースへお客様を呼び込む",
        TOSS: "説明、ヒアリング、訪問日時の調整",
      },
      /** 既存データが持つ旧役割。意味が違うので キャッチ / トス へ読み替えない。 */
      rolesLegacy: {
        LEAD: "リーダー",
        RECEPTION: "受付",
        PITCH: "商談",
        OTHER: "その他",
      },
      /** 勤務時間の記録（実績。予定は上書きしない）。 */
      actualForm: {
        title: "実際に勤務した時間",
        hint: "遅刻・早退・体調不良などで予定と違ったときに記録します。予定時間はそのまま残ります。",
        startActual: "実績開始",
        endActual: "実績終了",
        save: "実績を保存",
        saved: "実績を保存しました",
        clear: "実績を消す",
      },
      /** 予定時間・役割の変更。 */
      planForm: {
        title: "予定時間・役割",
        save: "予定を保存",
        saved: "予定を保存しました",
      },
      unassign: "配置を取り消す",
      unassigned2: "配置を取り消しました",
      errors: {
        overlap: "このスタッフは同じ時間帯に別の催事へ配置されています",
        noTarget: "配置する催事を選択してください",
        noStaff: "スタッフを選択してください",
        failed: "配置できませんでした",
        eventTimeMissing: "開催時間が未設定の開催日があります。予定時間を入力してください。",
      },
    },
    /** 成約（Google フォーム「成約フォーム」準拠・9 項目）。 */
    contract: {
      listTitle: "成約一覧",
      newTitle: "成約を登録",
      editTitle: "成約を編集",
      detailTitle: "成約詳細",
      empty: "登録された成約がありません",
      emptyCta: "「成約を登録」から追加してください。",
      sections: {
        contract: "成約情報",
        org: "体制",
      },
      fields: {
        franchiseNo: "加盟店番号",
        contractDate: "ご契約日",
        tossDate: "トス日",
        tossDept: "トス部署",
        apptGetter: "アポ獲得者",
        salesRep: "営業担当者",
        referralBranch: "取次拠点",
        affiliation: "所属",
        affiliationDept: "所属部署",
        acquisitionChannel: "アポ獲得時チャネル",
        createdAt: "登録日時",
      },
      affiliationLabels: {
        VE: "VE",
        PS: "PS",
      } as Record<string, string>,
      /** 所属の意味（フォームの説明文に合わせる）。 */
      affiliationHint: "バリューエコロジーの社員が獲得した場合は VE、それ以外は PS",
      acquisitionChannelLabels: {
        VISIT_SALES: "訪問販売",
        TELE_APPOINTMENT: "テレアポ",
        REFERRAL: "紹介",
        EVENT: "催事",
        INBOUND: "反響",
      } as Record<string, string>,
      columns: {
        contractDate: "ご契約日",
        tossDate: "トス日",
        salesRep: "営業担当者",
        referralBranch: "取次拠点",
        affiliation: "所属",
        acquisitionChannel: "獲得チャネル",
        tossDept: "トス部署",
        createdAt: "登録日時",
      },
      filters: {
        contractDate: "契約日",
        tossDate: "トス日",
        tossDept: "トス部署",
        apptGetter: "アポ獲得者",
        salesRep: "営業担当者",
        referralBranch: "取次拠点",
        affiliation: "所属",
        affiliationDept: "所属部署",
        acquisitionChannel: "獲得チャネル",
      },
    },
    // 催事日報（Google フォーム「ES_日報」準拠）。
    report: {
      listTitle: "催事日報一覧",
      newTitle: "催事日報を登録",
      editTitle: "催事日報を編集",
      correctTitle: "催事日報を訂正",
      correctAction: "訂正して再提出",
      correctHint:
        "元の日報はそのまま残り、この訂正が集計の対象になります。元の内容が二重に数えられることはありません。",
      correctedBadge: "訂正済み（この日報は集計の対象外）",
      correctionBadge: "訂正として提出された日報",
      alreadyCorrected: "この日報はすでに訂正されています。訂正後の日報を確認してください。",
      detailTitle: "催事日報詳細",
      empty: "登録された催事日報がありません",
      emptyCta: "「催事日報を登録」から追加してください。",
      sections: {
        basic: "基本情報",
        performance: "実績",
        impression: "所感",
      },
      fields: {
        eventDate: "催事実施日",
        venuePlace: "催事場所",
        category: "種別",
        venueChain: "催事区分",
        areaInFacility: "施設内エリア",
        startTime: "稼働開始時間",
        endTime: "稼働終了時間",
        cainzPayCount: "カインズPay対応数",
        impression: "所感",
        franchiseNo: "加盟店番号",
        createdAt: "登録日時",
      },
      metrics: {
        lottery: "抽選数",
        seated: "着座数",
        appointment: "アポ数",
        both: "両面",
        single: "片面",
        total: "合計",
      },
      /** 合計は入力させず算出する旨の注記。 */
      totalHint: "合計は両面と片面の合計から自動計算されます",
      categoryLabels: {
        HOUSING_EQUIPMENT: "住宅設備",
        REAL_ESTATE: "不動産",
      },
      venueChainLabels: {
        CAINZ_W: "カインズ-W",
        CAINZ_V: "カインズ-V",
        SHIMACHU: "島忠",
        KOMERI: "コメリ",
        OTHER: "その他",
      },
      columns: {
        eventDate: "催事実施日",
        venuePlace: "催事場所",
        category: "種別",
        venueChain: "催事区分",
        apptTotal: "アポ数",
        lotteryTotal: "抽選数",
        seatedTotal: "着座数",
        createdAt: "登録日時",
      },
      /** 共通の催事への紐付けと、数値の集計単位（代理店-01）。 */
      eventLink: {
        label: "対象の催事",
        hint: "自社が担当している催事から選びます。日報はその催事の開催日の記録なので、どちらも指定が必要です。",
        none: "選択してください",
        dayLabel: "対象の開催日",
        dayNone: "選択してください",
        noEvents:
          "自社が担当している催事がまだありません。催事の担当が決まると、ここから日報を出せます。",
      },
      scope: {
        label: "この数値の範囲",
        hint: "誰の実績かで合計の扱いが変わります。分からないときは未選択のままで構いません。",
        UNKNOWN: "選択しない",
        PERSON: "自分ひとりの実績",
        COMPANY: "自社の合計",
        BOOTH: "ブース全体（他社を含む）",
      },
      errors: {
        eventRequired: "対象の催事を選択してください",
        eventDayRequired: "対象の開催日を選択してください",
        eventNotAssigned: "選択した催事は自社の担当ではありません",
        eventDayMismatch: "選択した開催日はこの催事のものではありません",
      },
      filters: {
        eventDate: "催事実施日",
        venuePlace: "催事場所",
        category: "種別",
        venueChain: "催事区分",
        areaInFacility: "施設内エリア",
      },
    },
    // 販売員（Google フォームの販売員登録準拠）。
    salesperson: {
      listTitle: "販売員一覧",
      newTitle: "販売員を登録",
      editTitle: "販売員を編集",
      detailTitle: "販売員詳細",
      empty: "登録された販売員がいません",
      emptyCta: "「販売員を登録」から追加してください。",
      fields: {
        email: "メールアドレス",
        franchiseNo: "加盟店番号",
        name: "氏名（漢字）",
        kana: "氏名（カナ）",
        gender: "性別",
        birthDate: "生年月日",
        phone: "電話番号",
        address: "現住所",
        residentAddress: "住民票住所",
        employmentType: "雇用形態",
        salesExperience: "営業経験歴",
        isGuest: "ゲストスタッフ",
        isGuestHint:
          "他社から受け入れたスタッフです。閲覧範囲は自社スタッフと同じで、登録・招待・催事への追加は管理者だけが行います。",
        isActive: "状態",
      },
      genderLabels: {
        MALE: "男性",
        FEMALE: "女性",
        OTHER: "その他",
      },
      employmentTypeLabels: {
        EMPLOYEE: "正社員",
        CONTRACT: "契約社員",
        PART_TIME: "アルバイト",
        SUBCONTRACT: "業務委託",
        OTHER: "その他",
      },
      activeLabels: {
        active: "有効",
        inactive: "無効",
      },
      columns: {
        name: "氏名",
        kana: "カナ",
        phone: "電話番号",
        employmentType: "雇用形態",
        /** ログイン利用者（User）との紐付け状況。 */
        account: "アカウント",
      },
      filters: {
        keyword: "氏名・カナ・連絡先",
        employmentType: "雇用形態",
        isActive: "状態",
        link: "アカウント紐付け",
      },
      /** 紐付け状況の表記。販売員情報とログインアカウントは別の管理対象。 */
      linkLabels: {
        LINKED: "紐付けあり",
        UNLINKED: "紐付けなし",
      } as Record<string, string>,
      /** 紐付けの設定はアカウント管理側で行う旨。 */
      linkNote: "ログインアカウントとの紐付けは「利用者アカウント」から設定します。",
    },
    /** 利用者アカウント管理（二次店管理者のみ）。 */
    account: {
      listTitle: "利用者アカウント",
      listSubtitle: "自社のログイン利用者の利用区分・利用状況を管理します",
      detailTitle: "利用者アカウント",
      empty: "利用者がいません",
      emptyCta: "「利用者を招待」からメールアドレスを登録してください。",
      /** 所属二次店は 1 アカウント = 1 社で固定のため表示のみ。 */
      belongNote: "所属パートナー会社はアカウント作成時に決まり、この画面では変更できません。",
      columns: {
        name: "氏名",
        email: "メールアドレス",
        role: "利用区分",
        status: "利用状況",
        salesperson: "紐付く販売員",
        lastLoginAt: "最終ログイン",
        createdAt: "登録日",
      },
      filters: {
        keyword: "氏名・メールアドレス",
        role: "利用区分",
        status: "利用状況",
        link: "販売員との紐付け",
      },
      roleLabels: {
        DEALER_ADMIN: "管理者",
        DEALER_STAFF: "スタッフ",
      } as Record<string, string>,
      statusLabels: {
        ACTIVE: "利用中",
        INVITED: "招待済み（未ログイン）",
        SUSPENDED: "停止中",
        DELETED: "削除済み",
      } as Record<string, string>,
      linkLabels: {
        LINKED: "紐付けあり",
        UNLINKED: "紐付けなし",
      } as Record<string, string>,
      invite: {
        title: "利用者を招待",
        open: "利用者を招待",
        email: "メールアドレス",
        // 同じ画面に絞り込みの「利用区分」があるので、招待側は語を変えて取り違えを防ぐ。
        role: "付与する利用区分",
        submit: "招待を発行",
        done: "招待を発行しました",
        /** メールは送らない。リンクを本人へ渡してもらう。 */
        linkNote:
          "次のリンクをご本人にお渡しください。利用区分に応じたサイトへつながります（メールは送信していません）。",
      },
      actions: {
        title: "この利用者の設定",
        activate: "利用を開始する",
        suspend: "利用を停止する",
        toAdmin: "管理者にする",
        toStaff: "スタッフにする",
        link: "販売員と紐付ける",
        unlink: "紐付けを解除",
        salespersonSelect: "紐付ける販売員",
        salespersonNone: "紐付けない",
        save: "保存",
      },
      /** 操作を止める理由。管理者が 0 人になる操作と自分自身の操作は禁止。 */
      guards: {
        self: "自分自身の利用区分・利用状況は変更できません",
        lastAdmin: "管理者が 0 人になる操作はできません",
        notDealerUser: "パートナー会社の利用者ではありません",
        invited: "招待済みのアカウントは、本人が招待を受け入れるまで利用状況を変更できません",
        salespersonTaken: "この販売員は別の利用者と紐付いています",
      },
      /** 紐付けの考え方。氏名一致などからの自動紐付けはしない。 */
      linkNote:
        "販売員との紐付けは管理者が明示的に指定します。氏名が同じでも自動では紐付きません。",
    },
    /** 手数料管理（営業フィー）。率の設定は代理店が行うため閲覧のみ。 */
    commission: {
      listTitle: "手数料管理",
      listSubtitle: "自社に適用されている営業フィーの率と、確定した金額です",
      rateSection: "適用中の手数料率",
      rateEmpty: "手数料率が設定されていません",
      rateEmptyCta: "代理店が設定すると、ここに表示されます。",
      /** 変更は代理店側で行う旨。 */
      readOnlyNote: "手数料率は代理店が設定します。この画面では変更できません。",
      fields: {
        tossUpRate: "トスアップ率",
        closingRate: "クロージング率",
        applyFrom: "適用開始",
        applyTo: "適用終了",
        updatedAt: "最終更新",
      },
      listSection: "確定した営業フィー",
      empty: "確定した営業フィーがありません",
      emptyCta: "契約が確定すると、ここに表示されます。",
      columns: {
        settledMonth: "対象月",
        contractDate: "契約日",
        targetProfit: "対象粗利",
        rate: "率",
        amount: "金額",
        finalizedAt: "確定日",
      },
      filters: {
        settledMonth: "対象月",
        amount: "金額",
        contractDate: "契約日",
      },
      totalLabel: "表示中の合計",
      /** 表示できない情報の断り書き（代理店の原価は二次店に出さない）。 */
      costNote: "代理店側の原価情報は含まれません。",
    },
    /** 希望ラインの提出（出店希望）。保存先は既存の LanePreference。 */
    lanePreference: {
      title: "出店希望の提出",
      subtitle: "対象月ごとに、レーン単位で希望店舗・希望日程を提出します",
      monthLabel: "対象月",
      monthApply: "この月を表示",
      submittedAt: "最終提出",
      notSubmitted: "この月はまだ提出していません",
      noteLabel: "特記事項",
      itemsTitle: "希望箇所",
      itemsHint: "上から希望順（1 番目が第一希望）になります。空欄の行は保存されません。",
      addRow: "希望を追加",
      removeRow: "この行を削除",
      priority: "希望順",
      venueLabel: "希望場所",
      venueLabelHint: "店舗名など。候補から選ぶか、直接入力できます。",
      /** 希望場所は店舗マスタから選ぶ（自由記述だとどの店舗か決まらないため）。 */
      venueSelectHint:
        "代理店に登録されている店舗から選びます。同じ名前の店舗は場所提供元と住所で見分けられます。",
      venueSelectNone: "店舗を選択",
      venueLabelAtSubmit: "提出時の名称",
      venuePick: "候補から選ぶ",
      venuePickNone: "直接入力",
      desiredDates: "希望開催日",
      desiredDatesHint: "複数ある場合は改行かカンマで区切ってください（例: 2026-06-05）。",
      memo: "メモ",
      submit: "提出する",
      submitting: "提出中…",
      submitted: "提出しました",
      /** 再提出は全件入れ替えになる旨。 */
      replaceNote: "同じ月に再提出すると、前回の内容は入れ替わります。",
      /** 候補が無いとき。 */
      candidatesEmpty: "代理店から公開されている候補はありません。希望場所は直接入力できます。",
      /** 候補の絞り込み。 */
      candidatesTitle: "公開中の候補",
      candidatesHint: "代理店が自社に公開している候補です。希望場所の入力補助に使います。",
      candidatesCount: "該当 {total}件",
      candidatesNoMatch: "条件に一致する候補がありません",
      filters: {
        venue: "候補の場所",
        eventDate: "開催日",
      },
      columns: {
        eventDate: "開催日",
        venue: "場所",
        address: "住所",
      },
      errors: {
        needItem: "希望店舗を 1 件以上入力してください",
        invalidMonth: "対象月の指定が正しくありません",
        invalidDate: "希望日程は YYYY-MM-DD 形式で入力してください",
        ambiguousRelationship: "依頼先の代理店を選択してください",
        storeNotAvailable: "選択された店舗は利用できません。候補から選び直してください",
        failed: "提出できませんでした",
      },
      /** 一覧・詳細（提出したものを後から確認する）。 */
      listTitle: "出店希望",
      listSubtitle: "対象月ごとに、レーン単位で希望店舗・希望日程を提出します",
      newSubmission: "希望を提出する",
      resubmit: "内容を修正して再提出",
      detailTitle: "出店希望の詳細",
      empty: "提出した出店希望はまだありません",
      noMatch: "条件に一致する提出はありません",
      originLabel: "依頼先代理店",
      originHint: "どの代理店への希望かを選びます。",
      laneCountLabel: "希望レーン数",
      laneCountHint: "申告値です。店舗が未定のレーンがあっても構いません。",
      laneTitle: "{n}レーン目",
      addLane: "レーンを追加",
      removeLane: "このレーンを削除",
      priorityLabel: "第{n}希望",
      addPriority: "希望店舗を追加",
      removePriority: "この希望を削除",
      conditionNote: "個別条件",
      conditionNoteHint:
        "この店舗だけの条件（例: 上記日程のいずれか 2 日間を希望）。希望順位とは別に記録されます。",
      laneDesiredDates: "希望日程",
      laneDesiredDatesHint:
        "このレーンで希望する開催日。複数指定できます（改行またはカンマ区切り、例: 2026-07-04）。",
      statusLabel: "状態",
      status: {
        DRAFT: "下書き",
        SUBMITTED: "提出済み",
        ANSWERED: "代理店回答あり",
        CONFIRMED: "確定",
      },
      /** 代理店とのやり取り。 */
      threadTitle: "代理店とのやり取り",
      threadHint: "この提出についての連絡と、代理店からの回答が残ります。",
      threadEmpty: "やり取りはまだありません",
      threadPost: "送信",
      threadBody: "連絡内容",
      threadSideDealer: "自社",
      threadSideWholesaler: "代理店",
      threadKindSubmission: "提出",
      threadKindAnswer: "回答",
      threadKindMessage: "連絡",
      /** 確定した開催内容。 */
      confirmedTitle: "確定した開催",
      confirmedHint: "代理店が確定した開催場所・日程・担当会社です。",
      confirmedEmpty: "確定した開催はまだありません",
      /** 希望明細ごとの採用結果。代替提案（希望と違う店舗）は区別して出す。 */
      adopted: "採用されました",
      adoptedAlternative: "別の店舗で採用されました",
      confirmedColumns: {
        venue: "開催場所",
        days: "開催日",
        mode: "開催体制",
        dealers: "担当会社",
      },
      listColumns: {
        targetMonth: "対象月",
        origin: "依頼先代理店",
        laneCount: "レーン数",
        status: "状態",
        submittedAt: "提出",
        submittedBy: "提出者",
      },
      listFilters: {
        month: "対象月",
        origin: "依頼先代理店",
        status: "状態",
        venue: "店舗名・住所",
        area: "エリア",
      },
    },
    /** 場所確保の相談（通常の希望提出とは別建て）。 */
    consultation: {
      title: "場所確保の相談",
      subtitle: "地域の特性を伝えて、ブースの確保を相談します",
      newTitle: "相談を送る",
      detailTitle: "相談の詳細",
      create: "相談を送る",
      empty: "相談はまだありません",
      noMatch: "条件に一致する相談はありません",
      fields: {
        origin: "相談先代理店",
        targetMonth: "対象月（任意）",
        area: "希望エリア",
        areaHint: "例: 群馬県東部、静岡県東部",
        title: "件名",
        body: "相談内容",
        bodyHint: "例: この地域はこういう特性があるため、○○でブースを確保できませんか。",
      },
      columns: {
        createdAt: "送信",
        title: "件名",
        origin: "相談先",
        area: "エリア",
        targetMonth: "対象月",
        status: "状態",
      },
      status: { OPEN: "回答待ち", ANSWERED: "回答あり", CLOSED: "完了" },
      filters: { area: "エリア", keyword: "件名・内容", month: "対象月", status: "状態" },
      errors: { failed: "送信できませんでした" },
    },
    errors: {
      notFound: "対象が見つかりません",
      forbidden: "この情報にアクセスできません",
      /** スタッフが管理機能を開いたとき。 */
      adminOnly: "この機能はパートナー管理者のみ利用できます",
      /** 取引先の代理店が 1 社に決まらないとき。提出先を推測しない。 */
      ambiguousOrigin: "依頼先の代理店が特定できません。代理店にご確認ください",
    },
  },

  // 代理店側の顧客詳細に出す「二次店が登録した催事情報」（読み取り専用）。
  // 二次店ポータルからの登録内容を代理店が確認できるようにするための最小表示で、
  // 編集導線は置かない。
  customerVenueInfo: {
    section: "初訪アポ情報（パートナー様登録）",
    fromEvent: "登録済み催事から",
    directInput: "直接入力",
    empty: "パートナー様からの登録情報はありません",
    fields: {
      eventDate: "催事実施日",
      venuePlace: "催事場所",
      venueChain: "催事種別",
      boothArea: "催事ブース場所",
      closeCompany: "クローズ会社",
    },
  },

  // 代理店側で二次店の催事日報を確認する読み取り専用画面。
  dealerReportView: {
    listTitle: "パートナー 催事日報",
    listSubtitle: "パートナー様から提出された催事日報です（閲覧のみ）",
    detailTitle: "催事日報詳細",
    backToList: "一覧へ戻る",
    empty: "提出された催事日報がありません",
    emptyCta: "パートナー様がパートナーポータルから登録すると、ここに表示されます。",
    readOnlyNote: "この画面は閲覧専用です。編集はパートナーポータルから行われます。",
    columns: {
      eventDate: "催事実施日",
      dealerName: "パートナー会社",
      venuePlace: "催事場所",
      venueChain: "催事区分",
      apptTotal: "アポ数",
    },
    filters: {
      dealer: "パートナー会社",
      all: "すべて",
      resultCount: "{total}件",
    },
  },

  // 代理店側で二次店の訪問アポを確認する読み取り専用画面。
  dealerVisitAppointmentView: {
    listTitle: "パートナー 訪問アポ",
    listSubtitle: "パートナー様から提出された訪問アポです（閲覧のみ）",
    detailTitle: "訪問アポ詳細",
    backToList: "一覧へ戻る",
    empty: "提出された訪問アポがありません",
    emptyCta: "パートナー様がパートナーポータルから登録すると、ここに表示されます。",
    readOnlyNote: "この画面は閲覧専用です。編集はパートナーポータルから行われます。",
    columns: {
      createdAt: "登録日時",
      dealerName: "パートナー会社",
      tossDept: "トス部署",
      closeDept: "クローズ部署",
      salesRep: "営業担当者",
    },
  },

  // 代理店側で二次店の成約報告を確認する読み取り専用画面。
  dealerContractView: {
    listTitle: "パートナー 成約",
    listSubtitle: "パートナー様から提出された成約報告です（閲覧のみ）",
    detailTitle: "成約詳細",
    backToList: "一覧へ戻る",
    empty: "提出された成約がありません",
    emptyCta: "パートナー様がパートナーポータルから登録すると、ここに表示されます。",
    readOnlyNote: "この画面は閲覧専用です。編集はパートナーポータルから行われます。",
    columns: {
      contractDate: "ご契約日",
      dealerName: "パートナー会社",
      salesRep: "営業担当者",
      referralBranch: "取次拠点",
      affiliation: "所属",
    },
  },

  // 決済（BizOrch 利用料）の状態表示と、支払い起因の利用制限。
  //
  // 内部の enum 名（ACTIVE / PAYMENT_METHOD_MISSING / …）はそのまま画面に出さない。
  billing: {
    // ナビの非活性項目に出す tooltip。
    navDisabledReason: "決済情報の登録またはお支払いが必要です",
    /** 支払い状態の表示名。/payments の「支払い状態」で使う。 */
    statusLabels: {
      ACTIVE: "支払い済み",
      PAYMENT_METHOD_MISSING: "決済情報未登録",
      UNPAID: "未払い",
      STRIPE_UNAVAILABLE: "決済状態を確認できません",
    } as Record<string, string>,
    /** ホーム上部の警告（横長の 1 行。巨大なカードにはしない）。 */
    alert: {
      paymentMethodMissing: {
        title: "決済情報が登録されていません",
        body: "BizOrchを利用するには決済情報の登録が必要です。",
        ownerAction: "決済管理ページへ",
        otherAction: "オーナーに決済情報の登録を依頼してください",
      },
      unpaid: {
        title: "お支払いが確認できていません",
        body: "お支払いが確認できるまで、ホームと決済管理以外はご利用いただけません。",
        ownerAction: "決済管理ページへ",
        otherAction: "オーナーに支払い対応を依頼してください",
      },
      unavailable: {
        title: "決済状態を確認できません",
        body: "決済サービスに接続できていません。時間を置いて再度ご確認ください。",
      },
    },
    /** 支払い方法の表示。カード番号そのものは扱わない（下 4 桁まで）。 */
    card: {
      /** ブランドが取れないときの言い換え。「カード •••• 4242」。 */
      generic: "カード",
      none: "未登録",
      expiry: "有効期限",
    },
    /** 決済管理ページ（Stripe のカスタマーポータル）への導線。 */
    portal: {
      /** 決済情報が既にある場合。 */
      manage: "決済管理ページ",
      /** Stripe Customer がまだ無い場合。 */
      start: "決済情報を登録",
      opening: "決済管理ページを開いています…",
      error: "決済管理ページを開けませんでした。時間を置いて再度お試しください",
      notConfigured: "決済サービスが未設定のため、決済管理ページを開けません",
    },
  },

  // 製品カタログ（商品マスタ管理）。
  //
  // カテゴリの表示順は PV → BT → エコキュート → IH → プレゼント品 → その他 で固定。
  // 内部名は @solar/contracts の CATALOG_CATEGORY_VALUES が唯一の情報源で、
  // ここは表示名だけを持つ。
  productCatalog: {
    title: "製品カタログ",
    new: "商品を登録",
    categories: {
      PV: "PV",
      BT: "BT",
      ECO_CUTE: "エコキュート",
      IH: "IH",
      GIFT: "プレゼント品",
      OTHER: "その他",
    } as Record<string, string>,
    categoryTabsAriaLabel: "商品カテゴリ",
    // BT の機能区分。状態値ではなく分類なのでバッジにはせず、素の文字で出す。
    batteryFunctionTypes: {
      SINGLE: "単機能",
      SPECIFIC_LOAD: "特定負荷",
      FULL_LOAD: "全負荷",
    } as Record<string, string>,
    // 商品マスタの単位列。カタログ画面では入力させず、カテゴリごとの既定値を入れる。
    defaultUnits: {
      PV: "枚",
      BT: "台",
      ECO_CUTE: "台",
      IH: "台",
      GIFT: "個",
      OTHER: "式",
    } as Record<string, string>,
    fields: {
      name: "商品名",
      maker: "メーカー",
      series: "シリーズ",
      modelNo: "型番",
      capacity: "容量",
      batteryFunctionType: "機能区分",
      warranty: "保証",
      // 「原価」「販売価格」等へ言い換えない。
      // 仕入れ値 = 自社の仕入価格 / 卸値 = 取引先への卸価格。
      purchasePrice: "仕入れ値",
      dealerPrice: "卸値",
      note: "備考",
      status: "状態",
      isActive: "有効",
      updatedAt: "更新日時",
    },
    // 一覧のチェックボックスからの有効 / 無効切替（削除とは別操作）。
    activeToggle: {
      // 見出しだけでは何のチェックか分からないので、行ごとに商品名を含めた
      // aria-label を組み立てる（{name} を差し替える）。
      ariaLabel: "{name} を有効にする",
      activated: "有効にしました",
      deactivated: "無効にしました",
    },
    capacitySuffix: "kWh",
    warrantySuffix: "年保証",
    filters: {
      keyword: "商品名・メーカー・シリーズ・型番",
      keywordPlaceholder: "商品名 / メーカー / シリーズ / 型番",
      includeRetired: "無効の商品も表示",
      resultCount: "{total}件",
    },
    // メーカー絞り込み（カテゴリ切替はサイドバーが担うので、画面中央はここ）。
    makerFilter: {
      label: "メーカー",
      all: "すべて",
      unset: "メーカー未設定",
      empty: "登録済みのメーカーがありません",
    },
    // 登録・編集フォームのメーカー入力（既存から選択 + 新規名の直接入力）。
    makerInput: {
      hint: "一覧から選ぶか、新しいメーカー名を入力できます",
      placeholder: "メーカー名",
    },
    sortFieldLabels: {
      updated_at: "更新順",
      created_at: "登録順",
      maker: "メーカー",
      series: "シリーズ",
      modelNo: "型番",
      capacity: "容量",
      name: "商品名",
      purchasePrice: "仕入れ値",
      dealerPrice: "卸値",
    } as Record<string, string>,
    expand: {
      open: "詳細を開く",
      close: "詳細を閉じる",
    },
    empty: "登録された商品がありません",
    emptyCta: "右上の「商品を登録」から追加してください。",
    create: {
      title: "商品を登録",
      description: "カテゴリを選ぶと、そのカテゴリで必要な項目だけ表示されます。",
      category: "カテゴリ",
      submit: "登録",
      submitting: "登録中…",
      cancel: "キャンセル",
      done: "商品を登録しました",
    },
    edit: {
      trigger: "編集",
      title: "商品を編集",
      description: "登録済みの内容を変更します。カテゴリは変更できません。",
      submit: "保存",
      submitting: "保存中…",
      cancel: "キャンセル",
    },
    remove: {
      trigger: "削除",
      confirmTitle: "この商品を削除しますか",
      confirmBody:
        "一覧から外れ、新規の商品選択にも出なくなります。過去の契約・見積から参照されている情報はそのまま残ります。",
      submit: "削除",
      submitting: "削除中…",
      cancel: "キャンセル",
      done: "商品を削除しました",
    },
    errors: {
      duplicate: "同じ内容の商品がすでに登録されています",
      notFound: "商品が見つかりません",
    },
  },

  // Role-group navigation (SP-02+ で実体を入れる前提の最小 stub)
  groups: {
    saasAdmin: "SaaS 運営者",
    wholesaler: "卸業者本部",
    field: "現場要員",
    dealer: "取引先",
    common: "共通",
    onboarding: "オンボーディング",
    auth: "認証",
  },

  // Common navigation labels
  nav: {
    dashboard: "ダッシュボード",
    notifications: "通知",
    profile: "プロフィール",
    signOut: "サインアウト",
    menu: "メニュー",
    // 未実装画面への導線に付ける印。押す前に分かるようにする。
    upcoming: "準備中",
  },

  // Auth — S-001 sign-in (docs/04 §4.1)
  signIn: {
    title: "サインイン",
    subtitle: "メールアドレスとパスワードでサインインしてください",
    emailLabel: "メールアドレス",
    emailPlaceholder: "you@example.com",
    passwordLabel: "パスワード",
    passwordPlaceholder: "パスワード",
    submit: "サインイン",
    submitting: "サインイン中…",
    forgotPassword: "パスワードを忘れた方",
    dealerInviteCode: "招待コード入力（新規取引先）",
    invalidCredentials: "メールアドレスまたはパスワードが正しくありません",
    lockedTitle: "アカウントは一時的にロックされています",
    lockedSuffix: "後に再度お試しください",
    suspended: "このアカウントは利用停止中です。管理者にお問い合わせください",
    invited: "招待メール内のリンクからアカウント開設を完了してください",
    unknownError: "予期しないエラーが発生しました。時間を置いて再度お試しください",
    demoPanelTitle: "デモアカウント",
    demoPanelDescription: "下記の認証情報でサインインしてお試しください",
    demoEmailLabel: "メールアドレス",
    demoPasswordLabel: "パスワード",
    demoAutofillButton: "クリックでフォームに自動入力",
  },

  // Auth — S-002 MFA challenge
  mfa: {
    title: "2 段階認証コードを入力",
    subtitle: "認証アプリに表示されている 6 桁のコードを入力してください",
    codeLabel: "認証コード",
    codePlaceholder: "123456",
    submit: "検証",
    submitting: "検証中…",
    backupCodeLink: "バックアップコードを使用",
    invalidCode: "コードが一致しません",
    unknownError: "予期しないエラーが発生しました。時間を置いて再度お試しください",
  },

  // Auth — S-003 MFA setup
  mfaSetup: {
    title: "2 段階認証の初回セットアップ",
    subtitle: "認証アプリで QR コードをスキャンし、表示されたコードを入力してください",
    manualSecretLabel: "手動入力用シークレット",
    backupCodesTitle: "バックアップコード（8 個）",
    backupCodesNotice:
      "このコードはこの画面でしか表示されません。安全な場所に保存してください。1 度使うと無効になります。",
    downloadBackupCodes: "バックアップコードをダウンロード",
    verifyTitle: "認証コードで動作確認",
    codeLabel: "6 桁の確認コード",
    submit: "セットアップを完了",
    submitting: "セットアップ中…",
    loading: "QR コードを生成しています…",
    initError: "セットアップ情報の取得に失敗しました。ページを再読込してください",
    success: "2 段階認証のセットアップが完了しました",
  },

  // Auth — S-006 lock screen
  locked: {
    title: "アカウントは一時的にロックされています",
    body: "ログインの失敗回数が上限に達しました。15 分後に再度お試しください。",
    countdownPrefix: "再試行可能まで残り ",
    backToSignIn: "サインインへ戻る",
    support: "解除のお問い合わせはサポートまでご連絡ください",
  },

  // Common form / action labels
  // 顧客管理配下の各一覧が共有する検索・並び替え UI の文言（components/list/ 配下）。
  // 一覧固有の検索項目名は各一覧の labels に残し、ここは「枠」だけを持つ。
  listCommon: {
    /** 折りたたみ検索パネルのヘッダ。閉じているときはこの 1 行だけが見える。 */
    filterPanel: "検索条件",
    /** ヘッダに出す有効条件数（0 件のときは出さない）。 */
    activeCount: "{n}件",
    // 日付は「開始日」「終了日」を独立見出しにせず、1 つの見出しでまとめる
    // （何の日付か分からなくなるため）。個々の input には aria-label を付ける。
    dateRange: "検索範囲",
    dateRangeFrom: "検索範囲 開始日",
    dateRangeTo: "検索範囲 終了日",
    rangeSeparator: "〜",
    // 並び替えは検索条件ではないので検索パネルの外（表示件数の横）に置く。
    sortField: "並び替え",
    sortDirection: "並び順",
    sortDirectionLabels: {
      asc: "昇順",
      desc: "降順",
    } as Record<string, string>,
    search: "検索",
    clear: "クリア",
    all: "すべて",
  },
  common: {
    save: "保存",
    saving: "保存中…",
    cancel: "キャンセル",
    back: "戻る",
    create: "新規作成",
    edit: "編集",
    disable: "無効化",
    disabling: "無効化中…",
    delete: "削除",
    search: "検索",
    yes: "はい",
    no: "いいえ",
    optional: "（任意）",
    required: "必須",
    notSet: "未設定",
    active: "有効",
    inactive: "無効",
    unknownError: "予期しないエラーが発生しました。時間を置いて再度お試しください",
    saved: "保存しました",
    deleted: "削除しました",
    disabled: "無効化しました",
    notFound: "対象が見つかりません",
    forbidden: "この情報にアクセスできません",
    forbiddenBack: "前のページへ戻る",
    actions: "操作",
    currencySuffix: "円",
    comingSoon: "この画面は準備中です。",
  },

  // 準備中（coming-soon）プレースホルダ画面のタイトル。
  // メッセージ本文は labels.common.comingSoon を共用する。
  comingSoon: {
    appointments: "アポイント一覧",
    contracts: "契約一覧",
    venueNegotiations: "場所取り対応状況",
    bi: "BIダッシュボード",
    biAnalysis: "市況分析",
    masters: "エリア・場所管理",
    members: "システムユーザー",
    relationships: "取引先管理",
    auditLogs: "監査ログ",
  },

  // S-018 — 卸業者ダッシュボード (T-02-11 / docs/04 §1.3).
  //
  // 卸業者全ロール (admin / event_team / call_team / direct_sales /
  // field_staff) の共通ホーム。5 KPI カード + 直近イベント + 売上推移。
  dashboard: {
    title: "ホーム",
    // 催事営業は「期限」と「担当の割当」で売上が決まる。ホームの役割は
    // 実績の閲覧ではなく、滞留している対応を拾わせること。
    subtitle: "対応待ちの案件と今週の催事を確認できます",
    breadcrumbHome: "ホーム",
    kpi: {
      contractCount: "今月の契約件数",
      revenueGrossProfit: "今月の売上 / 粗利",
      grossProfitLabel: "粗利",
      weeklyEvents: "今週のイベント開催件数",
      weeklyEventsHint: "今週（月〜日）に開催されるイベント",
      weeklyAppointments: "今週のアポ件数",
      appointmentCompleted: "実績",
      appointmentScheduled: "見込み",
      notificationsAlert: "通知 / アラート",
      unreadCount: "未読 {n} 件",
      noNotifications: "通知はありません",
      countUnit: "件",
      prevMonth: "前月",
      revenue: "今月売上",
      incentive: "インセンティブ見込み",
    },
    sections: {
      // 要対応キュー。放置すると売上が落ちる 3 つの滞留を、件数と遷移先だけの
      // 最小構成で並べる。数字を大きく見せることが目的ではなく、
      // 「今日どこを開くか」を 1 秒で決めさせることが目的。
      todo: {
        title: "要対応",
        allClear: "対応待ちはありません",
        unread: {
          title: "未読通知",
          hint: "確認していない通達があります",
          link: "通知一覧を開く",
          unit: "件",
        },
        preference: {
          title: "取引先希望提出状況",
          hint: "希望が未提出のため開催体制を決められません",
          link: "イベント体制決定画面を開く",
          unit: "社",
        },
        precall: {
          title: "マエカク未対応",
          hint: "アポ取得済みで事前確認コールが未実施です",
          link: "マエカク一覧を開く",
          unit: "件",
        },
      },
      // 実績は「見に行くもの」であって「最初に目に入るもの」ではないため、
      // 大きな KPI カードではなく 1 行のメトリクス帯に降格する。
      monthlySummary: {
        title: "当月成績サマリ",
        link: "月次レポートを開く",
        contractCount: "契約件数",
        revenue: "売上",
        grossProfit: "粗利",
        appointments: "今週のアポ",
        prevMonthPrefix: "前月",
      },
      thisWeek: {
        title: "今週の催事",
      },
      recentEvents: {
        title: "直近イベント",
        viewAll: "すべて見る →",
        empty: "直近のイベントはありません",
        cols: { date: "日付", name: "イベント名", mode: "体制", status: "ステータス" },
      },
      notificationStatus: {
        title: "通達状況",
        viewAll: "すべて見る →",
        unread: "未読通知",
        pendingPreference: "希望未提出取引先",
        pendingPrecall: "マエカク未対応",
      },
      salesTrend: {
        title: "売上推移（過去 12 ヶ月）",
        viewDetail: "BI ダッシュボードを開く →",
      },
      weekendEvents: {
        title: "今週末のイベント一覧",
        empty: "今週末に予定されているイベントはありません",
        cols: {
          date: "日付",
          name: "イベント名",
          venue: "場所",
          mode: "体制",
          dealers: "担当取引先数",
        },
      },
    },
  },

  // S-052 — マスタ管理ハブ (T-02-10 / docs/04 §1.3).
  // 卸業者本部の `wholesaler_admin` 専用ナビゲーション。shadcn Tabs で
  // 5 タブ（取引先関係 / 施工業者 / インセンティブ率 / キャンセル期限 /
  // 年度開始月）を統合表示する。各タブの中身は T-02-05〜T-02-07 の既存
  // 画面コンテンツを埋め込む。場所提供元 (S-019/S-020) と商品・価格
  // (S-042/S-043) は S-052 のスコープ外（独立画面 /masters/venue-providers
  // /masters/products で実装済）。
  masters: {
    title: "エリア・場所管理",
    subtitle: "業務で参照する各種マスタを一覧・編集できます",
    sectionTitle: "マスタ一覧",
    summary: {
      count: "登録件数",
      lastUpdated: "最終更新",
      neverUpdated: "未登録",
      activeOnly: "（有効分のみ）",
    },
    tabs: {
      dealerRelationships: {
        label: "取引先関係",
        description: "取引先との関係 / 招待コード / スコープデフォルト（後続スプリントで実装）",
      },
      installers: {
        label: "施工業者",
        description: "契約後の施工をアサインする業者マスタ",
      },
      areas: {
        label: "エリア",
        description: "イベント候補登録時に選択するエリアのマスタ",
      },
      stores: {
        label: "店舗",
        description: "イベント候補登録時に選択する店舗のマスタ",
      },
      incentiveRates: {
        label: "インセンティブ率",
        description: "取引先ごとのインセンティブ率（粗利配分）マスタ",
      },
      cancelDeadline: {
        label: "キャンセル期限",
        description: "契約成立日から何日以内をキャンセル受付期間とするかの卸業者単位設定",
      },
      fiscalYear: {
        label: "年度開始月",
        description: "年度集計の起点月（月次集計は暦月固定）",
      },
    },
    dealerRelationshipsPlaceholder: {
      title: "取引先関係マスタは後続スプリントで実装予定です",
      description:
        "F-009（関係一覧 / スコープデフォルト）と F-010（招待コード発行）は SP-03 以降で実装されます。本タブは現時点ではプレースホルダです。",
      currentCount: "現在の関係数",
    },
    embedded: {
      goToDetail: "詳細を開く",
      openFullPage: "一覧画面を開く",
      moreInstallers: "他 {n} 件の施工業者は施工業者一覧画面でご確認ください。",
      moreIncentiveRates: "他 {n} 件の関係は インセンティブ率一覧画面でご確認ください。",
    },
    actions: {
      open: "開く",
    },
  },

  // /masters/relationships — 取引先一覧マスタ（卸業者管理者向け）
  dealerRelationships: {
    title: "取引先一覧",
    subtitle: "卸業者と取引のある取引先の一覧。ステータスとスコープ既定値を管理します。",
    empty: "取引先との関係はまだ登録されていません",
    emptyCta: "招待コードを発行して取引先にサインアップしてもらうと、ここに表示されます",
    fields: {
      dealerName: "取引先名",
      franchiseNo: "加盟店番号",
      status: "ステータス",
      defaultScope: "対応範囲",
      note: "備考",
      createdAt: "登録日",
      updatedAt: "最終更新",
    },
    franchiseNoPlaceholder: "例: ERP12",
    statuses: {
      ACTIVE: "有効",
      SUSPENDED: "停止中",
      // 取引終了（論理削除）。一覧には出さないので、履歴表示用の呼称。
      TERMINATED: "取引終了",
    },
    // 取引先の追加・削除。
    create: {
      trigger: "取引先を追加",
      title: "取引先を追加",
      description: "取引先名を登録すると、この卸業者との取引関係が作成されます。",
      nameLabel: "取引先名",
      namePlaceholder: "例: 株式会社サンプル電設",
      submit: "追加",
      cancel: "キャンセル",
      submitting: "追加中…",
      nameRequired: "取引先名を入力してください",
    },
    remove: {
      trigger: "削除",
      confirmTitle: "この取引先を削除しますか",
      confirmBody:
        "一覧から外れ、新規の担当先として選べなくなります。過去の顧客・契約・スタッフからの参照は残ります。",
      submit: "削除する",
      cancel: "キャンセル",
      submitting: "削除中…",
      columnLabel: "操作",
    },
    scopes: {
      APPOINTMENT_ONLY: "アポ取りまで",
      FIRST_VISIT: "初訪まで",
      FULL_CLOSING: "契約まで",
    },
    actions: {
      saving: "保存中…",
    },
  },

  // S-019 / S-020 — F-011 場所提供元マスタ
  venueProvider: {
    title: "場所提供元マスタ",
    listTitle: "場所提供元一覧",
    new: "場所提供元を新規登録",
    edit: "場所提供元を編集",
    empty: "場所提供元未登録",
    emptyCta: "最初の場所提供元を登録しましょう",
    searchByName: "名称で検索",
    searchByArea: "エリアで検索",
    fields: {
      name: "名称",
      contactName: "担当者",
      phone: "電話",
      email: "メール",
      postalCode: "郵便番号",
      address: "住所",
      area: "エリア",
      contractType: "契約形態",
      fixedFee: "固定費（円）",
      performanceRate: "成果報酬率（%）",
      note: "備考",
      isActive: "有効",
      updatedAt: "最終更新",
    },
    contractTypes: {
      FIXED: "固定費型",
      PERFORMANCE: "成果報酬型",
      OTHER: "その他",
    },
    sections: {
      basic: "基本情報",
      contact: "連絡先",
      address: "住所",
      contract: "契約条件",
      note: "備考",
      history: "変更履歴",
    },
    historyPlaceholder: "変更履歴は後続スプリントで対応予定です。",
    actions: {
      createSubmit: "登録",
      updateSubmit: "保存",
      disable: "このマスタを無効化",
      disableConfirm: "無効化すると新規イベント候補から選択できなくなります。続行しますか？",
    },
    errors: {
      nameRequired: "名称を入力してください",
      fixedFeeRequired: "固定費型では固定費金額が必須です",
      performanceRateRequired: "成果報酬型では成果報酬率が必須です",
    },
  },

  // S-021 / S-022 — F-017 場所提供元対応 (venue negotiation)
  venueNegotiation: {
    title: "場所提供元対応",
    listTitle: "場所提供元対応一覧",
    detailTitle: "場所提供元対応詳細",
    new: "対応を新規起票",
    empty: "対応未登録",
    emptyCta: "最初の場所提供元と調整を始めましょう",
    searchByStoreName: "場所提供元名で検索",
    filterByStatus: "ステータスで絞り込み",
    allStatuses: "すべてのステータス",
    fields: {
      venueProvider: "場所提供元",
      storeName: "店舗名",
      address: "住所",
      candidateDates: "実施候補日",
      decidedDate: "確定日",
      contractType: "契約形態",
      fixedFee: "固定費（円）",
      performanceRate: "成果報酬率（%）",
      conditionNote: "条件メモ",
      status: "ステータス",
      nextAction: "次回アクション",
      assigneeId: "担当者",
      note: "備考・履歴メモ",
      area: "エリア",
      updatedAt: "最終更新",
      reason: "変更理由",
    },
    statuses: {
      NOT_CONTACTED: "未連絡",
      CONTACTING: "調整中",
      CONDITION_REVIEW: "条件確認中",
      FEASIBLE: "実施可",
      INFEASIBLE: "実施不可",
      FIXED: "確定",
      CANCELLED: "中止",
    },
    sections: {
      basic: "基本情報",
      candidateDates: "実施候補日",
      contract: "契約条件",
      condition: "条件メモ",
      status: "ステータス",
      history: "対応履歴",
      promote: "イベント候補に昇格",
    },
    timeline: {
      empty: "対応履歴はまだありません",
    },
    promote: {
      title: "イベント候補に昇格",
      description:
        "確定した場所提供元対応をイベント候補として登録します。回答期限までに取引先の希望を募集します。",
      targetMonth: "対象年月（YYYY-MM）",
      scheduledDate: "実施予定日",
      storeName: "店舗名",
      address: "住所",
      area: "エリア",
      deadlineAt: "回答期限",
      submit: "イベント候補として登録",
      requiresFixed: "ステータスを「確定」にしてからご利用ください",
    },
    actions: {
      createSubmit: "登録",
      updateSubmit: "保存",
      changeStatus: "ステータスを変更",
      changing: "変更中…",
      promote: "イベント候補に昇格",
      promoting: "登録中…",
    },
    errors: {
      venueProviderRequired: "場所提供元を選択してください",
      candidateDateRequired: "候補日を 1 件以上入力してください",
      invalidStateTransition: "この状態からその状態への変更はできません",
      promoteRequiresFixed: "場所提供元対応が「確定」のときのみイベント候補に昇格できます",
      storeNameRequired: "店舗名を入力してください",
      targetMonthFormat: "対象年月は YYYY-MM 形式で入力してください",
      statusRequired: "遷移先のステータスを選択してください",
      invalidDate: "日付の形式が正しくありません",
    },
  },

  // S-023 / S-024 — F-018 イベント候補登録・編集
  //
  // 卸業者本部 (wholesaler_admin / wholesaler_event_team) 専用画面。
  // 内部メモ・固定費・成果報酬率は取引先から不可視（DTO 物理除外、T-03-03）。
  eventCandidate: {
    title: "イベント候補",
    listTitle: "イベント候補一覧",
    detailTitle: "イベント候補詳細",
    new: "イベント候補を新規登録",
    empty: "イベント候補未登録",
    emptyCta: "場所提供元対応からイベント化、または直接新規登録できます",
    filterByStatus: "ステータスで絞り込み",
    filterByTargetMonth: "対象年月で絞り込み",
    allStatuses: "すべてのステータス",
    internalOnlyNotice: "このセクションは卸業者専用です（取引先には公開されません）",
    /** 開催場所は店舗マスタが正本であることを画面に出す（同じ店舗が増殖しないように）。 */
    storeHint: "住所・場所提供元・開催エリアは、選んだ店舗の登録内容から決まります",
    /** マスタが改称されても、過去の開催記録は上書きしない。 */
    storeRenamed: "現在の店舗マスタ上の名称: {name}",
    storeMasterLink: "店舗マスタを開く",
    storeUnregistered: "候補に無い店舗は、先に店舗マスタへ登録してください",
    fields: {
      venueProvider: "場所提供元",
      venueNegotiation: "場所提供元対応",
      targetMonth: "対象年月（YYYY-MM）",
      scheduledDate: "実施予定日",
      /** 店舗マスタから選ぶ開催場所。住所・場所提供元・開催エリアはこの選択から決まる。 */
      store: "開催店舗",
      storeName: "店舗名",
      address: "住所",
      area: "開催エリア",
      deadlineAt: "回答期限",
      contractType: "場所提供元との契約形態",
      fixedFee: "固定費（円・内部）",
      performanceRate: "成果報酬率（%・内部）",
      internalNote: "卸業者内部メモ",
      status: "ステータス",
      publishedAt: "公開日時",
      updatedAt: "最終更新",
      reason: "変更理由",
      perDayFee: "日当たりの報酬額（円）",
      revenueRate: "売上に対する報酬率（%）",
      contractNote: "メモ",
      venueChain: "催事種別",
      boothArea: "ブース場所",
      boothAreaNote: "ブース場所（その他の内容）",
      productCategory: "商材種別",
    },
    // 催事種別（店舗チェーン）
    venueChains: {
      CAINZ_W: "カインズW",
      CAINZ_V: "カインズV",
      SHIMACHU: "島忠",
      KOMERI: "コメリ",
      OTHER: "その他",
    },
    // ブース場所（施設内エリア）。エリア（地域）とは別項目。
    boothAreas: {
      ENTRANCE: "店頭入口付近",
      REFORM_CORNER: "リフォームコーナー付近",
      OTHER: "その他",
    },
    productCategories: {
      HOUSING_EQUIPMENT: "住設設備",
      REAL_ESTATE: "不動産",
    },
    boothAreaNotePlaceholder: "例）園芸コーナー横 特設スペース",
    statuses: {
      DRAFT: "下書き",
      OPEN: "希望受付中",
      CLOSED: "希望受付終了",
      DECIDED: "開催体制決定済み",
      CANCELLED: "中止",
    },
    sections: {
      basic: "基本情報",
      schedule: "対象月・実施日・期限",
      contract: "場所提供元との契約条件",
      internal: "卸業者内部メモ",
      status: "ステータス",
      visibility: "取引先共有設定",
      history: "対応履歴",
    },
    actions: {
      createSubmit: "登録",
      updateSubmit: "保存",
      publish: "希望受付を開始（公開）",
      publishing: "公開中…",
      closePreference: "希望受付を終了",
      closing: "終了処理中…",
      reopen: "期限延長（再受付）",
      cancel: "イベント候補を中止",
      cancelConfirm: "中止すると元には戻せません（編集不可になります）。続行しますか？",
      cancelling: "中止処理中…",
    },
    visibility: {
      heading: "取引先共有設定",
      description:
        "公開する取引先をチェックして「公開する」ボタンを押すと、対象の取引先にイベント候補が表示されます。固定費・成果報酬率・卸業者内部メモは取引先には公開されません。",
      draftDisabledNotice:
        "下書き状態では公開できません。先にイベント候補を「希望受付を開始（公開）」してください。",
      noRelationships:
        "アクティブな取引先関係がありません。先に取引先を登録・関係を有効化してください。",
      tableHeaderSelect: "選択",
      tableHeaderDealer: "取引先",
      tableHeaderStatus: "現在の公開状態",
      published: "公開中",
      notPublished: "未公開",
      revoked: "公開取消済み",
      bulkSelectAll: "すべて選択",
      bulkClear: "選択を解除",
      publishSelected: "公開する",
      publishing: "公開処理中…",
      unpublishSelected: "公開取消",
      unpublishing: "公開取消処理中…",
      publishedToast: "対象の取引先に公開しました",
      unpublishedToast: "公開を取り消しました",
      selectAtLeastOne: "対象の取引先を 1 件以上選択してください",
    },
    errors: {
      targetMonthRequired: "対象年月を入力してください",
      targetMonthFormat: "対象年月は YYYY-MM 形式で入力してください",
      scheduledDateRequired: "実施予定日を入力してください",
      storeNameRequired: "店舗名を入力してください",
      storeRequired: "開催店舗を選択してください",
      deadlineAtRequired: "回答期限を入力してください",
      invalidStateTransition: "この状態からその状態への変更はできません",
      nonDraftEditForbidden: "公開後は回答期限と内部メモのみ編集できます",
    },
  },

  // S-025 / S-026 — F-022 取引先希望状況確認 (T-03-07 / docs/04 §1.3).
  //
  // 卸業者本部 (wholesaler_admin / wholesaler_event_team) 専用の集計画面。
  // 「取引先別」「店舗別」の 2 ビュー。期限超過の未提出取引先は `destructive`
  // バッジで強調表示する（docs/02 §F-022 受入基準）。
  eventCandidatePreferences: {
    title: "取引先希望状況",
    subtitle: "公開対象の取引先ごとに提出状況を一覧表示します。",
    backToCandidate: "イベント候補詳細へ戻る",
    deadlineLine: "回答期限",
    deadlinePassedBanner: "回答期限を過ぎました。未提出の取引先は提出できません。",
    storeLine: "対象店舗",
    targetMonthLine: "対象年月",
    scheduledDateLine: "実施予定日",
    totals: {
      visible: "公開対象",
      submitted: "提出済み",
      pending: "未提出（期限内）",
      overdue: "未提出（期限超過）",
    },
    tabs: {
      byDealer: "取引先別",
      byStore: "店舗別",
    },
    byDealer: {
      heading: "取引先別 提出状況",
      empty: "公開対象の取引先がありません。先にイベント候補詳細から取引先共有を行ってください。",
      columns: {
        dealer: "取引先",
        status: "提出状況",
        priority: "優先順位",
        availablePeople: "対応可能人数",
        availableDates: "対応可能日",
        submittedAt: "提出日時",
        comment: "コメント",
      },
    },
    byStore: {
      heading: "店舗別 提出状況",
      description:
        "1 つのイベント候補は 1 店舗に対応します。複数店舗の比較は対象年月単位の月次サマリ（実装予定）で確認してください。",
      columns: {
        store: "店舗名",
        scheduledDate: "実施予定日",
        submitted: "提出済み",
        pending: "未提出（期限内）",
        overdue: "未提出（期限超過）",
      },
    },
    statuses: {
      SUBMITTED: "提出済み",
      PENDING: "未提出",
      OVERDUE: "期限超過",
    },
    none: "—",
  },

  // S-059 — F-020 取引先向けイベント候補閲覧 (T-03-05 / docs/04 §1.5).
  //
  // 取引先メンバ (dealer_admin / dealer_staff) のみが参照する画面。卸業者の
  // 内部情報 (固定費 / 成果報酬率 / 内部メモ / 他社取引先の希望状況) は
  // `EventCandidateForDealerDto` で物理除外しているため、表示する文字列も
  // 卸業者画面と完全に分離する（同じ "イベント候補" でも視点が異なるため）。
  eventCandidateDealer: {
    title: "公開中のイベント候補",
    subtitle:
      "卸業者から公開されているイベント候補です。希望提出ボタンから対象店舗を選んで応募できます。",
    filterByTargetMonth: "対象年月で絞り込み",
    filterByWholesaler: "卸業者で絞り込み",
    allWholesalers: "すべての卸業者",
    empty: "現在、公開中のイベント候補はありません",
    emptyHint: "卸業者から新しい候補が公開されると、ここに表示されます。",
    monthGroupPrefix: "対象年月：",
    fields: {
      wholesaler: "卸業者",
      scheduledDate: "実施予定日",
      storeName: "店舗名",
      area: "エリア",
      address: "住所",
      deadlineAt: "希望提出期限",
      publishedAt: "公開日時",
    },
    submitPreference: "希望提出",
    deadlinePassed: "希望提出期限を過ぎています",
  },

  // S-060 — F-021 取引先希望店舗回答 (T-03-06 / docs/04 §1.5).
  //
  // 取引先 (dealer_admin / dealer_staff) が公開中イベント候補に対して希望を
  // 提出するフォーム。本画面は単一 EventCandidate に対する希望の submit /
  // update / withdraw に責務を限定し、F-021 「1 件以上の候補」要件は複数候補
  // を順に経由する形で UI 側で担保する。期限超過 / 候補 status NOT OPEN 時は
  // 入力 UI を disabled 表示するが、サーバ側 (`submitPreferenceAction`) でも
  // 必ず再検証する。
  dealerPreference: {
    title: "希望回答",
    subtitle:
      "このイベント候補に対する優先度・対応可能日・対応可能人数などを入力してください。期限内であれば何度でも更新できます。",
    candidateHeader: "対象イベント候補",
    deadlineLine: "回答期限",
    scheduledDateLine: "実施予定日",
    targetMonthLine: "対象年月",
    storeNameLine: "店舗名",
    areaLine: "エリア",
    addressLine: "住所",
    wholesalerLine: "卸業者",
    deadlinePassedBanner: "回答期限を過ぎました。希望の新規提出・編集・取り下げはできません。",
    candidateClosedBanner:
      "このイベント候補は希望受付中ではありません。提出・取り下げはできません。",
    existingHeader: "現在の提出内容",
    notSubmittedYet: "まだ希望を提出していません。",
    submittedAtLabel: "最終提出日時",
    formHeader: "希望内容を入力",
    fields: {
      priority: "優先順位（任意、0〜3）",
      availableDates: "対応可能日（任意、改行で区切る YYYY-MM-DD）",
      availableDatesHint: "例: 2026-06-15",
      staffCount: "対応可能人数（任意、人）",
      note: "コメント（任意）",
    },
    actions: {
      submit: "希望を提出",
      submitting: "提出中…",
      update: "希望を更新",
      updating: "更新中…",
      withdraw: "提出を取り下げる",
      withdrawing: "取り下げ中…",
      withdrawConfirm: "提出済みの希望を取り下げます。よろしいですか？",
    },
    feedback: {
      submitted: "希望を提出しました",
      updated: "希望を更新しました",
      withdrawn: "希望を取り下げました",
      deadlinePassed: "回答期限を過ぎているため操作できません",
      invalidDate: "日付の形式が正しくありません（YYYY-MM-DD で入力）",
      invalidPriority: "優先順位は 0 以上の整数で入力してください",
      invalidStaffCount: "対応可能人数は 0 以上の整数で入力してください",
    },
  },

  // S-042 / S-043 — F-012 商品・価格マスタ
  product: {
    title: "商品・価格マスタ",
    listTitle: "商品一覧",
    new: "商品を新規登録",
    edit: "商品情報を編集",
    revise: "価格改定",
    history: "価格改定履歴",
    empty: "商品未登録",
    emptyCta: "最初の商品を登録しましょう",
    searchByMaker: "メーカーで検索",
    filterByCategory: "カテゴリで絞り込み",
    allCategories: "すべてのカテゴリ",
    fields: {
      category: "カテゴリ",
      maker: "メーカー",
      name: "商品名",
      modelNo: "型番",
      capacity: "容量",
      unit: "単位",
      purchasePrice: "仕入値（円）",
      dealerPrice: "取引先向け卸値（円）",
      listPrice: "参考売価（円）",
      effectiveFrom: "適用開始日",
      effectiveTo: "適用終了日",
      reason: "改定理由",
      note: "備考",
      isActive: "有効",
      updatedAt: "最終更新",
      changedAt: "変更日時",
      changedBy: "変更者",
    },
    categories: {
      PANEL: "パネル",
      BATTERY: "蓄電池",
      POWER_CONDITIONER: "パワコン",
      MOUNT: "架台",
      OTHER_PART: "その他部材",
      SET: "セット",
      ECO_CUTE: "エコキュート",
      IH: "IH",
      GIFT: "プレゼント品",
    },
    sections: {
      basic: "基本情報",
      specs: "仕様",
      price: "価格",
      effective: "適用期間",
      note: "備考",
      history: "価格改定履歴",
    },
    historyEmpty: "価格改定履歴はまだありません。",
    actions: {
      createSubmit: "登録",
      updateSubmit: "保存",
      reviseSubmit: "価格改定を確定",
      retire: "この商品を廃止",
      retireConfirm: "廃止すると新規契約で選択できなくなります。続行しますか？",
      goToRevise: "価格を改定",
    },
    errors: {
      makerRequired: "メーカーを入力してください",
      nameRequired: "商品名を入力してください",
      unitRequired: "単位を入力してください",
      priceRequired: "価格を入力してください",
      effectiveOrderInvalid: "適用終了日は適用開始日より後にしてください",
      reviseOrderInvalid: "価格改定の適用開始日は既存の適用開始日より後にしてください",
    },
  },

  // S-052 サブ — F-014 インセンティブ率マスタ
  incentiveRate: {
    title: "インセンティブ率マスタ",
    listTitle: "取引先ごとのインセンティブ率",
    new: "インセンティブ率を新規登録",
    edit: "インセンティブ率を編集",
    empty: "インセンティブ率未登録",
    emptyCta: "最初のインセンティブ率を登録しましょう",
    groupBy: "取引先",
    relationshipColumn: "対象関係（取引先）",
    currentRate: "現在の率",
    noCurrentRate: "現在有効な率はありません",
    fields: {
      relationship: "対象関係（取引先）",
      targetType: "対象粗利種別",
      rate: "率（%）",
      effectiveFrom: "適用開始日",
      effectiveTo: "適用終了日",
      note: "備考",
      updatedAt: "最終更新",
    },
    targetTypes: {
      PROJECT_PROFIT: "案件粗利",
      WHOLESALE_PROFIT: "卸粗利",
      MANUAL: "手動指定",
    },
    sections: {
      relationship: "対象関係",
      target: "対象粗利・率",
      effective: "適用期間",
      note: "備考",
    },
    actions: {
      createSubmit: "登録",
      updateSubmit: "保存",
    },
    errors: {
      relationshipRequired: "関係（取引先）を選択してください",
      rateRequired: "率（%）を入力してください",
      effectiveFromRequired: "適用開始日を入力してください",
      effectiveOrderInvalid: "適用終了日は適用開始日より後にしてください",
      noActiveRelationships: "有効な取引先との関係が未登録です。先に関係を登録してください。",
    },
    notices: {
      overlapClose:
        "新規登録時、同じ関係内で適用中（適用終了日未設定）の率があれば、その率は新規率の適用開始日で自動的に締められます。",
      immutableFields: "対象粗利種別と適用開始日は編集できません（時系列の整合性を保つため）。",
    },
  },

  // S-052 サブ — F-015 / F-016 卸業者設定
  wholesalerSettings: {
    title: "卸業者設定",
    subtitle: "キャンセル期限・年度開始月・PII マスキングモードの設定",
    splitSubtitle: {
      cancelDeadline: "契約成立日から何日以内をキャンセル受付期間とするかを設定します。",
      fiscalYear: "年度集計の起点月を設定します。",
    },
    fullSettingsLink: "PII マスキングモードを含む全設定画面を開く",
    fields: {
      cancelDeadlineDays: "キャンセル期限（日数）",
      fiscalYearStartMonth: "年度開始月",
      piiMaskingMode: "PII マスキングモード",
    },
    helpers: {
      cancelDeadlineDays:
        "契約成立日から何日以内であればキャンセル受付・インセンティブ取消となるかを設定します（特商法準拠デフォルト 8 日、1〜90 日）。",
      cancelDeadlineDaysWarning:
        "設定変更は今後成立する契約のみに適用され、過去の契約はそれぞれの契約成立時のキャンセル期限を保持します。",
      fiscalYearStartMonth:
        "年度集計の起点月を設定します（4 月始まり、1 月始まり等）。月次集計は暦月固定です。",
      piiMaskingMode:
        "取引先メンバ向けの顧客 PII（電話・住所・氏名）の表示制御。MASKED は常時マスク、FULL は非マスク、PARTIAL は部分マスク（電話下 4 桁可視・住所と氏名はマスク）です。",
    },
    piiMaskingModes: {
      MASKED: "マスク（既定）",
      FULL: "フル表示",
      PARTIAL: "部分マスク",
    },
    months: {
      "1": "1 月",
      "2": "2 月",
      "3": "3 月",
      "4": "4 月",
      "5": "5 月",
      "6": "6 月",
      "7": "7 月",
      "8": "8 月",
      "9": "9 月",
      "10": "10 月",
      "11": "11 月",
      "12": "12 月",
    },
    sections: {
      cancel: "キャンセル運用",
      fiscalYear: "年度設定",
      privacy: "PII 表示制御",
    },
    actions: {
      save: "保存",
    },
    errors: {
      cancelDeadlineDaysRange: "1〜90 日の範囲で入力してください",
      fiscalYearStartMonthRange: "1〜12 月の範囲で入力してください",
    },
  },

  // S-013 / S-014 / S-015 — F-004 SaaS 運営者: テナント管理
  saasAdminTenant: {
    dashboardTitle: "運営者ダッシュボード",
    dashboardSubtitle: "テナント / ユーザー / 招待状況のサマリ",
    summaryCards: {
      totalTenants: "テナント数",
      activeTenants: "アクティブテナント",
      totalUsers: "アクティブユーザー数",
      pendingInvitations: "未受諾招待数",
    },
    listTitle: "卸業者テナント一覧",
    listSubtitle: "テナントの作成・ステータス・プランを管理",
    new: "卸業者テナントを新規作成",
    empty: "テナント未作成",
    emptyCta: "最初の卸業者テナントを作成しましょう",
    detailTitle: "卸業者テナント詳細",
    backToList: "テナント一覧へ戻る",
    fields: {
      name: "テナント名",
      type: "種別",
      plan: "プラン",
      status: "ステータス",
      adminEmail: "全体管理者メール",
      adminName: "全体管理者氏名",
      userCount: "ユーザー数",
      createdAt: "作成日",
      updatedAt: "最終更新",
    },
    types: {
      WHOLESALER: "卸業者",
      DEALER: "取引先",
    },
    plans: {
      PILOT: "パイロット",
      SMALL: "小",
      MEDIUM: "中",
      LARGE: "大",
    },
    statuses: {
      ACTIVE: "アクティブ",
      SUSPENDED: "停止中",
    },
    filters: {
      type: "種別で絞り込み",
      plan: "プランで絞り込み",
      status: "ステータスで絞り込み",
      all: "すべて",
    },
    sections: {
      basic: "基本情報",
      admin: "全体管理者",
      invitation: "招待状態",
      lifecycle: "ステータス操作",
    },
    invitation: {
      pending: "招待未受諾",
      accepted: "招待受諾済み",
      expired: "招待期限切れ",
      none: "招待情報なし",
      sentAt: "招待送信日時",
      expiresAt: "招待期限",
      acceptedAt: "受諾日時",
      resend: "招待を再発行",
      resending: "再発行中…",
      resendUnavailable: "現在の招待が有効期間内です。期限経過後（7 日後）に再発行できます。",
      resendSuccess: "招待を再発行しました",
    },
    lifecycle: {
      suspend: "テナントを停止",
      activate: "テナントを再開",
      suspendConfirm:
        "停止するとこのテナントの全ユーザーがログインできなくなります。続行しますか？",
      activateConfirm: "テナントを再開します。続行しますか？",
      suspended: "停止しました",
      activated: "再開しました",
    },
    actions: {
      createSubmit: "テナントを作成",
      creating: "作成中…",
    },
    errors: {
      duplicateEmail:
        "同一メールアドレスで既に管理者ユーザーが存在します。別のメールを指定してください。",
      nameRequired: "テナント名を入力してください",
      adminEmailRequired: "管理者メールを入力してください",
      adminNameRequired: "管理者氏名を入力してください",
    },
  },

  // S-016 / S-017 — F-005 SaaS 運営者: プラン管理 + 請求状況
  saasAdminPlan: {
    listTitle: "プラン管理",
    listSubtitle: "卸業者テナントの現行プランと直近変更日",
    detailTitle: "プラン変更履歴",
    backToList: "プラン一覧へ戻る",
    billingTitle: "請求状況（オフライン記録）",
    billingSubtitle: "請求書発行・決済は本システム外。プラン変更履歴のメモを参照します。",
    sections: {
      current: "現在のプラン",
      apply: "新プランを適用",
      history: "変更履歴",
    },
    fields: {
      name: "テナント名",
      type: "種別",
      currentPlan: "現在プラン",
      newPlan: "新プラン",
      effectiveFrom: "適用開始日",
      changedAt: "変更日時",
      changedBy: "変更者",
      planBefore: "変更前",
      planAfter: "変更後",
      note: "メモ",
      status: "ステータス",
      lastChangedAt: "直近プラン変更日",
      latestNote: "直近メモ",
    },
    empty: "プラン管理対象のテナントがありません",
    noHistory: "プラン変更履歴はまだありません。",
    actions: {
      apply: "プラン変更を適用",
      applying: "適用中…",
    },
    notices: {
      external:
        "請求書発行・決済はオフライン運用です。本画面ではプラン適用と変更履歴のみを管理します。",
      noOp: "同じプランへの変更は記録されません（履歴・監査ログともに無変更）。",
    },
    errors: {
      tenantIdRequired: "テナント ID を指定してください",
      planRequired: "新プランを選択してください",
      noteTooLong: "メモは 2000 文字以内で入力してください",
    },
  },

  // S-052 サブ — F-013 施工業者マスタ
  installer: {
    title: "施工業者マスタ",
    listTitle: "施工業者一覧",
    new: "施工業者を新規登録",
    edit: "施工業者を編集",
    empty: "施工業者未登録",
    emptyCta: "最初の施工業者を登録しましょう",
    searchByName: "名称で検索",
    fields: {
      name: "名称",
      contactName: "担当者",
      phone: "電話",
      email: "メール",
      area: "対応エリア",
      isActive: "有効",
      updatedAt: "最終更新",
    },
    sections: {
      basic: "基本情報",
      contact: "連絡先",
      coverage: "対応エリア",
    },
    actions: {
      createSubmit: "登録",
      updateSubmit: "保存",
      disable: "このマスタを無効化",
      disableConfirm:
        "無効化すると新規契約で選択できなくなります（過去契約からの参照は維持されます）。続行しますか？",
    },
    errors: {
      nameRequired: "名称を入力してください",
    },
  },

  // エリアマスタ — イベント候補登録時のエリア選択肢を管理する。
  // installer マスタと同じ構造（一覧 / 新規 / 編集 / 論理停止）。
  areaMaster: {
    title: "エリアマスタ",
    listTitle: "エリア一覧",
    new: "エリアを新規登録",
    edit: "エリアを編集",
    empty: "エリア未登録",
    emptyCta: "最初のエリアを登録しましょう",
    searchByName: "名称で検索",
    fields: {
      name: "名称",
      isActive: "有効",
      updatedAt: "最終更新",
    },
    sections: {
      basic: "基本情報",
    },
    actions: {
      createSubmit: "登録",
      updateSubmit: "保存",
      disable: "このエリアを無効化",
      disableConfirm: "無効化すると新規イベント候補で選択できなくなります。続行しますか？",
    },
    errors: {
      nameRequired: "名称を入力してください",
    },
  },

  storeMaster: {
    title: "店舗マスタ",
    listTitle: "店舗一覧",
    new: "店舗を新規登録",
    edit: "店舗を編集",
    empty: "店舗未登録",
    emptyCta: "最初の店舗を登録しましょう",
    searchByName: "名称で検索",
    /** 所在地・開催エリアがイベント登録の正本であることを画面に出す。 */
    venueHint: "住所と開催エリアは、イベント登録の初期値になります。",
    /** エリア・場所管理の主画面。都道府県の一覧ではなく、実際の開催場所を最初に出す。 */
    venueSection: {
      title: "開催場所・店舗",
      description: "実際に催事を行う場所を、所在地・管理エリア・場所提供元とあわせて管理します。",
    },
    noAddress: "住所未登録",
    filters: {
      keyword: "店舗名・住所",
      keywordPlaceholder: "店舗名や住所の一部",
      all: "すべて",
      clear: "条件をクリア",
      resultCount: "{n}件",
    },
    columns: {
      store: "店舗・開催場所",
      location: "所在地",
      related: "関連",
      events: "催事 {n}件",
      preferences: "出店希望 {n}件",
    },
    /** 詳細の関連セクション。 */
    relatedPreferences: "この店舗への出店希望",
    relatedPreferencesEmpty: "この店舗を希望する提出はまだありません",
    relatedPreferencesHint:
      "店舗マスタに紐付いた希望だけが出ます（名称が似ているだけの希望は混ぜません）。",
    laneAndPriority: "{lane} レーン目 / 第{priority}希望",
    venueLabelAtSubmit: "提出時の希望場所名",
    fields: {
      name: "名称",
      postalCode: "郵便番号",
      address: "住所",
      area: "開催エリア",
      venueProvider: "場所提供元",
      isActive: "有効",
      updatedAt: "最終更新",
    },
    sections: {
      basic: "基本情報",
      relatedEvents: "この店舗の催事",
    },
    relatedEventsEmpty: "この店舗に紐づく催事はまだありません",
    relatedEventsHint: "店舗マスタから登録した催事だけが出ます（店舗名の一致では紐付けません）。",
    storeNameAtEvent: "開催当時の店舗名",
    actions: {
      createSubmit: "登録",
      updateSubmit: "保存",
      disable: "この店舗を無効化",
      disableConfirm: "無効化すると新規イベント候補で選択できなくなります。続行しますか？",
    },
    errors: {
      nameRequired: "名称を入力してください",
    },
  },

  // S-027 — F-023 イベント開催体制決定 (T-03-08 / docs/04 §1.3 S-027).
  //
  // 卸業者本部 (wholesaler_admin / wholesaler_event_team) が EventCandidate
  // (OPEN or CLOSED) の体制を決定する画面。mode 別に動的フォームを表示し、
  // CANCELLED 以外では Event + EventDealer + EventChange を生成する。
  eventDecision: {
    title: "開催体制決定",
    subtitle: "このイベント候補の開催体制を決定してください",
    backToCandidate: "イベント候補詳細へ戻る",
    candidateInfo: "イベント候補概要",
    preferencesSummary: "希望提出状況",
    fields: {
      mode: "開催体制",
      requiredPeople: "必要人数",
      dealerRelationshipIds: "担当取引先",
      reason: "中止理由",
      note: "備考",
    },
    modes: {
      SELF: "自社開催",
      DEALER: "取引先開催",
      JOINT: "共同開催",
      CANCELLED: "中止",
    },
    modeDescriptions: {
      SELF: "自社スタッフのみで開催します。必要人数を入力してください。",
      DEALER: "担当取引先が単独で開催します。担当取引先を選択してください。",
      JOINT: "自社と担当取引先が共同で開催します。必要人数と担当取引先を入力してください。",
      CANCELLED: "このイベント候補を中止します。イベントは作成されません。",
    },
    preferenceStatus: {
      submitted: "提出済み",
      notSubmitted: "未提出",
      heading: "希望提出状況サマリ",
      submittedDealers: "提出済み取引先",
      notSubmittedDealers: "未提出取引先",
      noPreferences: "希望提出がありません",
    },
    actions: {
      submit: "決定して通知",
      submitting: "決定中…",
      confirmTitle: "開催体制を決定しますか？",
      confirmDescription: "決定後は体制変更が必要な場合、別途変更操作が必要です。",
      confirmCancelled: "このイベント候補を中止します。中止後は元に戻せません。続行しますか？",
      confirm: "決定する",
      cancelAction: "キャンセル",
    },
    hints: {
      cancelledNoEvent: "中止を選択した場合、イベントは作成されません。",
      redirectToShifts: "決定後、自社・共同開催の場合はシフト管理画面に遷移します。",
    },
    placeholders: {
      requiredPeople: "例: 3",
      reason: "中止理由を入力してください",
    },
    decideLinkText: "開催体制を決定する",
    errors: {
      requiredPeopleRequired: "自社開催・共同開催では必要人数（1以上）を入力してください",
      dealerRequired: "取引先開催・共同開催では担当取引先を 1 件以上選択してください",
      reasonRequired: "中止の場合は理由を入力してください",
      invalidStatus: "OPEN または CLOSED 状態のイベント候補のみ開催体制を決定できます",
    },
    success: {
      decided: "開催体制を決定しました",
      cancelled: "イベント候補を中止しました",
    },
    changeMode: {
      confirmTitle: "開催体制を変更しますか？",
      confirmDescription: "変更前後の差分は変更履歴に記録されます。",
    },
    scopeOverride: {
      title: "取引先スコープ上書き",
      subtitle:
        "このイベントの担当取引先のスコープを個別に上書きできます。未設定の場合は関係のデフォルトスコープが適用されます。",
      fields: {
        scope: "スコープ",
        reason: "変更理由",
      },
      scopes: {
        APPOINTMENT_ONLY: "アポ獲得まで",
        FIRST_VISIT: "初回訪問まで",
        FULL_CLOSING: "商談・クロージングまで",
      },
      scopeNone: "デフォルト（関係設定を使用）",
      actions: {
        save: "上書き設定を保存",
        saving: "保存中…",
        clear: "上書きをクリア（デフォルトに戻す）",
      },
      errors: {
        reasonRequired: "変更理由を入力してください",
        eventDealerNotFound: "指定した担当取引先がこのイベントに存在しません",
      },
      success: {
        updated: "スコープ上書きを保存しました",
        cleared: "スコープ上書きをクリアしました",
      },
    },
  },
  // S-028 — F-025 自社要員シフト割当 (T-03-10 / docs/04 §1.3 S-028).
  //
  // 卸業者本部 (wholesaler_admin / wholesaler_event_team) 専用画面。
  // Event ヘッダー + シフト一覧テーブル + 必要人数充足バッジ。
  // シフト追加・編集は shadcn Dialog 経由。
  eventShift: {
    title: "シフト管理",
    subtitle: "自社要員のシフトを割り当てます",
    backToEvent: "イベント一覧へ戻る",
    eventInfo: "イベント情報",
    fields: {
      user: "担当者",
      role: "役割",
      startPlanned: "開始時刻（予定）",
      endPlanned: "終了時刻（予定）",
      status: "ステータス",
    },
    roles: {
      LEAD: "リーダー",
      CATCH: "キャッチ",
      RECEPTION: "受付",
      PITCH: "ピッチ",
      OTHER: "その他",
    },
    statuses: {
      ASSIGNED: "割当済",
      CHECKED_IN: "チェックイン済",
      CHECKED_OUT: "チェックアウト済",
      NO_SHOW: "無断欠席",
    },
    staffCount: {
      label: "充足状況",
      badge: "{current}/{required} 人",
      fulfilled: "充足",
      insufficient: "不足",
      noRequirement: "人数設定なし",
    },
    table: {
      empty: "シフトがまだ割り当てられていません",
      columns: {
        user: "担当者",
        role: "役割",
        startPlanned: "開始（予定）",
        endPlanned: "終了（予定）",
        status: "状態",
        actions: "操作",
      },
    },
    placeholders: {
      selectDefault: "— 選択してください —",
    },
    addDialog: {
      title: "シフトを追加",
    },
    editDialog: {
      title: "シフトを編集",
    },
    actions: {
      add: "シフトを追加",
      edit: "編集",
      unassign: "削除",
      unassignConfirm: "このシフトを削除します。続行しますか？",
      save: "保存",
      saving: "保存中…",
    },
    errors: {
      userRequired: "担当者を選択してください",
      roleRequired: "役割を選択してください",
      startRequired: "開始時刻を入力してください",
      endRequired: "終了時刻を入力してください",
      endBeforeStart: "終了時刻は開始時刻より後にしてください",
      overlap: "この時間帯に既にシフトが割り当てられています",
    },
    feedback: {
      assigned: "シフトを追加しました",
      updated: "シフトを更新しました",
      unassigned: "シフトを削除しました",
    },
  },
  // S-053 — 現場要員ダッシュボード / S-054 — 自分のシフト一覧
  // (T-03-11 / F-026 / docs/04 §1.4).
  //
  // wholesaler_field_staff のスマホ向けダッシュボードと期間フィルタ付き
  // シフト一覧画面。当日分は最上段固定 + border-primary で視覚強調。
  fieldShift: {
    dashboardTitle: "現場ダッシュボード",
    dashboardSubtitle: "今日の割当シフトと今週の予定を確認します",
    shiftListTitle: "シフト一覧",
    shiftListSubtitle: "期間を指定してシフトを確認できます",
    todaySection: "本日のシフト",
    thisWeekSection: "今週のシフト",
    noShiftsToday: "本日のシフトはありません",
    noShiftsInPeriod: "指定期間にシフトはありません",
    filter: {
      today: "今日",
      thisWeek: "今週",
      custom: "期間指定",
      from: "開始日",
      to: "終了日",
      apply: "適用",
    },
    card: {
      storeName: "店舗名",
      area: "エリア",
      address: "住所",
      scheduledDate: "実施日",
      startPlanned: "開始（予定）",
      endPlanned: "終了（予定）",
      role: "役割",
      status: "状態",
      eventStatus: "イベント状態",
    },
    roles: {
      LEAD: "リーダー",
      CATCH: "キャッチ",
      RECEPTION: "受付",
      PITCH: "ピッチ",
      OTHER: "その他",
    },
    statuses: {
      ASSIGNED: "割当済",
      CHECKED_IN: "チェックイン済",
      CHECKED_OUT: "チェックアウト済",
      NO_SHOW: "無断欠席",
    },
    eventStatuses: {
      PLANNED: "開催予定",
      ONGOING: "開催中",
      CLOSED: "終了",
      CANCELLED: "中止",
    },
    todayBadge: "本日",
    loading: "シフトを読み込んでいます…",
  },
  // S-029 unified — イベント一覧（週次カレンダー + テーブル統合ビュー）
  eventList: {
    title: "単発イベント一覧",
    subtitleWeekly: "週ごとのイベント状況を確認できます",
    subtitleMonthly: "期間を指定してイベントを一覧できます",
    newEvent: "イベント登録",
    weeklyCalendar: "週次カレンダー",
    weekLabel: "{start} 〜 {end}",
    selectedWeekEvents: "選択週のイベント一覧",
    selectedDateEvents: "選択日のイベント一覧",
    selectedWeekRange: "対象: {start} 〜 {end}",
    selectedDateLabel: "対象: {date}",
    empty: "該当するイベントはありません",
    columns: {
      scheduledDate: "開催日時",
      area: "エリア",
      venue: "開催場所・店舗",
      holdingStatus: "開催ステータス",
      assignStatus: "アサインステータス",
    },
    holdingStatuses: {
      confirmed: "確定",
      pending: "確認中",
      cancelled: "中止",
    },
    assignStatuses: {
      confirmed: "確定",
      pending: "確認中",
    },
    dayLabels: {
      mon: "月",
      tue: "火",
      wed: "水",
      thu: "木",
      fri: "金",
      sat: "土",
      sun: "日",
    },
    eventCount: "{n}件",
    totalEvents: "総イベント件数",
    confirmed: "開催確定",
    prospective: "開催見込み",
    unassigned: "未アサイン",
    // 週次カレンダーの日セル。人が足りている日／催事が無い日を静かに示す。
    allAssigned: "アサイン済",
    noEvents: "—",
    prevWeek: "前週",
    nextWeek: "次週",
    thisWeek: "今週",
    clearSelection: "選択をクリア",
    weeklyView: "週次表示",
    monthlyView: "月次表示",
    monthlyListTitle: "イベント一覧",
    filter: {
      period: "期間",
      venue: "場所",
      allVenues: "すべて",
      all: "すべて",
      clear: "クリア",
      resultCount: "件",
    },
    appointmentInfo: "アポ取り情報（顧客アポイント情報）",
    appointmentPlaceholder: "この催事で獲得したアポイントはまだありません",
    appointmentColumns: {
      customerName: "顧客名",
      dateTime: "アポイント日時",
      address: "住所",
      /** 獲得したパートナー会社。自社獲得なら「—」。 */
      company: "獲得した会社",
      memo: "メモ",
    },
    assignPendingNote: "開催体制が決定されると、アサイン情報がここに表示されます",
    decideLink: "開催体制を決定する →",
    eventDetailTitle: "イベント詳細",
    editButton: "編集",
    dateTime: "日時",
    holdingStatusLabel: "開催ステータス",
    assignColumns: {
      name: "担当者名",
      affiliation: "所属",
      status: "アサインステータス",
    },
    assignStatusOptions: {
      confirmed: "確定",
      adjusting: "調整中",
    },
    addAssign: "アサイン設定",
    assignNotAvailable: "開催体制が決定されると担当者をアサインできます",
    affiliationSelf: "自社",
    affiliationDealer: "取引先",
    assignNamePlaceholder: "担当者名を入力",
    assignDialogTitle: "アサイン設定",
    assignModeLabel: "開催体制",
    assignModeSelf: "自社開催",
    assignModeDealer: "取引先開催",
    assignModeJoint: "混合開催",
    assignSelectStaff: "自社要員を選択",
    assignDealerName: "取引先事業者名",
    assignDealerNamePlaceholder: "事業者名を入力",
    assignOverallStatus: "アサインステータス",
    assignMemo: "メモ",
    assignMemoPlaceholder: "メモを入力",
    assignSave: "保存",
    reportSection: "レポート",
    reportColumns: {
      type: "報告種別",
      submitter: "提出者",
      submittedAt: "提出日時",
      memo: "メモ",
    },
    reportStart: "開始報告",
    reportEnd: "終了報告",
    reportResult: "成果報告",
    reportNotSubmitted: "未提出",
    reportSubmitted: "提出済",
    noReports: "報告はまだありません",
  },

  // レーンイベント — F-059. 懇意の場所提供元と月単位で複数開催日を契約する
  // イベント。卸業者本部 (wholesaler_admin / wholesaler_event_team) 専用画面。
  // 単発イベントと並ぶ機能。仕入値は扱わない（場所提供元との契約条件のみ）。
  lineEvent: {
    title: "レーン一覧",
    subtitle: "場所ごとのレーン契約情報を一覧で確認できます",
    detailTitle: "レーン詳細",
    newLine: "レーン登録",
    empty: "該当するレーンはありません",
    breadcrumbList: "レーンイベント一覧",
    holdingCountSuffix: "回",
    csvExport: "CSV出力",
    filter: {
      month: "対象月",
      venueProvider: "場所提供元",
      allVenueProviders: "すべての場所提供元",
      search: "検索",
      clear: "クリア",
      resultCount: "件",
    },
    columns: {
      venueName: "場所名",
      venueProvider: "場所提供事業者",
      scheduledDates: "開催予定日",
      area: "エリア",
      holdingCount: "開催回数",
      lastUpdated: "最終更新日",
    },
    statuses: {
      DRAFT: "確認中",
      CONFIRMED: "確定",
      CANCELLED: "中止",
    },
    sections: {
      basic: "基本情報",
      schedule: "開催日",
      contract: "契約条件",
      status: "ステータス",
      assign: "アサイン情報",
    },
    calendar: {
      held: "開催日",
      outOfRange: "対象外",
      scheduledDatesHeading: "開催予定日",
      holdingCount: "開催回数",
      note: "備考",
    },
    editSchedule: {
      button: "編集",
      dialogTitle: "開催日を編集",
      save: "保存",
    },
    // 日付ポップアップ。タイトルは「YYYY年M月D日(曜)」。レポート/アポは
    // 単発詳細 (eventList) のラベルを流用し、現状はプレースホルダー表示。
    datePopup: {
      titleFormat: "{year}年{month}月{day}日({dow})",
      reportSection: "レポート",
      appointmentSection: "アポ取り顧客一覧",
    },
    statusUpdate: {
      label: "開催ステータス",
      cancelConfirm: "このレーンを中止しますか？",
    },
    fields: {
      lineName: "レーン名",
      venueName: "場所名",
      venueProvider: "場所提供元",
      area: "エリア",
      address: "住所",
      targetMonth: "対象月",
      scheduledDates: "開催日",
      status: "ステータス",
      contractType: "契約形態",
      perDayFee: "日当たりの報酬額（円）",
      revenueRate: "売上に対する報酬率（%）",
      contractNote: "メモ",
      registeredAt: "登録日時",
      updatedAt: "最終更新",
    },
    form: {
      selectDates: "対象月を選ぶと、その月の開催日を選択できます",
      selectedCount: "{n}日選択中",
    },
    errors: {
      lineNameRequired: "レーン名を入力してください",
      venueNameRequired: "場所名を選択してください",
      targetMonthRequired: "対象月を選択してください",
      scheduledDatesRequired: "開催日を 1 日以上選択してください",
    },
    actions: {
      createSubmit: "登録",
    },
  },

  // S-089 — F-060 取引先レーン希望一覧（アコーディオン）。卸業者ビュー。
  lanePreference: {
    title: "取引先希望一覧",
    subtitle: "取引先ごとのレーン希望を月単位で確認できます",
    empty: "該当する希望提出はありません",
    csvExport: "CSV出力",
    submittedAtLabel: "提出日時",
    noteLabel: "特記事項",
    noNote: "特記事項はありません",
    /** 回答画面（提出内容 + やり取り）への導線。 */
    openDetail: "詳細・回答",
    /** 申告されたレーン数。候補店舗の件数（storeCountBadge）とは別の数。 */
    laneCountBadge: "希望レーン {n}本",
    laneCountUnknown: "希望レーン数 未申告",
    storeCountBadge: "候補店舗 {n}件",
    /** レーン見出し。レーンごとに独立した希望順位を持つ。 */
    laneTitle: "{n} レーン目",
    laneItemsHint: "レーンごとに第一希望から順に並びます。",
    /** 申告レーン数と明細の実レーン数が食い違うとき。数字を黙って合わせない。 */
    laneCountMismatch: "申告は {declared} 本ですが、明細は {actual} 本ぶんです",
    conditionNoteLabel: "この店舗の条件",
    /** マスタ未登録の希望場所。提供元が確かめられないことを明示する。 */
    storeUnlinked: "店舗マスタ未登録（場所提供元は確認できません）",
    statusLabels: {
      DRAFT: "下書き",
      SUBMITTED: "提出済み",
      ANSWERED: "回答済み",
      CONFIRMED: "確定済み",
    },
    /** 採用して確定したイベントとの対応。 */
    adoptionTitle: "採用した開催",
    adoptionEmpty: "まだ採用されていません",
    adoptionOpen: "イベントを開く",
    adoptionSelect: "採用するイベントを選ぶ",
    adoptionSubmit: "採用する",
    adoptionWithdraw: "採用を外す",
    adoptionNoEvents: "この対象月の確定イベントがまだありません",
    adoptionCreateEvent: "イベント管理で催事を登録する",
    /** 希望と違う店舗で採用した場合（代理店からの代替提案）。 */
    adoptionAlternative: "代替提案（希望と違う店舗）",
    adoptionHint: "採用しても開催の確定やスタッフ配置は行われません（催事側の操作のままです）。",
    filter: {
      month: "対象月",
      dealer: "取引先",
      allDealers: "すべての取引先",
      search: "検索",
      clear: "クリア",
      resultCount: "件",
    },
    card: {
      venueLabel: "希望場所",
      venueProvider: "場所提供元",
      store: "店舗",
      desiredDates: "希望開催日",
      memo: "メモ",
      noMemo: "メモなし",
      dayCount: "{n}日",
    },
    priorityLabels: {
      1: "第一希望",
      2: "第二希望",
      3: "第三希望",
      4: "第四希望",
      5: "第五希望",
      // 6 以上は priorityFallback で「第N希望」を生成する。
      fallback: "第{n}希望",
    },
  },

  // 顧客詳細に統合したパートナー会社の提出物（代理店-01）。
  customerDealerSubmissions: {
    title: "パートナー会社からの提出",
    hint: "この顧客に紐付けた、訪問アポ報告と成約報告です。紐付けは内容を確認した人が行います。",
    empty: "この顧客に紐付いた提出はありません",
    visitTitle: "訪問アポ報告",
    contractTitle: "成約報告",
    contractNote:
      "成約報告は「契約済」への変更や正式契約とは別の記録です。金額・粗利・手数料はこの報告からは作られません。",
    submittedAt: "提出",
    linkedAppointment: "アポイントに紐付け済み",
    noAppointment: "アポイント未紐付け（この報告は日時を持ちません）",
    linkedContract: "正式契約に紐付け済み",
    noContract: "正式契約への紐付けなし",
    fields: {
      tossDept: "トス部署",
      closeDept: "クローズ部署",
      salesRep: "営業担当者",
      maekakuOperator: "マエカク実施者",
      contractDate: "ご契約日",
      tossDate: "トス日",
      referralBranch: "取次拠点",
    },
  },

  /**
   * 運営管理サイト（BizOrch 運営管理 / APP_VARIANT=system-admin）。
   *
   * システム提供者が使う画面の文言。業務画面（代理店 / パートナー）とは別に持つ。
   */
  systemAdmin: {
    brand: "BizOrch 運営管理",
    signOut: "サインアウト",
    /** 環境区分。取り違え防止のためヘッダーに常時出す。 */
    envLabel: "環境",
    envLocal: "ローカル",
    envProduction: "本番",
    envUnknown: "未設定",
    operator: "運営者",
    nav: {
      ariaLabel: "運営管理メニュー",
      menuOpen: "メニューを開く",
      menuClose: "メニューを閉じる",
      dashboard: "ダッシュボード",
      companies: "会社管理",
      users: "利用者管理",
      operators: "運営者管理",
      audit: "操作履歴",
      status: "稼働状況",
    },
    common: {
      search: "検索",
      clear: "条件をクリア",
      keyword: "フリーワード",
      keywordHint: "会社名・メールアドレスなどの一部で探せます",
      all: "すべて",
      notSet: "未設定",
      dash: "—",
      save: "保存",
      saving: "保存中…",
      cancel: "キャンセル",
      backToList: "一覧へ戻る",
      detail: "詳細",
      total: "該当 {n}件",
      page: "{page} / {pages} ページ",
      prev: "前へ",
      next: "次へ",
      empty: "該当するデータがありません",
      confirm: "実行",
      /** 取得できない情報を 0 件や正常と書かないための表示。 */
      unavailable: "未取得",
      notConnected: "未連携",
    },
    dashboard: {
      title: "ダッシュボード",
      subtitle: "BizOrch 全体の利用状況と稼働状態です",
      sections: {
        attention: "要対応事項",
        usage: "利用状況",
        statusAndRecent: "稼働状態・直近の操作",
      },
      attentionNone: "対応が必要な項目はありません",
      attention: {
        suspendedCompanies: "利用停止中の会社が {n} 社あります",
        pendingInvitations: "招待中のまま受諾されていない利用者が {n} 件あります",
        siteDown: "応答しないサイトが {n} 件あります",
        noOperatorMfa: "運営者の多要素認証が未強制です（本番公開前の必須要件）",
      },
      metrics: {
        activeCompanies: "利用中の会社",
        suspendedCompanies: "停止中の会社",
        users: "利用者",
        pendingInvitations: "招待中",
      },
      recentTitle: "直近の管理操作",
      recentEmpty: "運営者による操作履歴はまだありません",
      openCompanies: "会社管理へ",
      openUsers: "利用者管理へ",
      openAudit: "操作履歴へ",
      openStatus: "稼働状況へ",
      unit: "社",
      unitUser: "人",
      unitCase: "件",
    },
    company: {
      title: "会社管理",
      subtitle: "代理店・パートナー会社の登録状況と利用状態です",
      detailTitle: "会社詳細",
      newTitle: "パートナー会社を追加",
      addAction: "パートナー会社を追加",
      editTitle: "基本情報を編集",
      columns: {
        name: "会社名",
        type: "区分",
        status: "利用状態",
        userCount: "所属利用者",
        relation: "代理店との関係",
        contact: "連絡先",
        createdAt: "登録日",
      },
      types: { WHOLESALER: "代理店", DEALER: "パートナー会社" },
      statuses: { ACTIVE: "利用中", SUSPENDED: "停止中" },
      fields: {
        name: "会社名",
        contactEmail: "連絡先メールアドレス",
        contactPhone: "連絡先電話番号",
        note: "備考",
      },
      relationNone: "取引関係なし",
      relationWith: "{name} と取引",
      /** 停止・再開。削除とは分ける。 */
      suspend: "利用を停止する",
      resume: "利用を再開する",
      suspendTitle: "利用停止の確認",
      resumeTitle: "利用再開の確認",
      suspendHint:
        "停止してもデータは削除しません。停止中はこの会社の利用者がサインインできなくなります。",
      resumeHint: "停止を解除し、この会社の利用者が再びサインインできるようにします。",
      impactTitle: "影響する範囲",
      impactUsers: "サインインできなくなる利用者: {n} 人",
      impactRelationships: "取引関係: {n} 件（関係そのものは変更しません）",
      impactOthers: "他社への影響: ありません",
      suspendedNotice: "この会社は利用停止中です。所属利用者はサインインできません。",
      errors: {
        notFound: "会社が見つかりません",
        nameRequired: "会社名を入力してください",
        cannotSuspendWholesaler: "代理店の利用停止はこの画面では行えません",
      },
    },
    user: {
      title: "利用者管理",
      subtitle: "各社の利用者アカウントの状態です",
      detailTitle: "利用者詳細",
      columns: {
        name: "氏名",
        email: "ログインメール",
        company: "所属会社",
        roles: "利用区分",
        sites: "利用可能サイト",
        status: "状態",
        lastLoginAt: "最終ログイン",
        salesperson: "販売員との紐付け",
      },
      statuses: {
        INVITED: "招待中",
        ACTIVE: "利用中",
        SUSPENDED: "停止中",
        LOCKED: "ロック中",
      },
      sites: {
        agency: "代理店",
        partner: "パートナー",
        partnerAdmin: "パートナー管理者",
        systemAdmin: "運営管理",
      },
      linkedYes: "紐付けあり（{name}）",
      linkedNo: "紐付けなし",
      neverLoggedIn: "未ログイン",
      invite: "利用者を招待",
      inviteTitle: "利用者を招待",
      inviteHint: "招待メールの代わりに、発行した招待リンクをこの画面に表示します。",
      inviteIssued: "招待リンクを発行しました（この画面でのみ表示します）",
      suspend: "利用を停止",
      resume: "利用を再開",
      revokeSessions: "サインイン中のセッションを失効",
      revokeHint: "この利用者の全セッションを無効にします。次回からは再サインインが必要です。",
      sendReset: "パスワード再設定を案内",
      resetHint: "パスワードそのものは表示しません。再設定用のリンクを発行します。",
      resetIssued: "パスワード再設定リンクを発行しました（この画面でのみ表示します）",
      changeRole: "利用区分を変更",
      relatedAudit: "この利用者に関する操作履歴",
      errors: {
        notFound: "利用者が見つかりません",
        emailRequired: "メールアドレスを入力してください",
        emailTaken: "このメールアドレスは既に使われています",
        roleRequired: "利用区分を選択してください",
      },
    },
    operators: {
      title: "運営者管理",
      subtitle: "運営管理サイトを利用できる人の一覧です",
      columns: {
        name: "氏名",
        email: "ログインメール",
        status: "状態",
        lastLoginAt: "最終ログイン",
      },
      invite: "運営者を招待",
      grant: "運営権限を付与",
      revoke: "運営権限を解除",
      suspend: "利用を停止",
      resume: "利用を再開",
      grantHint: "運営権限の付与・解除はこの画面だけで行います。",
      lastOperatorNotice: "有効な運営管理者が 1 人のため、この操作はできません。",
      errors: {
        notFound: "運営者が見つかりません",
        lastOperator: "最後の有効な運営管理者を無効にすることはできません",
        notOperator: "この利用者は運営者ではありません",
      },
      mfaNotice:
        "運営者の多要素認証は本番公開の必須要件です。現在の実装では強制していません（残課題）。",
    },
    audit: {
      title: "操作履歴",
      subtitle: "運営者による会社・利用者・権限の変更を記録しています",
      columns: {
        createdAt: "日時",
        actor: "操作者",
        target: "対象",
        action: "操作種別",
        changes: "変更項目",
        result: "結果",
      },
      filters: {
        from: "期間（開始）",
        to: "期間（終了）",
        actor: "操作者",
        company: "対象会社",
        action: "操作種別",
      },
      resultOk: "成功",
      /** 失敗は記録しない方針なので、表示もしない。 */
      noChanges: "変更内容なし",
      readOnlyNotice: "この履歴は編集・削除できません。",
      targetTypes: {
        Tenant: "会社",
        User: "利用者",
        UserRole: "権限",
        UserInvitation: "招待",
      },
      actions: {
        CREATE: "作成",
        UPDATE: "更新",
        DELETE: "削除",
        STATUS_CHANGE: "状態変更",
        ROLE_CHANGE: "権限変更",
        RELATION_SUSPEND: "取引停止",
        RELATION_RESUME: "取引再開",
        PUBLISH: "公開",
        UNPUBLISH: "非公開",
        CANCEL: "取消",
        FINALIZE: "確定",
        UNLOCK: "ロック解除",
        MANUAL_ADJUST: "手動調整",
        REVEAL_PII: "個人情報表示",
      },
    },
    status: {
      title: "稼働状況",
      subtitle: "各サイト・データベース・外部連携の状態です",
      checkedAt: "確認日時",
      sitesTitle: "サイト",
      dbTitle: "データベース",
      integrationsTitle: "外部連携",
      columns: { name: "対象", state: "状態", detail: "内容" },
      states: { up: "正常", down: "異常", unknown: "未取得", notConnected: "未連携" },
      dbName: "PostgreSQL",
      notConfiguredHint: "設定されていないため確認していません",
      noMonitoring: "監視基盤は新設していません。この画面はその場で取得した結果を表示します。",
      integrations: {
        email: "メール送信（Resend）",
        storage: "オブジェクトストレージ（Cloudflare R2）",
        sentry: "エラー監視（Sentry）",
      },
    },
  },

  // 旧「パートナー報告」メニューから統合先への案内（代理店-01）。
  integratedViewNotice: {
    keepsPermissions: "表示できる範囲と個人情報の扱いは、これまでと同じです。",
    dealerReports:
      "この一覧の内容は、イベント詳細の「日報・実績（パートナー会社）」からも確認できます。日報は対象の催事・開催日を選んで提出するので、催事に紐付かない日報は新しく増えません。",
    visitAppointments:
      "この一覧の内容は、顧客に紐付けたものは顧客詳細から、アポイントに紐付けたものはアポイント一覧から確認できます。",
    contracts:
      "この一覧の内容は、顧客に紐付けたものは顧客／商談詳細から確認できます。金額・粗利を伴う正式な契約はここからは作られません。",
    links: {
      events: "イベント管理",
      customers: "顧客一覧",
      appointments: "アポイント一覧",
    },
  },

  // イベント詳細に統合したパートナー会社の催事日報（代理店-01）。
  // 独立メニューではなく、催事の「日報・実績」としてここに出す。
  dealerEventReportSection: {
    title: "日報・実績（パートナー会社）",
    hint: "この催事に紐づく、パートナー会社からの催事日報です。",
    empty: "この催事に紐づく日報はまだありません",
    submitter: "提出者",
    areaInFacility: "施設内エリア",
    supersededBadge: "訂正により差し替え済み",
    metrics: {
      lottery: "抽選数",
      seated: "着座数",
      appointment: "アポ数",
      counted: "合計の対象",
      countedValue: "{n}件",
    },
    /** 合計に入れなかった理由と件数。黙って捨てない。 */
    excluded: {
      unknown: "集計単位が未設定のため合計に入れていない報告: {n}件",
      booth: "ブース全体の数値のため別扱いにした報告: {n}件（他社と重複しうるので合算しません）",
      superseded: "訂正で差し替えられた報告: {n}件",
    },
    scopeLabels: {
      PERSON: "個人の実績",
      COMPANY: "会社の合計",
      BOOTH: "ブース全体",
      UNKNOWN: "集計単位 未設定",
    } as Record<string, string>,
  },

  // 手数料管理 — 一覧・設定（ページ内要素は後続で定義。現状はプレースホルダ）。
  commission: {
    list: {
      title: "手数料一覧",
      subtitle: "取引先ごとの手数料を確認できます",
    },
    settings: {
      title: "手数料設定",
      subtitle: "手数料の計算ルールを設定できます",
    },
    placeholder: "この画面は準備中です。",
    // 手数料設定ページ専用ラベル（取引先一覧 / インセンティブ率カード /
    // 適用期間 / 計算プレビュー / 変更履歴）。値は全てクライアント側のサンプル
    // で、保存はプレースホルダ（永続化なし）。
    settingsPage: {
      listTitle: "取引先一覧",
      addRule: "ルール追加",
      columns: {
        dealerName: "取引先名",
        tossUpRate: "トスアップ率",
        closingRate: "クロージング率",
      },
      sections: {
        baseSetting: "インセンティブ基準設定",
        rates: "インセンティブ率",
        applyPeriod: "適用期間",
        preview: "計算プレビュー",
        history: "変更履歴",
      },
      rateCards: {
        tossUp: "トスアップ（紹介のみ）",
        tossUpDesc: "紹介（アポ獲得）のみを担当した場合の率",
        closing: "クロージング（契約完了まで）",
        closingDesc: "契約完了まで対応した場合の率",
      },
      applyPeriod: {
        from: "適用開始日",
        to: "適用終了日",
        noEnd: "終了日なし（現在適用中）",
        noEndHint: "終了日を空欄にすると「終了日なし」となります",
      },
      preview: {
        baseAmount: "基準金額",
        baseAmountPlaceholder: "例: 3,000,000",
        tossUpFee: "トスアップ手数料",
        closingFee: "クロージング手数料",
      },
      historyColumns: {
        date: "日付",
        changedBy: "変更者",
        summary: "内容",
      },
      historyEmpty: "変更履歴はまだありません。",
      save: "保存",
      empty: "取引先が登録されていません",
      percentSuffix: "%",
    },
    // 手数料一覧ページ専用ラベル（フィルタ・列見出し・支払状況・件数）。
    listPage: {
      sectionTitle: "取引先別 手数料",
      filter: {
        targetMonth: "対象月",
        dealer: "取引先",
        allDealers: "すべての取引先",
        paymentStatus: "支払状況",
        all: "すべて",
        search: "検索",
        clear: "クリア",
        csvExport: "CSV出力",
      },
      columns: {
        dealerName: "取引先名",
        targetMonth: "対象月",
        customerCount: "対象顧客数",
        totalFee: "手数料合計",
        paymentStatus: "支払状況",
        updatedAt: "最終更新日",
        expand: "展開",
        customerName: "顧客名",
        contractAmount: "契約金額",
        scope: "対応範囲",
        incentiveRate: "インセンティブ率",
        fee: "手数料金額",
        note: "備考",
      },
      band: {
        customerCount: "顧客数",
        closingCount: "クロージング件数",
        tossUpCount: "トスアップ件数",
        subtotal: "小計",
      },
      scopeLabels: {
        closing: "クロージングまで",
        tossup: "トスアップのみ",
      } as Record<"closing" | "tossup", string>,
      paymentStatusLabels: {
        pending: "未確定",
        unpaid: "未払い",
        partial: "一部支払",
        paid: "支払済",
      } as Record<"pending" | "unpaid" | "partial" | "paid", string>,
      caseCountUnit: "件",
      customerCountUnit: "名",
      empty: "該当する手数料データがありません",
      resultCount: "件",
      // {start}-{end} を {total} 件中で表示。
      rangeOf: "{start}-{end}件 / 全{total}件",
      // 一括支払状況設定ツールバー。{n} は選択件数。
      bulk: {
        selectAll: "全選択",
        selectedCount: "{n}件選択中",
        apply: "一括設定",
      },
      // 展開明細内の調整項目（加算・減算）セクション。
      adjust: {
        title: "調整項目",
        add: "項目追加",
        itemPlaceholder: "項目名",
        amountPlaceholder: "金額",
        total: "合計",
        remove: "削除",
      },
    },
  },

  // 施工一覧 / 申請一覧（サイドバー導線。ページ内要素は後続で定義するプレースホルダ）。
  // スタッフ一覧（設定配下のマスタ画面）。
  // スタッフは認証 User とは別概念で、ログインしない催事販売員も含めて管理する。
  // 所属は Salesperson.relationshipId の有無で判定し、会社名は Relationship /
  // 自テナントから導出する（加盟店名を文字列で複製しない）。
  salespersonList: {
    title: "スタッフ一覧",
    // スタッフ（Salesperson）とシステムユーザー（User）は別管理。
    subtitle: "催事に立つスタッフの管理です（ログインアカウントはシステムユーザー）",
    // スタッフの削除。物理削除ではなく isActive = false の論理削除。
    remove: {
      trigger: "削除",
      confirmTitle: "このスタッフを削除しますか",
      confirmBody:
        "一覧から外れ、新規の担当者として選べなくなります。過去の顧客担当実績やイベントアサインは残ります。",
      submit: "削除する",
      cancel: "キャンセル",
      submitting: "削除中…",
    },
    empty: "該当するスタッフがいません",
    emptyCta: "検索条件を変更するか、「スタッフを登録」から追加してください。",
    new: "スタッフを登録",
    newTitle: "スタッフを登録",
    editTitle: "スタッフを編集",
    backToList: "スタッフ一覧へ戻る",
    /** 所属タブ。既存 UI の affiliationSelf/Dealer（自社 / 取引先）と揃える。 */
    tabs: {
      self: "自社スタッフ",
      dealer: "取引先スタッフ",
    },
    filters: {
      name: "氏名・カナ",
      searchPlaceholder: "氏名・カナで検索",
      company: "所属取引先",
      employmentType: "雇用形態",
      all: "すべて",
      resultCount: "表示件数: {total}件",
    },
    /** 【並び替え項目】の選択肢。所属会社は Relationship 側の名称で並べる。 */
    sortFieldLabels: {
      name: "氏名",
      company: "加盟店名",
      created_at: "登録日時",
    } as Record<string, string>,
    // 通常行に出す列。PII（生年月日・性別・住所）は展開バナー側。
    columns: {
      name: "氏名",
      kana: "カナ",
      companyName: "加盟店名",
      systemUser: "システム利用",
      employmentType: "雇用形態",
      phone: "電話番号",
      email: "メールアドレス",
    },
    // 行の展開（詳細バナー）。文言は他一覧と揃える。
    expand: {
      open: "詳細を開く",
      close: "詳細を閉じる",
      detailLink: "編集",
    },
    /** 展開バナー / 編集フォームの項目名。 */
    fields: {
      name: "氏名（漢字）",
      kana: "氏名（カナ）",
      companyName: "加盟店名",
      relationship: "所属取引先",
      linkedUser: "ログインユーザー",
      roles: "ロール",
      staffProfile: "スタッフ情報",
      tossUpCustomerCount: "トスアップ担当",
      closingCustomerCount: "クロージング担当",
      eventAssignmentCount: "イベント担当",
      gender: "性別",
      birthDate: "生年月日（任意）",
      phone: "電話番号",
      email: "メールアドレス",
      address: "現住所",
      employmentType: "雇用形態",
      note: "備考",
      isActive: "有効",
    },
    /** 生年月日は任意入力。未入力（DB は null）はこの文言で表示する。 */
    birthDateUnset: "未登録",
    customerCountSuffix: "件",
    /** ログイン User が紐づいているか（= 本アプリを使える人物か）。 */
    systemUserYes: "あり",
    systemUserNo: "なし",
    /** Salesperson（スタッフ業務プロフィール）行の有無。 */
    staffProfileSet: "登録済",
    staffProfileUnset: "スタッフ情報未登録",
    /** User だけの人物からスタッフ情報を登録するときのフォーム見出し。 */
    newFromUserTitle: "スタッフ情報を登録",
    selfCompanyHint: "自社スタッフの所属会社は自テナント名から表示します",
    relationshipUnset: "自社（取引先に所属しない）",
    linkedUserUnset: "紐付けなし",
    linkedUserHint: "同一人物の自社ログインユーザーがいれば紐付けます（取引先スタッフは対象外）",
    linkedUserTaken: "（別のスタッフに紐付け済み）",
    genderLabels: {
      MALE: "男性",
      FEMALE: "女性",
      OTHER: "その他",
    } as Record<string, string>,
    employmentTypeLabels: {
      EMPLOYEE: "正社員",
      CONTRACT: "契約社員",
      PART_TIME: "アルバイト・パート",
      SUBCONTRACT: "業務委託",
      OTHER: "その他",
    } as Record<string, string>,
    inactiveBadge: "無効",
    /** イベント詳細の販売員アサインセクション。 */
    assign: {
      title: "販売員",
      hint: "この催事に立つスタッフを選択します（自社社員のシフトとは別管理）。",
      empty: "販売員が未アサインです",
      save: "アサインを保存",
      saving: "保存中…",
      noCandidates: "登録済みのスタッフがいません。設定 > スタッフ一覧から登録してください。",
    },
  },

  constructionList: {
    title: "施工一覧",
    subtitle: "施工予定・現地調査・完工状況を一覧で確認できます。",
    empty: "該当する施工がありません",
    emptyCta: "検索条件を変更するか、顧客詳細の施工タブから登録してください。",
    filters: {
      customerName: "顧客名",
      searchPlaceholder: "顧客名で検索",
      status: "施工状態",
      surveyStatus: "現地調査",
      /** 検索範囲（開始日〜終了日）をどの日付に掛けるか。 */
      dateField: "日付対象",
      all: "すべて",
      resultCount: "表示件数: {total}件",
    },
    /** 【日付対象】の選択肢。いずれも Construction の実列。既定は「すべて」。 */
    dateFieldLabels: {
      all: "すべて",
      planned: "施工予定日",
      started: "着工日",
      completed: "完工日",
    } as Record<string, string>,
    // 行の展開（施工日程の編集バナー）。文言はコール一覧と揃える。
    expand: {
      open: "詳細を開く",
      close: "詳細を閉じる",
      detailLink: "案件詳細",
    },
    /** 展開バナーの編集セクション見出し。 */
    editSection: {
      title: "施工日程",
    },
    /** 【並び替え項目】の選択肢。 */
    sortFieldLabels: {
      planned_date: "施工予定日",
      started_date: "着工日",
      survey_date: "現地調査日",
      completed_date: "完工日",
    } as Record<string, string>,
    columns: {
      plannedDate: "施工予定日",
      customerName: "顧客名",
      assignee: "担当者",
      installer: "施工業者",
      surveyStatus: "現地調査",
      status: "施工状態",
      // 着工日は一覧から直接編集できる（保存先は Construction.startedDate）。
      startedDate: "着工日",
      completedDate: "完工日",
    },
    noInstaller: "業者未定",
    noSurvey: "未設定",
    notCompleted: "未完工",
  },
  applicationList: {
    title: "申請一覧",
    subtitle: "設置・補助金申請の提出状況と承認状況を一覧で確認できます。",
    empty: "該当する申請がありません",
    emptyCta: "検索条件を変更するか、顧客詳細の設置申請タブから登録してください。",
    filters: {
      customerName: "顧客名",
      searchPlaceholder: "顧客名で検索",
      status: "申請状態",
      type: "申請種別",
      all: "すべて",
      resultCount: "表示件数: {total}件",
    },
    // 行の展開（申請日程の編集バナー）。文言はコール一覧・施工一覧と揃える。
    expand: {
      open: "詳細を開く",
      close: "詳細を閉じる",
      detailLink: "案件詳細",
    },
    /** 展開バナーの編集セクション見出し。 */
    editSection: {
      title: "申請日程",
    },
    /** 【並び替え項目】の選択肢（Application の実列）。 */
    sortFieldLabels: {
      planned_date: "申請予定日",
      created_at: "登録日時",
    } as Record<string, string>,
    columns: {
      plannedDate: "申請予定日",
      customerName: "顧客名",
      assignee: "担当者",
      type: "申請種別・提出先",
      status: "申請状態",
      submittedDate: "提出日",
      approvedDate: "承認日",
      files: "関連書類",
    },
    noType: "種別未設定",
    notSubmitted: "未提出",
    notApproved: "未承認",
    fileCount: "{n}件",
    noFiles: "0件",
  },

  // ローン審査一覧（顧客詳細のローン審査タブを横断で俯瞰する管理者向け画面）。
  loanReviewList: {
    title: "ローン審査一覧",
    subtitle: "ローン審査の進行状況と不備の解消状況を一覧で確認できます。",
    empty: "該当するローン審査がありません",
    emptyCta: "検索条件を変更するか、顧客詳細のローン審査タブから登録してください。",
    filters: {
      customerName: "顧客名",
      searchPlaceholder: "顧客名で検索",
      status: "審査状態",
      defect: "不備",
      all: "すべて",
      resultCount: "表示件数: {total}件",
    },
    /** 【並び替え項目】の選択肢（LoanReview の実列）。 */
    sortFieldLabels: {
      updated_at: "更新日時",
      created_at: "登録日時",
    } as Record<string, string>,
    columns: {
      customerName: "顧客名",
      loanCompany: "ローン会社",
      status: "審査状態",
      defect: "不備",
      defectAssignee: "不備担当者",
      latestResult: "直近の審査結果",
    },
    // 一覧では不備の有無だけ分かれば十分なので 2 値に畳む
    // （未解消 / 解消済みの区別と不備内容は顧客詳細のローン審査タブで確認する）。
    defectPresenceLabels: {
      yes: "あり",
      no: "なし",
    } as Record<string, string>,
    statusLabels: {
      not_reviewed: "審査前",
      reviewing: "審査中",
      completed: "審査完了",
      defect: "不備あり",
    },
    resultLabels: {
      approved: "承認",
      rejected: "否決",
      defect: "不備",
      other: "その他",
    },
    defectLabels: {
      none: "なし",
      open: "未解消",
      resolved: "解消済み",
    },
    defectFilter: {
      open: "未解消の不備あり",
      none: "不備なし",
    },
    noCompany: "未設定",
    noResult: "履歴なし",
  },

  // S-029 / S-030 — F-027 配属済みイベント一覧・詳細 (T-04-02)
  // 卸業者ビュー (wholesaler_* 全ロール)
  event: {
    title: "配属済みイベント",
    listTitle: "イベント一覧",
    detailTitle: "イベント詳細",
    empty: "表示できるイベントがありません",
    emptyCta: "開催体制が決定したイベントがここに表示されます",
    backToList: "イベント一覧へ戻る",
    filterByStatus: "ステータスで絞り込み",
    filterByFrom: "開始日",
    filterByTo: "終了日",
    allStatuses: "すべてのステータス",
    detailHeading: "詳細情報",
    fields: {
      storeName: "店舗名",
      area: "エリア",
      address: "住所",
      scheduledDate: "開催日",
      targetMonth: "対象年月",
      mode: "開催体制",
      status: "ステータス",
      requiredPeople: "必要人数",
      dealerCount: "担当取引先数",
      reportStatus: "報告状況",
      updatedAt: "最終更新",
      lastUpdated: "最終更新日",
      updatedBy: "更新者",
      note: "備考",
      contractType: "契約形態",
      fixedFee: "固定費",
      performanceRate: "成果報酬率",
    },
    modes: {
      SELF: "自社開催",
      DEALER: "取引先開催",
      JOINT: "共同開催",
      CANCELLED: "中止",
    },
    statuses: {
      PLANNED: "開催予定",
      ONGOING: "開催中",
      CLOSED: "終了",
      CANCELLED: "中止",
    },
    contractTypes: {
      FIXED: "固定費",
      PERFORMANCE: "成果報酬",
      NONE: "なし",
      OTHER: "その他",
    },
    reportTypes: {
      START: "開始報告",
      END: "終了報告",
      RESULT: "成果報告",
    },
    reportOrgTypes: {
      WHOLESALER: "自社",
      DEALER: "取引先",
    },
    sections: {
      info: "イベント情報",
      basicInfo: "基本情報",
      contractConditions: "契約条件",
      assignInfo: "アサイン情報",
      dealers: "担当取引先",
      shifts: "シフト",
      reports: "報告状況",
      customers: "関連顧客",
    },
    noReports: "報告はまだありません",
    noDealers: "担当取引先はありません",
    noShifts: "シフトは未設定です",
    noCustomers: "関連顧客はまだ登録されていません",
    customerCountSuffix: "件の顧客が登録されています。",
    registerCustomer: "このイベントから顧客を登録",
    manageShifts: "シフト管理",
    table: {
      columns: {
        store: "店舗名",
        scheduledDate: "実施日",
        mode: "開催体制",
        status: "ステータス",
        dealers: "担当取引先数",
        reports: "報告",
        actions: "操作",
      },
    },
  },

  // S-061 / S-062 — F-027 配属済みイベント一覧・詳細 (T-04-02)
  // 取引先ビュー (dealer_admin / dealer_staff)
  eventDealer: {
    title: "担当イベント",
    listTitle: "担当イベント一覧",
    detailTitle: "イベント詳細",
    empty: "担当イベントがありません",
    emptyCta: "卸業者から配属されたイベントがここに表示されます",
    backToList: "担当イベント一覧へ戻る",
    filterByStatus: "ステータスで絞り込み",
    filterByFrom: "開始日",
    filterByTo: "終了日",
    allStatuses: "すべてのステータス",
    fields: {
      storeName: "店舗名",
      area: "エリア",
      address: "住所",
      scheduledDate: "実施日",
      targetMonth: "対象年月",
      mode: "開催体制",
      status: "ステータス",
      wholesaler: "卸業者",
      scope: "スコープ",
      reportStatus: "報告状況",
      updatedAt: "最終更新",
    },
    modes: {
      SELF: "自社開催",
      DEALER: "取引先開催",
      JOINT: "共同開催",
      CANCELLED: "中止",
    },
    statuses: {
      PLANNED: "開催予定",
      ONGOING: "開催中",
      CLOSED: "終了",
      CANCELLED: "中止",
    },
    scopes: {
      APPOINTMENT_ONLY: "アポ獲得まで",
      FIRST_VISIT: "初回訪問まで",
      FULL_CLOSING: "商談・クロージングまで",
    },
    reportTypes: {
      START: "開始報告",
      END: "終了報告",
      RESULT: "成果報告",
    },
    sections: {
      info: "イベント情報",
      scope: "担当スコープ",
      reports: "報告状況",
    },
    noReports: "報告はまだありません",
    table: {
      columns: {
        store: "店舗名",
        scheduledDate: "実施日",
        mode: "開催体制",
        status: "ステータス",
        scope: "スコープ",
        reports: "報告",
        actions: "操作",
      },
    },
  },

  // S-032 / S-033 / S-057 / S-064 / S-065 — F-031 顧客登録・編集 (T-04-06).
  //
  // 卸業者と取引先の両ロールが使う顧客管理ラベル。PII マスキング表示は
  // MaskingService が適用した後の文字列がここのラベルと組み合わさる。
  customer: {
    title: "顧客管理",
    listTitle: "顧客一覧",
    subtitle: "全ての顧客情報を一覧で確認・管理できます。",
    // コール一覧（旧「マエカク一覧」）— 顧客詳細「コール」タブの内容を顧客横断で俯瞰する画面。
    // 列ラベルはグループ見出し (groups) + グループ内の短縮列名 (columns) の 2 段ヘッダで
    // 組み立てる（例: サンキューコール × 希望日時）。ステータスの値域ラベルは顧客詳細と
    // 共有する（detail.projectInfo.maekakuStatusDisplayLabels / callPhaseStatusLabels）。
    calls: {
      title: "コール一覧",
      subtitle: "顧客ごとの各種コール対応状況を一覧で確認・管理できます。",
      empty: "該当する顧客がありません",
      emptyCta: "検索条件を変更して再度お試しください。",
      filters: {
        // 折りたたみ式の検索パネル。閉じているときはこのヘッダ 1 行だけが見える。
        panelTitle: "検索条件",
        /** ヘッダに出す有効条件数（0 件のときは出さない）。 */
        activeCount: "{n}件",
        customerName: "顧客名",
        searchPlaceholder: "顧客名で検索",
        assignee: "担当者",
        // 【対象項目】×【ステータス】の 2 段絞り込み。
        callType: "対象項目",
        callStatus: "ステータス",
        // 【日付対象】×【検索範囲】。2 つの日付入力は「検索範囲」の見出しでまとめ、
        // 各 input には aria-label（開始日 / 終了日）を個別に付ける。
        dateField: "日付対象",
        dateRange: "検索範囲",
        dateRangeFrom: "検索範囲 開始日",
        dateRangeTo: "検索範囲 終了日",
        rangeSeparator: "〜",
        // 【並び替え項目】×【昇順/降順】。検索パネルではなく一覧直前（表示件数の横）に置く。
        sortField: "並び替え",
        sortDirection: "並び順",
        all: "すべて",
        search: "検索",
        clear: "クリア",
        resultCount: "表示件数: {total}件",
      },
      // 【対象項目】の選択肢（CALL_TYPE_VALUES と 1:1）。
      callTypeLabels: {
        all: "すべて",
        maekaku: "マエカク",
        thank_you: "サンキューコール",
        loan_completion: "ローン審査完了コール",
        post_completion: "施工完了コール",
      } as Record<string, string>,
      // 対象項目 = すべて のときの統合ステータス。マエカク pending と他 3 種 not_done を
      // 1 つにまとめた表示上の値（DB 値ではない）。個別種別を選んだときは顧客詳細の
      // maekakuStatusDisplayLabels / callPhaseStatusLabels をそのまま使う。
      combinedStatusLabels: {
        not_done: "未実施・実施前",
        done: "実施済",
        unnecessary: "不要",
      } as Record<string, string>,
      // 【日付対象】の選択肢（CALL_DATE_FIELD_VALUES と 1:1）。
      dateFieldLabels: {
        all: "すべて",
        maekaku_preferred_at: "マエカク希望日時",
        thank_you_preferred_at: "サンキューコール希望日時",
        loan_completion_preferred_at: "ローン審査完了コール希望日時",
        post_completion_preferred_at: "施工完了コール希望日時",
        next_appointment_at: "次回アポイント",
        last_called_at: "最終架電日時",
      } as Record<string, string>,
      // 【並び替え項目】の選択肢（CALL_SORT_FIELD_VALUES と 1:1）。
      sortFieldLabels: {
        updated_at: "更新日時",
        name: "顧客名",
        maekaku_preferred_at: "マエカク希望日時",
        thank_you_preferred_at: "サンキューコール希望日時",
        loan_completion_preferred_at: "ローン審査完了コール希望日時",
        post_completion_preferred_at: "施工完了コール希望日時",
        next_appointment_at: "次回アポイント日",
      } as Record<string, string>,
      sortDirectionLabels: {
        asc: "昇順",
        desc: "降順",
      } as Record<string, string>,
      // 通常行の列。横スクロールを避けるため 4 コール列は短縮名にする
      // （正式名称は展開バナーの見出し sections / 次回対応の nextTaskKindLabels 側）。
      columns: {
        name: "顧客名",
        assignee: "担当者",
        maekaku: "マエカク",
        thankYouCall: "サンキュー",
        loanCompletionCall: "ローン完了",
        postCompletionCall: "施工完了",
        nextTask: "次回対応",
      },
      // 予定が無い行の 1 行目。行高を揃えるため、空欄にせずこの文言を出す。
      nextTaskNone: "予定なし",
      // 「次回対応」に出す対応項目名（NEXT_TASK_KIND_VALUES と 1:1）。
      nextTaskKindLabels: {
        maekaku: "マエカク",
        thank_you: "サンキューコール",
        loan_completion: "ローン審査完了コール",
        post_completion: "施工完了コール",
        next_appointment: "次回アポイント",
      } as Record<string, string>,
      /** 次回対応の日時が現在時刻より前のときに添えるバッジ。 */
      overdue: "期限超過",
      // 行の展開（詳細バナー）。
      expand: {
        open: "詳細を開く",
        close: "詳細を閉じる",
        detailLink: "案件詳細",
      },
      // 展開バナーの情報ブロック見出し（電話番号は最上段の 1 行に置くので見出しを持たない）。
      sections: {
        maekaku: "マエカク",
        thankYouCall: "サンキューコール",
        loanCompletionCall: "ローン審査完了コール",
        postCompletionCall: "施工完了コール",
        nextAppointment: "次回対応",
        lastCall: "直近コール履歴",
      },
      // 展開バナーの項目名。
      fields: {
        landlinePhone: "固定電話",
        mobilePhone: "携帯電話",
        statusLabel: "ステータス",
        preferredAt: "希望日時",
        note: "メモ",
        appointmentAt: "次回アポイント",
        appointmentAssignee: "次回担当者",
        nextAction: "次回アクション",
        lastCalledAt: "最終架電日時",
        lastHandler: "対応者",
      },
    },
    new: "顧客を新規登録",
    // イベント詳細から登録したときの補足（販売チャネルは催事で固定される）。
    eventSalesChannelLocked: "イベントからの登録のため、販売チャネルは「催事」で固定されます",
    // 催事 ID は内部識別子。人が手入力する値ではないので、どこから入るのかを書く。
    sourceEventIdFromEvent: "イベント画面から登録したため自動で入りました",
    sourceEventIdHint: "イベント詳細の「顧客を登録」から開くと自動で入ります",
    newShort: "＋ 新規顧客登録",
    honorific: "様",
    openDetail: "詳細を開く",
    edit: "顧客情報を編集",
    empty: "顧客未登録",
    emptyCta: "最初の顧客を登録しましょう",
    searchByName: "氏名で検索",
    searchByPhone: "電話番号で検索",
    searchPlaceholder: "氏名・電話番号で検索",
    searchPlaceholderFull: "顧客名で検索",
    filterByStatus: "ステータスで絞り込み",
    allStatuses: "すべてのステータス",
    filterByChannel: "チャネルで絞り込み",
    allChannels: "すべてのチャネル",
    filters: {
      customerName: "顧客名",
      assignee: "担当者",
      contractStatus: "商談状況",
      constructionStatus: "施工状況",
      subsidyStatus: "設置申請状況",
      maekaku: "マエカク有無",
      all: "すべて",
      search: "検索",
      clear: "クリア",
      resultCount: "表示件数: {total}件",
    },
    /** 【並び替え項目】の選択肢（Customer の実列）。顧客名はフリガナ優先。 */
    sortFieldLabels: {
      updated_at: "更新日時",
      name: "顧客名",
      created_at: "登録日時",
    } as Record<string, string>,
    columns: {
      name: "顧客名",
      area: "エリア",
      assignee: "担当者",
      nextAppointmentAt: "次回アポイント",
      maekaku: "マエカク",
      contractStatus: "契約状況",
      constructionStatus: "施工状況",
      subsidyStatus: "設置申請状況",
      // 一覧を「顧客 / 進捗 / 次アクション / 後工程」の 4 つの意味の塊に
      // まとめたときの見出し。
      customer: "顧客",
      progress: "進捗",
      nextAction: "次アクション",
      downstream: "後工程",
    },
    // 次アクション（既存フィールドからの表示上の導出。next-action.ts）。
    // 全行を「何をするか（label）／いつ・何が不足か（detail）」の 2 段に揃える。
    // 日付そのものを label にしない — 予定か期限か督促かが読み取れなくなるため。
    nextActions: {
      closed: "—",
      appointmentSet: "アポ設定",
      appointmentMissing: "未設定",
      appointmentNext: "次回アポ",
      maekaku: "マエカク実施",
      maekakuPending: "未実施",
      survey: "現地調査",
      surveyPending: "未実施",
      construction: "施工",
      constructionPending: "着工待ち",
      constructionRunning: "進行中",
      subsidySubmit: "申請提出",
      subsidyUnsubmitted: "未提出",
      subsidyResult: "申請結果",
      subsidyInReview: "審査中",
      completed: "完了",
      none: "—",
    },
    // ステータスのクイック絞り込み（既存の contractStatus パラメータのみを使う）。
    quickFilters: {
      all: "すべて",
    },
    maekakuLabels: {
      present: "済",
      absent: "未",
    },
    contractStatusLabels: {
      pre_visit: "初訪前",
      negotiating: "商談中",
      quote_presented: "見積提示済",
      contract_pending: "契約対応中",
      contracted: "契約済",
      lost: "失注",
      cancelled: "解約",
    },
    constructionStatusLabels: {
      not_started: "現地調査前",
      surveyed: "施工前",
      in_progress: "施工中",
      done: "完工",
    },
    subsidyStatusLabels: {
      not_applied: "申請前",
      preparing: "申請準備中",
      applied: "申請済",
      revising: "修正対応中",
      completed: "完了",
    },
    // 現地調査ステータス（施工ステータスとは別管理）。Construction.surveyStatus。
    surveyStatusLabels: {
      not_surveyed: "調査前",
      scheduled: "予定日確定",
      surveyed: "実施済",
    },
    detail: {
      basicInfo: "基本情報",
      customerInfo: "顧客情報",
      memo: "メモ",
      memoPlaceholder: "顧客に関するメモを入力（商談状況・申し送り事項など）",
      edit: "編集",
      editBasicInfo: "基本情報を編集",
      editMemo: "メモを編集",
      // 基本情報タブの区分見出し（現状情報 / 契約予定情報）。
      currentInfoSection: "現状情報",
      currentInfoHint: "顧客の連絡先・既存設備・電気契約など現在の状況",
      plannedInfoSection: "契約情報",
      plannedInfoHint: "契約・金額・設備・保証など（編集は契約状況タブ）",
      // 顧客情報カード内の現状（電気契約・設備）サブセクション見出し。
      electricSection: "電気契約・設備",
      existingEquipmentTitle: "既存設備",
      existingEquipmentHint: "ヒアリング時点の現況（エコキュート / ガス給湯器 / 太陽光 の有無）",
      editAssignee: "担当者を変更",
      changeAssignee: "変更",
      assigneeLabel: "担当者",
      /** 取引先を選んだあとに選ぶ「その取引先に所属するスタッフ」。 */
      assigneeStaffLabel: "担当スタッフ",
      /** 既存データは会社までしか記録が無いことがあるので、その場合の表示。 */
      assigneeStaffUnset: "未登録",
      /** 過去データ（*UserId のみ）で残っている担当者の現在値表示。新規候補には出さない。 */
      assigneeLegacyUserOption: (name: string) => `${name}（過去データ）`,
      unassigned: "未設定",
      ownStaffBadge: "自社",
      dealerBadge: "取引先",
      // 担当者変更ダイアログの 1 段目（所属区分）。2 段目の担当者候補を
      // 自社社員(User) / 取引先(Relationship) のどちらから出すかを決める。
      // 区分そのものは保存せず、どちらの ID 列に値が入るかで復元する。
      assigneeKind: "所属区分",
      ownStaffGroup: "自社社員",
      dealerGroup: "取引先",
      areaUnset: "未設定",
      // ヘッダー直下の at-a-glance ステータス帯用の短縮ラベル。
      glance: {
        nextAppointment: "次回アポ",
        contract: "契約",
        construction: "施工",
        subsidy: "設置申請",
      },
      // 案件情報（F-061 統合ビュー）。約90項目をカテゴリ別に表示。
      projectInfo: {
        empty: "未設定",
        contracted: "契約あり",
        notContracted: "契約なし",
        sections: {
          basic: "基本情報",
          organization: "体制",
          contract: "契約・金額",
          loan: "ローン・団信",
          construction: "工事・完工",
          certification: "認定・設備",
          specialNote: "特記事項",
          equipment: "設備明細",
          overview: "概況",
          calls: "コール状況",
          note: "備考",
        },
        // 施工サブタブ本文のセクション見出し（サマリ / スケジュール / コスト）。
        constructionSections: {
          summary: "サマリ",
          schedule: "スケジュール",
          cost: "コスト",
        },
        fields: {
          name: "お客様名",
          kana: "フリガナ",
          birthDate: "生年月日",
          age: "年齢",
          postalCode: "郵便番号",
          prefecture: "都道府県",
          city: "市区町村",
          addressLine: "番地",
          phone: "電話番号",
          email: "メールアドレス",
          buildYear: "築年日",
          apptGetter: "アポ獲得者",
          salesRep: "営業担当者",
          tossDept: "トス部署",
          belongDept: "所属部署",
          contractDate: "ご契約日",
          proposalAmount: "ご提案金額（税込）",
          paymentCount: "支払い回数",
          paymentStatus: "支払いステータス",
          depositDate: "入金日",
          agencyPayDate: "代理店支払日",
          loanReviewCallAt: "ローン審査コール日時",
          loanCompany: "ローン会社",
          downPayment: "頭金",
          creditLife: "団体信用生命保険",
          loanNote: "ローン-備考",
          loanReviewStatus: "ローン審査ステータス",
          callStatus: "架電ステータス",
          surveyCandidateAt: "現地調査日時（候補）",
          constructionCandidateAt: "工事日時（候補）",
          surveyAt: "現調日時",
          surveyStatus: "現地調査ステータス",
          plannedDate: "工事予定日",
          // 施工サブタブ 3 セクション用のラベル（サマリ / スケジュール / コスト）。
          plannedStartDate: "工事予定日（開始）",
          plannedEndDate: "工事予定日（終了）",
          plannedCompletionDate: "完工予定日",
          surveyDateField: "現地調査日",
          constructionStartDate: "工事日（開始）",
          constructionEndDate: "工事日（終了）",
          businessName: "事業者名",
          installerName: "施工業者",
          amount: "金額",
          startedDate: "着工日",
          completedDate: "完工日",
          thankYouCallAt: "サンキューコール日時",
          completionStatus: "完工ステータス",
          constructionFee: "施工コスト",
          postCompletionStatus: "完工後ステータス",
          defectStatus: "不備解消ステータス",
          defectDetail: "不備内容",
          certApplicationStatus: "認定申請ステータス",
          equipmentId: "設備ID",
          powerSaleStartDate: "売電開始日",
          note: "備考",
          dealerPayoutDate: "代理店支払日",
          loanReviewCallAtField: "ローン審査コール日時",
          downPaymentField: "頭金",
          contractAmount: "ご契約金額（税込）",
          incentiveGrossProfit: "インセンティブ対象粗利",
          incentiveAmount: "インセンティブ額",
          electricBill: "電気料金",
          household: "世帯",
          housingType: "住居種別",
          inflowRoute: "流入経路",
          maekakuStatus: "マエカク状況",
          vendorName: "対応事業者名",
          applicationType: "申請種別",
          submittedDate: "申請日",
          approvedDate: "承認日",
          grantedAmount: "交付額",
          // コールタブ 4 セクション。
          callMaekakuStatus: "マエカクステータス",
          maekakuPreferredAt: "マエカク希望日時",
          maekakuCallNote: "メモ",
          thankYouCallStatus: "サンキューコールステータス",
          thankYouCallPreferredAt: "サンキューコール希望日時",
          thankYouCallNote: "メモ",
          postCompletionCallStatus: "施工完了コールステータス",
          postCompletionCallPreferredAt: "施工完了コール希望日時",
          postCompletionCallNote: "メモ",
          loanCompletionCallStatus: "ローン審査完了コールステータス",
          loanCompletionCallPreferredAt: "ローン審査完了コール希望日時",
          loanCompletionCallNote: "メモ",
          generalCallPreferredTime: "汎用コール希望時間帯",
        },
        // コールタブの電話番号ヘッダ + 4 セクション見出し + 過去コール履歴 + 次回アポ（read-only）。
        callSections: {
          // タブ上部の電話番号ヘッダ（マスク済み）。
          phoneHeaderTitle: "電話番号",
          landlinePhone: "固定電話番号",
          mobilePhone: "携帯電話番号",
          // 2 カラムレイアウト（左=履歴 / 右=各ステータス）の列見出し。
          historyColumnTitle: "コール履歴",
          statusColumnTitle: "コールステータス",
          maekakuCall: "マエカクコール",
          thankYouCall: "サンキューコール",
          loanCompletionCall: "ローン審査完了コール",
          postCompletionCall: "施工完了コール",
          // マエカクコール read-only の次回アポ表示（編集は商談タブ）。
          nextAppointmentAt: "次回アポイント日程",
          nextAppointmentAssignee: "次回アポ担当者",
          nextAction: "次回アクション",
          // 過去コール履歴（CustomerCallLog・画面から追加）。
          callLogTitle: "過去コール履歴",
          callLogEmpty: "履歴はありません",
          callLogCalledAt: "架電日時",
          callLogHandler: "対応者",
          callLogNote: "メモ",
          callLogAdd: "追加",
          callLogAdding: "追加中…",
          callLogDelete: "削除",
          callLogDeleteConfirm: "このコール履歴を削除しますか？",
          callLogHandlerUnset: "未選択",
        },
        // DTO の enum CODE → 表示ラベル。
        callStatusLabels: {
          NONE: "未架電",
          SCHEDULED: "予定",
          DONE: "完了",
          CALLBACK_WAIT: "不在・折返し待ち",
          NG: "不通",
        } as Record<string, string>,
        paymentStatusLabels: {
          UNPAID: "未入金",
          PARTIAL: "一部入金",
          PAID: "入金済み",
        } as Record<string, string>,
        // ローン審査ステータス CODE → 表示ラベル（バッチ C・LOAN_REVIEW_STATUS_VALUES）。
        loanReviewStatusLabels: {
          not_reviewed: "審査前",
          reviewing: "審査中",
          completed: "完了",
          defect: "不備在り",
        } as Record<string, string>,
        postCompletionStatusLabels: {
          NONE: "未着手",
          IN_PROGRESS: "対応中",
          DONE: "完了",
        } as Record<string, string>,
        defectStatusLabels: {
          NONE: "なし",
          OPEN: "不備あり（未解消）",
          RESOLVED: "解消済み",
        } as Record<string, string>,
        // 施工ステータスは 現地調査前 / 施工前 / 施工中 / 完工 の 4 値。既存 enum 6 値は
        // REQUEST_PENDING・REQUESTED=現地調査前 / SURVEYED=施工前 / CONSTRUCTING・PAUSED=施工中 /
        // DONE=完工 にマッピング（一覧導出 constructionEnumToStatusValue と一致）。
        constructionStatusLabels: {
          REQUEST_PENDING: "現地調査前",
          REQUESTED: "現地調査前",
          SURVEYED: "施工前",
          CONSTRUCTING: "施工中",
          DONE: "完工",
          PAUSED: "施工中",
        } as Record<string, string>,
        // 現地調査ステータス（施工ステータスとは別管理）。Construction.surveyStatus。
        surveyStatusLabels: {
          not_surveyed: "調査前",
          scheduled: "予定日確定",
          surveyed: "実施済",
        } as Record<string, string>,
        applicationStatusLabels: {
          DRAFT: "下書き",
          SUBMITTED: "申請中",
          APPROVED: "認定済み",
          REJECTED: "却下",
          CANCELLED: "取消",
        } as Record<string, string>,
        introStatusLabels: {
          NONE: "未導入",
          EXISTING: "既設",
          NEW: "新規導入",
        } as Record<string, string>,
        noContract: "契約情報がありません",
        equipmentAddHint: "＋から設備を追加すると契約が作成されます",
        noConstruction: "施工情報がありません",
        noApplication: "認定・申請情報がありません",
        specialNotePlaceholder: "特記事項を入力（自由記述）",
        specialNoteEmpty: "特記事項はありません",
        yes: "有",
        no: "無",
        equipment: {
          pv: "PV（太陽光）",
          bt: "BT（蓄電池）",
          eq: "EQ（エコキュート）",
          ih: "IH",
          ac: "AC（エアコン）",
          accessory: "付帯商材",
          gift: "プレゼント品",
          // 契約商材ラインとしての施工（施工状況タブの工事進捗・原価とは別概念）。
          construction: "施工",
          // 各商材ごとの契約金額（顧客向け・原価ではない）。
          amount: "金額（税込）",
          vendor: "施工業者",
          // 各設備の項目
          totalWarranty: "総合保証・発電量保証",
          extWarranty: "延長保証",
          maker: "メーカー",
          modelNo: "型番",
          modelNo1: "型番①",
          modelNo2: "型番②",
          capacity: "容量",
          panelCount: "枚数",
          pcLocationNew: "パワコン設置場所（新設）",
          pcLocationSwap: "パワコン設置場所（交換）",
          optional: "オプション付帯",
          location: "設置場所",
          disasterWarranty: "自然災害保証（有償）",
          status: "導入状況",
          careSupport: "住設安心サポート",
          count: "契約個数",
          detail: "契約詳細",
          mitsubishiPotModel: "三菱鍋-型番",
        },
        // F-063 ヒアリング（住環境・家族）カテゴリ（docs/05 §17.7）。
        hearing: {
          title: "ヒアリング（住環境・家族）",
          existingTitle: "既設設備（現況）",
          existingHint: "ヒアリング時点のお宅の現況（契約設備とは別）",
          familyTitle: "家族属性",
          contactTitle: "連絡先・希望日時",
          husbandAge: "ご主人年齢",
          wifeAge: "奥様年齢",
          childAge: "お子様年齢",
          household: "家族構成",
          guideAttendee: "案内者",
          faceToFace: "主権者同席",
          proposedProduct: "ご提案商材",
          landlinePhone: "固定電話",
          mobilePhone: "携帯電話",
          maekakuPreferredAt: "マエカク希望日時",
          acquiredAt: "アポ取得日",
          installed: "設置有無",
          installDate: "設置日",
          maker: "メーカー",
          capacity: "容量",
          panelCount: "枚数",
          noExisting: "既設設備のヒアリング記録はありません",
          guideAttendeeLabels: {
            HUSBAND: "ご主人のみ",
            WIFE: "奥様のみ",
            BOTH: "ご夫婦お揃い",
            OTHER: "その他",
          } as Record<string, string>,
          categoryLabels: {
            GAS_WATER_HEATER: "ガス給湯器",
            ECO_CUTE: "エコキュート（EQ）",
            PV: "太陽光（既設）",
          } as Record<string, string>,
          presenceLabels: {
            YES: "あり",
            NO: "なし",
            UNKNOWN: "不明",
          } as Record<string, string>,
        },
        // コール状況のステータス CODE → 表示ラベル（バッチ B・CALL_STATUS_VALUES）。
        // 既存 callStatusLabels（Contract.callStatus）とは別 namespace（衝突回避）。
        callPhaseStatusLabels: {
          not_done: "実施前",
          done: "実施済",
          unnecessary: "不要",
        } as Record<string, string>,
        // マエカク状況 CODE → 表示ラベル（コール状況セクションで参照）。
        maekakuStatusDisplayLabels: {
          pending: "未実施",
          done: "実施済み",
          unnecessary: "不要",
        } as Record<string, string>,
        // クロスセル候補バッジ（docs/05 §17.8）。判定材料の可視化のみ。
        crossSellTitle: "クロスセル候補",
        crossSellLabels: {
          ECO_CUTE_SUGGEST: "エコキュート提案",
          BATTERY_SUGGEST: "蓄電池提案",
          PV_EXPAND_SUGGEST: "太陽光増設提案",
        } as Record<string, string>,
        // F-062 案件情報インライン編集（各セクションの編集トリガー / ダイアログ）。
        edit: {
          save: "保存",
          cancel: "キャンセル",
          unset: "未設定",
          editOverview: "概況を編集",
          editHearing: "ヒアリングを編集",
          editEquipment: "設備明細を編集",
          addEquipment: "設備を追加",
          editConstruction: "工事・完工を編集",
          editApplication: "認定・設備（申請）を編集",
          // コール状況ステータス選択肢（CALL_STATUS_VALUES）。
          callStatusLabels: {
            not_done: "実施前",
            done: "実施済",
            unnecessary: "不要",
          } as Record<string, string>,
          // 入力補助ラベル（既存 fields/hearing と重複しないもののみ）。
          familyTitle: "家族属性",
          contactTitle: "連絡先",
          inflowRouteLabels: {
            EVENT: "催事",
            OUTBOUND_CALL: "アウトバウンド",
            DIRECT_VISIT: "直接訪問",
          } as Record<string, string>,
          maekakuStatusLabels: {
            pending: "未実施",
            done: "実施済み",
            unnecessary: "不要",
          } as Record<string, string>,
          presence: {
            true: "有",
            false: "無",
          },
        },
      },
      tabs: {
        basic: "基本情報",
        projectInfo: "案件情報",
        history: "商談履歴",
        contract: "契約",
        loan: "ローン審査",
        profit: "損益計算",
        construction: "施工",
        subsidy: "設置申請",
        powerSale: "売電状況",
        calls: "コール",
        files: "関連ファイル",
        todo: "ToDo",
        chat: "チャット",
      },
      // 売電状況タブ — 顧客ごとの現在値（売電開始日 + 備考）だけを持つ簡易フォーム。
      // 申請 ID などの補足は独立項目を設けず、備考へ自由記述する運用。
      powerSaleTab: {
        title: "売電状況",
        hint: "売電開始日と補足事項を記録します（申請 ID などは備考へ記入してください）",
        startDate: "売電開始日",
        note: "備考",
        notePlaceholder:
          "例）店舗契約→2月21日の14時〜16時の間\n電力情報施工店共有済み〇\n★申請ID：09174680",
        save: "保存",
        saving: "保存中…",
      },
      // 契約状況タブ — 契約予定情報の単一の表示・編集面（Contract モデル由来 per-contract）。
      // 商材ライン（PV/BT/付帯/施工）をカード内インラインで入力する（概況は廃止）。
      contractTab: {
        empty: "契約はまだありません。「契約を追加」から作成してください。",
        detailTitle: "契約予定情報（案件詳細）",
        detailHint: "契約・支払・商材ライン・認定を契約ごとに編集（契約金額は商材ライン合計）",
        equipmentTitle: "商材ライン",
        equipmentHint: "PV/BT/付帯/施工の各商材の金額・内容を入力（契約金額は自動合計）",
        // 契約サブタブ（契約 #1 / #2 …＋追加）。
        subtabHeading: "契約",
        addContract: "契約を追加",
        addingContract: "契約を追加中…",
        // 追加時に契約名を入力するダイアログ。
        addDialogTitle: "契約を追加",
        nameLabel: "契約名",
        namePlaceholder: "例）1回目契約（空欄で「契約 #N」）",
        deleteContract: "この契約を削除",
        deleteContractText: "契約を削除",
        deletingContract: "削除中…",
        deleteContractConfirm: "この契約を削除しますか？商材ラインも削除されます。",
        // 契約サマリ（サブタブ上部のインライン編集）。契約金額は商材ライン合計（read-only）。
        summaryTitle: "契約サマリ",
        // 付帯商材（ACCESSORY）の複数行運用。
        accessoryTitle: "付帯商材",
        addAccessory: "付帯商材を追加",
        addingAccessory: "追加中…",
        deleteAccessory: "この付帯商材を削除",
        deleteAccessoryConfirm: "この付帯商材を削除しますか？",
        accessoryEmpty: "付帯商材は未登録です。",
        // 各契約カードの契約金額（商材ライン合計・read-only）。
        contractAmountAuto: "契約金額（商材ライン合計）",
      },
      // ローン審査タブ（独立 LoanReview エンティティ・契約タブと同型のサブタブ）。
      loanTab: {
        empty: "ローン審査はまだありません。「審査を追加」から作成してください。",
        // サブタブ見出し（ローン審査 #1 / #2 …）。
        subtabHeading: "ローン審査",
        addReview: "審査を追加",
        addingReview: "審査を追加中…",
        // 追加時にローン審査名を入力するダイアログ。
        addDialogTitle: "ローン審査を追加",
        nameLabel: "ローン審査名",
        namePlaceholder: "例）1回目審査（空欄で「ローン審査 #N」）",
        deleteReview: "この審査を削除",
        deleteReviewText: "審査を削除",
        deletingReview: "削除中…",
        deleteReviewConfirm: "この審査を削除しますか？審査履歴も削除されます。",
        // 審査サマリ（インライン編集セクション）。
        summaryTitle: "審査内容",
        status: "審査ステータス",
        loanCompany: "ローン会社",
        downPayment: "頭金",
        creditLife: "団信",
        note: "メモ",
        defectTitle: "不備内容・解消状況",
        defectContent: "不備内容",
        reviewedAt: "審査日",
        // 不備内容・解消状況（審査履歴ログ横断の一覧 + 解消トグル）。
        logDefectContent: "不備内容",
        defectListEmpty: "不備はありません",
        defectResolveToResolved: "解消済みにする",
        defectResolveToOpen: "未解消に戻す",
        defectResolvedBadge: "解消済み",
        defectOpenBadge: "未解消",
        defectStatusAria: "不備ステータス",
        // 専用の不備追加フォーム（不備内容 + 発生日 + 担当者）。
        defectAdd: "不備を追加",
        defectAdding: "追加中…",
        defectOccurredAt: "発生日",
        defectAssignee: "担当者",
        defectAssigneeUnset: "未割当",
        defectContentPlaceholder: "不備の内容を入力",
        defectContentRequired: "不備内容を入力してください",
        // 過去の審査履歴ログ（LoanReviewLog・画面から追加）。
        historyTitle: "過去の審査履歴",
        historyEmpty: "履歴はありません",
        logReviewedAt: "日時",
        logResult: "結果",
        logHandler: "記録者",
        logNote: "メモ",
        logAdd: "追加",
        logAdding: "追加中…",
        logDelete: "削除",
        logDeleteConfirm: "この審査履歴を削除しますか？",
        // ローン審査ステータス CODE → ラベル（LOAN_REVIEW_STATUS_VALUES）。
        statusLabels: {
          not_reviewed: "審査前",
          reviewing: "審査中",
          completed: "完了",
          defect: "不備在り",
        } as Record<string, string>,
        // 審査履歴結果 CODE → ラベル（LOAN_REVIEW_RESULT_VALUES）。
        resultLabels: {
          approved: "可決",
          rejected: "否決",
          defect: "不備",
          other: "その他",
        } as Record<string, string>,
      },
      // 損益計算タブ（契約単位の売上・原価・粗利）。機密財務のため卸業者限定。
      profitTab: {
        title: "損益計算",
        empty: "損益を表示できる契約がありません。",
        contractHeading: "契約",
        totalRow: "合計",
        columns: {
          contract: "契約",
          salesPrice: "売上",
          constructionFee: "施工代",
          venueFee: "場所代",
          grossProfit: "粗利",
          commission: "手数料",
        },
        // 契約ごとの編集カード。
        salesPrice: "売上",
        salesPriceHint: "商材ライン合計（自動）",
        grossProfit: "粗利",
        commission: "手数料",
        commissionRate: "手数料率（%）",
        commissionRatePlaceholder: "例）10",
        costItems: "コスト項目",
        costItemsEmpty: "コスト項目はまだありません。",
        addConstructionFee: "施工代を追加",
        addVenueFee: "場所代を追加",
        constructionRef: "施工",
        constructionRefUnset: "施工を選択",
        amount: "金額",
        deleteCostItem: "このコスト項目を削除",
        deleteCostItemConfirm: "このコスト項目を削除しますか？",
        categoryLabels: {
          CONSTRUCTION_FEE: "施工代",
          VENUE_FEE: "場所代",
        },
      },
      constructionTab: {
        title: "施工コスト",
        empty: "施工コストを表示できる契約・施工がありません。",
        // 編集可能（customer.update）で施工が 0 件のときの空状態（追加導線つき）。
        emptyEditable: "施工はまだありません。「施工を追加」から作成してください。",
        contractHeading: "契約",
        // 施工サブタブ見出し（施工 #1 / #2 …）。
        subtabHeading: "施工",
        // 施工サブタブの追加/削除。
        addConstruction: "施工を追加",
        addingConstruction: "施工を追加中…",
        deleteConstruction: "この施工を削除",
        deleteConstructionText: "施工を削除",
        deletingConstruction: "削除中…",
        deleteConstructionConfirm: "この施工を削除しますか？",
        // 追加時に施工名を入力するダイアログ。
        addDialogTitle: "施工を追加",
        nameLabel: "施工名",
        namePlaceholder: "例）1棟目（空欄で「施工 #N」）",
      },
      // 設置申請タブ（施工/ローン審査タブと同型）。申請レコードごとのサブタブ。
      applicationTab: {
        empty: "設置申請はまだありません。",
        // 編集可能（customer.update）で申請が 0 件のときの空状態（追加導線つき）。
        emptyEditable: "設置申請はまだありません。「申請を追加」から作成してください。",
        // 申請サブタブ見出し（申請 #1 / #2 …）。
        subtabHeading: "申請",
        // 申請サブタブの追加/削除。
        addApplication: "申請を追加",
        addingApplication: "申請を追加中…",
        deleteApplication: "この申請を削除",
        deleteApplicationText: "申請を削除",
        deletingApplication: "削除中…",
        deleteApplicationConfirm: "この申請を削除しますか？",
        // 追加時に申請名を入力するダイアログ。
        addDialogTitle: "設置申請を追加",
        nameLabel: "申請名",
        namePlaceholder: "例）補助金申請（空欄で「申請 #N」）",
        // 設置申請ステータス（ApplicationStatus enum → ラベル）。業務上 4 値
        // （申請前 / 申請済み / 修正対応中 / 完了）。CANCELLED(legacy) は申請前へ正規化。
        statusLabels: {
          DRAFT: "申請前",
          SUBMITTED: "申請済み",
          APPROVED: "完了",
          REJECTED: "修正対応中",
          CANCELLED: "申請前",
        } as Record<string, string>,
        // 設置申請の項目ラベル。
        status: "設置申請ステータス",
        // 各申請に紐づく関連ドキュメント（アップロード）セクションの見出し。
        relatedDocuments: "関連ドキュメント",
      },
      // サブタブ名の右クリック改名 UX（施工/ローン審査/契約で共用）。
      tabRename: {
        editTabName: "タブ名を編集する",
        placeholder: "タブ名を入力（空欄で既定表記）",
        menuAria: "タブ操作メニュー",
        inputAria: "タブ名",
      },
      chat: {
        empty: "まだメッセージはありません。最初のメッセージを送りましょう。",
        placeholder: "メッセージを入力（Enter で送信 / Shift+Enter で改行）",
        send: "送信",
      },
      editContract: "契約状況を編集",
      editConstruction: "施工状況を編集",
      editSubsidy: "設置申請状況を編集",
      save: "保存",
      cancel: "キャンセル",
      backToList: "一覧へ戻る",
      noMemo: "メモはありません",
      fields: {
        kana: "フリガナ",
        postalCode: "郵便番号",
        address: "住所",
        area: "エリア",
        phone: "電話番号",
        email: "メールアドレス",
        channel: "獲得チャネル",
        assignee: "担当者",
        tossUpAssignee: "トスアップ担当",
        closingAssignee: "クロージング担当",
        inflowRoute: "流入経路",
        prefecture: "都道府県",
        city: "市区町村",
        addressLine: "番地",
        birthDate: "生年月日",
        age: "年齢",
        buildYear: "築年日",
        tossDept: "トス部署",
        belongDept: "所属部署",
        salesChannel: "販売チャネル",
        faceToFace: "対面者",
        electricContractStatus: "電気契約状況",
        electricAccountNo: "お客様番号",
        supplyPointNo: "供給地点番号",
        equipmentId: "設備ID",
        createdAt: "登録日時",
      },
      inflowRouteLabels: {
        EVENT: "イベント",
        OUTBOUND_CALL: "アウトバウンドコール",
        DIRECT_VISIT: "直訪問",
      },
      // 販売チャネル。獲得チャネル (channel: AcquisitionChannel) とは別項目。
      salesChannelLabels: {
        VISIT_SALES: "訪問販売",
        INBOUND: "反響",
        EVENT: "催事",
        REFERRAL: "紹介",
        OTHER: "その他",
      },
      // 対面者は Customer.faceToFace（true/false/null）の 3 状態を言い換えたもの。
      faceToFaceLabels: {
        sovereign: "主権者",
        nonSovereign: "非主権者",
      },
      salesSection: "販売情報",
      quoteSection: {
        title: "見積",
        record: "見積を記録",
        empty: "見積の提示記録はまだありません",
        files: "見積書ファイル",
        addFile: "見積書を添付",
        noFiles: "添付ファイルはありません",
      },
      negotiation: {
        title: "現在の商談状況",
        maekaku: "マエカクステータス",
        maekakuLabels: {
          pending: "未対応",
          done: "対応済",
          unnecessary: "不要",
        },
        dealStatus: "商談ステータス",
        nextAppointment: "次回アポ日程",
        nextAppointmentAssignee: "次回アポ担当者",
        nextAppointmentAssigneeUnset: "未選択",
        maekakuPreferredAt: "マエカク希望日時",
        nextAction: "次回アクション",
        nextActionPlaceholder: "次に行うアクションを入力（例: 再訪日程の調整、見積り送付 など）",
        save: "保存",
      },
      cards: {
        contract: "契約状況",
        construction: "施工状況",
        subsidy: "設置申請状況",
      },
      statusLabel: "ステータス",
      contractFields: {
        plan: "契約プラン",
        amount: "契約金額（円・税込）",
        expectedDate: "契約予定日",
      },
      constructionFields: {
        plannedDate: "工事予定日",
        completedDate: "完了予定日",
        vendor: "対応事業者",
        vendorPlaceholder: "施工を担当する事業者名",
      },
      subsidyFields: {
        type: "申請種別",
        submittedDate: "申請日",
        grantedDate: "承認日",
      },
      history: {
        title: "商談履歴（新しい順）",
        newRecord: "新規記録",
        showAll: "すべての履歴を表示",
        assignee: "担当",
        empty: "商談履歴はありません",
        amountLabel: "提示金額",
        kinds: {
          tossup: "トスアップ",
          event: "イベント経由",
          phone: "コール",
          appointment: "アポイント",
          email: "メール",
          visit: "訪問",
          quote: "見積提示",
          other: "その他",
        },
      },
      newActivity: {
        title: "新規記録",
        date: "日付",
        category: "種別",
        assignee: "担当者",
        assigneeUnset: "未設定",
        detail: "詳細",
        amount: "提示金額（円・税込）",
        amountHint: "顧客に提示した見積金額を入力（任意）",
        tasks: "発生タスク",
        taskContent: "タスク内容",
        taskDue: "期限",
        taskAssignee: "担当者",
        addTask: "タスクを追加",
        files: "関連ファイル",
        selectFile: "ファイルを選択",
        uploading: "アップロード中…",
        save: "保存",
        cancel: "キャンセル",
        detailPlaceholder: "対応内容を入力",
        detailPlaceholderQuote: "提示した見積の内容（プラン・条件・有効期限など）を入力",
      },
      files: {
        title: "関連ファイル",
        showAll: "すべてのファイルを見る",
        empty: "関連ファイルはありません",
      },
      applicationFiles: {
        title: "申請関連ドキュメント",
        empty: "申請関連ドキュメントはありません",
      },
      pvDrawing: {
        title: "PV設置図面",
        empty: "PV設置図面はありません",
      },
      contractFiles: {
        title: "契約関連ファイル",
        empty: "契約関連ファイルはありません",
      },
      tasks: {
        title: "タスク / ToDo",
        showAll: "すべてのタスクを見る",
        empty: "タスクはありません",
      },
      fileDropzone: {
        primary: "ファイルをドラッグ&ドロップ",
        secondary: "またはクリックして選択",
        hint: "複数選択可・1ファイル最大 10MB",
        dragActive: "ここにドロップ",
      },
    },
    pageSize: {
      label: "{n}件",
      range: "{from} - {to} / {total}件",
      displayCount: "表示件数",
    },
    weekdays: ["日", "月", "火", "水", "木", "金", "土"],
    none: "—",
    pagination: {
      first: "最初へ",
      prev: "前へ",
      next: "次へ",
      last: "最後へ",
      pageOf: "{page} / {total} ページ",
    },
    fields: {
      name: "氏名",
      kana: "フリガナ",
      phone: "電話番号",
      email: "メールアドレス",
      postalCode: "郵便番号",
      address: "住所",
      channel: "獲得チャネル",
      sourceEventId: "催事 ID",
      status: "ステータス",
      note: "備考",
      ownerRelationshipId: "担当取引先",
      createdAt: "登録日時",
      updatedAt: "最終更新",
    },
    channels: {
      EVENT: "催事",
      WALK_IN: "飛び込み",
      TELE: "テレアポ",
      REFERRAL: "紹介",
      OTHER: "その他",
    },
    statuses: {
      NEW: "新規",
      PRE_CALL_WAIT: "マエカク待ち",
      PRE_CALL_DONE: "マエカク済",
      VISIT_PLANNED: "訪問予定",
      IN_NEGOTIATION: "商談中",
      CONTRACTED: "契約済",
      LOST: "失注",
      IN_CONSTRUCTION: "施工中",
      COMPLETED: "完了",
    },
    sections: {
      basic: "基本情報",
      contact: "連絡先",
      address: "住所",
      acquisition: "獲得チャネル",
      note: "備考",
    },
    actions: {
      createSubmit: "登録",
      updateSubmit: "保存",
    },
    feedback: {
      duplicatePhone: "同じ電話番号の顧客がすでに存在します（登録は完了しています）",
    },
    errors: {
      nameRequired: "氏名を入力してください",
      phoneRequired: "電話番号を入力してください",
      channelRequired: "獲得チャネルを選択してください",
      sourceEventIdRequired: "催事チャネルでは催事 ID を指定してください",
    },
  },

  // S-034 / S-074 / S-075 — F-033 / F-034 アポ登録・編集・一覧 (T-04-08).
  //
  // 卸業者と取引先双方が利用するアポ管理ラベル。
  appointment: {
    title: "アポ管理",
    listTitle: "アポ一覧",
    // S-034 アポイント一覧（横断一覧・顧客一覧と同じ情報設計）。
    list: {
      title: "アポイント一覧",
      subtitle: "全てのアポイントを予定日時順に一覧で確認できます。",
      empty: "該当するアポイントがありません",
      emptyCta: "検索条件を変更するか、顧客詳細からアポイントを登録してください。",
      filters: {
        customerName: "顧客名",
        searchPlaceholder: "顧客名で検索",
        assignee: "担当者",
        status: "状態",
        all: "すべて",
        resultCount: "表示件数: {total}件",
        /** 「検索範囲」が何の日付かを曖昧にしない。2 つの期間は別条件。 */
        scheduledRange: "アポ予定日",
        createdRange: "登録日",
        area: "エリア",
        company: "担当会社",
        /** 担当会社と提出会社は同じとは限らないので、担当会社であることを明記する。 */
        companyHint: "アポイントを取得した会社です（報告の提出会社とは限りません）。",
        appointmentType: "アポイント種別",
        partnerKind: "フォーム区分",
        event: "獲得元催事",
        eventQuery: "催事の開催場所",
        eventQueryHint: "催事の開催場所で探します（訪問先の住所ではありません）。",
        preCall: "マエカク対応状況",
        preCallNone: "未実施",
        /** 詳細条件の開閉。よく使う条件を上に、それ以外をここへ。 */
        moreTitle: "詳細条件",
        invalidRange: "開始日が終了日より後になっています",
      },
      /** 【並び替え項目】の選択肢。許可したものだけを受け付ける。 */
      sortFieldLabels: {
        scheduled_at: "アポ日時",
        created_at: "登録日時",
        customer_name: "顧客名",
        area: "エリア",
        assignee: "担当者",
        company: "担当会社",
        appointment_type: "アポイント種別",
        partner_kind: "フォーム区分",
        event: "獲得元催事",
        status: "状態",
        pre_call: "マエカク対応状況",
      } as Record<string, string>,
      columns: {
        scheduledAt: "予定日時",
        customerName: "顧客名",
        area: "エリア",
        assignee: "担当者",
        appointmentType: "種別・場所",
        status: "状態",
        preCall: "対応状況（マエカク）",
        // 次に必要な対応は文章なので通常列には出さず、行を展開して全文を読む。
        nextAction: "次に必要な対応",
        /** 狭い画面で隠した列は、展開部分から必ず読めるようにする。 */
        company: "担当会社",
        partnerKind: "フォーム区分",
        event: "獲得元催事",
        createdAt: "登録日時",
        location: "訪問先",
      },
      /** フォーム区分の表示。アポイント種別（初回訪問・見積提示…）とは別概念。 */
      partnerKindLabels: {
        FIRST_VISIT: "初訪アポ",
        VISIT: "訪問アポ",
      } as Record<string, string>,
      /** 自社（代理店）が取得したアポイント。 */
      ownCompany: "自社",
      // 行の展開（詳細バナー）。文言はコール一覧と揃える。
      expand: {
        open: "詳細を開く",
        close: "詳細を閉じる",
        detailLink: "案件詳細",
      },
      preCallNone: "マエカク未実施",
    },
    new: "アポを新規登録",
    edit: "アポを編集",
    empty: "アポ未登録",
    emptyCta: "最初のアポを登録しましょう",
    filterByStatus: "ステータスで絞り込み",
    allStatuses: "すべてのステータス",
    filterByFrom: "開始日",
    filterByTo: "終了日",
    pagination: {
      prev: "前へ",
      next: "次へ",
      pageOf: "{page} / {total} ページ",
    },
    fields: {
      customerId: "顧客",
      eventId: "催事 ID（任意）",
      scheduledAt: "訪問予定日時",
      location: "場所（任意）",
      acquiredRelationshipId: "取得元取引先（任意）",
      appointmentType: "種別（任意）",
      status: "ステータス",
      note: "備考（任意）",
      cancelReason: "キャンセル理由",
      createdAt: "登録日時",
      updatedAt: "最終更新",
    },
    statuses: {
      UNCONFIRMED: "未確認",
      PRE_CALL_DONE: "マエカク済",
      VISITED: "訪問済",
      ABSENT: "不在",
      CANCELLED: "キャンセル",
      RESCHEDULED: "再調整",
    },
    sections: {
      basic: "基本情報",
      schedule: "日程",
      status: "ステータス",
      note: "備考",
      cancel: "キャンセル",
    },
    actions: {
      createSubmit: "登録",
      updateSubmit: "保存",
      cancel: "アポをキャンセル",
      cancelConfirm: "このアポをキャンセルします。続行しますか？",
      cancelling: "キャンセル中…",
      preCall: "マエカク",
      /** 旧「操作」列の実体 — マエカク入力画面 (/appointments/[id]/pre-call) への導線。 */
      preCallEntry: "マエカクを入力",
    },
    feedback: {
      created: "アポを登録しました",
      updated: "アポを更新しました",
      cancelled: "アポをキャンセルしました",
      invalidTransition: "この状態からその状態への変更はできません",
    },
    errors: {
      customerRequired: "顧客を選択してください",
      scheduledAtRequired: "訪問予定日時を入力してください",
      cancelReasonPlaceholder: "キャンセル理由（任意）",
      invalidStateTransition: "この状態からその状態への変更はできません",
    },
  },

  // S-035 — F-035 マエカク管理 (T-04-09 / docs/04 §1.3).
  //
  // 卸業者本部 (wholesaler_admin / wholesaler_call_team) 専用画面。
  // 取引先ロールは URL 直叩きも含めて 403。
  preCall: {
    title: "マエカク管理",
    listTitle: "マエカク履歴",
    recordTitle: "マエカク結果を記録",
    recordDescription: "コール結果と次のアクションを記録してください",
    noPreCall: "マエカク未記録",
    alreadyRecorded: "このアポにはすでにマエカクが記録されています",
    backToAppointment: "アポ詳細へ戻る",
    fields: {
      result: "コール結果",
      notes: "メモ（任意）",
      rescheduledAt: "新しい訪問予定日時",
      calledAt: "コール日時",
      calledBy: "コール担当者",
    },
    results: {
      APPROVED: "承認（訪問確認）",
      ABSENT: "不在",
      CALLBACK: "折り返し依頼",
      CANCELLED: "キャンセル",
      RESCHEDULED: "日程変更",
    },
    resultBadges: {
      APPROVED: "承認",
      ABSENT: "不在",
      CALLBACK: "折り返し",
      CANCELLED: "キャンセル",
      RESCHEDULED: "日程変更",
    },
    appointmentStatusUpdated: {
      APPROVED: "アポステータスを「マエカク済」に更新しました",
      ABSENT: "マエカクを記録しました",
      CALLBACK: "マエカクを記録しました",
      CANCELLED: "アポステータスを「キャンセル」に更新しました",
      RESCHEDULED: "アポステータスを「再調整」に更新し、日程を更新しました",
    },
    actions: {
      record: "記録する",
      recording: "記録中…",
    },
    errors: {
      appointmentNotFound: "アポが見つかりません",
      rescheduledAtRequired: "日程変更の場合は新しい訪問予定日時を入力してください",
      alreadyRecorded: "このアポにはすでにマエカクが記録されています",
    },
    feedback: {
      recorded: "マエカクを記録しました",
    },
  },

  // S-036 / S-066 / S-077 — F-036 / F-037 マエカク結果連絡・取引先確認 (T-04-10).
  //
  // 卸業者側: 対象取引先チェックリスト + 連絡ボタン + 連絡済みステータス表示。
  // 取引先側: マエカク結果通知一覧 + 確認ボタン → ACKNOWLEDGED に更新。
  preCallNotification: {
    title: "マエカク結果連絡",
    listTitle: "マエカク結果通知一覧",
    sendTitle: "取引先への結果連絡",
    sendDescription: "マエカク結果を対象の取引先に通知します。",
    ackTitle: "マエカク結果の確認",
    noNotifications: "通知はありません",
    fields: {
      relationship: "取引先",
      status: "ステータス",
      notifiedAt: "連絡日時",
      acknowledgedAt: "確認日時",
    },
    statuses: {
      PENDING: "未連絡",
      SENT: "送信済み",
      ACKNOWLEDGED: "確認済み",
    },
    statusBadges: {
      PENDING: "未連絡",
      SENT: "送信済み",
      ACKNOWLEDGED: "確認済み",
    },
    actions: {
      send: "連絡する",
      sending: "連絡中…",
      acknowledge: "確認済みにする",
      acknowledging: "確認中…",
    },
    feedback: {
      sent: "マエカク結果を連絡しました",
      alreadySent: "この取引先はすでに連絡済みです",
      acknowledged: "確認済みにしました",
      alreadyAcknowledged: "すでに確認済みです",
    },
    errors: {
      preCallNotFound: "マエカクが見つかりません",
      notificationNotFound: "通知が見つかりません",
      noRelationshipSelected: "通知対象の取引先を 1 件以上選択してください",
    },
    selectAll: "すべて選択",
    clearSelection: "選択を解除",
    selectedCount: "{n} 件選択中",
  },

  // S-057 — 現場フォーム: アポ顧客登録 (T-04-11 / F-031 / F-033 / docs/04 §1.4).
  //
  // wholesaler_field_staff がスマホ上で 1 画面で顧客 + アポを同時登録する
  // 簡易フォーム。Sheet（BottomSheet）ベースでダッシュボードから呼び出す。
  fieldQuickAppointment: {
    sheetTitle: "アポ・顧客を登録",
    sheetDescription: "顧客情報とアポ日程を入力してください。今日の催事から自動的に紐付けます。",
    openButton: "クイックアポ登録",
    sections: {
      customer: "顧客情報",
      appointment: "アポ日程",
    },
    fields: {
      name: "氏名",
      phone: "電話番号",
      scheduledAt: "訪問予定日時",
      note: "メモ（任意）",
      sourceEventId: "催事 ID（自動入力）",
    },
    submitButton: "登録する",
    submitting: "登録中…",
    successToast: "顧客とアポを登録しました",
    noEventToday: "今日の催事シフトが見つかりません。催事 ID を確認してください。",
    errors: {
      nameRequired: "氏名を入力してください",
      phoneRequired: "電話番号を入力してください",
      scheduledAtRequired: "訪問予定日時を入力してください",
    },
    reportLinks: {
      startReport: "開始報告",
      endReport: "終了報告",
    },
  },

  // S-037 / S-038 / S-067 — F-038 商談・クロージング管理 (T-05-03 / docs/04 §1.3 §1.5).
  //
  // 卸業者 (S-037/S-038) と取引先 (S-067) の両側で利用する商談管理ラベル。
  // ステータス遷移ボタン・スコープ制限バッジ・ページネーションを含む。
  deal: {
    title: "商談管理",
    listTitle: "商談一覧",
    detailTitle: "商談詳細",
    new: "商談を新規登録",
    empty: "商談未登録",
    emptyCta: "顧客のアポ取得後、商談を登録できます",
    dealerSubtitle: "自社が担当する商談の一覧です",
    filterByStatus: "ステータスで絞り込み",
    allStatuses: "すべてのステータス",
    filterFrom: "登録日（開始）",
    filterTo: "登録日（終了）",
    pagination: {
      prev: "前へ",
      next: "次へ",
      pageOf: "{page} / {total} ページ",
    },
    fields: {
      customer: "顧客",
      status: "ステータス",
      ownerType: "担当",
      firstVisitAt: "初回訪問日",
      proposedProduct: "提案商品",
      proposedAmount: "提案金額",
      expectedProfit: "見込み粗利",
      expectedContractDate: "契約見込み日",
      lostReason: "失注理由",
      nextAction: "次回アクション",
      note: "備考",
      createdAt: "登録日",
      scopeCapability: "スコープ",
    },
    statuses: {
      VISIT_PLANNED: "初回訪問予定",
      VISITED: "訪問済み",
      PROPOSING: "提案中",
      QUOTED: "見積提出",
      CONSIDERING: "検討中",
      LIKELY_CONTRACT: "契約見込み",
      CONTRACTED: "契約",
      LOST: "失注",
    },
    ownerTypes: {
      WHOLESALER: "自社",
      DEALER: "取引先",
    },
    scopeCapabilities: {
      readOnly: "閲覧のみ（アポ獲得まで）",
      visitOnly: "初回訪問まで",
      fullClosing: "商談・クロージングまで",
    },
    sections: {
      basic: "基本情報",
      statusChange: "ステータス変更",
    },
    terminalNotice: "このステータスは最終状態のため、変更はできません。",
    actions: {
      changeStatus: "ステータスを変更",
      changing: "変更中…",
    },
    errors: {
      notFound: "商談が見つかりません",
      invalidTransition: "この状態からその状態への変更はできません",
      scopeForbidden: "このスコープではこの操作はできません",
    },
    feedback: {
      created: "商談を登録しました",
      updated: "商談を更新しました",
      statusChanged: "ステータスを変更しました",
    },
  },

  // S-040 / S-041 — F-040 契約登録・詳細 (T-05-06 / docs/04 §1.3 §1.5).
  //
  // 卸業者 (WHOLESALER_ADMIN / WHOLESALER_DIRECT_SALES) 専用の契約登録フォームと
  // 契約詳細画面。契約日・金額・自社開催フラグを入力し、Deal の LIKELY_CONTRACT
  // → CONTRACTED 遷移と Contract レコード作成を 1 トランザクションで完結する。
  // cancelDeadline と incentiveRateSnapshot は自動計算されてサーバ側で確定する。
  contract: {
    title: "契約管理",
    listTitle: "契約一覧",
    // S-040 契約一覧（横断一覧・顧客一覧と同じ情報設計）。
    list: {
      title: "契約一覧",
      subtitle: "成約済み案件を契約日順に一覧で確認できます。",
      empty: "該当する契約がありません",
      emptyCta: "検索条件を変更するか、顧客詳細の契約タブから登録してください。",
      filters: {
        customerName: "顧客名",
        searchPlaceholder: "顧客名で検索",
        assignee: "担当者",
        status: "契約状態",
        all: "すべて",
        resultCount: "表示件数: {total}件",
      },
      /** 【並び替え項目】の選択肢（Contract の実列）。 */
      sortFieldLabels: {
        contract_date: "契約日",
        contract_amount: "契約金額",
        created_at: "登録日時",
      } as Record<string, string>,
      columns: {
        contractDate: "契約日",
        customerName: "顧客名",
        assignee: "担当者",
        status: "契約状態",
        contractAmount: "契約金額",
        // 施工 / 設置申請は専用一覧へ集約したため契約一覧では扱わない。
        // 入金状況は一覧から直接変更できる（保存先は ContractPayment.paymentStatus）。
        paymentStatus: "入金状況",
      },
    },
    detailTitle: "契約詳細",
    new: "契約を登録",
    empty: "契約未登録",
    emptyCta: "商談が「契約見込み」になったら契約を登録できます",
    filterByStatus: "ステータスで絞り込み",
    allStatuses: "すべてのステータス",
    filterFrom: "契約日（開始）",
    filterTo: "契約日（終了）",
    pagination: {
      prev: "前へ",
      next: "次へ",
      pageOf: "{page} / {total} ページ",
    },
    fields: {
      deal: "商談",
      customer: "顧客",
      contractDate: "契約日",
      totalAmount: "契約金額（円）",
      cancelDeadline: "キャンセル期限",
      incentiveRateSnapshot: "インセンティブ率スナップショット（%）",
      incentiveTargetTypeSnapshot: "インセンティブ対象粗利種別スナップショット",
      isSelfHosted: "自社開催案件（取引先インセンティブ対象外）",
      status: "ステータス",
      createdAt: "登録日時",
      updatedAt: "最終更新",
    },
    statuses: {
      CONTRACTED: "契約中",
      CONSTRUCTING: "施工中",
      DONE: "完了",
      CANCELLED: "キャンセル済み",
    },
    sections: {
      basic: "基本情報",
      amounts: "金額・条件",
      snapshot: "スナップショット（自動）",
      items: "契約明細",
      grossProfit: "粗利",
      constructions: "施工状況",
      applications: "補助金申請",
      incentive: "インセンティブ",
    },
    actions: {
      createSubmit: "契約を登録",
      creating: "登録中…",
      goToItems: "明細を編集",
      goToGrossProfit: "粗利を計算",
      goToIncentive: "インセンティブを確認・調整",
    },
    feedback: {
      created: "契約を登録しました",
    },
    detail: {
      dealLink: "商談",
      customerLink: "顧客",
      noItems: "明細未登録",
      noGrossProfit: "粗利未計算",
      noConstructions: "施工未登録",
      noApplications: "補助金申請未登録",
      selfHostedBadge: "自社開催案件",
      incentiveNote: "共同開催案件は手動分配が必要です。インセンティブを確認・確定してください。",
    },
    cancel: {
      buttonLabel: "契約をキャンセル",
      dialogTitle: "契約キャンセルの確認",
      dialogDescription:
        "この操作は取り消せません。キャンセル期限内の場合はインセンティブも取消し、期限後の場合は翌月に負調整が発生します。",
      reasonLabel: "キャンセル理由",
      reasonPlaceholder: "例: お客様都合によるキャンセル",
      confirmButton: "キャンセルを実行",
      confirming: "処理中…",
      withinDeadlineNotice: "キャンセル期限内です。インセンティブは即時取消しになります。",
      afterDeadlineNotice: "キャンセル期限を過ぎています。翌月分に負調整が作成されます。",
      successWithin: "契約をキャンセルしました（期限内）",
      successAfter: "契約をキャンセルしました。翌月分に負調整が作成されます",
      alreadyCancelled: "この契約はすでにキャンセル済みです",
      invalidStatus: "キャンセルできるのは「契約中」または「施工中」の状態のみです",
    },
    errors: {
      dealRequired: "商談 ID を指定してください",
      contractDateRequired: "契約日を入力してください",
      totalAmountRequired: "契約金額を入力してください",
      totalAmountNonNegative: "契約金額は 0 以上で入力してください",
      dealNotFound: "商談が見つかりません",
      dealNotLikelyContract: "契約登録には商談が「契約見込み」状態である必要があります",
    },
  },

  // S-065 — 取引先 契約一覧・詳細 (T-05-09 / F-040 / docs/04 §1.5).
  //
  // 取引先ロール (dealer_admin / dealer_staff) 向け契約一覧・詳細。
  // snapshotPurchasePrice は DTO 物理除外。施工費・卸業者内部情報も非表示。
  // 自社関与 (ownerRelationshipId IN ctx.relationshipIds) のみ表示。
  dealerContract: {
    listTitle: "契約一覧",
    detailTitle: "契約詳細",
    empty: "契約がありません",
    emptyCta: "担当顧客の契約が成立するとここに表示されます",
    filterByStatus: "ステータスで絞り込み",
    allStatuses: "すべてのステータス",
    filterFrom: "契約日（開始）",
    filterTo: "契約日（終了）",
    pagination: {
      prev: "前へ",
      next: "次へ",
      pageOf: "{page} / {total} ページ",
    },
    fields: {
      customer: "顧客",
      contractDate: "契約日",
      totalAmount: "契約金額（円）",
      cancelDeadline: "キャンセル期限",
      status: "ステータス",
      dealerPrice: "取引先卸値（円）",
      listPrice: "参考売価（円）",
    },
    statuses: {
      CONTRACTED: "契約中",
      CONSTRUCTING: "施工中",
      DONE: "完了",
      CANCELLED: "キャンセル済み",
    },
    sections: {
      basic: "基本情報",
      items: "契約明細",
      incentivePlaceholder: "インセンティブ（SP-06 で接続予定）",
    },
    detail: {
      noItems: "明細未登録",
      incentivePlaceholder: "インセンティブ確定は SP-06 で実装予定です",
    },
  },

  // S-039 — F-039 取引先商談・クロージング報告一覧 (T-05-04 / docs/04 §1.3 S-039).
  //
  // 卸業者 (wholesaler_admin / wholesaler_direct_sales) 専用。
  // 取引先所有の商談更新（ownerType = DEALER）を一覧表示し、
  // 契約見込み行を強調。「商談詳細へ」で S-038 に遷移する。
  dealReport: {
    listTitle: "取引先商談・クロージング報告",
    subtitle: "取引先が更新した商談の最新ステータスを確認できます",
    empty: "該当する取引先商談報告がありません",
    emptyCta: "フィルタ条件を変更するか、対象月を切り替えてください",
    filterByMonth: "対象月",
    goToDetail: "商談詳細へ",
    fields: {
      customer: "顧客",
      status: "ステータス",
      dealer: "担当取引先",
      updatedAt: "最終更新",
    },
  },

  // S-044 — F-041 契約明細登録（価格スナップショット）(T-05-07 / docs/04 §1.3 S-044).
  //
  // 卸業者 (WHOLESALER_ADMIN / WHOLESALER_DIRECT_SALES) 専用の契約明細管理画面。
  // 価格スナップショット列（仕入値 / 取引先卸値 / 参考売価）を一括表示し、
  // 商品選択 + 数量入力で明細を全置換する。
  // 取引先向け DTO では snapshotPurchasePrice を物理除外する（CLAUDE.md rule #5）。
  contractItem: {
    title: "契約明細",
    contractInfo: "契約情報",
    empty: "明細がまだ登録されていません",
    addRow: "明細を追加",
    selectProduct: "— 商品を選択 —",
    notEditable: "この契約は CONTRACTED 状態ではないため明細の変更はできません",
    purchasePriceHidden: "（内部管理）",
    fields: {
      product: "商品",
      qty: "数量",
      contractDate: "契約日",
      status: "ステータス",
      totalAmount: "契約金額",
    },
    columns: {
      productName: "商品名",
      maker: "メーカー",
      qty: "数量",
      unit: "単位",
      purchasePrice: "仕入値（円）",
      dealerPrice: "取引先卸値（円）",
      listPrice: "参考売価（円）",
      subtotal: "小計（円）",
    },
    actions: {
      addRow: "追加",
      save: "明細を保存",
      saving: "保存中…",
    },
    feedback: {
      saved: "契約明細を保存しました",
    },
    errors: {
      itemsRequired: "明細は 1 件以上必要です",
      productRequired: "商品を選択してください",
      qtyRequired: "数量を入力してください",
      productNotEffective: "契約日時点で有効な商品が見つかりません",
    },
  },

  // S-045 — F-042 粗利計算・手動調整 (T-05-08 / docs/04 §1.3 §1.5).
  //
  // 卸業者 (WHOLESALER_ADMIN / WHOLESALER_DIRECT_SALES) 専用。
  // 契約明細スナップショットから自動計算し、必要に応じて手動調整する。
  // snapshotPurchasePrice は DTO 物理除外対象なので取引先には表示しない。
  grossProfit: {
    title: "粗利計算",
    subtitle: "契約明細スナップショットをもとに粗利を計算します",
    backToContract: "契約詳細へ戻る",
    noItems: "契約明細がまだ登録されていません。先に明細を登録してください。",
    sections: {
      summary: "粗利サマリ",
      recalc: "再計算",
      adjust: "手動調整",
    },
    fields: {
      salesPrice: "売上（円）",
      purchaseTotal: "仕入合計（円）",
      dealerTotal: "取引先向け卸値合計（円）",
      constructionFee: "施工費（円）",
      otherCost: "その他費用（円）",
      discount: "値引き（円）",
      projectProfit: "案件粗利（円）",
      wholesaleProfit: "卸粗利（円）",
      profitRate: "粗利率",
      incentiveTargetType: "インセンティブ対象粗利種別",
      incentiveTargetProfit: "インセンティブ対象粗利（円）",
      manualAdjustmentReason: "調整理由",
      manualAdjustedAt: "手動調整日時",
      manualValue: "手動指定額（円）",
    },
    incentiveTargetTypes: {
      PROJECT_PROFIT: "案件粗利",
      WHOLESALE_PROFIT: "卸粗利",
      MANUAL: "手動指定",
    },
    manualBadge: "手動調整済み",
    actions: {
      recalc: "再計算",
      recalcing: "計算中…",
      adjust: "手動調整を保存",
      adjusting: "保存中…",
    },
    feedback: {
      recalcDone: "粗利を再計算しました",
      adjustDone: "手動調整を保存しました",
    },
    placeholders: {
      manualValue: "例: 50000",
      adjustReason: "例: 共同開催手動配分",
    },
    errors: {
      salesPriceRequired: "売上金額を入力してください",
      manualValueRequired: "手動指定額を入力してください",
      reasonRequired: "調整理由を入力してください",
      itemsRequired: "契約明細が登録されていません",
    },
  },

  // S-046 — F-044 施工状況管理 (T-05-10 / docs/04 §1.3 S-046).
  //
  // 卸業者 (WHOLESALER_ADMIN / WHOLESALER_DIRECT_SALES) 専用。
  // 施工レコードの作成・ステータス遷移・費用更新を管理する。
  // 施工費更新時は粗利が自動再計算される（docs/02 §F-044 受入基準）。
  construction: {
    title: "施工管理",
    listTitle: "施工一覧",
    detailTitle: "施工詳細",
    new: "施工を登録",
    empty: "施工未登録",
    emptyCta: "施工を登録しましょう",
    backToContract: "契約詳細へ戻る",
    fields: {
      status: "ステータス",
      installer: "施工業者",
      fee: "施工費（円）",
      surveyDate: "現地調査日",
      plannedDate: "施工予定日",
      completedDate: "施工完了日",
      note: "備考",
      createdAt: "登録日時",
      updatedAt: "最終更新",
    },
    statuses: {
      REQUEST_PENDING: "依頼前",
      REQUESTED: "依頼済み",
      SURVEYED: "現地調査済み",
      CONSTRUCTING: "施工中",
      DONE: "完了",
      PAUSED: "中断",
    },
    sections: {
      basic: "基本情報",
      schedule: "日程",
      cost: "施工費",
      statusChange: "ステータス変更",
    },
    upcomingBadge: "施工予定 7 日前以内",
    actions: {
      create: "施工を登録",
      creating: "登録中…",
      save: "保存",
      saving: "保存中…",
      changeStatus: "ステータスを変更",
      changing: "変更中…",
    },
    feedback: {
      created: "施工を登録しました",
      updated: "施工情報を更新しました",
      statusChanged: "ステータスを変更しました",
      grossProfitRecalculated: "施工費の変更により粗利を再計算しました",
    },
    errors: {
      contractRequired: "契約 ID を指定してください",
      constructionNotFound: "施工情報が見つかりません",
      invalidTransition: "この状態からその状態への変更はできません",
      cancelledContract: "キャンセルされた契約には施工を登録できません",
    },
  },

  // S-047 — F-045 補助金申請管理 (T-05-11 / docs/04 §1.3 S-047).
  //
  // 卸業者 (WHOLESALER_ADMIN / WHOLESALER_DIRECT_SALES) 専用。
  // 補助金申請レコードの作成・ステータス遷移・金額更新を管理する。
  application: {
    title: "補助金申請管理",
    listTitle: "補助金申請一覧",
    detailTitle: "申請詳細",
    new: "申請を登録",
    empty: "申請未登録",
    emptyCta: "補助金申請を登録しましょう",
    backToContract: "契約詳細へ戻る",
    fields: {
      status: "ステータス",
      type: "申請種別",
      agency: "申請先",
      plannedDate: "申請予定日",
      submittedDate: "申請日",
      approvedDate: "承認日",
      estimatedAmount: "補助金見込み額（円）",
      confirmedAmount: "補助金確定額（円）",
      note: "備考",
      createdAt: "登録日時",
      updatedAt: "最終更新",
    },
    statuses: {
      DRAFT: "未申請",
      SUBMITTED: "申請済み",
      APPROVED: "承認済み",
      REJECTED: "却下",
      CANCELLED: "取消",
    },
    sections: {
      basic: "基本情報",
      amounts: "補助金金額",
      statusChange: "ステータス変更",
    },
    actions: {
      create: "申請を登録",
      creating: "登録中…",
      save: "保存",
      saving: "保存中…",
      changeStatus: "ステータス変更",
      changing: "変更中…",
    },
    feedback: {
      created: "申請を登録しました",
      updated: "申請情報を更新しました",
      statusChanged: "ステータスを変更しました",
    },
    estimatedPrefix: "見込み",
    confirmedPrefix: "確定",
    placeholders: {
      type: "例：省エネ補助金、住宅ポイント",
      agency: "申請先機関名",
    },
    errors: {
      contractRequired: "契約 ID を指定してください",
      typeRequired: "申請種別を入力してください",
      applicationNotFound: "申請情報が見つかりません",
      invalidTransition: "この状態からその状態への変更はできません",
      cancelledContract: "キャンセルされた契約には申請を登録できません",
      confirmedAmountRequired: "承認時は補助金確定額が必要です",
    },
  },

  // S-050 タブ — F-047 共同開催インセンティブ手動調整 (T-06-03 / docs/05 §4.8 §6.1).
  //
  // 卸業者 (WHOLESALER_ADMIN) 専用。eventModeAtContract=JOINT の契約の
  // インセンティブを取引先ごとに手動分配し FINALIZED にする。
  incentiveAdjust: {
    title: "インセンティブ調整",
    subtitle: "共同開催インセンティブの取引先への手動分配",
    backToContract: "契約詳細へ戻る",
    notJointMode: "この契約は共同開催ではないため、手動分配は不要です",
    noIncentives: "インセンティブ情報がありません。先に粗利を確定してください",
    allFinalized: "すべてのインセンティブが確定済みです",
    sections: {
      distributions: "分配設定",
      history: "調整履歴",
    },
    columns: {
      relationship: "対象取引先",
      currentAmount: "現在の金額（円）",
      status: "ステータス",
      adjustAmount: "分配金額（円）",
      reason: "調整理由",
    },
    statuses: {
      DRAFT: "下書き（未確定）",
      FINALIZED: "確定済み",
      CANCELLED: "取消済み",
      NEGATIVE_ADJUSTED: "負調整済み",
    },
    actions: {
      submit: "分配を確定",
      submitting: "確定中…",
    },
    feedback: {
      done: "インセンティブ分配を確定しました",
    },
    errors: {
      contractNotFound: "契約が見つかりません",
      notJoint: "共同開催契約のみ手動調整できます",
      incentiveNotFound: "インセンティブが見つかりません",
      alreadyFinalized: "既に確定済みのインセンティブは再調整できません",
      amountRequired: "分配金額を入力してください",
      reasonRequired: "調整理由を入力してください",
      noDistributions: "分配先を 1 件以上入力してください",
    },
    placeholders: {
      amount: "例: 50000",
      reason: "例: 共同開催分配合意による",
    },
  },

  // T-04-03 / T-04-04 — EventReport start / end / result actions (F-028 / F-029 / F-030)
  eventReport: {
    sections: {
      actions: "報告操作",
      result: "成果報告",
      metrics: "追加集計項目",
    },
    submitStart: "開始報告を提出",
    submitEnd: "終了報告を提出",
    submitResult: "成果報告を提出",
    submitting: "提出中…",
    startAlreadySubmitted: "開始報告は提出済みです",
    endAlreadySubmitted: "終了報告は提出済みです",
    resultAlreadySubmitted: "成果報告は提出済みです",
    startSuccess: "開始報告を提出しました",
    endSuccess: "終了報告を提出しました",
    resultSuccess: "成果報告を提出しました",
    startMissingWarning: "開始報告が未提出です。終了報告を提出しました",
    conflictError: "すでに同じ種別の報告が提出済みです",
    unknownError: "報告の提出に失敗しました。時間を置いて再度お試しください",
    wholesalerLabel: "自社",
    dealerLabel: "取引先",
    commentLabel: "コメント（任意）",
    commentPlaceholder: "コメントを入力…",
    result: {
      approachCount: "声かけ数",
      surveyCount: "アンケート数",
      totalAppts: "アポ取得数",
      validAppts: "有効アポ数",
      invalidAppts: "無効アポ数",
      apptsSumError: "有効アポ数 + 無効アポ数 はアポ取得数以下にしてください",
      negativeError: "0 以上の値を入力してください",
    },
    // 固定集計項目（声かけ数 / アンケート数 / アポ数 / コメント）とは別に、
    // 催事ごとに増える数値だけを追加登録するセクション。
    metrics: {
      description:
        "固定の集計項目に加えて、この催事だけで集計したい数値を追加できます（項目名と 0 以上の整数）。",
      empty: "追加集計項目は登録されていません",
      needsResultReport: "成果報告を提出すると、追加集計項目を登録できます",
      name: "項目名",
      value: "数値",
      namePlaceholder: "例）カインズPay対応数",
      valuePlaceholder: "例）12",
      addAction: "項目を追加",
      editAction: "を編集",
      deleteAction: "を削除",
      deleteConfirm: "「{name}」を削除します。よろしいですか？",
      deleted: "追加集計項目を削除しました",
      nameRequired: "項目名を入力してください",
      valueInvalid: "数値は 0 以上の整数で入力してください",
    },
  },

  // 成果報告（日報）— レーン/単発イベント共通。Google フォーム「ES_日報」準拠。
  // クリックで開く閲覧ポップアップで使用するラベル群。
  resultReport: {
    title: "成果報告（日報）",
    startReport: "開始報告",
    endReport: "終了報告",
    view: "成果を見る",
    close: "閉じる",
    notSubmitted: "未提出",
    submitted: "提出済み",
    sections: {
      basic: "基本情報",
      performance: "実績",
      impression: "所感",
    },
    fields: {
      eventDate: "催事実施日",
      franchiseNo: "加盟店番号",
      category: "種別",
      venuePlace: "催事場所",
      areaInFacility: "施設内エリア",
      workingHours: "稼働時間",
      salesChannel: "種別（販売チャネル）",
      impression: "所感",
    },
    // 実績テーブルの行・列見出し。
    metrics: {
      lottery: "抽選数",
      seated: "着座数",
      appointment: "アポ数",
      total: "合計",
      both: "両面",
      single: "片面",
    },
    categoryLabels: {
      housing: "住宅設備",
      realestate: "不動産",
    },
    channelLabels: {
      cainzW: "カインズ-W",
      cainzV: "カインズ-V",
      shimachu: "島忠",
    },
    emptyImpression: "（記入なし）",
  },

  // イベント獲得顧客の「初訪アポフォーム」— 顧客一覧の行クリックで開く閲覧ポップアップ。
  // Google フォーム「住設事業部/加盟店-①初訪アポフォーム」準拠。
  customerReport: {
    title: "アポイント詳細",
    close: "閉じる",
    openDetail: "顧客詳細を開く",
    empty: "（未入力）",
    sections: {
      org: "体制",
      event: "催事",
      customer: "お客様情報",
      appointment: "アポ・マエカク",
      note: "備考",
    },
    fields: {
      franchiseNo: "加盟店番号",
      tossGetter: "トス獲得者",
      closeCompany: "クローズ会社",
      salesRep: "営業担当者",
      channel: "販売チャネル",
      eventDate: "催事実施日",
      venuePlace: "催事場所",
      eventType: "催事種別",
      faceToFace: "対面者",
      customerName: "お客様名",
      kana: "フリガナ",
      maekakuPreferredAt: "マエカク電話希望日時",
      maekakuOperator: "マエカク実施者",
      firstVisitAt: "初回訪問アポ日時",
      landline: "固定電話番号",
      mobile: "携帯番号",
      postalCode: "郵便番号",
      prefecture: "都道府県",
      cityAddress: "市区町村・番地",
    },
  },

  // S-048 / S-049 — F-048 / F-049 / F-050 月次報告一覧・詳細 (T-06-07)
  monthlyReport: {
    listTitle: "月次報告一覧",
    listSubtitle: "対象月と体制区分を選択して月次集計を確認します",
    detailTitle: "月次報告詳細",
    backToList: "月次報告一覧へ戻る",
    aggregateButton: "集計を実行",
    aggregating: "集計中…",
    aggregateSuccess: "集計を実行しました",
    aggregateError: "集計に失敗しました",
    aggregateMonthLabel: "集計対象月（YYYY-MM）",
    targetMonthLabel: "対象月（YYYY-MM）",
    scopeLabel: "体制区分",
    filterApply: "絞り込む",
    scopes: {
      ALL: "全体",
      SELF: "自社開催",
      DEALER: "取引先開催",
      JOINT: "共同開催",
    } as Record<string, string>,
    statuses: {
      DRAFT: "下書き",
      SUBMITTED: "提出済み",
      REVIEWED: "確認済み",
      FINALIZED: "確定",
    } as Record<string, string>,
    statusBadgeClass: {
      DRAFT: "text-muted-foreground",
      SUBMITTED: "text-amber-600",
      REVIEWED: "text-blue-600",
      FINALIZED: "text-green-700",
    } as Record<string, string>,
    fields: {
      targetMonth: "対象月",
      scope: "体制区分",
      status: "ステータス",
      contractCount: "契約数",
      totalSales: "売上合計",
      totalGrossProfit: "粗利合計",
      totalIncentive: "インセンティブ見込み",
      averageProfitRate: "平均粗利率",
      updatedAt: "最終更新",
      relationshipId: "関係 ID",
      finalizedAt: "確定日時",
    },
    empty: "月次報告がありません",
    emptyCta: "集計を実行すると月次報告が作成されます",
    aggregatedSection: "集計値",
    chartSection: "直近 6 ヶ月の推移",
    chartLabels: {
      totalSales: "売上",
      totalGrossProfit: "粗利",
      totalIncentive: "インセンティブ",
    },
    commentsSection: "コメント",
    commentsPlaceholder: "コメントはまだ提出されていません",
    finalizeSection: "確定操作",
    finalizeButton: "月次確定する",
    finalizing: "確定中…",
    finalizeSuccess: "月次報告を確定しました",
    finalizeConfirm:
      "この月次報告を確定します。確定後は集計値が固定され、手動調整ができなくなります。よろしいですか？",
    unlockButton: "確定を解除する",
    unlocking: "解除中…",
    unlockSuccess: "確定を解除しました",
    unlockReasonLabel: "解除理由",
    unlockReasonPlaceholder: "アンロックの理由を入力してください（必須）",
    finalizedBadge: "確定済み",
    notReviewedYet: "確認済み状態になってから確定できます",
    currencySuffix: "円",
    percentSuffix: "%",
    noAggregated: "集計データがありません",
    allScopes: "すべての区分",
    allTab: "すべて",
    viewDetail: "詳細",
    countSuffix: "件",
    chartAxisUnit: "万",
    comment: {
      fields: {
        mainResults: "主な成果",
        issues: "課題",
        improvements: "改善アクション",
        nextMonthFocusStores: "翌月重点店舗",
        nextMonthMeasures: "翌月施策",
        dealerComment: "取引先コメント",
        reviewComment: "卸業者コメント",
      },
      submitButton: "コメントを提出する",
      submitting: "提出中…",
      reviewButton: "確認済みにする",
      reviewing: "確認中…",
      submitSuccess: "コメントを提出しました",
      reviewSuccess: "確認済みにしました",
      notSubmittedYet: "コメントはまだ提出されていません",
      alreadySubmitted: "コメント提出済み",
      alreadyReviewed: "確認済み",
      finalized: "確定済みのため変更できません",
      dealerCommentLabel: "取引先からのコメント",
      wholesalerCommentLabel: "卸業者からのコメント（任意）",
    },
    // S-068 — dealer monthly reports list
    dealerList: {
      title: "月次報告",
      subtitle: "卸業者ごとの月次成績を確認し、コメントを提出します",
      empty: "月次報告がありません",
      emptyCta: "集計が完了すると月次報告が表示されます",
      fields: {
        wholesaler: "卸業者",
        targetMonth: "対象月",
        status: "ステータス",
      },
      submitCommentCta: "コメントを入力・提出",
      backToList: "月次報告一覧へ戻る",
    },
  },

  // S-069 — F-051 取引先向け成績確認 (T-06-10 / docs/04 §1.5)
  dealerPerformance: {
    title: "成績確認",
    subtitle: "卸業者ごとの月次成績を確認できます",
    empty: "成績データがありません",
    emptyCta: "月次集計が完了すると成績が表示されます",
    filterLabel: "対象月（YYYY-MM）",
    filterApply: "絞り込む",
    filterPlaceholder: "例: 2026-06",
    wholesalerLabel: "卸業者",
    fields: {
      targetMonth: "対象月",
      contractCount: "契約数",
      totalSales: "売上合計",
      totalIncentive: "インセンティブ見込み",
      averageProfitRate: "平均粗利率",
      status: "ステータス",
    },
    statuses: {
      DRAFT: "集計中",
      SUBMITTED: "提出済み",
      REVIEWED: "確認済み",
      FINALIZED: "確定",
    } as Record<string, string>,
    currencySuffix: "円",
    percentSuffix: "%",
    countSuffix: "件",
    noData: "データなし",
  },

  // S-070 — F-051 インセンティブ確認 (T-06-10 / docs/04 §1.5)
  dealerIncentive: {
    title: "インセンティブ確認",
    subtitle: "確定済みインセンティブの一覧です",
    empty: "確定済みのインセンティブがありません",
    emptyCta: "月次確定後にインセンティブが表示されます",
    filterLabel: "対象月（YYYY-MM）",
    filterApply: "絞り込む",
    filterPlaceholder: "例: 2026-06",
    fields: {
      contractDate: "契約日",
      settledMonth: "対象月",
      targetProfit: "インセンティブ対象粗利",
      rate: "インセンティブ率",
      amount: "確定インセンティブ額",
      status: "ステータス",
      finalizedAt: "確定日時",
    },
    statuses: {
      DRAFT: "下書き",
      FINALIZED: "確定",
      CANCELLED: "取消済み",
      NEGATIVE_ADJUSTED: "負調整済み",
    } as Record<string, string>,
    statusBadgeClass: {
      DRAFT: "text-muted-foreground",
      FINALIZED: "text-green-700",
      CANCELLED: "text-destructive",
      NEGATIVE_ADJUSTED: "text-amber-600",
    } as Record<string, string>,
    currencySuffix: "円",
    percentSuffix: "%",
    // purchasePrice は取引先向け画面に一切表示しない (CLAUDE.md rule #5)
  },

  // S-051 — F-056 BI ダッシュボード (T-06-11 / docs/04 §4.3 S-051).
  //
  // 卸業者本部 (wholesaler_admin / wholesaler_event_team / wholesaler_direct_sales)
  // 専用。期間・体制・取引先フィルタ付きの時系列グラフ + 取引先ランキング。
  // dealer ロールには表示しない（他社情報が混入するため）。
  bi: {
    title: "BI ダッシュボード",
    subtitle: "売上・粗利・契約数の時系列推移と取引先ランキングを確認できます",
    filters: {
      fromMonth: "集計開始月",
      toMonth: "集計終了月",
      scope: "体制区分",
      allScopes: "すべての体制",
      dealerRelationship: "取引先",
      allDealers: "すべての取引先",
      apply: "絞り込む",
    },
    scopes: {
      ALL: "全体",
      SELF: "自社開催",
      DEALER: "取引先開催",
      JOINT: "共同開催",
    } as Record<string, string>,
    kpi: {
      title: "集計期間合計",
      contractCount: "契約件数",
      totalSales: "売上合計",
      totalGrossProfit: "粗利合計",
      averageProfitRate: "平均粗利率",
    },
    chart: {
      timeSeriesTitle: "月別推移",
      axisUnit: "万",
      currencySuffix: "円",
      contractCountSuffix: "件",
      percentSuffix: "%",
      salesLabel: "売上",
      grossProfitLabel: "粗利",
      contractCountLabel: "契約数",
      conversionRateLabel: "成約率",
    },
    ranking: {
      title: "取引先ランキング（Top 10）",
      rankLabel: "順位",
      dealerLabel: "取引先",
      contractCountLabel: "契約件数",
      totalSalesLabel: "売上合計（円）",
      totalGrossProfitLabel: "粗利合計（円）",
      empty: "ランキングデータがありません",
    },
    empty: "指定期間にデータがありません",
  },
  // Notification type labels — used in notification inbox, settings, and email
  // subject lines (T-07-02 / T-07-04 / T-07-06 / docs/05 §6.7).
  notificationTypes: {
    DEALER_PREFERENCE_SUBMITTED: "取引先から希望が提出されました",
    DEALER_PREFERENCE_MISSING: "希望未提出の取引先があります",
    EVENT_DECISION_PENDING: "開催体制決定が保留中です",
    EVENT_SHIFT_SHORTAGE: "シフト人数が不足しています",
    EVENT_START_REPORTED: "イベント開始が報告されました",
    EVENT_END_REPORTED: "イベント終了が報告されました",
    EVENT_RESULT_REPORTED: "イベント実績が報告されました",
    CUSTOMER_NEW: "新規顧客が登録されました",
    PRE_CALL_PENDING: "マエカク登録が未完了です",
    PRE_CALL_NOTIFICATION_PENDING: "マエカク結果の連絡が未送信です",
    PRE_CALL_RESULT_SHARED: "マエカク結果が共有されました",
    DEAL_STATUS_TO_CONTRACT: "商談が契約に進みました",
    MONTHLY_REPORT_SUBMITTED: "月次報告が提出されました",
    MONTHLY_REPORT_REVIEW_PENDING: "月次報告のレビューが必要です",
    GROSS_PROFIT_PENDING: "粗利計算が未確定です",
    INCENTIVE_PENDING: "インセンティブが未確定です",
    INCENTIVE_FINALIZED: "インセンティブが確定しました",
    CONSTRUCTION_UPCOMING: "施工予定が近づいています",
    APPLICATION_DEADLINE: "申請期限が近づいています",
    EVENT_PUBLISHED: "新しいイベント候補が公開されました",
    EVENT_PREFERENCE_DEADLINE: "希望提出期限が近づいています",
    EVENT_ASSIGNED: "イベントに割り当てられました",
    EVENT_DAY_BEFORE: "明日はイベント当日です",
    CONTRACT_CONTRACTED: "契約が成立しました",
    SHIFT_ASSIGNED: "シフトに割り当てられました",
    SHIFT_CHANGED: "シフトが変更されました",
    REPORT_PENDING: "実績報告が未提出です",
  },

  // S-078/S-079 — notification inbox UI (T-07-04 / F-052).
  notifications: {
    pageTitle: "通知インボックス",
    pageSubtitle: "あなた宛の通知一覧です",
    bellAriaLabel: "通知",
    unreadCount: "{count} 件の未読",
    noUnread: "未読通知なし",
    markAllRead: "すべて既読にする",
    markAllReadConfirm: "すべての通知を既読にします。よろしいですか？",
    markAllReadDone: "すべて既読にしました",
    filterUnreadOnly: "未読のみ表示",
    empty: "通知はありません",
    emptyUnreadOnly: "未読の通知はありません",
    loadMore: "さらに読み込む",
    loading: "通知を読み込んでいます…",
    showingOf: "{shown} 件を表示（全 {total} 件）",
    readStatus: {
      read: "既読",
      unread: "未読",
    },
    columns: {
      title: "タイトル",
      body: "本文",
      createdAt: "受信日時",
      status: "状態",
    },
    goToTarget: "詳細を確認",
    markRead: "既読にする",
    errors: {
      loadFailed: "通知の取得に失敗しました",
      markReadFailed: "既読更新に失敗しました",
    },
  },

  // S-080 — 通知設定 UI (T-07-06 / F-052 / F-053 / docs/04 §1.7).
  //
  // チャネル別 (IN_APP / EMAIL) × type 別のチェックボックスマトリクス。
  // LINE は Phase 2 Feature Flag が false の間は disabled 表示。
  notificationSettings: {
    pageTitle: "通知設定",
    pageSubtitle: "受け取る通知の種類とチャネルを設定してください",
    saveButton: "保存",
    saving: "保存中…",
    savedToast: "通知設定を保存しました",
    errorToast: "通知設定の保存に失敗しました",
    loadErrorToast: "通知設定の取得に失敗しました",
    channelHeaders: {
      IN_APP: "アプリ内通知",
      EMAIL: "メール通知",
      LINE: "LINE 通知（Phase 2）",
    },
    lineDisabledNote: "LINE 通知は現在準備中です",
    typeColumnHeader: "通知の種類",
  },

  // S-084 / S-085 — 監査ログ閲覧 (T-07-09 / F-055 / docs/04 §1.3).
  //
  // wholesaler_admin は自テナントのログのみ閲覧 (S-084)。
  // saas_admin は全テナント横断閲覧 (S-085)。
  auditLog: {
    pageTitle: "監査ログ",
    pageSubtitle: "操作履歴を閲覧します。ログは追記専用のため編集・削除はできません。",
    saasAdminSubtitle: "全テナント横断の操作履歴を閲覧します。",
    filterActor: "アクターで絞り込み（ユーザー ID）",
    filterAction: "アクションで絞り込み",
    filterFrom: "開始日時",
    filterTo: "終了日時",
    filterApply: "絞り込む",
    filterReset: "リセット",
    allActions: "すべてのアクション",
    empty: "条件に一致する監査ログがありません",
    emptyCta: "フィルタを変更してください",
    pagination: {
      prev: "前へ",
      next: "次へ",
      pageOf: "{page} / {total} ページ",
    },
    columns: {
      createdAt: "日時",
      actorUserId: "アクター",
      action: "アクション",
      targetType: "対象種別",
      targetId: "対象 ID",
      before: "変更前",
      after: "変更後",
      ip: "IP",
      tenantId: "テナント",
    },
    actions: {
      CREATE: "作成",
      UPDATE: "更新",
      DELETE: "削除",
      STATUS_CHANGE: "ステータス変更",
      PUBLISH: "公開",
      UNPUBLISH: "非公開",
      CANCEL: "キャンセル",
      FINALIZE: "確定",
      UNLOCK: "ロック解除",
      MANUAL_ADJUST: "手動調整",
      REVEAL_PII: "PII 開示",
      ROLE_CHANGE: "ロール変更",
      RELATION_SUSPEND: "関係停止",
      RELATION_RESUME: "関係再開",
    } as Record<string, string>,
    noActor: "システム",
    jsonPreviewLabel: "変更内容",
    jsonEmpty: "—",
    archiveNote: "90 日以前のログはアーカイブ表示です",
  },

  // Sign-out
  signOut: {
    button: "サインアウト",
    ariaLabel: "サインアウト",
  },

  // S-018 サブ — F-006 / F-008 メンバー管理 (卸業者・取引先共通ラベル)
  // WHOLESALER_ADMIN は /members、DEALER_ADMIN は /d-members で利用。
  // 決済管理（/payments）。契約済み顧客の決済状況の確認と Stripe への導線。
  // Stripe API はまだ接続していないので、操作系の文言は「Stripe を開く」だけ。
  // 決済管理（/payments）。
  //
  // 太陽光顧客の決済ではなく、**このシステム（BizOrch）の利用契約**
  // — プラン / 利用料 / 契約期間 / 支払い状況 — を扱う画面。
  // 料金の値そのものは lib/config/billing.ts が持つ（ここには置かない）。
  payment: {
    title: "決済管理",
    subtitle: "本システムの利用契約と支払い状況です",
    notSet: "未設定",
    dash: "—",
    info: {
      section: "決済情報",
      fields: {
        tenantName: "契約者",
        plan: "契約プラン",
        unitPrice: "利用料金",
        contractPeriod: "契約期間",
        method: "支払い方法",
        nextBillingAt: "次回請求日",
        status: "現在の支払い状態",
      },
      /** Tenant.plan の表示名。 */
      planLabels: {
        PILOT: "パイロット",
        SMALL: "スモール",
        MEDIUM: "ミディアム",
        LARGE: "ラージ",
      } as Record<string, string>,
      cycleSuffix: {
        MONTHLY: "／月",
        YEARLY: "／年",
      } as Record<string, string>,
      methodStripe: "Stripe",
      /** 契約期間の「N か月契約」表記。 */
      periodMonths: "{n}か月契約",
      periodSeparator: "〜",
    },
    history: {
      section: "決済履歴",
      empty: "決済履歴はまだありません",
      emptyHint: "利用料の請求が発生すると、ここに支払い記録が並びます",
      columns: {
        paidAt: "支払日",
        period: "対象期間",
        amount: "金額",
        status: "状態",
        method: "支払い方法",
      },
      /** Stripe の invoice.status。内部値をそのまま出さない。 */
      invoiceStatus: {
        draft: "下書き",
        open: "未払い",
        paid: "支払い済み",
        uncollectible: "回収不能",
        void: "無効",
      } as Record<string, string>,
    },
  },

  memberManagement: {
    // 卸業者側は「本アプリへログインできる User」の管理なのでシステムユーザーと呼ぶ。
    // 催事に立つスタッフ全般（Salesperson）は設定 > スタッフ一覧が担当する別概念。
    wholesalerTitle: "システムユーザー",
    wholesalerSubtitle: "本アプリにログインできるユーザーです（スタッフ一覧とは別管理）",
    // 一覧上部に常設する権限の早見表。編集ダイアログの選択肢と同じ 3 ロール。
    roleGuide: {
      title: "権限について",
      /** 階層ルールの一言補足（3 ロールの機能説明とは別行）。 */
      hierarchyNote: "システムユーザーは、自分と同じ権限または下位の権限のみ管理できます。",
      items: [
        { role: "オーナー", scope: "全機能を利用できます" },
        { role: "システム管理者", scope: "決済管理以外を利用できます" },
        { role: "一般ユーザー", scope: "設定・決済管理以外を利用できます" },
      ],
    },
    resultCount: "表示件数: {total}件",
    // 行の展開（スタッフ一覧と同じ操作体系）。
    expand: {
      open: "詳細を開く",
      close: "詳細を閉じる",
    },
    /** 取引先タブは閲覧のみ。展開しても操作を出さない理由をその場に書く。 */
    dealerReadOnly: "取引先のアカウントはこの画面では編集できません",
    /** 自分より上位のロールを持つユーザー。表示はするが操作は出さない。 */
    upperRoleReadOnly: "上位権限のユーザーは編集できません",
    // 所属で 2 タブに分ける。自社は招待・ロール管理まで、取引先は閲覧のみ。
    tabs: {
      own: "自社",
      dealer: "取引先",
      ariaLabel: "システムユーザーの所属",
    },
    dealerTabEmpty: "取引先のシステムユーザーはまだいません",
    dealerTabEmptyCta: "取引先が招待コードからアカウントを開設すると、ここに表示されます",
    dealerTabNote: "取引先のアカウントはこの画面では編集できません（閲覧のみ）",
    dealerNameColumn: "所属取引先",
    actionsColumn: "操作",
    // システムユーザー（User）の編集・削除。スタッフ（Salesperson）とは別管理。
    edit: {
      trigger: "編集",
      title: "システムユーザーを編集",
      description: "氏名・ロール・状態を変更します。",
      submit: "保存",
      cancel: "キャンセル",
      submitting: "保存中…",
    },
    remove: {
      trigger: "削除",
      confirmTitle: "このシステムユーザーを削除しますか",
      confirmBody: "一覧から外れ、ログインできなくなります。監査ログや過去の担当履歴は残ります。",
      submit: "削除する",
      cancel: "キャンセル",
      submitting: "削除中…",
    },
    dealerTitle: "メンバー管理",
    subtitle: "ユーザーの一覧と招待状況を確認できます",
    inviteButton: "招待",
    inviteDialogTitle: "メンバーを招待",
    inviteDialogDescription:
      "招待メールを送信します。受け取ったメンバーはリンクからアカウントを開設できます。",
    empty: "メンバーが登録されていません",
    emptyCta: "招待ボタンから最初のメンバーを招待しましょう",
    fields: {
      name: "氏名",
      email: "メールアドレス",
      roles: "ロール",
      twoFactor: "2FA",
      status: "ステータス",
      lastLoginAt: "最終ログイン",
      inviteRole: "招待ロール",
      inviteEmail: "メールアドレス",
      linkedStaff: "紐付くスタッフ",
    },
    /** スタッフ一覧側から Salesperson.userId のリンクが無い場合の表示。 */
    staffUnlinked: "紐付けなし",
    twoFactorEnabled: "有効",
    twoFactorDisabled: "無効",
    statuses: {
      ACTIVE: "有効",
      INVITED: "招待済み（未受諾）",
      SUSPENDED: "停止中",
      // 論理削除済み。通常一覧には出ないが、履歴表示などのための呼称。
      DELETED: "削除済み",
    },
    wholesalerRoles: {
      // 正式仕様の 3 ロール。
      OWNER: "オーナー",
      SYSTEM_ADMIN: "システム管理者",
      GENERAL_USER: "一般ユーザー",
      // 旧ロール。新規付与はしないが、既存ユーザーの表示のために残す。
      WHOLESALER_ADMIN: "管理者（旧）",
      WHOLESALER_EVENT_TEAM: "イベントチーム（旧）",
      WHOLESALER_CALL_TEAM: "コールチーム（旧）",
      WHOLESALER_DIRECT_SALES: "直販営業（旧）",
      WHOLESALER_FIELD_STAFF: "現場要員（旧）",
    } as Record<string, string>,
    dealerRoles: {
      DEALER_ADMIN: "管理者",
      DEALER_STAFF: "スタッフ",
    } as Record<string, string>,
    neverLoggedIn: "なし",
    actions: {
      invite: "招待する",
      inviting: "招待中…",
    },
    feedback: {
      invited: "招待メールを送信しました",
    },
    errors: {
      emailRequired: "メールアドレスを入力してください",
      emailInvalid: "正しいメールアドレスを入力してください",
      roleRequired: "ロールを選択してください",
    },
  },

  // S-022 サブ — F-009 / F-010 取引先管理（卸業者 ↔ 取引先 関係）
  // WHOLESALER_ADMIN 専用。Relationship 一覧・スコープ編集・停止/再開・招待コード発行。
  relationshipManagement: {
    title: "取引先管理",
    subtitle: "取引先との関係、デフォルトスコープ、招待コードを管理します",
    empty: "取引先（取引先）がまだ登録されていません",
    emptyCta: "招待コードを発行して取引先に渡してください",
    inviteCodeSectionTitle: "新規招待コード発行",
    inviteCodeDialogTitle: "招待コードを発行",
    inviteCodeDialogDescription:
      "有効期限と最大使用回数を設定して招待コードを発行します。コードは画面に一度だけ表示されます。",
    inviteCodeResult: "発行した招待コード",
    inviteCodeResultNote: "このコードは今後表示されません。取引先に安全な方法でお伝えください。",
    inviteCodeCopied: "コードをコピーしました",
    fields: {
      dealerName: "取引先名",
      status: "ステータス",
      defaultScope: "デフォルトスコープ",
      createdAt: "開始日",
      inviteCodeExpiresAt: "有効期限",
      inviteCodeMaxUses: "最大使用回数",
    },
    statuses: {
      ACTIVE: "有効",
      SUSPENDED: "停止中",
    },
    scopes: {
      APPOINTMENT_ONLY: "アポ獲得まで",
      FIRST_VISIT: "初回訪問まで",
      FULL_CLOSING: "商談・クロージングまで",
    },
    actions: {
      editScope: "スコープを変更",
      savingScope: "保存中…",
      saveScope: "保存",
      suspend: "停止",
      resume: "再開",
      suspending: "停止中…",
      resuming: "再開中…",
      generateCode: "招待コードを発行",
      generating: "発行中…",
    },
    feedback: {
      scopeUpdated: "デフォルトスコープを変更しました",
      suspended: "取引先を停止しました",
      resumed: "取引先を再開しました",
      codeGenerated: "招待コードを発行しました",
    },
    errors: {
      notFound: "取引先が見つかりません",
      invalidScope: "スコープを選択してください",
      expiresAtRequired: "有効期限を入力してください",
      maxUsesRequired: "最大使用回数を入力してください（1〜100）",
    },
  },

  // S-077 — F-037 取引先マエカク結果確認 (dealer side pre-call notification list)
  // DEALER_ADMIN / DEALER_STAFF が確認する画面。
  dealerPreCallNotification: {
    title: "マエカク結果確認",
    subtitle: "卸業者から共有されたマエカク結果を確認できます",
    empty: "マエカク結果の通知はありません",
    emptyCta: "卸業者からマエカク結果が共有されると、ここに表示されます",
    filterByStatus: "ステータスで絞り込み",
    allStatuses: "すべてのステータス",
    fields: {
      customerName: "顧客",
      scheduledAt: "訪問予定日時",
      preCallResult: "コール結果",
      status: "確認ステータス",
      notifiedAt: "通知日時",
      acknowledgedAt: "確認日時",
    },
    statuses: {
      PENDING: "未確認",
      SENT: "通知済み",
      ACKNOWLEDGED: "確認済み",
    },
    actions: {
      acknowledge: "確認済みにする",
      acknowledging: "確認中…",
    },
    feedback: {
      acknowledged: "確認済みにしました",
    },
    errors: {
      notFound: "通知が見つかりません",
      alreadyAcknowledged: "すでに確認済みです",
    },
  },

  // Breadcrumb — generic separator and aria label
  breadcrumb: {
    ariaLabel: "パンくずリスト",
    separator: "/",
    items: {
      // サイドバーの最上位グループ名。パンくずの先頭はサイドバーの階層と
      // 一致させる（画面がどこに属するかの主張を 2 箇所で食い違わせない）。
      settings: "設定",
      eventCandidates: "イベント一覧",
      eventCandidateDetail: "詳細",
      eventCandidateDecide: "開催体制決定",
      eventCandidatePreferences: "希望状況",
      events: "イベント一覧",
      eventDetail: "詳細",
      eventShifts: "シフト管理",
      venueNegotiations: "場所提供元対応",
      venueNegotiationDetail: "詳細",
      customers: "顧客",
      customerEdit: "編集",
      customerNew: "新規登録",
      customerDetail: "顧客詳細",
      appointments: "アポ",
      appointmentNew: "新規登録",
      appointmentPreCall: "マエカク",
      deals: "商談",
      dealDetail: "詳細",
      contracts: "契約",
      contractDetail: "詳細",
      contractItems: "明細",
      contractGrossProfit: "粗利",
      contractConstruction: "施工",
      contractApplication: "補助金",
      contractIncentive: "インセンティブ",
      contractCancel: "キャンセル",
      monthlyReports: "月次報告",
      monthlyReportDetail: "詳細",
      masters: "エリア・場所管理",
      masterProducts: "商品",
      masterProductDetail: "詳細",
      masterVenueProviders: "場所提供元",
      masterVenueProviderDetail: "詳細",
      masterInstallers: "施工業者",
      masterInstallerDetail: "詳細",
      masterIncentiveRates: "インセンティブ率",
      masterIncentiveRateDetail: "詳細",
    },
  },

  // Auth flows — invite acceptance (F-006) and dealer self-signup (F-007).
  // Keys are nested under `auth` so pages import `labels.auth.invite` /
  // `labels.auth.signup` etc. without polluting the top-level namespace.
  auth: {
    // S-007 — Invite acceptance (F-006)
    invite: {
      title: "アカウントを開設する",
      subtitle:
        "招待メールに記載のリンクからアクセスしています。氏名とパスワードを設定してください。",
      nameLabel: "氏名",
      namePlaceholder: "例: 山田 太郎",
      passwordLabel: "パスワード",
      passwordPlaceholder: "8 文字以上",
      confirmPasswordLabel: "パスワード（確認）",
      confirmPasswordPlaceholder: "もう一度入力",
      submitButton: "アカウントを開設",
      submitting: "開設中…",
      backToSignIn: "サインインへ戻る",
      errors: {
        nameRequired: "氏名を入力してください",
        passwordMinLength: "パスワードは 8 文字以上で入力してください",
        passwordMismatch: "パスワードが一致しません",
        invalidToken: "このリンクは無効または期限切れです。担当者にご連絡ください。",
        unknownError: "予期しないエラーが発生しました。時間を置いて再度お試しください",
      },
    },

    // S-008 / S-009 / S-010 — Dealer self-signup (F-007)
    signup: {
      // Step 1 — invite code entry (S-008)
      codeTitle: "新規取引先登録",
      codeSubtitle: "卸業者から発行された招待コードを入力してください。",
      codeLabel: "招待コード",
      codePlaceholder: "SOLAR-XXXX-YYYY",
      codeHint: "招待コードは卸業者から送付されます。形式: SOLAR-XXXX-YYYY",
      codeSubmitButton: "次へ",
      submitting: "処理中…",
      backToSignIn: "サインインへ戻る",

      // Step 2 — company + admin account (S-009 / S-010)
      registerTitle: "会社情報・管理者アカウント設定",
      registerSubtitle: "会社名と管理者アカウントの情報を入力してください。",
      sectionCompany: "会社情報",
      sectionAdmin: "管理者アカウント",
      companyNameLabel: "会社名",
      companyNamePlaceholder: "例: 株式会社サンシャイン",
      adminNameLabel: "管理者氏名",
      adminNamePlaceholder: "例: 山田 太郎",
      adminEmailLabel: "管理者メールアドレス",
      adminEmailPlaceholder: "you@example.com",
      passwordLabel: "パスワード",
      passwordPlaceholder: "8 文字以上",
      confirmPasswordLabel: "パスワード（確認）",
      confirmPasswordPlaceholder: "もう一度入力",
      registerSubmitButton: "登録する",
      backToCodeEntry: "招待コード入力へ戻る",

      // Success
      successTitle: "登録完了",
      successBody: "取引先アカウントが作成されました。サインインしてください。",

      errors: {
        codeRequired: "招待コードを入力してください",
        invalidCode: "招待コードが無効または期限切れです。卸業者にご確認ください。",
        codeExhausted:
          "この招待コードは利用上限に達しています。卸業者に新しいコードを発行してもらってください。",
        companyNameRequired: "会社名を入力してください",
        adminEmailRequired: "管理者メールアドレスを入力してください",
        adminNameRequired: "管理者氏名を入力してください",
        passwordMinLength: "パスワードは 8 文字以上で入力してください",
        passwordMismatch: "パスワードが一致しません",
        emailAlreadyExists:
          "このメールアドレスはすでに登録されています。別のアドレスを使用してください。",
        validationError: "入力内容に誤りがあります。ご確認ください。",
        unknownError: "予期しないエラーが発生しました。時間を置いて再度お試しください",
      },
    },
  },

  // Password reset — S-007 / S-008
  passwordReset: {
    requestTitle: "パスワードを再設定",
    requestSubtitle: "登録済みのメールアドレスを入力してください。再設定リンクを送信します。",
    emailLabel: "メールアドレス",
    emailPlaceholder: "you@example.com",
    submitButton: "再設定リンクを送信",
    submitting: "送信中…",
    sentTitle: "メールを送信しました",
    sentBody:
      "パスワード再設定リンクをメールに送りました。メールが届かない場合は迷惑メールフォルダをご確認ください。",
    backToSignIn: "サインインへ戻る",
    newPasswordTitle: "新しいパスワードを設定",
    newPasswordSubtitle: "新しいパスワードを入力してください。",
    newPasswordLabel: "新しいパスワード",
    newPasswordPlaceholder: "8 文字以上",
    confirmPasswordLabel: "パスワード（確認）",
    confirmPasswordPlaceholder: "もう一度入力",
    setButton: "パスワードを変更",
    setting: "変更中…",
    successTitle: "パスワードを変更しました",
    successBody: "新しいパスワードでサインインしてください。",
    invalidToken: "このリンクは無効または期限切れです。再度パスワード再設定をお試しください。",
    passwordMinLength: "パスワードは 8 文字以上で入力してください",
    passwordMismatch: "パスワードが一致しません",
    errors: {
      emailRequired: "メールアドレスを入力してください",
      emailInvalid: "メールアドレスの形式が正しくありません",
      unknownError: "予期しないエラーが発生しました。時間を置いて再度お試しください",
    },
  },

  // Profile — common for all roles
  profile: {
    title: "プロフィール",
    subtitle: "アカウント情報と 2FA の設定状況を確認できます",
    fields: {
      displayName: "表示名",
      email: "メールアドレス",
      role: "ロール",
      twoFaStatus: "2 段階認証",
    },
    twoFa: {
      enabled: "有効",
      disabled: "無効",
    },
    changePassword: "パスワードを変更",
    passwordPage: {
      title: "パスワード変更",
      subtitle: "現在のパスワードと新しいパスワードを入力してください",
      currentLabel: "現在のパスワード",
      newLabel: "新しいパスワード",
      confirmLabel: "新しいパスワード（確認）",
      submitButton: "変更する",
      submitting: "変更中…",
      success: "パスワードを変更しました",
      errors: {
        currentRequired: "現在のパスワードを入力してください",
        newRequired: "新しいパスワードを入力してください",
        newMinLength: "パスワードは 8 文字以上で入力してください",
        confirmMismatch: "パスワードが一致しません",
        currentIncorrect: "現在のパスワードが正しくありません",
        unknownError: "パスワードの変更に失敗しました。時間を置いて再度お試しください",
      },
    },
  },

  // Dealer dashboard — S-058
  dealerDashboard: {
    // 見出しはサイドバーの項目名と揃える（どちらも「ホーム」）。
    title: "ホーム",
    subtitle: "対応待ちの案件と本日の催事を確認できます",
    todoTitle: "要対応",
    todoAllClear: "対応待ちはありません",
    resultTitle: "当月実績",
    sections: {
      todayEvents: {
        title: "本日のイベント",
        empty: "本日のイベントはありません",
        cta: "担当イベント一覧を開く",
        // 卸業者ホームと同じく単位を明示する（従来ここだけ単位が無かった）。
        unitSuffix: "件",
      },
      pendingPreCall: {
        title: "マエカク未対応",
        description: "アポ取得後、マエカク結果通知の確認が未完了です",
        cta: "アポ一覧を開く",
        unitSuffix: "件",
      },
      monthlyContracts: {
        title: "今月の契約件数",
        cta: "契約一覧を開く",
        unitSuffix: "件",
      },
    },
  },

  // Sidebar navigation labels — used by AppShell component.
  wholesalerNav: {
    dashboard: "ダッシュボード",
    eventCandidates: "イベント候補",
    venueNegotiations: "場所提供元対応",
    events: "イベント実施",
    customers: "顧客",
    appointments: "アポ",
    deals: "商談",
    contracts: "契約",
    monthlyReports: "月次報告",
    masters: "エリア・場所管理",
    auditLogs: "監査ログ",
    bi: "BI ダッシュボード",
  },

  dealerNav: {
    dashboard: "ダッシュボード",
    eventCandidates: "イベント候補",
    events: "担当イベント",
    customers: "顧客",
    appointments: "アポ",
    deals: "商談",
    contracts: "契約",
    monthly: "月次成績",
    incentives: "インセンティブ",
  },

  saasAdminNav: {
    dashboard: "ダッシュボード",
    tenants: "テナント管理",
    plans: "プラン管理",
    billing: "請求状況",
    auditLogs: "監査ログ",
  },

  fieldNav: {
    dashboard: "ダッシュボード",
    shifts: "シフト一覧",
    quickAppointment: "クイックアポ登録",
  },

  // Email subjects — T-07-05 transactional email templates.
  // These are the Japanese subject lines used by packages/email/src/templates/*.
  // The template files themselves embed subjects directly, but listing them
  // here keeps the i18n rule satisfied (labels.ts is the single source of truth).
  emailSubjects: {
    invite: "[Solar SaaS] アカウント招待",
    passwordReset: "[Solar SaaS] パスワード再設定リンク",
    preferenceDeadline: "[Solar SaaS] 希望提出期限が近づいています",
    eventDecided: "[Solar SaaS] イベント開催体制が決定しました",
    preCallResult: "[Solar SaaS] マエカク結果が共有されました",
    contractCreated: "[Solar SaaS] 契約が成立しました",
    monthlyReportSubmitted: "[Solar SaaS] 月次報告が提出されました",
    monthlyReportFinalized: "[Solar SaaS] 月次レポートが確定しました",
  },

  // 卸業者インセンティブ一覧 (wholesaler/incentives/page.tsx).
  //
  // 卸業者テナント全体のインセンティブ一覧。取引先単位・対象月・ステータスで絞り込み。
  wholesalerIncentive: {
    title: "インセンティブ一覧",
    subtitle: "テナント全体のインセンティブ確定状況を確認できます",
    empty: "インセンティブがありません",
    emptyCta: "契約成立後に粗利が確定するとインセンティブが生成されます",
    filterByStatus: "ステータスで絞り込み",
    filterByMonth: "対象月で絞り込み",
    allStatuses: "すべてのステータス",
    goToContract: "契約詳細",
    columns: {
      dealer: "取引先",
      contractDate: "契約日",
      settledMonth: "対象月",
      amount: "インセンティブ額",
      status: "ステータス",
      finalizedAt: "確定日",
    },
    statuses: {
      DRAFT: "下書き",
      FINALIZED: "確定済み",
      CANCELLED: "取消済み",
      NEGATIVE_ADJUSTED: "負調整済み",
    } as Record<string, string>,
    pagination: {
      prev: "前へ",
      next: "次へ",
      pageOf: "{page} / {total} ページ",
    },
  },

  // BI 市況分析 placeholder (wholesaler/bi/analysis/page.tsx).
  //
  // Phase 2 機能のプレースホルダ。サイドバーリンクの 404 を防ぐ。
  biAnalysis: {
    title: "市況分析",
    subtitle: "市場動向・地域別需要・競合比較などを分析します（Phase 2 予定）",
    placeholderTitle: "この機能は準備中です",
    placeholderBody:
      "市況分析（競合店分析・地域別需要トレンド・価格動向など）は Phase 2 で実装予定です。現在は BI ダッシュボード（/bi）で売上・粗利・取引先ランキングを確認できます。",
  },
  /** 催事の開催日（複数日 × 日別開催時間）。代理店が登録する。 */
  eventDays: {
    title: "開催日",
    subtitle: "複数日にまたがる催事は、日ごとに開催時間を登録できます",
    empty: "開催日が登録されていません",
    dateLabel: "開催日",
    startLabel: "開始時刻",
    endLabel: "終了時刻",
    add: "追加・更新",
    remove: "削除",
    saved: "保存しました",
    deleted: "削除しました",
    failed: "保存できませんでした",
    timeUnset: "開催時間未設定",
    shiftCount: "配置 {n}件",
    hint: "開催時間は、パートナー会社のシフト配置で予定時間の初期値になります。未定なら空のままで構いません。",
  },
} as const;

export type Labels = typeof labels;
