# Test Suite

Новые тесты — отдельные файлы; существующие тесты не изменялись. Первый прогон (до реализации): `npx vitest run src/plans.test.ts src/storage-plans.test.ts src/history-plans.test.ts src/export/pdf-pages.test.ts`.

Итог первого прогона: 4 файла упали, 47 тестов упали, 2 прошли (см. «Unexpected Passes»). `plans.test.ts` и `storage-plans.test.ts` падают целиком на `Cannot find module './plans'`; `history-plans.test.ts` и `pdf-pages.test.ts` — `planHistory is not a function`, `buildPdfPages/availableFormatsForPages/pagesOf/exportPages is not a function`.

## Tests

### `src/plans.test.ts` — каталог планов (spec drawing-plans)

| ID | Requirement | Test File | Test Name | Initial Result |
|---|---|---|---|---|
| PL-01 | drawing-plans: Каталог планов | src/plans.test.ts | каталог содержит единственный план «Обмерочный план» с идентификатором measure | FAIL (нет модуля) |
| PL-02 | drawing-plans: Каталог планов | src/plans.test.ts | план по умолчанию — measure и он первый в каталоге | FAIL (нет модуля) |
| PL-02 | drawing-plans: Каталог планов | src/plans.test.ts | идентификаторы каталога уникальны, подписи непусты, каждый идентификатор признаётся isPlanId | FAIL (нет модуля) |
| PL-03 | drawing-plans: Активный план чертежа | src/plans.test.ts | принимает идентификатор каталога | FAIL (нет модуля) |
| PL-03 | drawing-plans: Активный план чертежа | src/plans.test.ts | отвергает значение, не являющееся идентификатором плана (11 значений: неизвестный id, "", "Measure", " measure", название, 5, null, undefined, true, {}, ["measure"]) | FAIL (нет модуля) |
| PL-04 | drawing-plans: Активный план чертежа | src/plans.test.ts | чертёж без поля активного плана — measure | FAIL (нет модуля) |
| PL-04 | drawing-plans: Активный план чертежа | src/plans.test.ts | сохранённый идентификатор каталога возвращается как есть | FAIL (нет модуля) |
| PL-04 | drawing-plans: Активный план чертежа | src/plans.test.ts | недопустимое значение поля читается как measure (5 значений) | FAIL (нет модуля) |
| PL-04 | drawing-plans: Активный план чертежа | src/plans.test.ts | результат всегда идентификатор каталога | FAIL (нет модуля) |
| PL-04 | drawing-plans: Активный план чертежа | src/plans.test.ts | функция не меняет чертёж | FAIL (нет модуля) |
| PL-05 | drawing-history: Независимость историй планов | src/plans.test.ts | для обмерочного плана ключ — идентификатор чертежа без суффикса | FAIL (нет модуля) |
| PL-05 | drawing-history: Независимость историй планов | src/plans.test.ts | пустой идентификатор чертежа даёт пустой ключ (без суффикса) | FAIL (нет модуля) |
| PL-06 | drawing-history: Независимость историй планов | src/plans.test.ts | разные чертежи дают разные ключи | FAIL (нет модуля) |

### `src/storage-plans.test.ts` — поле activePlan в документе (spec drawing-storage)

| ID | Requirement | Test File | Test Name | Initial Result |
|---|---|---|---|---|
| ST-01 | drawing-storage: Активный план чертежа в документе (Чертёж без активного плана) | src/storage-plans.test.ts | чертёж версии 3 без поля активного плана открывается с планом measure и поле не добавляется | FAIL (нет модуля plans) |
| ST-01 | то же | src/storage-plans.test.ts | документ без поля не считается повреждённым — все данные чертежа восстановлены | FAIL (нет модуля plans) |
| ST-02 | drawing-storage: Неизвестный идентификатор плана | src/storage-plans.test.ts | недопустимый activePlan (8 значений: неизвестный id, "", "Measure", 5, null, true, {}, ["measure"]) не повреждает документ … активен measure | FAIL (нет модуля plans) |
| ST-02 | то же | src/storage-plans.test.ts | недопустимое значение не мешает остальным чертежам документа | FAIL (нет модуля plans) |
| ST-03 | drawing-storage: Активный план сохраняется | src/storage-plans.test.ts | сохранённый activePlan переживает serialize → parse | FAIL (нет модуля plans) |
| ST-03 | то же | src/storage-plans.test.ts | serialize записывает activePlan в JSON чертежа | FAIL (нет модуля plans) |
| ST-04 | drawing-storage: Содержимое обмерочного плана в прежних полях; drawing-plans: Каталог планов | src/storage-plans.test.ts | стены, размеры и проёмы читаются из прежних полей без потерь | FAIL (нет модуля plans) |
| ST-04 | то же | src/storage-plans.test.ts | запись не переносит объекты в новые поля — в JSON нет ключа plans | FAIL (нет модуля plans) |
| ST-05 | drawing-storage: Содержимое обмерочного плана в прежних полях | src/storage-plans.test.ts | версия документа остаётся 3 при чтении и записи | FAIL (нет модуля plans) |
| ST-06 | drawing-plans: Активный план у каждого чертежа свой | src/storage-plans.test.ts | у двух чертежей поле хранится независимо: у одного сохранено, у другого отсутствует | FAIL (нет модуля plans) |
| ST-07 | drawing-storage: Данные неизвестной будущей версии (регрессия) | src/storage-plans.test.ts | документ будущей версии по-прежнему только для чтения и не читает поле плана | FAIL (нет модуля plans) |

