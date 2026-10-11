## 0. Подготовка и ограничения

- [x] 0.1 Прочитать `test-validation.md` (VERDICT: PASS), `design.md` (D1–D7, D4a) и файлы утверждённых тестов: `src/export/fit-scale.test.ts`, `src/export/fit-scale-pdf.test.ts`, `src/storage-scale.test.ts`, `src/export/fit-scale-ui.test.ts`. Эти файлы реализация не меняет (CLAUDE.md Rule 5).
- [x] 0.2 Оформить test-change-request на существующие тесты, конфликтующие с изменением (список в `test-suite.md`, раздел Notes): `page-format.test.ts`, `sheet-fit.test.ts`, `pdf.test.ts`, `pdf-pages.test.ts`, `legend-area.test.ts`, `demolition-pdf.test.ts`, `demolition-dimensions-pdf.test.ts`, `mounting-pdf.test.ts`, `types.test.ts`, `storage.test.ts` и фикстуры `Drawing` с полем `scale`. Решение «удалить или переписать на подбор масштаба» и повторная валидация этих тестов принимаются отдельно; до их разрешения задачи 2.x и 3.x по удалению API не завершаются. Спека: `pdf-export` (REMOVED «Попап о невмещающих форматах», «Форматы учитывают все страницы», «Формат страницы выбирает пользователь»), `drawing-storage`.

## 1. Модуль подбора масштаба (`drawing-scale`, design D1, D2, D4a, D7)

- [x] 1.1 Создать `src/export/fit-scale.ts`: `SCALE_SERIES` (2, 2.5, 4, 5, 10, 15, 20, 25, 40, 50, 75, 100, 200, 400, 500, 800, 1000 от крупного к мелкому) и тип `ScaleDenominator` как объединение литералов ряда. Спека: «Ряд масштабов». Тесты: `fit-scale.test.ts` T-01, T-46, T-48.
- [x] 1.2 Реализовать `fitScale(pages, format): ScaleDenominator | null` на `pageBounds` и `fitsFormat` из `pdf.ts` с областью чертежа и шириной легенды всех страниц (`legendWidthMm(pages)`): первый подходящий член ряда для всех страниц со стенами, 1:1000 если не подошёл ни один, `null` если нет страниц со стенами. Спека: «Автоподбор масштаба», «Единый масштаб документа», «Масштаб не вычисляется сверх ряда». Тесты: `fit-scale.test.ts` T-03…T-09, T-11, T-12, T-15, T-24, T-25, T-44…T-47; `fit-scale-pdf.test.ts` T-11, T-13, T-27, T-28, T-29.
- [x] 1.3 Реализовать `formatScale(x)` («1:X», десятичная запятая для 2,5) и `scaleLabel(pages, format)` (пустая строка при `null`). Спека: «Ряд масштабов», «Показ подобранного масштаба». Тесты: `fit-scale.test.ts` T-02, T-31…T-33, T-15.

## 2. Данные и хранилище (`drawing-storage`, `drawing-plans`, `mounting-plan`, design D2, D3)

- [x] 2.1 Убрать из `src/types.ts` `SCALE_DENOMINATORS`, `DEFAULT_SCALE`, `isScale` и поле `Drawing.scale`; импорт `ScaleDenominator` везде заменить на `fit-scale.ts` или на `number`, где тип не нужен. Спека: «Формат документа». Зависит от 0.2 для `types.test.ts` и фикстур.
- [x] 2.2 В `src/storage.ts` перестать читать и писать `scale`: убрать проверку `isScale` в `isDrawing`, назначение `DEFAULT_SCALE` при миграциях версий 1 и 2 и в `emptyDrawing`; значение `scale` из загружаемого чертежа отбрасывать; версия документа остаётся 3. Спека: «Формат документа» (сценарии «Масштаб не записывается», «Прежде сохранённый масштаб игнорируется»), «Миграция документа версии 1» и «версии 2». Тесты: `storage-scale.test.ts` T-40…T-43.

## 3. PDF и экспорт (`pdf-export`, design D5, D7)

- [x] 3.1 В `src/export/sheet-layout.ts` графа 25 берёт текст из `formatScale`. Спека: «Заполнение основной надписи». Тесты: `fit-scale-pdf.test.ts` T-26, T-14.
- [x] 3.2 В `src/export/pdf.ts` удалить `availableFormats`, `availableFormatsForPages`, `pageFormats`; убрать `DEFAULT_SCALE` из значений по умолчанию (масштаб передаётся явно); `fitsFormat`, `pageBounds`, `placeOnPage`, `buildPdfPages`, `exportPages` сохраняют сигнатуры. Спека: «Формат страницы», REMOVED «Форматы учитывают все страницы». Тесты: `fit-scale-ui.test.ts` T-39; `fit-scale-pdf.test.ts` T-20…T-23.
- [x] 3.3 В `src/export/page-format.ts` удалить `chooseFormat`, оставить `PageFormat` и `PAGE_FORMATS_MM`. Спека: «Формат страницы». Тесты: `fit-scale-ui.test.ts` T-39.

