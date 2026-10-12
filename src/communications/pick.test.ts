import { describe, expect, it } from "vitest"
import { hitCommunication } from "./pick"
import { duct, riser } from "./communications.test-utils"

// change add-communications: выбор коммуникации под курсором — для выделения кликом и ластика
// (spec communications «Выделение, перемещение и удаление коммуникации»; wall-deletion «Ластик и удаление коммуникаций»).

const R = riser(100, 100, 10, "r1")
const D = duct(200, 100, 30, 20, "d1")

describe("hitCommunication", () => {
  it("CS-01: клик по телу стояка и воздуховода возвращает ту же коммуникацию", () => {
    expect(hitCommunication({ x: 100, y: 100 }, [R, D], 0)).toBe(R)
    expect(hitCommunication({ x: 103, y: 100 }, [R, D], 0)).toBe(R)
    expect(hitCommunication({ x: 214, y: 109 }, [R, D], 0)).toBe(D)
  })

  it("CS-01b: круг — по окружности, а не по описанному квадрату: угол квадрата вне круга", () => {
    expect(hitCommunication({ x: 104, y: 104 }, [R], 0)).toBeNull() // расстояние 5,66 > 5
    expect(hitCommunication({ x: 103, y: 103 }, [R], 0)).toBe(R) // 4,24 < 5
  })

  it("CS-01c: вне тела без допуска — null; с допуском в радиусе — попадание", () => {
    expect(hitCommunication({ x: 106, y: 100 }, [R], 0)).toBeNull()
    expect(hitCommunication({ x: 106, y: 100 }, [R], 2)).toBe(R)
    expect(hitCommunication({ x: 216, y: 100 }, [D], 0)).toBeNull()
    expect(hitCommunication({ x: 216, y: 100 }, [D], 2)).toBe(D)
    expect(hitCommunication({ x: 218, y: 100 }, [D], 2)).toBeNull()
  })

  it("CS-01d: пустой список и пустое место", () => {
    expect(hitCommunication({ x: 100, y: 100 }, [], 5)).toBeNull()
    expect(hitCommunication({ x: 0, y: 0 }, [R, D], 1)).toBeNull()
  })

  it("CS-01e: касающиеся коммуникации — точка в теле возвращает владельца тела", () => {
    const left = duct(85, 100, 30, 20, "left") // x 70…100
    const right = duct(115, 100, 30, 20, "right") // x 100…130
    expect(hitCommunication({ x: 80, y: 100 }, [left, right], 0)).toBe(left)
    expect(hitCommunication({ x: 120, y: 100 }, [left, right], 0)).toBe(right)
  })
})