### `src/history-plans.test.ts` — история на (чертёж, план) (spec drawing-history)

| ID | Requirement | Test File | Test Name | Initial Result |
|---|---|---|---|---|
| HI-01 | drawing-history: Независимость историй планов | src/history-plans.test.ts | для обмерочного плана возвращает ту же историю, что drawingHistory чертежа | FAIL (planHistory is not a function) |
| HI-01 | то же | src/history-plans.test.ts | ранее созданная через drawingHistory история видна через planHistory | FAIL |
| HI-02 | то же | src/history-plans.test.ts | повторный вызов возвращает тот же объект, записи накапливаются, а не теряются | FAIL |
| HI-02 | то же | src/history-plans.test.ts | запись → отмена → повтор через planHistory работают как через drawingHistory | FAIL |
| HI-04 | то же | src/history-plans.test.ts | история чертежа без записей создаётся лениво под ключом идентификатора чертежа, без суффикса | FAIL |
| HI-05 | то же (Переключение плана не добавляет шагов) | src/history-plans.test.ts | чтение истории (как при переключении плана) не добавляет шагов и не очищает повтор | FAIL |
| HI-07 | то же | src/history-plans.test.ts | истории разных чертежей независимы | FAIL |
| HI-03 | то же (История обмерочного плана совпадает с прежней) | src/history-plans.test.ts | parseHistory читает документ версии 2; planHistory обмерочного плана отдаёт его стеки | FAIL |
| HI-03 | то же | src/history-plans.test.ts | отмена по прежней истории работает и ключи не получают суффикса | FAIL |
| HI-06 | то же (формат не меняется) | src/history-plans.test.ts | формат документа истории не меняется — версия 2, ключи по идентификатору чертежа, roundtrip равен исходному | **PASS** (регрессия существующего поведения) |
| HI-06 | то же | src/history-plans.test.ts | запись через planHistory сохраняется в тот же формат и читается обратно | FAIL |
| HI-06 | то же | src/history-plans.test.ts | будущая версия истории по-прежнему читается как пустая и только для чтения | **PASS** (регрессия существующего поведения) |

### `src/export/pdf-pages.test.ts` — страницы PDF и форматы (spec pdf-export)