## 4. Интерфейс (`drawing-scale` «Показ подобранного масштаба», `ui.md`, design D4, D5, D6)

- [x] 4.1 В `index.html` убрать `#pdf-scale`; сразу после `#pdf-format` добавить неинтерактивную текстовую подпись с `id`. Перед этим найти в нижней панели готовый стиль текстового значения и использовать его (правило `ui.md`: не вводить новый виджет). Тесты: `fit-scale-ui.test.ts` T-30, T-34, T-36.
- [x] 4.2 В `src/main.ts` заменить `syncFormats` на синхронизацию подписи: `textContent = scaleLabel(pagesOf(current()), формат)`, блокировка кнопки экспорта только при отсутствии страниц со стенами; убрать попап, пересборку и отключение списка форматов, обработчик `#pdf-scale`, `syncScaleSelector`, поле `scale` при создании чертежа; добавить обработчик `change` списка формата, вызывающий синхронизацию; экспорт передаёт в `exportPages` результат `fitScale` (при `null` не экспортирует). Вызывать синхронизацию во всех местах прежнего `syncFormats()` и при загрузке. Тесты: `fit-scale-ui.test.ts` T-14, T-30…T-34, T-39.
- [x] 4.3 В `src/style.css` убрать `#pdf-scale` и `#fit-popup`; стиль подписи — по образцу соседних элементов панели. Тесты: `fit-scale-ui.test.ts` T-39.

## 5. Спеки и документация

- [x] 5.1 После синхронизации спек обновить разделы `## Purpose` в `openspec/specs/drawing-scale/spec.md` и `openspec/specs/pdf-export/spec.md`: масштаб подбирается автоматически, а не выбирается пользователем (дельта-спека `Purpose` не меняет, см. `design.md`, Risks).
- [x] 5.2 Просмотреть остальные спеки с формулировкой «масштаб чертежа» (`wall-joints`, `wall-types`, `demolition-plan`): если это экранный зум, а не масштаб печати, записать в `TODO.md` как расхождение документации (Docs), не правя спеки в рамках этого change.

## 6. Проверка и закрытие

- [x] 6.1 Запустить новые утверждённые тесты: `npx vitest run src/export/fit-scale.test.ts src/export/fit-scale-pdf.test.ts src/storage-scale.test.ts src/export/fit-scale-ui.test.ts` — все 108 зелёные.
- [x] 6.2 Запустить весь набор `npx vitest run`: зелёный, включая пересмотренные по test-change-request тесты (0.2); ни один утверждённый тест не изменён реализацией (`git diff` по `*.test.ts`/`*.test-utils.ts` содержит только изменения из test-change-request).
- [x] 6.3 Проверка типов: `npx tsc --noEmit` (в `package.json` сборка идёт через `tsc && vite build`) без ошибок; `any`, `@ts-ignore`, приведения типов «для тишины компилятора» и `!`-сокращения не добавлены (`.claude/rules/typescript.md`).
- [x] 6.4 Линтер и форматтер: в проекте не настроены (в `package.json` нет скриптов lint/format) — зафиксировать это в отчёте; mutation testing не настроен (Stryker отсутствует), ручные мутанты уже приведены в `test-validation.md`.
- [x] 6.5 Ручная проверка в браузере по `browser-manual-checks` (после перезапуска dev-сервера на `/draw-repair/`): нет списка масштаба; подпись рядом с форматом меняется при смене формата и при рисовании комнаты стена за стеной; список A4–A0 постоянный; формат не меняется сам; зум и панорамирование не меняются; экспорт A4 и A3 — одинаковый масштаб в графе 25 всех страниц; перезагрузка страницы со старым сохранённым чертежом (с полем `scale` в localStorage) открывает чертёж без ошибок. Удалить `src/snap-debug.ts` не требуется (вне этого change).
- [x] 6.6 Проверить итоговый `git diff` на случайные изменения, затем `openspec validate auto-fit-scale --strict` (предупреждения про SHALL/MUST общие для всех спек проекта) и `/opsx:verify` по change; CRITICAL-замечания исправить в этой же сессии.
