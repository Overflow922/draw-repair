import { describe, expect, it } from "vitest"
import type { Dimension } from "../types"
import { deepFreeze, dimension, drawing, idsOf, mark, opening, wall } from "./mounting.test-utils"
import { openWorkspace, storedContent } from "./mounting-workspace"

// change mounting-plan, apply (design D2, D5, D6): рабочий набор плана «Монтаж» — преобразование «хранимое → сцена →
// хранимое». Тесты добавлены при реализации и не входят в утверждённый набор test-validation.md.

const MARK = mark("m", "W", "a", 100, 190)
const N = wall("N", 0, 100, 0, 400)

describe("openWorkspace", () => {
  it("WS-01: сцена — остатки и собственные стены; остатки отмечены, старые элементы отмечены", () => {
    const o = opening("o", "W", "a", 200)
    const { scene, workspace } = openWorkspace(drawing({ doorways: [o], demolition: [MARK], mounting: { walls: [N], dimensions: [] } }))
    expect(idsOf(scene.walls)).toEqual(["W~0", "W~1900", "N"])
    expect([...workspace.remnantIds]).toEqual(["W~0", "W~1900"])
    expect([...workspace.oldElementIds]).toEqual(["o"])
    expect(scene.doorways.map((d) => d.id)).toEqual(["o"])
  })

  it("WS-02: невидимые сохранённые размеры и элементы выделены в скрытые, видимые — нет", () => {
    const shown: Dimension = dimension(["N", 0], ["N", 2], ["N", 1], ["N", 3])
    const hidden: Dimension = dimension(["gone", 0], ["N", 2], ["N", 1], ["N", 3])
    const ownShown = opening("a1", "W", "a", 10)
    const ownHidden = opening("a2", "ghost", "a", 10)
    const { scene, workspace } = openWorkspace(drawing({ mounting: { walls: [N], dimensions: [shown, hidden], doorways: [ownShown, ownHidden] } }))
    expect(scene.dimensions).toEqual([shown])
    expect(workspace.hiddenDimensions).toEqual([hidden])
    expect(scene.doorways.map((d) => d.id)).toEqual(["a1"])
    expect(workspace.hiddenElements).toEqual([ownHidden])
  })

  it("WS-03: не мутирует чертёж", () => {
    expect(() => openWorkspace(deepFreeze(drawing({ demolition: [MARK], mounting: { walls: [N], dimensions: [] } })))).not.toThrow()
  })
})

