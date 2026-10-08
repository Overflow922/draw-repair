import { describe, expect, it } from "vitest"
import { moveWalls } from "./geometry"
import { userWalls } from "./move-joints.test-utils"
import { applyStretch, planOrthoStretch } from "./ortho-stretch"
import type { Point, Wall } from "./types"
import { moveWallsBounded } from "./wall-edit"
import { FREE, ORTHO, attachmentHolds, attachments, body, connected, overlapArea, overlapDepth } from "./wall-edit.test-utils"

// change wall-move-bounds: инварианты на чертеже пользователя (test-plan INV-1..INV-3).
// Для каждой стены как seed — 8 направлений × 3 длины, без орто и с орто, от исходной геометрии.

const DIRS = Array.from({ length: 8 }, (_, k) => (k * Math.PI) / 4 + 0.05)
const LENGTHS = [10, 60, 200]

interface Case {
  seed: number
  v: Point
  mode: { ortho: boolean }
}

const CASES: Case[] = userWalls().flatMap((_, seed) =>
  [FREE, ORTHO].flatMap((mode) =>
    DIRS.flatMap((ang) => LENGTHS.map((l) => ({ seed, mode, v: { x: Math.cos(ang) * l, y: Math.sin(ang) * l } }))),
  ),
)

const onDominantAxis = (v: Point): Point => (Math.abs(v.x) >= Math.abs(v.y) ? { x: v.x, y: 0 } : { x: 0, y: v.y })

const label = (c: Case): string => `seed ${c.seed}, v (${c.v.x.toFixed(2)}, ${c.v.y.toFixed(2)}), ortho ${c.mode.ortho}`

function run(c: Case): { before: Wall[]; after: Wall[]; applied: Point } {
  const before = userWalls()
  const after = userWalls()
  const applied = moveWallsBounded(after, [after[c.seed]], c.v, c.mode)
  return { before, after, applied }
}

describe("инварианты ограниченной правки на чертеже пользователя", () => {
  it("INV-1: исходные T-примыкания сохраняются после любой правки (та же линия, в пределах грани)", () => {
    const att = attachments(userWalls())
    expect(att.length).toBeGreaterThan(0)
    const broken: string[] = []
    for (const c of CASES) {
      const { before, after } = run(c)
      for (const a of att)
        if (!attachmentHolds(a, before, after)) broken.push(`${label(c)}: ${after[a.leg].id}.${a.end} → ${after[a.host].id}`)
    }
    expect(broken).toEqual([])
  })

  it("INV-2: нет новых пересечений тел, площадь исходных наложений не растёт", () => {
    const base = userWalls()
    const violations: string[] = []
    for (const c of CASES) {
      const { after } = run(c)
      for (let i = 0; i < base.length; i++)
        for (let j = i + 1; j < base.length; j++) {
          if (connected(base[i], base[j])) continue
          const d0 = overlapDepth(body(base[i]), body(base[j]))
          if (d0 > 0.01) {
            const a0 = overlapArea(body(base[i]), body(base[j]))
            const a1 = overlapArea(body(after[i]), body(after[j]))
            if (a1 > a0 + 1e-6) violations.push(`${label(c)}: площадь ${base[i].id}/${base[j].id} ${a0} → ${a1}`)
          } else {
            const d1 = overlapDepth(body(after[i]), body(after[j]))
            if (d1 > 0.01 + 1e-6) violations.push(`${label(c)}: ${base[i].id}/${base[j].id} глубина ${d1}`)
          }
        }
    }
    expect(violations).toEqual([])
  })

  it("INV-3: применённый вектор не длиннее запрошенного; при допустимом запросе — равен ему и даёт тот же итог, что примитив", () => {
    const base = userWalls()
    const att = attachments(base)
    let admissibleCount = 0
    const problems: string[] = []
    for (const c of CASES) {
      const { after, applied } = run(c)
      const lenReq = Math.hypot(c.v.x, c.v.y)
      if (Math.hypot(applied.x, applied.y) > lenReq + 1e-6) problems.push(`${label(c)}: длиннее запроса`)
      // итог примитива без ограничений; при орто правка идёт по оси большей составляющей
      // (wall-selection «Орто без боковой составляющей»), поэтому примитив получает вектор на оси
      const req = c.mode.ortho ? onDominantAxis(c.v) : c.v
      const free = userWalls()
      if (c.mode.ortho) applyStretch(planOrthoStretch(free, { kind: "walls", walls: [free[c.seed]] }, req), req)
      else moveWalls(free, [free[c.seed]], req)
      // сравнение только для правок, не затрагивающих ни одной стены T-примыкания:
      // там действует проекция и диапазон, а не только запрет пересечений
      const moved = (i: number): boolean =>
        free[i].a.x !== base[i].a.x || free[i].a.y !== base[i].a.y || free[i].b.x !== base[i].b.x || free[i].b.y !== base[i].b.y
      const attachOk = att.every((a) => !moved(a.leg) && !moved(a.host))
      const overlapOk = base.every((p, i) =>
        base.every((q, j) => {
          if (j <= i || connected(p, q)) return true
          const d0 = overlapDepth(body(p), body(q))
          if (d0 > 0.01) return overlapArea(body(free[i]), body(free[j])) <= overlapArea(body(p), body(q)) + 1e-6
          return overlapDepth(body(free[i]), body(free[j])) <= 0.01
        }),
      )
      if (!attachOk || !overlapOk) continue
      admissibleCount++
      if (Math.abs(applied.x - req.x) > 1e-6 || Math.abs(applied.y - req.y) > 1e-6) {
        problems.push(`${label(c)}: допустимый запрос ограничен до (${applied.x}, ${applied.y})`)
        continue
      }
      after.forEach((x, i) => {
        const f = free[i]
        if (Math.hypot(x.a.x - f.a.x, x.a.y - f.a.y) > 1e-6 || Math.hypot(x.b.x - f.b.x, x.b.y - f.b.y) > 1e-6)
          problems.push(`${label(c)}: ${x.id} отличается от примитива`)
      })
    }
    expect(admissibleCount).toBeGreaterThan(50)
    expect(problems).toEqual([])
  })
})
