import { readdirSync, readFileSync } from "node:fs"
import { join } from "node:path"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"

// CLN-GREP-1: символы, удалённые изменением remove-legacy-wall-geometry, не имеют
// вхождений в src/. Этот файл — единственное допустимое место упоминания имён.
//
// snapVertex проверяется с ограничением: живой канонический snapVertex из
// wall-geometry.ts остаётся; недопустимы только его вхождения в geometry.ts и
// geometry.test.ts (старая реализация и её тесты).

const SELF = "geometry-cleanup.test.ts"
const SRC_DIR = fileURLToPath(new URL(".", import.meta.url))

const REMOVED_UNIQUE = [
  "orthoAxis",
  "findVertexSnap",
  "handleAt",
  "moveWall",
  "pointOn",
  "sameTypeJoint",
  "wallDisplayPolys",
  "pointInConvex",
  "subtractCovered",
  "distToSegment",
]

function tsFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = join(dir, e.name)
    if (e.isDirectory()) return tsFiles(p)
    return e.isFile() && e.name.endsWith(".ts") && e.name !== SELF ? [p] : []
  })
}

const baseName = (f: string) => f.replace(/\\/g, "/").split("/").pop()!

describe("remove-legacy-wall-geometry: мертвый код удалён", () => {
  const files = tsFiles(SRC_DIR)

  it("CLN-GREP-1: удалённые символы нигде не остались", () => {
    const violations = files
      .map((f) => ({ f, src: readFileSync(f, "utf8") }))
      .flatMap(({ f, src }) => {
        const names = REMOVED_UNIQUE.filter((n) => new RegExp(`\\b${n}\\b`).test(src))
        const legacySnapVertex =
          baseName(f) === "geometry.ts" || baseName(f) === "geometry.test.ts"
            ? /\bsnapVertex\b/.test(src)
              ? ["snapVertex"]
              : []
            : []
        return [...names, ...legacySnapVertex].map((n) => `${baseName(f)}: ${n}`)
      })
    expect(violations).toEqual([])
  })

  it("CLN-COVER-1: эквиваленты кейса «клин заливки попадает в позднюю стену» живы", () => {
    const wg = readFileSync(join(SRC_DIR, "wall-geometry.test.ts"), "utf8")
    for (const name of ["HIT-WEDGE-1", "HIT-CONS-1"]) expect(wg).toContain(name)
  })

  it("CLN-COVER-2: сценарии describe moveWall покрыты эквивалентами moveWalls", () => {
    const g = readFileSync(join(SRC_DIR, "geometry.test.ts"), "utf8")
    for (const name of [
      'describe("moveWalls"',
      "смещает группу одним вектором",
      "приваривает стыковой конец соседа к точному новому концу группы",
      "T-примыкание к двум выделенным сдвигается ровно один вектор",
      "стена между концами двух стен группы растягивается между ними",
    ])
      expect(g).toContain(name)
  })

  it("CLN-COVER-3: пять блоков snapVertex канонического модуля живы", () => {
    const wg = readFileSync(join(SRC_DIR, "wall-geometry.test.ts"), "utf8")
    for (const name of [
      "snapVertex: привязка к сетке",
      "snapVertex: привязка к граням и торцам",
      "snapVertex: приоритеты и радиус",
      "snapVertex: орто-привязка",
      "snapVertex: детерминированность",
    ])
      expect(wg).toContain(name)
  })

  it("CLN-COVER-4: единственный тест живого lockedDirection пережил удаление describe snapVertex", () => {
    const g = readFileSync(join(SRC_DIR, "geometry.test.ts"), "utf8")
    // кейс жил внутри удаляемого describe("snapVertex"); реализация обязана
    // перенести его в собственный describe("lockedDirection"), а не потерять
    expect(g).toContain('describe("lockedDirection"')
    expect(g).toContain("направление от грани фиксируется точно перпендикулярно")
    // импорт живого экспорта остаётся
    expect(g).toMatch(/\bimport\b[^;]*\blockedDirection\b/)
  })
})