| ID | Requirement | Test File | Test Name | Initial Result |
|---|---|---|---|---|
| PG-01 | pdf-export: список страниц; drawing-plans: Каталог планов | src/export/pdf-pages.test.ts | единственный план каталога даёт одну страницу с его стенами, размерами и проёмами | FAIL (pagesOf is not a function) |
| PG-01 | то же | src/export/pdf-pages.test.ts | отсутствующий список проёмов превращается в пустой | FAIL |
| PG-01 | то же | src/export/pdf-pages.test.ts | чертёж без объектов даёт одну пустую страницу, а не пустой список | FAIL |
| PG-07 | pdf-export: Экспорт не зависит от активного плана | src/export/pdf-pages.test.ts | результат не зависит от активного плана чертежа | FAIL |
| PG-13 | инвариант: без побочных эффектов | src/export/pdf-pages.test.ts | pagesOf не меняет чертёж | FAIL |
| PG-02 | pdf-export: Одна страница; drawing-plans: Одна страница PDF на каждый план | src/export/pdf-pages.test.ts | одна страница даёт ровно одну страницу PDF | FAIL (buildPdfPages is not a function) |
| PG-03 | pdf-export: Страница на каждый план | src/export/pdf-pages.test.ts | две страницы дают две страницы PDF | FAIL |
| PG-04 | то же | src/export/pdf-pages.test.ts | три страницы дают три страницы PDF | FAIL |
| PG-09 | то же (граница: пустая страница) | src/export/pdf-pages.test.ts | пустая страница между непустыми остаётся страницей PDF (рамка и надпись есть) | FAIL |
| PG-04 | то же | src/export/pdf-pages.test.ts | страница i содержит геометрию только pages[i]: горизонтальная A на первой, вертикальная B на второй | FAIL |
| PG-04 | то же | src/export/pdf-pages.test.ts | при обратном порядке на входе страницы меняются местами | FAIL |
| PG-04 | то же | src/export/pdf-pages.test.ts | подписи высоты проёмов принадлежат своей странице (H=210 только на первой, H=150 только на второй) | FAIL |
| PG-04 | то же | src/export/pdf-pages.test.ts | пустая страница не содержит чужой геометрии | FAIL |
| PG-06 | pdf-export: список страниц (рамка и надпись на каждой) | src/export/pdf-pages.test.ts | на каждой странице нарисованы рамка листа и основная надпись | FAIL |
| PG-06 | то же | src/export/pdf-pages.test.ts | у каждой страницы одно и то же имя, «Р», масштаб и дата в своих графах | FAIL |
| PG-06 | то же | src/export/pdf-pages.test.ts | графа 5 пуста на каждой странице | FAIL |
| PG-06 | то же | src/export/pdf-pages.test.ts | все страницы одного формата и альбомные (A3 — 420×297 мм) | FAIL |
| PG-05 | pdf-export: Размещение в масштабе чертежа (каждая страница) | src/export/pdf-pages.test.ts | масштаб точный на каждой странице: стена 5 м при 1:100 — 50 мм, вертикальная 3 м — 30 мм | FAIL |
| PG-05 | то же | src/export/pdf-pages.test.ts | масштаб общий для всех страниц: при 1:200 — 25 мм и 15 мм | FAIL |
| PG-05 | то же | src/export/pdf-pages.test.ts | каждая страница размещается по габаритам своего плана — центр чертежа в центре области чертежа | FAIL |
| PG-14 | pdf-export: Заполнение основной надписи (масштаб) | src/export/pdf-pages.test.ts | страницы после первой подписаны тем же масштабом, что выбран для чертежа (1:50) | FAIL |
| PG-08 | pdf-export: Одна страница (совместимость) | src/export/pdf-pages.test.ts | одна страница — то же содержимое, что у прежней функции buildPdf (контуры, рамка, тексты) | FAIL (buildPdfPages is not a function) |
| PG-13 | инвариант: без побочных эффектов | src/export/pdf-pages.test.ts | сборка PDF не меняет входные страницы | FAIL |
| PG-15 | pdf-export: Имя файла; список страниц | src/export/pdf-pages.test.ts | exportPages скачивает один файл с именем чертежа и датой, имя и дата стоят на каждой странице | FAIL |
| PG-10 | pdf-export: Форматы учитывают все страницы | src/export/pdf-pages.test.ts | формат ограничен самой крупной страницей: малая + крупная (A3) — без A4 | FAIL (availableFormatsForPages is not a function) |
| PG-10 | то же | src/export/pdf-pages.test.ts | порядок страниц не влияет на результат | FAIL |
| PG-10 | то же | src/export/pdf-pages.test.ts | для одной страницы результат совпадает с availableFormats этой страницы | FAIL |
| PG-10 | то же | src/export/pdf-pages.test.ts | страницы считаются каждая по своим габаритам, а не по общему габариту всех | FAIL |
| PG-10 | то же | src/export/pdf-pages.test.ts | результат — пересечение: крупная по ширине и крупная по высоте страницы вместе исключают A4 и оставляют A3 | FAIL |
| PG-10 | то же | src/export/pdf-pages.test.ts | страница, не помещающаяся на A3, исключает A3 и A4 | FAIL |
| PG-10 | то же | src/export/pdf-pages.test.ts | учитывает масштаб чертежа: стена 3 м влезает на A4 при 1:100 и не влезает при 1:5 | FAIL |
| PG-11 | то же (границы) | src/export/pdf-pages.test.ts | граница по ширине на второй странице: ровно 272 мм — A4 доступен, +0,1 мм — нет | FAIL |
| PG-11 | то же | src/export/pdf-pages.test.ts | граница по ширине на первой странице: результат тот же при обратном порядке | FAIL |
| PG-11 | то же | src/export/pdf-pages.test.ts | граница по высоте на второй странице: ровно 145 мм — A4 доступен, +0,1 мм — нет | FAIL |
| PG-12 | pdf-export: Пустая страница не ограничивает форматы | src/export/pdf-pages.test.ts | страница без объектов не ограничивает форматы: [крупная, пустая] как [крупная] | FAIL |
| PG-12 | то же | src/export/pdf-pages.test.ts | [малая, пустая] даёт все форматы | FAIL |
| PG-12 | то же | src/export/pdf-pages.test.ts | только пустые страницы и пустой список дают все форматы | FAIL |

