## Context

- `drawDemolitionScene` (`src/demolition/demolition-render.ts`) рисует подложку через `drawScene(..., { underlay: true, doorways })`; флаг `underlay` подавляет подписи помещений, размеры и `drawDoorways` (подписи, полотно и дуга двери), а вырезы в стенах делает `drawWall` по списку `doorways`. Затем поверх подложки рисуются области сноса (закраска бумагой, красные контур и штриховка).
- `pagesOf` (`src/export/pdf.ts`) передаёт на страницу демонтажа `visibleElements(doorways, marks)`; `pageBounds` для страницы демонтажа считает габариты без элементов.
- `main.ts` (`drawDemolitionPlan`) передаёт `visibleElements(doorways, marks)`.
- `hiddenElements`/`visibleElements` (`mark-region.ts`) нужны только для скрытия.

## Goals / Non-Goals

**Goals:** элементы стены на плане «Демонтаж» (экран и PDF) рисуются полностью и поверх области сноса; габариты страницы учитывают элементы; удалить скрытие как мёртвый код.

**Non-Goals:** выделение и правка элементов на плане демонтажа; размеры и площади на нём.

## Decisions

### D1. Слой элементов — отдельная функция, рисуется после области сноса

Закраска бумагой скрывает всё под областью, поэтому слой элементов должен рисоваться после неё. В `render.ts` добавляется экспортируемая функция

```
drawElementsLayer(ctx, walls, unit, view, opts: RenderOptions): void
```

(настройка шрифта и выравнивания как в `drawScene`, `findRooms(walls)` для стороны подписей, затем `drawDoorways` без выделенных объектов). `underlay` по-прежнему отключает слой элементов внутри `drawScene`; `drawDemolitionScene` вызывает `drawElementsLayer` после областей сноса и перед числами ширины. Палитра с `ink = muted` даёт серый цвет элементов. Список `doorways` для подложки — все элементы чертежа (по ним же вырезаются проёмы в стенах).

### D2. Скрытие удаляется

`hiddenElements`, `visibleElements` и их тесты удаляются; `main.ts` и `pagesOf` передают все элементы; `pageBounds` всегда учитывает `page.doorways`.

### D3. Порядок

1. `render.ts`: `drawElementsLayer`. 2. `demolition-render.ts`. 3. `mark-region.ts` (удаление). 4. `pdf.ts`. 5. `main.ts`.

## Risks / Trade-offs

- Серые элементы поверх красной штриховки читаются хуже, чем на белом: цвет и порядок слоёв можно уточнить позже (`TODO.md`).
- Область сноса больше ничего не говорит о проёмах в ней: пользователь видит и проём, и красную область.
