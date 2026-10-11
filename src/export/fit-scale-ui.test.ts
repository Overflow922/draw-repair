import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

// change auto-fit-scale: разметка и связка main.ts без выбора масштаба, фильтра форматов и попапа «не влезает»
// (spec drawing-scale «Автоподбор масштаба», «Показ подобранного масштаба»; pdf-export «Формат страницы», REMOVED
// «Попап о невмещающих форматах»; design D4, D4a, D5, D6; test-plan T-14, T-30, T-31, T-34, T-36, T-39).
// Проверяется исходник без комментариев, как в doorway/popups-ui.test.ts. Текст подписи проверяется unit-тестами
// scaleLabel (fit-scale.test.ts); здесь — что main.ts его использует, а экспорт берёт масштаб из подбора, а не из литерала.
// Поведение на экране (T-35, T-38, T-49) в vitest без DOM недоступно и проверяется вручную в браузере (см. test-suite.md).

const html = readFileSync(new URL("../../index.html", import.meta.url), "utf8")
const css = readFileSync(new URL("../style.css", import.meta.url), "utf8")
const main = readFileSync(new URL("../main.ts", import.meta.url), "utf8")
  .replace(/\/\*[\s\S]*?\*\//g, "")
  .replace(/(^|[^:"'`])\/\/[^\n]*/g, "$1")

const formatSelect = ((): string => {
  const start = html.indexOf('id="pdf-format"')
  if (start < 0) return ""
  return html.slice(start, html.indexOf("</select>", start))
})()

// аргументы первого вызова name(...) с учётом вложенных скобок, разделённые запятыми верхнего уровня
function callArgs(source: string, name: string): string[] {
  const start = source.indexOf(`${name}(`)
  if (start < 0) return []
  const args: string[] = []
  let depth = 0
  let current = ""
  for (let i = start + name.length; i < source.length; i++) {
    const ch = source[i] ?? ""
    if (ch === "(" || ch === "[" || ch === "{") {
      depth++
      if (depth === 1) continue
    } else if (ch === ")" || ch === "]" || ch === "}") {
      depth--
      if (depth === 0) {
        args.push(current.trim())
        return args
      }
    } else if (ch === "," && depth === 1) {
      args.push(current.trim())
      current = ""
      continue
    }
    current += ch
  }
  return args
}

// тело обработчика addEventListener("change", ...) списка формата
function formatChangeHandler(): string {
  const start = main.indexOf('pdfFormat.addEventListener("change"')
  if (start < 0) return ""
  const open = main.indexOf("{", start)
  let depth = 0
  for (let i = open; i < main.length; i++) {
    if (main[i] === "{") depth++
    else if (main[i] === "}" && --depth === 0) return main.slice(open, i + 1)
  }
  return ""
}

describe("разметка нижней панели", () => {
  it("T-30: списка или кнопки выбора масштаба в разметке нет", () => {
    expect(html.includes('id="pdf-scale"')).toBe(false)
    expect(html).not.toMatch(/<select[^>]*title="Масштаб чертежа"/)
  })

  it("T-36: список форматов содержит ровно A4, A3, A2, A1, A0 по порядку, по умолчанию выбран A4", () => {
    const values = [...formatSelect.matchAll(/<option[^>]*value="([^"]+)"/g)].map((m) => m[1])
    expect(values).toEqual(["A4", "A3", "A2", "A1", "A0"])
    expect(formatSelect).toMatch(/<option value="A4" selected>/)
  })

  it("T-34: сразу после списка формата стоит неинтерактивная текстовая подпись, в которую main.ts пишет scaleLabel", () => {
    const after = html.slice(html.indexOf("</select>", html.indexOf('id="pdf-format"')) + "</select>".length)
    const next = /^\s*<(\w+)([^>]*)>/.exec(after)
    expect(next).not.toBeNull()
    expect(["span", "output", "div"]).toContain(next?.[1])
    const id = /id="([^"]+)"/.exec(next?.[2] ?? "")?.[1]
    expect(id).toBeTruthy()
    expect(next?.[2]).not.toMatch(/\b(onclick|tabindex|contenteditable|role="button")\b/)
    expect(main).toMatch(new RegExp(`querySelector[^\\n]*#${id}\\b`))
    expect(main).toMatch(/\.textContent\s*=\s*scaleLabel\(/)
  })
})

describe("удалённый фильтр форматов и попап", () => {
  it("T-39: в разметке и стилях нет попапа «не влезает» и списка масштаба", () => {
    expect(html.includes("fit-popup")).toBe(false)
    expect(css.includes("fit-popup")).toBe(false)
    expect(css.includes("#pdf-scale")).toBe(false)
  })

  it("T-39: main.ts не показывает попап, не пересобирает список форматов и не выбирает масштаб вручную", () => {
    for (const gone of ["fit-popup", "showFitPopup", "hideFitPopup", "unavailableFormats", "availableFormatsForPages", "availableFormats", "chooseFormat", "pdf-scale"]) {
      expect(main.includes(gone), gone).toBe(false)
    }
    expect(main).not.toMatch(/\b(?:current\(\)|drawing)\.scale\b/)
    expect(main).not.toMatch(/\bscale:\s*\d/)
  })

  it("T-39: main.ts не отключает список форматов и не пересобирает его", () => {
    expect(main).not.toMatch(/pdfFormat\.disabled\s*=/)
    expect(main).not.toMatch(/pdfFormat\.replaceChildren/)
  })

  it("T-39: модули экспорта не предоставляют фильтр форматов и выбор «наименьшего вмещающего»", async () => {
    const pdf: Record<string, unknown> = { ...(await import("./pdf")) }
    const pageFormat: Record<string, unknown> = { ...(await import("./page-format")) }
    expect("availableFormats" in pdf).toBe(false)
    expect("availableFormatsForPages" in pdf).toBe(false)
    expect("chooseFormat" in pageFormat).toBe(false)
  })
})

describe("связка подобранного масштаба", () => {
  it("T-31: main.ts импортирует scaleLabel и fitScale из модуля подбора", () => {
    expect(main).toMatch(/import\s*\{[^}]*\bscaleLabel\b[^}]*\}\s*from\s*"\.\/export\/fit-scale"/)
    expect(main).toMatch(/import\s*\{[^}]*\bfitScale\b[^}]*\}\s*from\s*"\.\/export\/fit-scale"/)
  })

  it("T-14: масштаб для exportPages берётся из fitScale, а не из литерала или поля чертежа", () => {
    const args = callArgs(main, "exportPages")
    expect(args.length).toBe(5)
    const scaleArg = args[2] ?? ""
    expect(scaleArg).not.toMatch(/^\d/)
    expect(scaleArg).not.toMatch(/\.scale\b/)
    if (/^[A-Za-z_]\w*$/.test(scaleArg)) {
      expect(main).toMatch(new RegExp(`(?:const|let)\\s+${scaleArg}\\b[^;\\n]*=[^;\\n]*\\bfitScale\\(`))
    } else {
      expect(scaleArg).toMatch(/\bfitScale\(/)
    }
  })

  it("T-32: смена формата пересчитывает подпись: обработчик change списка формата вызывает синхронизацию подписи", () => {
    const body = formatChangeHandler()
    expect(body.length).toBeGreaterThan(0)
    expect(body).toMatch(/scaleLabel\(|[sS]ync\w*\(/)
  })
})