describe("storedContent", () => {
  it("WS-10: неизменённая сцена даёт то же содержимое, что хранилось (без остатков и старых элементов)", () => {
    const stored = { walls: [N], dimensions: [dimension(["W~0", 1], ["N", 2], ["W~0", 1], ["N", 3])], doorways: [opening("po", "N", "a", 10)] }
    const d = drawing({ doorways: [opening("o", "W", "a", 200)], demolition: [MARK], mounting: stored })
    const { scene, workspace } = openWorkspace(d)
    expect(storedContent(scene, workspace, d)).toEqual(stored)
  })

  it("WS-11: элемент, поставленный на остаток, хранится со ссылкой на стену обмера и смещением от её конца a", () => {
    const d = drawing({ demolition: [MARK], mounting: { walls: [], dimensions: [] } })
    const { scene, workspace } = openWorkspace(d)
    scene.doorways.push({ ...opening("new", "W~1900", "a", 10) })
    expect(storedContent(scene, workspace, d).doorways).toEqual([opening("new", "W", "a", 200)])
  })

  it("WS-11: привязка b — смещение пересчитывается от конца b исходной стены (остаток не доходит до конца)", () => {
    const d = drawing({ demolition: [mark("m", "W", "b", 0, 5)], mounting: { walls: [], dimensions: [] } })
    const { scene, workspace } = openWorkspace(d)
    scene.doorways.push(opening("new", "W~0", "b", 5))
    expect(storedContent(scene, workspace, d).doorways).toEqual([opening("new", "W", "b", 10)])
  })

  it("WS-11: элемент на собственной стене хранится как есть", () => {
    const d = drawing({ mounting: { walls: [N], dimensions: [] } })
    const { scene, workspace } = openWorkspace(d)
    scene.doorways.push(opening("new", "N", "a", 10))
    expect(storedContent(scene, workspace, d).doorways).toEqual([opening("new", "N", "a", 10)])
  })

  it("WS-12: круг: элемент, разрешённый на остаток и сохранённый обратно, разрешается так же", () => {
    const d = drawing({ demolition: [MARK], mounting: { walls: [], dimensions: [], doorways: [opening("po", "W", "a", 250)] } })
    const { scene, workspace } = openWorkspace(d)
    expect(scene.doorways).toEqual([opening("po", "W~1900", "a", 60)])
    expect(storedContent(scene, workspace, d).doorways).toEqual([opening("po", "W", "a", 250)])
  })

  it("WS-13: остатки в содержимое не попадают, новые собственные стены — попадают", () => {
    const d = drawing({ demolition: [MARK] })
    const { scene, workspace } = openWorkspace(d)
    scene.walls.push(N)
    expect(storedContent(scene, workspace, d).walls).toEqual([N])
  })

  it("WS-14: старые элементы обмера в содержимое не попадают", () => {
    const d = drawing({ doorways: [opening("o", "W", "a", 200)] })
    const { scene, workspace } = openWorkspace(d)
    expect(storedContent(scene, workspace, d).doorways).toBeUndefined()
  })

  it("WS-15: невидимые размеры и элементы сохраняются при записи", () => {
    const hiddenDim = dimension(["gone", 0], ["N", 2], ["N", 1], ["N", 3])
    const hiddenEl = opening("h", "ghost", "a", 10)
    const d = drawing({ mounting: { walls: [N], dimensions: [hiddenDim], doorways: [hiddenEl] } })
    const { scene, workspace } = openWorkspace(d)
    const out = storedContent(scene, workspace, d)
    expect(out.dimensions).toEqual([hiddenDim])
    expect(out.doorways).toEqual([hiddenEl])
  })

  it("WS-16: автоматический размер, принадлежащий остатку, не хранится; принадлежащий собственной стене — хранится", () => {
    const d = drawing({ demolition: [MARK], mounting: { walls: [N], dimensions: [] } })
    const { scene, workspace } = openWorkspace(d)
    const ofRemnant: Dimension = { ...dimension(["W~0", 0], ["W~0", 2], ["W~0", 1], ["W~0", 3]), auto: "W~0" }
    const ofOwn: Dimension = { ...dimension(["N", 0], ["N", 2], ["N", 1], ["N", 3]), auto: "N" }
    scene.dimensions.push(ofRemnant, ofOwn)
    expect(storedContent(scene, workspace, d).dimensions).toEqual([ofOwn])
  })

  it("WS-17: список элементов не создаётся, если его не было и элементов нет", () => {
    const d = drawing({ mounting: { walls: [N], dimensions: [] } })
    const { scene, workspace } = openWorkspace(d)
    expect("doorways" in storedContent(scene, workspace, d)).toBe(false)
  })

  it("WS-18: пустой список элементов остаётся пустым списком, если был в чертеже", () => {
    const d = drawing({ mounting: { walls: [N], dimensions: [], doorways: [] } })
    const { scene, workspace } = openWorkspace(d)
    expect(storedContent(scene, workspace, d).doorways).toEqual([])
  })

  it("WS-19: не мутирует чертёж и рабочий набор", () => {
    const d = deepFreeze(drawing({ demolition: [MARK], mounting: { walls: [N], dimensions: [], doorways: [opening("po", "W", "a", 250)] } }))
    const { scene, workspace } = openWorkspace(d)
    expect(() => storedContent(deepFreeze(scene), workspace, d)).not.toThrow()
  })
})
