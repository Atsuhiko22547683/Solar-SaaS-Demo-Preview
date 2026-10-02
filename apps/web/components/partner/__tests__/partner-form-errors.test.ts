// 検証エラーの取り出し。
//
// Server Action をまたぐと ZodError の `issues` は失われ、`message`（指摘の JSON）
// だけが残る。その JSON を画面にそのまま出さず、項目別のメッセージに畳むことを固定する。

import { describe, expect, it } from "vitest";

import { extractFieldErrors, issuesToFieldErrors } from "../partner-form";

describe("issuesToFieldErrors", () => {
  it("path の先頭を項目名にして、最初の指摘だけを残す", () => {
    const fields = issuesToFieldErrors([
      { path: ["boothArea"], message: "ブース場所を選択してください" },
      { path: ["boothArea"], message: "あとから来た別の指摘" },
      { path: ["name"], message: "お客様名を入力してください" },
    ]);
    expect(fields).toEqual({
      boothArea: "ブース場所を選択してください",
      name: "お客様名を入力してください",
    });
  });

  it("path が無い指摘は項目に割り当てない", () => {
    expect(issuesToFieldErrors([{ message: "全体のエラー" }])).toEqual({});
  });
});

describe("extractFieldErrors", () => {
  it("issues を持つエラー（同一プロセス）は項目別に畳む", () => {
    const err = Object.assign(new Error("whatever"), {
      issues: [{ path: ["boothArea"], message: "ブース場所を選択してください" }],
    });
    expect(extractFieldErrors(err)).toEqual({
      fields: { boothArea: "ブース場所を選択してください" },
      message: null,
    });
  });

  it("message が指摘の JSON なら、生のまま出さず項目別に畳む", () => {
    // Server Action 越しに実際に届く形（boothArea 未選択のときの ZodError.message）。
    const raw = JSON.stringify([
      {
        received: "",
        code: "invalid_enum_value",
        options: ["ENTRANCE", "REFORM_CORNER", "OTHER"],
        path: ["boothArea"],
        message: "ブース場所を選択してください",
      },
    ]);
    const result = extractFieldErrors(new Error(raw));
    expect(result.fields).toEqual({ boothArea: "ブース場所を選択してください" });
    expect(result.message).toBeNull();
  });

  it("項目を特定できない JSON なら、生の JSON ではなく案内文にする", () => {
    const raw = JSON.stringify([{ code: "custom", message: "理由不明" }]);
    const result = extractFieldErrors(new Error(raw));
    expect(result.fields).toEqual({});
    expect(result.message).toBe("入力内容を確認してください。");
    expect(result.message).not.toContain("{");
  });

  it("ふつうのエラーはメッセージをそのまま渡す", () => {
    expect(extractFieldErrors(new Error("保存できませんでした"))).toEqual({
      fields: {},
      message: "保存できませんでした",
    });
  });

  it("JSON に見えない文字列は壊さずそのまま渡す", () => {
    expect(extractFieldErrors(new Error("[未完了] 何かの警告")).message).toBe(
      "[未完了] 何かの警告",
    );
  });
});