### Revision 1 — по результатам валидации (VERDICT: FAIL, раунд 1)

Изменялись только новые тесты этого change (они ещё не утверждены); существующие не затрагивались. Первый прогон ревизии: все тесты ревизии падают по тем же причинам (нет `pagesOf`, `buildPdfPages`, `availableFormatsForPages`, модуля `plans`).

| ID | Requirement | Test File | Test Name | Initial Result |
|---|---|---|---|---|
| PG-05 (исправлен) | pdf-export: Размещение в масштабе чертежа | src/export/pdf-pages.test.ts | каждая страница размещается по габаритам своего плана — центр чертежа в центре области чертежа (страницы без проёмов: подписи высоты входят в габариты размещения) | FAIL |
| PG-13 | инвариант: без побочных эффектов | src/export/pdf-pages.test.ts | pagesOf не дописывает чертежу отсутствующий список проёмов | FAIL |
| PG-16 | pdf-export: страница плана содержит объекты только этого плана | src/export/pdf-pages.test.ts | размеры принадлежат своей странице: на первой один размер, на второй два — подписей на второй ровно вдвое больше | FAIL |
| PG-16 | то же | src/export/pdf-pages.test.ts | страница без размеров не получает подписей размеров другой страницы | FAIL |
| PG-17 | то же | src/export/pdf-pages.test.ts | все стены плана рисуются на его странице: Г-образный план на второй странице | FAIL |
| PG-17 | то же | src/export/pdf-pages.test.ts | стены каждой страницы рисуются целиком: первая страница из двух стен тоже | FAIL |
| PG-18 | pdf-export: Форматы учитывают все страницы | src/export/pdf-pages.test.ts | размер, вынесенный далеко от стены, ограничивает форматы страницы: сама стена влезает на A4, с размером — нет | FAIL |
| PG-18 | то же | src/export/pdf-pages.test.ts | размер на второй странице ограничивает форматы так же, как на единственной | FAIL |
| PG-19 | то же | src/export/pdf-pages.test.ts | открывающаяся дверь выходит за стену и ограничивает форматы страницы: стена влезает на A4, с дверью — нет | FAIL |
| ST-02 (усилен) | drawing-storage: Неизвестный идентификатор плана | src/storage-plans.test.ts | недопустимый activePlan (8 значений) … дополнительно: поле отброшено (`"activePlan" in drawing` ложно) | FAIL |

### Revision 2 — по результатам валидации (VERDICT: FAIL, раунд 2)

Раунд 2 нашёл выжившие мутации в размещении страниц с размерами и проёмами (все утверждения PG-05 использовали страницы только со стенами). Добавлены тесты в `src/export/pdf-pages.test.ts`; остальные файлы не менялись.

| ID | Requirement | Test File | Test Name | Initial Result |
|---|---|---|---|---|
| PG-05 | pdf-export: Размещение в масштабе чертежа (каждая страница по своим габаритам) | src/export/pdf-pages.test.ts | размещение страницы не зависит от соседних: страница с размером на втором месте стоит там же, где при сборке отдельно | FAIL |
| PG-05 | то же | src/export/pdf-pages.test.ts | то же для размера на первой странице при другой второй | FAIL |
| PG-05 | то же | src/export/pdf-pages.test.ts | размещение страницы с проёмом на втором месте совпадает с размещением той же страницы отдельно | FAIL |
| PG-05 | то же | src/export/pdf-pages.test.ts | размещение страницы с проёмом на первом месте совпадает с размещением отдельно | FAIL |

### Revision 3 — по результатам валидации (VERDICT: FAIL, раунд 3)

Раунд 3 нашёл выживших: страницы после первой могли рисоваться с сеткой или другой палитрой. Добавлены тесты в `src/export/pdf-pages.test.ts`. PG-20 ловит сетку и другие толщины/пути на поздних страницах; цвета операторов PDF `parsePaths` не разбирает, поэтому палитра поздних страниц тестами не защищена (раунд 4, не блокирует; см. `TODO.md`).

