import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import { MATERIALS } from "./types"

// change new-wall-materials: образцы материалов во вспомогательной панели «Стена» — разметка index.html совпадает с каталогом
// (spec wall-types «Выбор типа стены»: состав, порядок, подписи, дефолт «Кирпич»; test-plan WM-U1, WM-U2, WM-U8).
// Исполнение main.ts без DOM-окружения недоступно, поэтому проверяется статическая разметка панели.

const html = readFileSync(new URL("../index.html", import.meta.url), "utf8")

interface Button {
  material: string
  title: string
  label: string
  active: boolean
  hasPreview: boolean
}

function buttons(): Button[] {
  const panel = /<div id="wall-types"[^>]*>([\s\S]*?)<\/div>/.exec(html)
  if (!panel?.[1]) throw new Error("в index.html нет панели #wall-types")
  const found: Button[] = []
  for (const m of panel[1].matchAll(/<button\b([^>]*)>([\s\S]*?)<\/button>/g)) {
    const attrs = m[1] ?? ""
    const body = m[2] ?? ""
    found.push({
      material: /data-material="([^"]*)"/.exec(attrs)?.[1] ?? "",
      title: /title="([^"]*)"/.exec(attrs)?.[1] ?? "",
      label: /<span>([^<]*)<\/span>/.exec(body)?.[1] ?? "",
      active: /class="[^"]*\bactive\b[^"]*"/.test(attrs),
      hasPreview: /<canvas\b[^>]*width="36"[^>]*height="14"/.test(body),
    })
  }
  return found
}

describe("панель образцов материалов в index.html", () => {
  it("WM-U2: кнопки образцов — те же материалы каталога в том же порядке", () => {
    expect(buttons().map((b) => b.material)).toEqual(MATERIALS.map((m) => m.id))
  })

  it("WM-U2: подпись и подсказка каждой кнопки — название материала из каталога", () => {
    const list = buttons()
    expect(list.map((b) => b.label)).toEqual(MATERIALS.map((m) => m.label))
    expect(list.map((b) => b.title)).toEqual(MATERIALS.map((m) => m.label))
  })

  it("WM-U1: у каждой кнопки есть холст мини-превью 36×14", () => {
    const list = buttons()
    expect(list.length).toBe(MATERIALS.length)
    for (const b of list) expect(b.hasPreview, b.material).toBe(true)
  })

  it("WM-U8: по умолчанию активна ровно одна кнопка — «Кирпич»", () => {
    const active = buttons().filter((b) => b.active)
    expect(active.map((b) => b.material)).toEqual(["brick"])
  })

  it("WM-U2: кнопок «Железобетон» и «Дерево (вдоль)» нет", () => {
    const list = buttons()
    expect(list.map((b) => b.material)).not.toContain("reinforced")
    expect(list.map((b) => b.label)).not.toContain("Железобетон")
    expect(list.map((b) => b.label)).not.toContain("Дерево (вдоль)")
  })
})