| ID | Requirement | Test File | Test Name | Initial Result |
|---|---|---|---|---|
| PG-20 | pdf-export: список страниц (каждая страница оформляется одинаково, без экранных элементов) | src/export/pdf-pages.test.ts | страницы рисуются одинаково: одинаковые планы на первой и второй странице дают одинаковые векторные операторы | FAIL |
| PG-20 | то же | src/export/pdf-pages.test.ts | то же для трёх страниц: третья страница совпадает с первой | FAIL |

### Регрессия (существующие тесты, не изменялись)

Весь существующий набор `npx vitest run` обязан остаться зелёным без правок (обёртки `buildPdf`, `availableFormats`, `exportDrawing`; формат хранилища и истории). Защищает сценарии «Одна страница» (`PG-1` в `sheet-pdf.test.ts`) и «поведение для единственного плана не меняется».

## Coverage

### Happy paths

- Каталог, `activePlanOf`, `historyKey` для `measure` (PL-01 … PL-05).
- Round-trip `activePlan` через `serializeStore`/`parseStore` (ST-03).
- `planHistory` совпадает с `drawingHistory`; запись/отмена/повтор (HI-01, HI-02).
- Две и три страницы PDF, порядок и принадлежность содержимого страницам, рамка/надпись/масштаб на каждой (PG-03 … PG-06, PG-14).
- Подбор формата по нескольким страницам (PG-10).

### Boundary cases

- Пустой идентификатор чертежа в `historyKey` (PL-05).
- Недопустимые значения `activePlan`: пустая строка, регистр, пробел, число, `null`, `true`, объект, массив (PL-03, PL-04, ST-02).
- Границы области A4: ровно 272 мм и +0,1 мм по ширине, ровно 145 мм и +0,1 мм по высоте, на первой и второй странице (PG-11).
- 0 страниц, только пустые страницы, пустая страница между непустыми (PG-09, PG-12).

### Negative cases

- Неизвестный `activePlan` не повреждает документ и не ломает соседние чертежи (ST-02).
- Отсутствующее поле не добавляется при загрузке (ST-01, ST-06).
- В JSON нет ключа `plans`; версия остаётся 3 (ST-04, ST-05); документ будущей версии остаётся read-only (ST-07).
- Старая история читается, суффикса ключа нет (HI-03, HI-04).
- Чужая геометрия и чужие подписи не попадают на страницу (PG-04).

### Invariants

- `activePlanOf` всегда возвращает идентификатор каталога (PL-04).
- `planHistory` возвращает один и тот же объект и совпадает с `drawingHistory` (HI-01, HI-02).
- Входные данные (`Drawing`, `pages`) не мутируются (PL-04, PG-13).
- Число страниц = число входных страниц, порядок сохраняется (PG-03, PG-04).
- Масштаб листа точный и общий для страниц; страница центрируется независимо (PG-05).
- Результат `availableFormatsForPages` не зависит от порядка и равен пересечению по страницам (PG-10, PG-11).

### Integration cases

- `pagesOf` → `buildPdfPages` → разбор операторов страницы (PG-01, PG-04 … PG-06).
- `exportPages` целиком: скачивание, имя файла, тексты на всех страницах (PG-15).
- Хранилище и история: serialize → parse (ST-03, HI-06).
- Эквивалентность одностраничного нового пути прежнему `buildPdf` (PG-08).

## Unexpected Passes

- `HI-06 «формат документа истории не меняется …»` и `HI-06 «будущая версия истории …»` проходят до реализации: они используют только существующие `serializeHistory`/`parseHistory`. Это сознательные регрессионные ограничения формата (спецификация требует неизменности формата истории) — после реализации они обязаны остаться зелёными. Продакшен-код не менялся.

## Tests That Could Not Run

- Ручные проверки интерфейса MAN-01 … MAN-08 из `test-plan.md` (переключатель планов, DOM-поведение, перезагрузка страницы, экспорт из интерфейса): в проекте нет DOM-стенда, автоматизировать их нельзя. MAN-04 (сброс выделения и жестов при переключении плана) недостижим при единственном плане и проверяется в change `demolition-plan`.
- Не покрыты автоматически: подстановка `planHistory`/`pagesOf` в `main.ts` и состояние переключателя; покрываются MAN-xx и проверкой кода в верификации.
