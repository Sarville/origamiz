# План полного ребрендинга визуальных ассетов

Цель: заменить всю графику (постройки, конвейер, иконки UI, лого) на свою, сохранив
100% игровую механику и совместимость с движком (те же имена файлов, те же размеры,
та же геометрия анимации). Юридический контекст: код на GPL-3.0 и его менять не
обязательно, но имя/лого "shapez" — товарный знак tobspr Games, поэтому бренд меняем
полностью (см. `sessions/` и память проекта).

Этот файл — техническое ТЗ для художника/AI-агента: что генерировать, что не
генерировать руками (потому что это делает скрипт автоматически), куда класть
результат и в каком порядке пересобирать.

---

## 1. Карта ассетов: что и где менять

| # | Категория | Путь | Кол-во | Способ замены |
|---|---|---|---|---|
| 1 | Постройки (финальный вид) | `res_raw/sprites/buildings/*.png` | 51 | **Генерировать (AI)** |
| 2 | Чертежи построек (blueprint) | `res_raw/sprites/blueprints/*.png` | 49 | **НЕ генерировать вручную** — авто-скрипт из (1) |
| 3 | Конвейер (анимация) | `res_raw/sprites/belt/built/*.png` | 42 (3×14) | **НЕ генерировать по кадрам** — правим скрипт |
| 4 | Провода (сигналы) | `res_raw/sprites/wires/sets/*` | авто | Процедурная генерация, низкий приоритет |
| 5 | Иконки UI | `res/ui/**/*.png` | 185 | Прямая замена файл-в-файл |
| 6 | Лого/бренд | `res/logo.png`, `res/logo-tobspr-games.svg`, `res/puzzle_dlc_logo.png`, base64-лого в `src/html/index.html` | 4 места | Своё лого, старое — удалить + вычистить ссылки |
| 8 | Цвета фигур (свотчи) | `res_raw/sprites/colors/*.png` | 8 (72×72) | Опционально, низкий приоритет |
| 9 | Мелкие оверлеи | `res_raw/sprites/misc/*.png` | 9 | Опционально |
| 10 | Шрифт | `res/fonts/GameFont.woff2` | 1 | Не бренд tobspr (это Barlow, OFL) — менять не обязано, AI-промптом не заменяется, см. §10 |
| 11 | Фон меню (видео) | `res/bg_render.webm` | 1 | Это рендер живого геймплея — переснять последним, после §2-4, не генерировать отдельно, см. §9 |
| 12 | Музыка | `res_raw/sounds/music/*.{wav,mp3}` | 3 | **Генерировать (AI)** |
| 13 | Звуковые эффекты (sfx) | `res_raw/sounds/sfx/*.wav` | 14 | **Генерировать (AI)** |
| 14 | Обучающие скриншоты построек | `res/ui/building_tutorials/*.png` | 44 | Это in-game скриншоты — переснять последними встроенным экспортёром, не генерировать, см. §16 |
| 15 | Интерактивные обучающие GIF | `res/ui/interactive_tutorial.noinline/*.gif` | 11 | Это записи экрана — переснять последними скринкастом, не генерировать, см. §17 |

---

## 2. Постройки — генерировать через AI

### 2.1 Точные размеры (обязательно сохранить 1:1)

192px = размер одной клетки поля. Все постройки — кратные 192 по каждой оси.

```
192×192  analyzer, balancer(-merger/-splitter, -inverse), belt_left/right/top, block,
         comparator, constant_producer, constant_signal, display, goal_acceptor,
         item_producer, lever, logic_gate(-not/-or/-xor), miner(-chainable),
         reader, rotator(-ccw/-rotate180), transistor(-mirrored), trash,
         underground_belt_entry/exit(-tier2), virtual_processor(-painter/-rotator/
         -stacker/-unstacker), wire_tunnel
384×192  balancer, cutter, filter, mixer, painter(-mirrored), stacker
768×192  cutter-quad, painter-quad
384×384  painter-double, storage
768×768  hub
```

Прозрачный фон (PNG с альфа-каналом) обязателен везде.

### 2.2 Функция каждой постройки (из текста самой игры, не по памяти)

В прошлой версии этого файла тут был только плейсхолдер с 2 примерами
(cutter/rotator) — генератор не знал бы, что делает оставшийся 41 файл.
Ниже — точная функция каждого из 51 файлов, взятая из `translations/
base-en.yaml` (раздел `buildings:` — это официальные тексты подсказок самой
игры, не мои формулировки на глаз), подготовленная как вставка в
`[ОПИСАНИЕ ФУНКЦИИ ПОСТРОЙКИ]` из промпта §2.4 ниже.

| Файл | Функция (для промпта) |
|---|---|
| `hub` | the central base building where the player delivers produced shapes to unlock upgrades — not a production-line part, the "home base" |
| `belt_top` / `belt_right` / `belt_left` | **не генерируется здесь** — это авто-копии кадра 0 анимации ленты, см. §4 |
| `miner` | an extractor that picks up a shape or color resource from the ground and feeds it onto a belt |
| `miner-chainable` | the same extractor, but able to be daisy-chained in a row so several share one output belt |
| `underground_belt_entry` | the entrance/input side of a tunnel that routes belt items underneath other buildings and belts |
| `underground_belt_exit` | the exit/output side of the same tunnel |
| `underground_belt_entry-tier2` | tier-2 (longer range) version of the tunnel entrance |
| `underground_belt_exit-tier2` | tier-2 (longer range) version of the tunnel exit |
| `balancer` | a multi-input/multi-output junction that evenly distributes all inputs across all outputs |
| `balancer-merger` | a compact junction merging two conveyor belts into one |
| `balancer-merger-inverse` | the same merge junction, mirrored orientation |
| `balancer-splitter` | a compact junction splitting one conveyor belt into two |
| `balancer-splitter-inverse` | the same split junction, mirrored orientation |
| `cutter` | cuts a shape from top to bottom, outputting both halves separately |
| `cutter-quad` | cuts a shape into four quadrant pieces at once, four separate outputs |
| `rotator` | rotates an incoming shape 90° clockwise |
| `rotator-ccw` | rotates an incoming shape 90° counter-clockwise |
| `rotator-rotate180` | rotates an incoming shape a full 180° |
| `stacker` | combines two incoming shapes into one — fuses them side-by-side on the same layer if possible, otherwise stacks the right input on top of the left |
| `mixer` | mixes two incoming colors together using additive color blending |
| `painter` | paints an incoming shape (left input) with a color fed from a second (top) input |
| `painter-mirrored` | the same painter, color fed from the bottom input instead of the top |
| `painter-double` | paints two shapes at once with one shared color input |
| `painter-quad` | paints each of the four quadrants of a shape individually, each slot controlled by its own wire signal |
| `trash` | destroys anything fed into it from any side, permanently — used to dispose of unwanted output |
| `storage` | stores excess items up to a capacity limit, acting as a buffer / overflow gate |
| `wire_tunnel` | lets two wire signal lines cross on the wires layer without connecting to each other |
| `constant_signal` | emits a fixed, unchanging signal (a shape, color, or boolean) onto the wires layer |
| `lever` | a manual on/off switch the player toggles to emit a boolean 1/0 signal onto the wires layer |
| `logic_gate` | a logic AND gate — outputs boolean "1" only if both wire inputs are truthy |
| `logic_gate-not` | a logic NOT gate — inverts a single boolean wire input |
| `logic_gate-xor` | a logic XOR gate — outputs "1" if exactly one of two wire inputs is truthy, not both |
| `logic_gate-or` | a logic OR gate — outputs "1" if at least one wire input is truthy |
| `transistor` | forwards an item/signal only while a separate side wire input is truthy — acts as a gate |
| `transistor-mirrored` | the same transistor gate, mirrored side-input orientation |
| `filter` | routes items matching a connected wire-signal condition to the top output, all others to the right output |
| `display` | a screen that visually shows whatever signal (shape, color, or boolean) is fed into it |
| `reader` | measures average belt throughput, can output the last item read onto the wires layer |
| `analyzer` | reads the top-right quadrant of a shape's lowest layer and outputs its shape/color as a wire signal |
| `comparator` | outputs boolean "1" if two incoming wire signals are exactly equal |
| `virtual_processor` | a wires-layer-only "virtual cutter" — splits a shape signal into two halves without a physical belt |
| `virtual_processor-rotator` | virtual wires-layer rotator — rotates a shape signal clockwise |
| `virtual_processor-unstacker` | virtual wires-layer unstacker — splits the topmost layer of a shape signal from the rest |
| `virtual_processor-stacker` | virtual wires-layer stacker — stacks one shape signal on top of another |
| `virtual_processor-painter` | virtual wires-layer painter — paints a shape signal with a color signal |
| `item_producer` | sandbox/debug-only building that spawns items directly from a wire signal |
| `constant_producer` | constantly outputs one fixed, specified shape or color onto the belt layer |
| `goal_acceptor` | the delivery target for a level's current goal — shapes delivered here count toward completing it |
| `block` | a plain solid tile used to reserve/block a grid cell so nothing else can be built there |

Постройки с приставкой `virtual_processor-*` функционально идентичны своим
"физическим" тёзкам (cutter/rotator/stacker/painter/unstacker), просто
работают виртуально на слое проводов, без реального перемещения фигур по
ленте — стоит визуально дать им общий узнаваемый язык с "физической" версией
символа (например тот же намёк на ножницы у `virtual_processor`, что и у
`cutter`), но можно добавить лёгкий маркер "виртуальности" (например
пунктирную/полупрозрачную трактовку), если хочется визуально отличать слой
проводов от слоя ленты — в оригинале это не выражено явно, решение на твой
вкус.

### 2.3 Наблюдаемый стиль (снял с текущих ассетов — cutter.png, hub.png)

- **Строго ортографический вид сверху (top-down), без изометрии и перспективы.** Камера
  смотрит вертикально вниз, никакого наклона граней.
- Силуэт — скруглённый прямоугольник (радиус скругления ~12–16px при 192px тайле),
  иногда со срезанным углом (см. cutter — правый нижний угол срезан по диагонали,
  это визуальный маркер направления входа/выхода).
- Обводка: единая толщина ~5px, тёмно-серый цвет (~`#8b8fa0`), по всему периметру
  корпуса и по всем внутренним элементам иконки-символа.
- Заливка корпуса: один плоский холодный светло-серый тон (~`#d9dce3`), без
  градиентов и без текстуры.
- Мягкая тень: лёгкий полупрозрачный серый оффсет вниз-вправо под всей фигурой —
  единственный намёк на объём, никакого другого освещения/бликов.
- Внутри — простой плоский символ функции постройки (ножницы для cutter, стрелки
  для направления ленты, шестерёнки и т.п.), тем же приёмом (обводка + плоская
  заливка чуть темнее фона), отцентрован.
- Акцентный цвет используется точечно и по смыслу (например красный прямоугольник
  на hub — не декоративный, это игровой индикатор).
- Никаких текстур, градиентов, бликов, декоративных деталей сверх необходимого —
  чистая flat-icon эстетика.

### 2.4 Готовый промпт-шаблон (генерировать ТОЛЬКО финальную/построенную версию)

```
Flat top-down 2D game icon of a factory building module, orthographic view
directly from above with ZERO perspective and ZERO isometric tilt (camera
looking straight down, all edges are pure horizontal/vertical/diagonal lines,
no foreshortening).

Silhouette: rounded-rectangle machine casing, corner radius about 8% of the
tile size[, with the bottom-right corner cut off diagonally to mark the output
side — ONLY if this building has a directional in/out].

Rendering style: single flat, uncontrolled shading, no gradients, no textures,
no highlights. Base body fill is one flat cool light-grey (#d9dce3). Uniform
outline stroke around every shape, thickness proportional (~2.5% of tile
width), color dark slate-grey (#8b8fa0). One soft, low-opacity drop shadow
offset slightly down-and-right beneath the whole silhouette — this is the
only depth cue, nothing else.

Centered functional icon/symbol representing: [ОПИСАНИЕ ФУНКЦИИ ПОСТРОЙКИ —
например "a pair of open scissor blades crossing, for a shape-cutting
machine" / "a rotating gear with a curved motion arrow, for a rotator machine"].
The symbol uses the same flat-fill + outline treatment, in a slightly darker
tone of the base grey (not a new color) unless a functional accent color is
explicitly required.

Background: fully transparent (alpha channel), no scene, no ground, no props.
Composition: object fills the frame edge-to-edge with small even padding,
centered, no rotation, canvas exactly [ШИРИНА]x[ВЫСОТА]px.

Absolutely avoid: 3D rendering, isometric angle, painterly shading, ambient
occlusion beyond the single flat drop shadow, photorealism, text, watermarks,
extra background elements.
```

Заполняй `[ОПИСАНИЕ ФУНКЦИИ]` из таблицы §2.2, `[ШИРИНА]x[ВЫСОТА]` из таблицы
§2.1, для каждого из 51 файла. Диагональный срез угла — только у построек с
явным входом/выходом (cutter, filter, mixer, stacker, painter, balancer и
т.п.) — сверься с текущими файлами при сомнении, чтобы не потерять этот
визуальный язык.

**Стиль/детали (палитру, референсы, тему) добавишь сам поверх этого шаблона —
здесь зафиксирована только геометрия и техническая структура, чтобы новая
графика физически совпадала со старой по размеру/расположению.**

---

## 3. Чертежи (blueprints) — НЕ генерировать руками, это автоматика

`res_raw/sprites/create_blueprint_previews.py` берёт **уже готовый** файл из
`buildings/` и сам строит его "чертёжную" синюю версию:

1. Находит контуры (свёртка Собеля по вертикали/горизонтали → модуль градиента).
2. Перекрашивает в целевой синий `RGB(104, 200, 255)`, яркость по силе края.
3. Альфа считается из размытой маски исходного альфа-канала + силы края — контуры
   получаются чуть ярче/непрозрачнее заливки, отсюда "голографический" вид.
4. Сохраняет в `blueprints/<то же имя>.png`.

Это ровно то, что нужно: **одинаковый силуэт, отличается только цветом** — но
получено гарантированно автоматически, а не второй независимой AI-генерацией,
которая рискует не совпасть по пикселям.

**Как использовать:**
```
cd res_raw/sprites
pip install numpy scipy Pillow   # если ещё не стоят
python3 create_blueprint_previews.py
```
Скрипт сам обходит всё содержимое `buildings/` — после того как туда положены новые
51 PNG, просто запусти его и `blueprints/` пересоздастся целиком.

**Исключения (скрипт их пропускает, `blueprints/hub.png` в репе и правда нет):**
- Любой файл с `"hub"` в имени.
- Любой файл с подстрокой `"wire-"` в имени (у нас таких нет — `wire_tunnel.png`
  использует `_`, не `-`, поэтому обрабатывается как обычно).

Если нужен чертёж для hub — либо вручную повтори тот же приём (перекраска в
`104,200,255` с тем же alpha-blend-по-краям), либо убери фильтр `if "hub" in
buildingId: continue` в скрипте и прогони отдельно.

---

## 4. Конвейер — НЕ генерировать 42 кадра через AI, правим генератор

`res_raw/sprites/belt/generate_belt_sprites.js` рисует конвейер кодом, не руками.
Структура: **3 направления × 14 кадров** = 42 PNG в `belt/built/`:

- `forward_0..13.png` — прямой участок.
- `right_0..13.png` — поворот направо (считается через дуговую геометрию).
- `left_0..13.png` — это **горизонтальное зеркало** right (тот же кадр,
  `flippedContext.scale(-1, 1)`), отдельно не считается.

Ключевая механика анимации: позиция каждого треугольника-стрелки — чистая
математика от номера кадра (`procentual = i / fps`, где `fps = 14`), стрелки
циклически сдвигаются на этот процент между фиксированными точками
(`spacingBetweenArrows`/`spacingTotal` для прямого участка, угловой шаг
`angleSpacing` для поворота). Именно поэтому 14 кадров зацикливаются идеально
ровно — расположение треугольников жёстко завязано на геометрию, не на глаз.

**Если попросить AI нарисовать 42 кадра по отдельности — треугольники неизбежно
"поплывут" между кадрами, анимация будет дёрганой.** Единственный надёжный способ
сохранить ровный луп — **не трогать геометрию**, менять только оформление:

```js
// Было — плоские цвета, вообще без текстуры:
const borderColor = "#91949e";
const fillColor = "#d2d4d9";
const arrowColor = "#c0c2c7";

// Меняешь только эти константы на новую палитру, и/или...
```

Для текстуры (не только цвет) — замени `context.fillStyle = fillColor` на паттерн:
```js
const texture = await loadImage("path/to/tileable_belt_texture.png");
const pattern = context.createPattern(texture, "repeat");
context.fillStyle = pattern; // вместо плоского fillColor
```
...и то же самое для `arrowSprite`, если нужна текстура на стрелках — но саму
геометрию (`beginPath/moveTo/lineTo/rect`, `arrowW/arrowH`, углы поворота) **не
трогать вообще**, тогда синхронность кадров гарантирована математически, а не
проверкой на глаз.

**Запуск:**
```
cd res_raw/sprites/belt
yarn global add canvas   # системная зависимость node-canvas, см. комментарий в файле
node generate_belt_sprites.js
```
Скрипт сам:
- сохранит 42 файла в `built/`;
- скопирует `forward_0.png` → `buildings/belt_top.png`, `right_0.png` →
  `buildings/belt_right.png`, `left_0.png` → `buildings/belt_left.png` —
  **эти три файла в `buildings/` руками не редактировать**, они всегда кадр-0
  анимации, синхронизация с самим конвейером иначе нарушится.

### Промпт для текстуры ленты (отдельная, узкая задача)

Раз кадры не рисуются, для AI тут нужна только **бесшовная (tileable) текстура**
поверхности ленты, которая ляжет паттерном на уже готовую геометрию:

```
Seamless tileable texture for a conveyor belt surface, flat top-down game
asset, subtle repeating pattern (fine ribbing or fabric weave), muted flat
colors (no strong highlights/shadows baked in — lighting is added separately
by the engine), designed to tile edge-to-edge with no visible seam, square
canvas, no logos/text/objects on it, [ПАЛИТРА/СТИЛЬ — заполнишь сам].
```
Плюс отдельно — цвет треугольников-стрелок (можно просто дать 1-2 hex-цвета,
не изображение).

---

## 5. Провода (wires) — тоже процедурная генерация

`res_raw/sprites/belt/generate_wire_sprites.js` → `res_raw/sprites/wires/sets/`.
Цвета сигналов (`first`/`second`/`conflict`) заданы как HSL-математика от базовых
hex в начале файла — не брендовая графика, а функциональная индикация (какой
провод к какому сигналу). Менять по желанию, тем же способом (только константы
цвета), не приоритет для ребрендинга.

---

## 6. UI-иконки — прямая замена, без пересборки

`res/ui/` (185 файлов, уже готовые PNG, **не** проходят через атлас-паккер):
`main_menu/`, `building_icons/`, `icons/`, `languages/` (флаги языков — не
брендовые, можно не трогать), `building_tutorials/`, `interactive_tutorial.noinline/`.
Заменяешь файл на файл с тем же именем и размером — пересборка не нужна.

В папке два визуально разных подстиля — не смешивать, промпты разные.

### 6.1 `res/ui/building_icons/` (27 файлов, все 128×128)

Это те же функциональные символы, что и внутри спрайтов построек (§2), но
вырезанные отдельно, без корпуса-казинга — используются в панели постройки/
тулбаре. Двухцветная дуотон-заливка: контур + плоская заливка чуть темнее фона,
тот же серый, что и у построек.

```
Flat 2D game UI icon, single centered pictogram representing: [ФУНКЦИЯ
ПОСТРОЙКИ — например "a pair of crossed scissor blades" / "a rotating gear
with a curved motion arrow"], NO background shape/casing/badge, just the bare
symbol floating on a fully transparent background.

Style: two-tone flat duotone — a mid-grey fill (#9a9dab) with a slightly
darker grey outline (#787c8c) of uniform stroke width (~6% of icon width),
no gradients, no shadow, no texture, no perspective (straight-on 2D icon).

Composition: centered, symmetric padding on all sides (~15% margin), square
canvas exactly 128x128px, crisp clean vector-icon look suitable for small
UI display.

Avoid: outer casing/rounded-rect background (that belongs to the building
sprite, not this icon), color accents unless the symbol functionally needs
one, text, watermarks.
```

**Про соответствие стилю самих построек — это не просто похожий стиль, а
буквально тот же самый символ**, что нарисован внутри корпуса постройки в §2,
только вырезанный отдельно без корпуса. Проверил вживую на нескольких файлах
(`cutter.png` → те же ножницы, что внутри корпуса cutter; `belt.png` → те же
вертикальные стрелки, что на `belt_top`; `underground_belt.png` → те же два
"арки-туннеля", что на входе/выходе тоннеля; `wire.png` → тот же разъём-вилка)
— так что источник правды для символа **не текст**, а уже готовый файл
`res_raw/sprites/buildings/<то же имя>.png` (или `blueprints/`, если
физической постройки с ровно таким именем нет). Правило: **сначала генерируй
постройки по §2, потом вырезай/переиспользуй ровно тот же символ сюда** — не
наоборот и не независимо, иначе рифма не совпадёт.

Ниже — таблица на все 27 файлов: какую функцию/постройку из §2.2 повторяет
каждая иконка (три файла — `belt`, `underground_belt`, `wire` — не совпадают
1:1 с именами файлов построек, для них функция расписана отдельно).

| Файл иконки | Соответствует постройке из §2 | Функция (для `[ФУНКЦИЯ ПОСТРОЙКИ]`) |
|---|---|---|
| `analyzer.png` | `buildings/analyzer.png` | reads the top-right quadrant of a shape's lowest layer and outputs its shape/color as a wire signal |
| `balancer.png` | `buildings/balancer.png` | a multi-input/multi-output junction that evenly distributes all inputs across all outputs |
| `belt.png` | `buildings/belt_top.png` (символ ленты, не отдельная функция) | transports items along a conveyor belt |
| `block.png` | `buildings/block.png` | a plain solid tile used to reserve/block a grid cell so nothing else can be built there |
| `comparator.png` | `buildings/comparator.png` | outputs boolean "1" if two incoming wire signals are exactly equal |
| `constant_producer.png` | `buildings/constant_producer.png` | constantly outputs one fixed, specified shape or color onto the belt layer |
| `constant_signal.png` | `buildings/constant_signal.png` | emits a fixed, unchanging signal (a shape, color, or boolean) onto the wires layer |
| `cutter.png` | `buildings/cutter.png` | cuts a shape from top to bottom, outputting both halves separately |
| `display.png` | `buildings/display.png` | a screen that visually shows whatever signal (shape, color, or boolean) is fed into it |
| `filter.png` | `buildings/filter.png` | routes items matching a connected wire-signal condition to one output, all others to another |
| `goal_acceptor.png` | `buildings/goal_acceptor.png` | the delivery target for a level's current goal |
| `item_producer.png` | `buildings/item_producer.png` | sandbox/debug-only building that spawns items directly from a wire signal |
| `lever.png` | `buildings/lever.png` | a manual on/off switch the player toggles to emit a boolean 1/0 signal |
| `logic_gate.png` | `buildings/logic_gate.png` | a logic AND gate — outputs boolean "1" only if both wire inputs are truthy |
| `miner.png` | `buildings/miner.png` | an extractor that picks up a shape or color resource from the ground and feeds it onto a belt |
| `mixer.png` | `buildings/mixer.png` | mixes two incoming colors together using additive color blending |
| `painter.png` | `buildings/painter.png` | paints an incoming shape with a color fed from a second input |
| `reader.png` | `buildings/reader.png` | measures average belt throughput, can output the last item read onto the wires layer |
| `rotator.png` | `buildings/rotator.png` | rotates an incoming shape 90° clockwise |
| `stacker.png` | `buildings/stacker.png` | combines two incoming shapes into one, stacking/fusing them together |
| `storage.png` | `buildings/storage.png` | stores excess items up to a capacity limit, acting as a buffer/overflow gate |
| `transistor.png` | `buildings/transistor.png` | forwards an item/signal only while a separate side wire input is truthy |
| `trash.png` | `buildings/trash.png` | destroys anything fed into it from any side, permanently |
| `underground_belt.png` | `buildings/underground_belt_entry.png` + `_exit.png` (обобщённый символ тоннеля, не конкретно вход или выход) | tunnels belt items underneath other buildings and belts |
| `virtual_processor.png` | `buildings/virtual_processor.png` | a wires-layer-only "virtual cutter" — splits a shape signal into two halves without a physical belt |
| `wire.png` | нет физического спрайта-постройки (провод рисуется процедурно, см. §5) — собственный символ: разъём/вилка | transfers signals (items, colors, or booleans) between wire-layer components; differently-colored wires don't connect to each other |
| `wire_tunnel.png` | `buildings/wire_tunnel.png` | lets two wire signal lines cross on the wires layer without connecting to each other |

Промпт-шаблон выше (перед таблицей) уже параметризован под это — просто
подставляй `[ФУНКЦИЯ ПОСТРОЙКИ]` из третьей колонки для каждого файла.

### 6.2 `res/ui/icons/` (59 файлов, общая UI-иконка интерфейса)

Замерил реальные цвета пикселей во всех 59 файлах (не только на глаз) —
внутри папки на самом деле **5 разных под-стилей**, не один. Ниже — каждый
со своим промптом и точным списком файлов, чтобы ничего не генерировать по
неправильному шаблону.

**Группа A — нейтральный однотонный глиф (базовый, большинство файлов).**
Один плоский тёмно-серый/чёрный цвет (в оригинале смесь `#333438` и чистого
`#000000` — на глаз одно и то же, отличия не значимы), без обводки, без
градиента:

`blueprint_marker`, `close`, `delete`, `download`, `edit_key`, `enum_selector`,
`help`, `info_button`, `link`, `main_menu_exit`, `main_menu_settings`, `mods`,
`music_off`, `music_on`, `pin`, `puzzle_complete_indicator`,
`puzzle_completion_rate`, `puzzle_plays`, `puzzle_upvotes`, `reset_key`, `save`,
`settings`, `settings_menu_exit`, `settings_menu_play`, `settings_menu_settings`,
`shop`, `sound_off`, `sound_on`, `state_back_button`, `state_next_button`,
`statistics`, `unpin`, `unpin_shape`, `waypoint`, `waypoint_wires`

```
Flat 2D UI glyph icon, single solid dark neutral fill color (#333438-class
near-black), no outline, no gradient, no shadow, no texture, no 3D —
representing: [ДЕЙСТВИЕ/ПОНЯТИЕ — например "a close/X action" / "a CPU chip
for a mods menu" / "a trash/delete bin" / "a floppy-disk save icon"].

Simple, bold, geometric, instantly legible at small size (smallest target is
32x32px — avoid fine detail that disappears when scaled down).

Composition: centered, generous even padding (~20% margin), fully
transparent background, square canvas exactly [РАЗМЕР]x[РАЗМЕР]px.
Размеры по факту в папке: 32×32 (13 файлов), 64×64 (34 файла, основная
масса), 128×128 (8 файлов), 192×192 и 256×256 (по 2 файла) — конкретный
размер смотри у заменяемого файла.

Avoid: multiple colors, outlines/strokes, text, realistic rendering,
background shapes.
```

**Группа A′ — светлый/инверсный близнец группы A** (та же самая форма, что и
у соответствующего файла из группы A, просто залита светлым вместо тёмного —
для использования на тёмном/подсвеченном фоне). Это **5 пар**, не 3, как
могло показаться по названиям:

| Тёмная версия (группа A) | Светлая версия |
|---|---|
| `blueprint_marker` | `blueprint_marker_inverted` |
| `current_goal_marker` | `current_goal_marker_inverted` |
| `enum_selector` | `enum_selector_white` |
| `mods` | `mods_white` |
| `puzzle_complete_indicator` | `puzzle_complete_indicator_inverse` |

Не генерируй их отдельным промптом — возьми готовый результат тёмной версии
и залей силуэт в `#ffffff` (перекраска альфа-маски, не новая генерация).
`current_goal_marker` (тёмная версия) сам по себе — тоже группа A, просто не
попал в список выше явно: значок текущей цели, тот же нейтральный глиф-стиль.

**Группа B — чисто белый глиф без тёмного варианта вообще.** В оригинале эти
файлы залиты сплошным белым и *не имеют* цветной подложки внутри самого PNG —
цветную "плашку"/бейдж под ними рисует движок отдельно через CSS во время
выполнения, картинка отвечает только за форму:

`display_icons`, `display_list`, `display_sorted`, `notification_info`,
`notification_saved`, `notification_success`, `notification_upgrade`,
`puzzle_action_liked_no`, `puzzle_action_liked_yes`, `toggle_unit`, `play`

```
Flat 2D UI glyph icon, pure solid WHITE fill only (#ffffff), no outline, no
shadow, no gradient — representing: [ПОНЯТИЕ — например "a list/grid view
toggle" / "a generic info notification checkmark-style glyph" / "a thumbs-up
liked icon"]. This icon is designed to sit on top of a colored badge/circle
that the game engine draws separately at runtime — do NOT add your own
background circle or color here, white silhouette only.

Composition: centered, even padding, fully transparent background, square
canvas exactly [РАЗМЕР]x[РАЗМЕР]px.
```

**Группа C — самодостаточный цветной кружок-бейдж (цвет уже внутри PNG).**
Только 2 файла, и это **исключение из группы B** внутри той же самой
"notification_*" семьи файлов — то есть в оригинальном ассете тут
непоследовательность (часть notification-иконок красит движок, часть
несёт цвет сама). Решай сам, к какому подходу приводить всё семейство —
но не копируй эту непоследовательность бездумно:

`notification_error` (красный кружок `#f3405b` + белый крестик),
`notification_warning` (жёлто-оранжевый кружок `#ffd05e` + тёмный акцент внутри)

```
Flat 2D circular notification badge icon: solid flat color circle
background ([ЦВЕТ — "red #f3405b for an error state" / "amber #ffd05e for a
warning state"]) with a simple white glyph centered inside representing
[error → "an X/cross" / warning → "an exclamation mark"], no gradient, no
outline, no shadow, no 3D.

Composition: centered, fully transparent background outside the circle,
square canvas exactly 64x64px.
```

**Группа D — двухцветная диаграмма мыши** (не глиф-пиктограмма, а маленькая
схема мыши с подсвеченной нужной кнопкой):

`mouse_left`, `mouse_middle`, `mouse_right`

```
Flat 2D computer mouse diagram icon, simple rounded mouse body silhouette in
flat neutral grey (#898e93-class), with ONE mouse button visually
highlighted in a bright flat accent color to indicate: [КНОПКА — "the left
button" / "the middle button/wheel" / "the right button"]. No gradients, no
outlines beyond the flat shape edges, no shadow, no realistic
rendering — stays a simple flat diagram.

Composition: centered, small even padding, fully transparent background,
square canvas exactly 64x64px.
```

**Группа E — акцентный однотонный глиф с игровым смыслом цвета** (не
нейтральный, конкретный цвет несёт значение — часто как второй, "активный"
компонент toggle-пары с файлом из группы A):

`tutorial_arrow` (ярко-зелёная стрелка `#4aed86` — та же зелёная семантика,
что и "first wire" в §5, держи согласованно, если провода тоже
перекрашиваешь), `shop_active` (оранжевая звезда `#ff4a03` — активное
состояние парного `shop.png` из группы A, который в неактивном состоянии
просто нейтрально-тёмный)

```
Flat 2D UI glyph icon, single solid flat ACCENT color fill (not neutral
grey) — representing: [ПОНЯТИЕ — "a downward tutorial pointer arrow, uses
the same green as a positive/first-priority accent elsewhere in the UI" /
"an active/selected shop star icon, contrasts with its own neutral grey
inactive twin"]. No outline, no gradient, no shadow.

Composition: centered, even padding, transparent background, square canvas
exactly [РАЗМЕР]x[РАЗМЕР]px.
```

### 6.3 `res/ui/main_menu/discord.svg`, `github.svg`, `patreon.svg`, `reddit.svg`

Это официальные лого сторонних сервисов (иконки ссылок на соцсети/донат), а не
брендинг игры — их не нужно "ребрендить" через AI. Если состав ссылок в новом
проекте меняется (например, вместо Patreon — Boosty, вместо Discord — свой
Telegram-канал), просто подставь официальный SVG-лого нужного сервиса на замену
файла того же назначения — рисовать чужие фирменные знаки самим не нужно и не
стоит.

Перепроверил папку — в ней и правда только эти 4 файла, больше там ничего
нет, "остальных" файлов под отдельный промпт для `main_menu/` не осталось.

---

## 7. Лого и айдентика

| Файл | Где используется в коде |
|---|---|
| `res/logo.png` | `src/css/main.scss`, `src/js/states/main_menu.js`, `src/js/states/preload.js`, `src/js/core/background_resources_loader.js` |
| `res/logo-tobspr-games.svg` | `src/js/states/about.js` (сплэш/подпись издателя) |
| `res/puzzle_dlc_logo.png` | `src/css/ingame_hud/puzzle_dlc_logo.scss`, `src/js/game/modes/puzzle.js`, `src/js/game/hud/hud_parts.ts` |
| base64 PNG прямо в `src/html/index.html` (загрузочный экран до старта бандла) | нужно перегенерировать вручную и вставить как новую base64-строку |

`logo-tobspr-games.svg` — это подпись самого издателя tobspr, её нужно не
"перекрасить", а полностью убрать вместе со ссылкой в `about.js` (это не игровой
ассет, это чужой корпоративный лейбл).

### 7.1 Разбор текущего лого (`res/logo.png`, 710×180)

Композиция из двух частей:
1. **Знак (mark)** — круглый бейдж: серый круг-подложка, внутри — крупная фигура
   из четырёх квадратов-квадрантов (2 светлых почти-белых, 2 тёмно-серых,
   в шахматном порядке, один из тёмных квадратов меньше остальных) — это прямая
   отсылка к игровой механике "фигур из четвёрок сегментов". Смысл знака держится
   на конкретной механике этой игры, один-в-один копировать по смыслу не нужно,
   но принцип "знак = внутриигровая механика в упрощённом виде" стоит сохранить,
   если механика похожая.
2. **Вордмарк** — название игры строчными буквами, лёгкий "гравированный"
   светло-серый на белом (тонкая тёмная обводка снизу/справа + светлый блик
   сверху/слева — псевдо-inset эффект), тот же несерьёзный скруглённый шрифт-
   стиль, что и общая эстетика игры.

### 7.2 Промпт — знак/мар (нужен отдельно, без текста — для favicon/иконки приложения)

```
Minimalist flat 2D app icon mark, circular badge on transparent background.
Inside the circle: a simple abstract geometric emblem built from a small set
of flat solid shapes (squares/rectangles or the game's core visual motif —
[ОПИСАНИЕ ЦЕНТРАЛЬНОЙ ИГРОВОЙ МЕХАНИКИ/МОТИВА, который знак должен
символизировать]), arranged in a balanced, symmetric or near-symmetric
composition, 2-3 flat colors maximum, no gradients, no 3D bevels, no drop
shadow, no outline text.

Style: clean flat vector iconography, bold simple shapes that stay legible
and recognizable when scaled down to 32x32px (this will be used as a browser
tab / app icon, so no fine detail).

Canvas: square, generous padding around the circular badge, fully
transparent background outside the circle.

Avoid: text/lettering, photorealism, complex illustration, more than 3 flat
colors, gradients, drop shadows, isometric/3D perspective.
```

### 7.3 Промпт — полный горизонтальный лого (знак + вордмарк, для меню/сплэша)

```
Horizontal game logo lockup: circular flat icon mark on the left (reuse the
mark from the previous prompt) followed by the game name as a wordmark in
lowercase, rounded friendly geometric sans-serif letterforms matching the
game's soft, minimal, flat visual style.

Wordmark style: light, airy, subtle "engraved/inset" look — a soft light
highlight on the top-left edge of each letter and a soft darker shadow on
the bottom-right edge, on an otherwise near-white/very light letter fill;
no heavy color, no gradients beyond this single subtle emboss effect, no
outline stroke.

Composition: mark and wordmark vertically centered together, mark-to-text
gap proportional and consistent, transparent background, wide horizontal
canvas (roughly 4:1 width:height ratio, e.g. 710x180px), leave clean
padding on all sides for use as a header logo at small display heights
(~40-60px tall) — must stay legible that small.

Avoid: photorealism, drop shadows on the wordmark, serif or heavy/bold
fonts, background shapes/panels behind the text, additional taglines.
```

Готовый результат из 7.2 (только знак, без слова) используется для base64-картинки
в `src/html/index.html` (это тоже полный
горизонтальный лого §7.3, просто перекодированный в base64 — сгенерируй PNG
той же логики, что и `res/logo.png`, и перегони в base64 любым инструментом,
например `base64 -w0 newlogo.png`, вставь строкой вместо текущего
`data:image/png;base64,...`).

`res/puzzle_dlc_logo.png` (709×205) — отдельный лого для puzzle/DLC-режима,
тот же подход (§7.3), но со своим текстом/акцентом на "puzzle" — актуально
только если этот режим остаётся в проекте, иначе можно пропустить.

---

## 8. Звук и музыка

Исходники лежат как обычные `.wav`/`.mp3` в `res_raw/sounds/`, сборка (`npm run
gulp`) сама всё транскодирует и упаковывает — руками собирать спрайт-лист или
подбирать финальный битрейт не нужно, важно только **положить файл с правильным
именем и разумным качеством на вход**.

### 8.1 Как это собирается (`gulp/sounds.js`) — важно для качества исходников

- **Музыка** (`music/*.wav|mp3`) прогоняется через ffmpeg дважды: лёгкая версия
  для веба (mono, 22050Hz, 48kbps mp3) и HQ-версия для standalone (stereo,
  44100Hz, 256kbps). Обе версии автоматически приглушаются фильтром
  `volume=0.15` — то есть **финальная громкость в игре будет заметно тише
  исходника**, при создании трека можно не бояться, что он "громкий", движок сам
  подрежет.
- **SFX** (`sfx/*.wav`) склеиваются в один `sfx.mp3` через `gulp-audiosprite`
  (промежуток `gap: 0.1s` между клипами вставляется автоматически) и
  перекодируются в mono/22050Hz/128kbps с фильтром `volume=0.2`. Раскладка по
  таймкодам (`sfx.json`) генерируется сама — можно просто положить 14 отдельных
  коротких файлов с точными именами, спрайт-лист собирать вручную не нужно.
- Имя файла (без расширения) = ключ в `src/js/platform/sound.js` (`SOUNDS` /
  `MUSIC`), **менять имена нельзя**, менять можно только содержимое.

### 8.2 Музыка

**2026-09-01: `theme` сгенерирован заново как плейлист из 7 треков**
(`res_raw/sounds/music/theme-1.mp3` … `theme-7.mp3`, ~2 минуты каждый),
ротация/шаффл реализованы в `src/js/platform/sound.js`
(`PlaylistMusicInstance` — по завершении трека переключается на следующий из
перемешанного списка, без кроссфейда). Список имён — константа
`THEME_PLAYLIST`, а не единственный ключ `MUSIC.theme`, так что для этого
трека правило "имя файла = ключ в коде" из §8.1 не действует — имена
`theme-N` просто должны совпадать со списком в `THEME_PLAYLIST`. Оригинал
`theme-full.mp3` (41:22, один бесшовный луп) в бэкапе:
`assets_backup_original/res_raw/sounds/music/theme-full.mp3`.

| Файл | Ключ в коде | Формат | Где звучит |
|---|---|---|---|
| `music/menu.mp3` | `MUSIC.menu` | mono/22050Hz (сгенерирован 2026-09-01) | Заставка/главное меню |
| `music/theme-1..7.mp3` | `THEME_PLAYLIST` (не прямой ключ) | mono/22050Hz (сгенерированы 2026-09-01) | Основной геймплей (фабрика), плейлист с шаффлом |
| `music/puzzle-full.mp3` | `MUSIC.puzzle` | 44.1kHz, стерео (оригинал, не заменён) | Режим паззлов |

Важно: `puzzle-full.mp3` и одиночные треки (`menu`, каждый `theme-N`) всё ещё
играются с `loop: true` внутри самого трека — Howler просто прыгает на 0-ю
секунду по окончании, **без кроссфейда**. Значит начало и конец каждого
такого файла должны звучать совместимо (не обрывать фразу на полутакте),
иначе будет слышен щелчок/шов на границе повтора одного трека. Между
разными треками плейлиста `theme` кроссфейда тоже нет — переход просто
обрывает один и начинает следующий, это осознанное упрощение
(`PlaylistMusicInstance`), а не баг.

```
Seamlessly loopable background music track for a calm factory-automation /
logic-puzzle video game, [ЖАНР/НАСТРОЕНИЕ — например "chill ambient
electronic with soft mechanical/synth textures" — заполни сам под свой
проект], instrumental only, no vocals, no lyrics.

Mood: [MENU-версия: "understated, atmospheric, sits quietly behind menu
navigation, not attention-grabbing" / THEME-версия: "steady, unobtrusive,
low-key hypnotic groove that stays pleasant over long uninterrupted play
sessions, minimal dynamic swings, no jarring drops or climaxes" / PUZZLE-
версия: "slightly more focused/tense than the main theme, still calm, fits
concentrated problem-solving"].

Structure: designed for a hard loop with NO crossfade — the very end must
flow back into the very beginning without an audible seam (matching tempo/
key/phrase position at the loop point, no cold stop, no fade-out ending).

Length: roughly [ДЛИНА — 1:30-2:00 для menu, от нескольких минут и дольше
для theme/puzzle, чем длиннее, тем менее заметен повтор за долгую сессию].

Technical: deliver as WAV or high-bitrate MP3, stereo, the build pipeline
will automatically downmix/transcode/attenuate for web and standalone —
source doesn't need to be pre-mastered quiet, just clean and not clipping.
```

### 8.3 Звуковые эффекты — 14 файлов, короткие one-shot

Все — не зацикленные (`loop: false`), проигрываются одним щелчком по игровому
событию. Ниже — исходная длительность (ориентир, не жёсткое требование) и что
именно озвучивает файл:

| Файл | ~Длина | Событие |
|---|---|---|
| `ui_click.wav` | 0.11s | Клик по обычной UI-кнопке |
| `ui_error.wav` | 0.31s | Недопустимое UI-действие |
| `dialog_error.wav` | 0.20s | Открытие диалога с ошибкой |
| `dialog_ok.wav` | 0.88s | Открытие диалога с подтверждением/успехом |
| `ui_swish_hide.wav` | 0.09s | Скрытие панели/меню |
| `ui_swish_show.wav` | 0.11s | Появление панели/меню |
| `badge_notification.wav` | 0.97s | Всплывающее уведомление/достижение |
| `level_complete.wav` | 2.12s | Завершение уровня/цели |
| `destroy_building.wav` | 0.47s | Снос постройки |
| `place_building.wav` | 0.31s | Установка постройки на поле |
| `place_belt.wav` | 0.06s | Установка сегмента ленты (очень короткий — тянется при протяжке) |
| `copy.wav` | 0.18s | Копирование (пипетка/чертёж) |
| `unlock_upgrade.wav` | 0.21s | Получение апгрейда/технологии |
| `tutorial_step.wav` | 0.68s | Прогресс обучающей подсказки |

```
Short one-shot UI/game sound effect for a factory-automation game, [ОПИСАНИЕ
СОБЫТИЯ ИЗ ТАБЛИЦЫ ВЫШЕ — например "a light, crisp, minimal click for a
generic UI button press" / "a soft mechanical thunk for placing a building
on a grid" / "a quick metallic snip/clunk for demolishing a building" /
"a rising chime/sparkle for unlocking an upgrade"].

Style: clean, minimal, non-fatiguing on repetition (this plays very often
during normal play, must not become annoying), fits the same calm/soft sonic
palette as the rest of the game's audio (no harsh/aggressive transients
unless the event is explicitly an error/warning).

Length: approximately [ДЛИНА ИЗ ТАБЛИЦЫ]s, single clean transient — no long
tail/reverb decay that would overlap the next rapid-fire trigger of the same
sound (e.g. rapid belt placement or rapid clicking).

Technical: mono or stereo WAV, no clipping, normalized but not
over-compressed — the build pipeline applies its own volume attenuation.
```

Отдельно стоит `place_belt.wav` (0.06s) — он проигрывается при протяжке ленты
мышью много раз подряд, поэтому должен быть предельно коротким и не
"звенящим" (без хвоста), иначе наложение копий друг на друга даст кашу.

### 8.4 Порядок для звука (встраивается в общий §9 ниже)

1. Сгенерировать 3 музыкальных трека и 14 sfx по промптам выше.
2. Положить в `res_raw/sounds/music/` и `res_raw/sounds/sfx/` **строго под теми
   же именами**, что и сейчас (расширение `.wav` или `.mp3` — оба варианта
   подхватываются).
3. `npm run gulp` — транскодирование, аудио-спрайт и приглушение соберутся
   автоматически, ничего руками собирать не надо.
4. Проверить в деве: особенно loop-шов у каждого `theme-N`/`puzzle-full`/`menu`, и
   что `place_belt` не "трещит" при быстрой протяжке ленты.

---

## 9. Фон меню (`res/bg_render.webm`)

Проверил файл: 1508×940, VP9, 60fps, **4.58 секунды**, зациклен, без звука.
Достал кадры и посмотрел — это **не абстрактный рендер и не отдельная
"фоновая иллюстрация"**, это буквально живой скриншот-запись реальной игры:
статичная камера над плотно застроенной фабрикой (те самые постройки и лента
из §2/§4), меняются только фигуры, ползущие по лентам, — то, что уже
пересобирается в §2–§4.

**Вывод: отдельный AI-промпт тут не нужен и даже вреден** — если сгенерировать
фон как самостоятельную картинку/видео, он не будет совпадать со стилем новых
построек (это будет второй независимый арт-стиль поверх первого). Правильный
путь — **записать этот фон заново уже после того, как готовы новые постройки
и лента (§2–§4)**:

1. В деве построить большую плотную фабрику (например через `mods`/дебаг-режим
   массовой застройки или просто руками — важна только визуальная "занятость"
   кадра, не игровая логика).
2. Поставить статичную камеру, дать конвейерам поработать, чтобы фигуры
   заполнили ленты по всему кадру.
3. Записать 4-5 секунд экрана (`ffmpeg -f x11grab ...` / OBS / любой скринкастер)
   на бесшовный луп: конец записи должен совпасть по фазе движения фигур с
   началом (проще всего — записать на 1-2 секунды больше нужного и обрезать
   так, чтобы позиции фигур на первом и последнем кадре визуально совпадали).
4. Перекодировать в VP9 webm тем же разрешением/fps:
   `ffmpeg -i capture.mp4 -c:v libvpx-vp9 -b:v 0 -crf 32 -an res/bg_render.webm`
   (без звуковой дорожки — `-an`, оригинал тоже без звука).

Если всё же хочется стилизованный, не-геймплейный фон (например абстрактный
паттерн вместо живой фабрики) — это уже отдельная дизайн-развилка, не
техническое требование; в таком случае промпт нужно писать под конкретно
выбранную концепцию, шаблона под неё в этом плане нет, потому что оригинал
её не использует.

---

## 10. Шрифт (`res/fonts/GameFont.woff2`)

Проверил через `fonttools` — это **не самостоятельный кастомный шрифт**, а
переименованный сабсет обычного open-source шрифта **Barlow** (Regular,
weight 400, 543 глифов из полного семейства). Barlow распространяется по
лицензии **SIL OFL 1.1** — свободной шрифтовой лицензии, которая прямо
разрешает переименовывать/сабсеттить/переупаковывать шрифт (именно так тут и
сделано: имя в метаданных всё ещё "Barlow", файл просто назвали
`GameFont.woff2` и подключили как `$mainFont` в `src/css/variables.scss`).

**Важное следствие: тут в принципе нечего "ребрендить" по юридическим
причинам** — Barlow не принадлежит tobspr, это чужой свободный шрифт,
использовать его дальше можно без каких-либо ограничений. В отличие от
лого/названия, шрифт — не часть чужого бренда.

**И тут не работает AI-промпт в том же смысле, что для картинок** —
image-генератор не производит рабочий `.woff2` с полным набором глифов,
кернингом и хинтингом, он рисует картинку буквы. Если менять шрифт всё же
хочется (по эстетическим, не юридическим причинам) — есть два реальных пути:

**Путь А (быстрый, рекомендуемый): взять другой готовый свободный шрифт.**
Раз пайплайн уже "переименовать open-source шрифт в GameFont.woff2", просто
подставь другое семейство с похожей лицензией (Google Fonts — почти всё под
OFL) и того же характера — округлый, геометричный, дружелюбный gothic/
grotesque в духе Barlow (кандидаты для референса: Poppins, Manrope, Rubik,
Quicksand — любой в этом же семействе "закруглённый geometric sans"). Дальше
сабсет под нужные языки и переименование в `GameFont.woff2` — чисто
техническая операция (`fonttools`/`pyftsubset`), не генерация.

**Путь Б (медленный): заказать/нарисовать уникальный шрифт** — это работа для
type-дизайнера в шрифтовом редакторе (Glyphs/FontForge/RoboFont), не для
картиночного AI. Если всё же нужен текстовый бриф для постановки задачи
дизайнеру (или для поиска референсов через text-to-image как mood-board, не
как источник самого шрифта):

```
Type design brief for a UI/game display font, geometric sans-serif family,
rounded soft terminals (not sharp/angular), friendly and approachable but
still clean and highly legible at small UI sizes (menus, HUD numbers,
tooltips). Medium-low contrast strokes, single regular weight (400) is the
minimum requirement — the game currently uses only one weight throughout.
Character: [СВОЙ СТИЛЬ — например "playful but not childish, matches a calm
minimalist factory-automation game" — заполни сам].

Must support: Latin (incl. extended diacritics), Cyrillic — [see current
`translations/` list for the full language set if more scripts are needed;
note the current subset is only 543 glyphs, i.e. Latin+Cyrillic-class
coverage, NOT CJK/Arabic — those likely fall back to a system font already,
verify before assuming full-script coverage is required].
```

Технически замена (любой из путей): положить сабсетнутый `.woff2` в
`res/fonts/`, оставить точно то же имя файла `GameFont.woff2` (или поменять
имя и обновить единственную ссылку — sass-переменную `$mainFont` в
`src/css/variables.scss:53`), пересборка не нужна, файл используется как есть.

---

## 11. Порядок работ (чтобы не пересобирать лишний раз)

1. Сгенерировать 51 PNG построек по шаблону из §2, положить в `res_raw/sprites/buildings/`
   с точными именами/размерами из таблицы §2.1.
2. Прогнать `create_blueprint_previews.py` (§3) — получить `blueprints/*.png` автоматом.
   Отдельно сделать `hub` (единственное явное исключение скрипта).
3. Отредактировать цвет/текстуру в `generate_belt_sprites.js` (§4, только константы,
   геометрию не трогать), прогнать — получить 42 кадра ленты + авто-копии в `buildings/`.
4. (Опционально) то же для `generate_wire_sprites.js`.
5. Заменить 185 файлов `res/ui/**`.
6. Заменить лого/иконки (§7), вычистить ссылку на `logo-tobspr-games.svg` из `about.js`.
7. Сгенерировать музыку и sfx по §8, положить в `res_raw/sounds/music/` и
   `res_raw/sounds/sfx/` под теми же именами.
8. (Опционально, можно в любой момент, не зависит от остального) шрифт — см. §10,
   свотчи `colors/*`, мелкие оверлеи `misc/*` — см. §12. Фон под сеткой поля
   (§13) — это не файл, а два hex-цвета в `themes/light.json`/`dark.json`,
   правится отдельно от любых генераций, тоже в любой момент.
9. Пересборка: `npm run gulp` — Java-текстур-паккер сам соберёт всё из `res_raw/sprites/`
   в атласы `res_built/` (гитигнорится, генерируется каждый раз), а ffmpeg/audiosprite
   сам транскодирует и упакует звук (§8.1). `res/ui/*` и лого пересборки не требуют,
   они уже финальные файлы.
10. Визуальная и звуковая проверка в деве: постройки, их чертежи (режим blueprint),
    лента на всех 3 направлениях в движении, loop-шов у музыки, "кашу" от
    `place_belt` при быстрой протяжке.
11. **Только теперь** переснять фон меню (§9), 44 обучающих скриншота (§16) и
    11 обучающих GIF (§17) — все три категории делаются из готовой игры с новой
    графикой, поэтому обязательно последним шагом, не раньше.

---

## 12. Мелкие оверлеи (`res_raw/sprites/misc/`)

Немного — **9 файлов**, все маленькие (52–192px), это не постройки, а
служебные значки, которые движок рисует поверх других элементов (курсор-
подсказки, статусы, компас). Они визуально неоднородны — тут не один стиль, а
три разных, посмотрел каждый:

| Файл | Размер | Что это | Стиль |
|---|---|---|---|
| `slot_good_arrow.png` | 52×52 | "сюда можно поставить" — зелёная стрелка над слотом | Дуотон: контур + заливка, акцентный зелёный |
| `slot_bad_arrow.png` | 52×52 | "сюда нельзя" — та же стрелка, другой цвет | Дуотон, акцентный красный (по аналогии с good) |
| `processor_disconnected.png` | 128×128 | Значок "не подключено к сети" на процессоре/логике | Дуотон + акцентный цвет (розово-красный), с мягкой тенью — как у building_icons |
| `processor_disabled.png` | 128×128 | Значок "отключено" | Тот же язык, нейтральный серый акцент |
| `reader_overlay.png` | 192×192 | Пустая панель-экран поверх постройки reader (под неё движок сам рисует превью сигнала) | Просто скруглённый прямоугольник, контур + плоская заливка светлого тона — визуально повторяет корпус постройки из §2 |
| `storage_overlay.png` | 120×60 | Пустая панель-подложка под индикатор заполненности хранилища | Тот же скруглённый-прямоугольник-панель язык, чуть темнее заливка |
| `hub_direction_indicator.png` | 64×64 | Стрелка-компас "куда идти" (за пределами видимой карты) | **Не дуотон** — плоский **один сплошной цвет**, без обводки, простой заострённый треугольник-указатель |
| `waypoint.png` | 64×64 | Иконка маркера-метки (как пин на карте) | Тот же плоский однотонный язык, что и у компаса |
| `waypoint_wires.png` | 64×64 | То же самое, вариант для режима проводов | Тот же однотонный язык, вероятно другой акцентный цвет под тему проводов |

Промпты — два разных шаблона под два стиля из таблицы.

**Шаблон А — дуотон с акцентным цветом** (`slot_good_arrow`, `slot_bad_arrow`,
`processor_disconnected`, `processor_disabled`):

```
Flat 2D game UI status icon representing: [СМЫСЛ — например "a valid/allowed
placement indicator, an upward arrow" / "an invalid/blocked placement
indicator, same arrow shape as the valid version" / "a disconnected network
plug icon" / "a disabled/greyed-out power icon"].

Style: two-tone flat duotone matching the game's building-icon language —
a solid accent-color fill with a darker outline of the same hue (uniform
stroke width, ~8-10% of icon size), soft short drop shadow beneath, no
gradients, no texture, no 3D.

Color: [ЦВЕТ — "green accent for a positive/allowed state" / "red accent for
a negative/blocked state" / "neutral grey for a disabled state" — держи
smysl "зелёный=можно, красный=нельзя" как есть, это функциональная
семантика, а не декоративный выбор].

Composition: centered, small even padding, fully transparent background,
square canvas exactly [РАЗМЕР]x[РАЗМЕР]px, must stay legible at this small
size (icon is viewed at in-game zoom, often quite small on screen).
```

**Шаблон Б — панель/подложка** (`reader_overlay`, `storage_overlay`):

```
Flat 2D empty UI panel background, a plain rounded-rectangle frame matching
this game's building-casing style: uniform outline stroke (~5px at 192px
scale, proportionally thinner at smaller sizes), flat single-tone fill
(a neutral light or mid grey), no gradients, no icon/content inside — this
is purely a backdrop panel that other dynamic content gets drawn on top of
by the game engine at runtime.

Corner radius: proportional, matching the same rounding used on the building
sprites (~8% of the shorter side). Fully transparent background outside the
panel shape. Canvas exactly [ШИРИНА]x[ВЫСОТА]px ([192×192 для reader_overlay,
120×60 для storage_overlay]).
```

**Шаблон В — плоский однотонный компас/пин** (`hub_direction_indicator`,
`waypoint`, `waypoint_wires`):

```
Flat 2D single-color solid silhouette icon, no outline, no gradient, no
shadow — representing: [СМЫСЛ — "a sharp directional compass-arrow pointer"
/ "a map pin/waypoint marker"], bold simple geometric shape, must read
clearly as a tiny icon at in-game map scale.

Color: one flat solid fill only, [ЦВЕТ — обычный тёмный нейтральный тон для
waypoint/hub_direction_indicator; для waypoint_wires — акцентный цвет,
согласованный с палитрой проводов из §5].

Composition: centered, transparent background, square canvas exactly
64x64px.
```

---

## 13. Фон под постройками / сетка поля ("тайлы")

Проверил: **это не картинка**. Игровое поле (сетка клеток под постройками) в
движке рисуется не спрайтом, а прямой заливкой canvas плюс тонкими линиями
сетки — цвета берутся из JSON-темы, а не из `res_raw`:

```
src/js/game/themes/light.json:
    "background": "#eceef2",
    "gridRegular": "#e3e7ea",
    "gridPlacing": "#dadff0",
    "gridLineWidth": 0.5,

src/js/game/themes/dark.json — тот же набор ключей, свои значения
```

Ресурсные "пятна" фигур на карте (`map_chunk_view.js` → `drawOverlayPatches`)
тоже не текстура фона — это просто отрисовка самого предмета-фигуры (того
же спрайта, что несёт лента), карта не хранит отдельную "текстуру земли" под
ними.

**Значит: тут не нужен AI-промпт вообще — фон тайлов меняется правкой пары
hex-значений в `light.json`/`dark.json`, а не генерацией картинки.** Подбери
`background` (базовый фон поля), `gridRegular` (обычная линия сетки, сейчас
чуть темнее фона) и `gridPlacing` (подсветка сетки в момент, когда что-то
ставишь) под новую палитру построек из §2 — этого достаточно, чтобы поле
визуально сочеталось с новой графикой.

Если хочется не плоский цвет, а именно **текстурированный фон** (например
лёгкий шум/бетон/металл под сеткой) — это уже не смена ассета, а инженерная
доработка: пришлось бы добавить в движок отрисовку тайловой текстуры вместо
`fillRect`, чего сейчас там нет. Если это нужно — отдельная задача уровня
чанка в `TODO.md`, не часть художественного ребрендинга; в таком случае
промпт под саму текстуру будет похож на промпт для текстуры ленты в §4
("seamless tileable texture..."), но встраивание в рендер — отдельная работа.

---

## 14. Свотчи цветов (`res_raw/sprites/colors/*.png`)

8 файлов, 72×72: `red`, `green`, `blue`, `yellow`, `purple`, `cyan`, `white`,
`uncolored`. Это иконки-превью красителей в UI (выбор цвета для покрасочной
машины и т.п.), не сами игровые цвета фигур — но нарисованы не плоским
квадратом, а как три перекрывающихся кружка-кляксы (венн-диаграмма из "трёх
капель краски"), с тёмной обводкой — визуально намекает на смешивание.

**Важно для смысла, не только картинки:** в `src/js/game/colors.js` это не
произвольные 8 цветов, а настоящая **аддитивная RGB-модель**, зашитая в
геймплей — `yellow = red+green`, `purple = red+blue`, `cyan = blue+green`,
`white = red+green+blue`, `uncolored` — нейтральный серый (ничего не
смешано):

```
red:    #ff666a
green:  #78ff66
blue:   #66a7ff
yellow: #fcf52a   (red + green)
purple: #dd66ff   (red + blue)
cyan:   #00fcff   (blue + green)
white:  #ffffff   (red + green + blue)
uncolored: #aaaaaa
```

Если менять оттенки — можно (это не бренд tobspr, ограничений нет), но **три
базовых (red/green/blue) должны остаться узнаваемыми как классические
RGB-примари**, иначе игрок перестанет интуитивно понимать логику смешивания
(зачем "жёлтый" получается из этих двух конкретных цветов). Смещать
насыщенность/яркость — ок, менять сам цветовой тон primary-цветов — рискованно
для читаемости механики.

```
Flat 2D UI swatch icon representing the dye color "[НАЗВАНИЕ ЦВЕТА]" in a
factory-automation game with an additive-RGB color-mixing mechanic. Three
overlapping circular paint-drop blobs (Venn-diagram-style cluster, like a
color swatch made of three dabs), each blob filled with the same flat solid
color: [HEX ИЗ ТАБЛИЦЫ ВЫШЕ, либо своя палитра — но красный/зелёный/синий
базовые ДОЛЖНЫ визуально читаться как классические RGB-примари, потому что
жёлтый/пурпурный/голубой/белый получаются смешением именно этих трёх].

Style: flat fill, no gradient, uniform dark outline stroke around each blob
and around the overall cluster silhouette (~10% of icon size), soft flat
look matching the game's building-icon language, no texture, no shine.

For "uncolored": same three-blob composition but in flat neutral grey
(#aaaaaa-class tone) — represents "no dye applied yet".

Composition: centered, small even padding, transparent background, square
canvas exactly 72x72px.
```

---

## 15. Флаги языков (`res/ui/languages/*.svg`)

32 файла — но это, если честно, **не то, что вообще стоит трогать AI-
генератором**. Открыл несколько `.svg`: это обычные квадратные скруглённые
флаги стран (512×512 viewBox, плоская векторная заливка) — узнаваемый набор
из готовой открытой icon-библиотеки флагов (такой стиль используют
"flag-icons" и аналогичные наборы), никак не завязанный на бренд shapez —
это просто иконка выбора языка в настройках.

**Почему не AI-промпт:**
- Национальные флаги — это точные, регламентированные изображения (пропорции,
  цвета, элементы герба). AI-генератор их re-imagine'ит "на глаз" и почти
  гарантированно даст неточный/узнаваемо кривой результат — для флага это не
  стилизация, а фактическая ошибка (и местами вопрос простой вежливости к
  стране).
- Тут нет ничего от айдентики tobspr/shapez, которую нужно убирать — ребрендинг
  эту папку не требует вообще.

**Что реально стоит сделать вместо генерации**, если хочется другой визуальный
стиль флагов (например другую форму — круг вместо скруглённого квадрата, или
другую толщину скругления углов под общий UI-стиль проекта): взять готовый
открытый набор флаг-иконок (например `flag-icons` на GitHub, MIT-лицензия) в
нужной форме/размере и подставить файл-в-файл под теми же именами. Полный
список нужных 32 кодов языков (совпадает с `translations/base-*.yaml`):

```
ar bg cs da de el en es-419 et fi fr he hu it ja kor mt-MT nb nl no pl
pt-BR pt-PT ro ru sv th tr uk vi zh-CN zh-TW
```

(`kor`/`es-419`/`mt-MT` — нестандартные коды проекта, не ISO 639-1 напрямую,
сверяйся по имени файла, а не только по стандартному коду языка при подборе
замены из внешнего набора.)

---

## 16. Обучающие иллюстрации построек (`res/ui/building_tutorials/*.png`)

44 файла, все 600×600. Открыл несколько (`cutter.png`, `rotator.png`) — та же
история, что с фоном меню в §9: **это не отдельная иллюстрация, а
скомпонованный in-game скриншот** — реальная сетка поля, реальная лента,
реальный спрайт постройки, реальные предметы-фигуры на ленте, иконка мусорки
— то есть ровно те ассеты, что уже переделываются в §2–§5, просто выставленные
в маленькую демонстрационную сцену (например у `cutter.png` — два варианта
раскладки рядом: было/стало, с мусоркой для лишнего выхода; у `rotator.png` —
фигура до и после поворота).

**Важная находка: в движке уже есть встроенный экспортёр скриншота ровно под
эту задачу** — `src/js/game/hud/parts/screenshot_exporter.js`
(`HUDScreenshotExporter`), висит на хоткее `KEYMAPPINGS.ingame.exportScreenshot`:
считает bounding box всех построенных сущностей на карте и рендерит их в PNG.
Это штатный dev-инструмент, а не что-то, что нужно писать с нуля.

Ещё важно: `src/js/mods/mod_interface.js:381` ссылается на путь
`building_tutorials/${buildingIdentifier}.png` как на контракт для
модов-построек — то есть **имена файлов менять нельзя**, это не просто
внутренний ассет, а публичный API-контракт для мод-сообщества.

**Тут тоже не нужен AI-промпт** — по той же причине, что и для фона меню:
независимая генерация даст рассинхрон со стилем уже готовых построек/ленты.
Правильный порядок:

1. Дождаться готовности §2 (постройки) и §4 (лента).
2. Для каждой из построек выставить в деве ровно ту сцену, что описана в
   таблице ниже (2-4 клетки, содержимое сцены уже продумано методистами игры —
   менять её смысл не нужно, только внешний вид ассетов).
3. Экспортировать скриншот встроенным экспортёром (хоткей
   `exportScreenshot`) или обычным кропом окна до 600×600.
4. Сохранить под тем же именем поверх файла в `res/ui/building_tutorials/`.

### 16.1 Что именно показывает каждый файл (открыл все, не по памяти)

Посмотрел все 44 файла по одному — вот что физически происходит в кадре у
каждого. Общий приём почти везде один: **1-2 панели side-by-side**, реальные
предметы-фигуры едут по реальной ленте через реальный спрайт постройки; для
построек уровня проводов (`wire`/логика/`virtual_processor*`/`comparator` и
т.п.) фон окрашен в бирюзовый "режим проводов", источник сигнала — компактный
квадратик-извлекатель наверху, приёмник — серый блок с "π" внизу/сбоку
(нейтральный дебаг-индикатор значения сигнала, не про математику), а
булевы 0/1 подписаны прямо белыми плашками на проводе.

| Файл | Сцена |
|---|---|
| `analyzer` | Два извлекателя цвета шлют сигналы по проводам в анализатор, результат идёт на индикатор-π внизу |
| `balancer` | Два примера рядом: вход из двух разных фигур на два входа балансера, выход равномерно перемешан на оба выхода |
| `balancer-merger` | Два примера мержа бокового входа в основную ленту — правый и левый заход, разные ориентации |
| `balancer-splitter` | Зеркально мержеру — два примера разбивки одной ленты на левый/правый отвод |
| `belt` | Простой поворот ленты на 90° с квадратными фигурами, идущими по маршруту |
| `block` | Сетка из зарезервированных серых тайлов, лента огибает их поворотом — демонстрация блокировки клетки |
| `comparator` | Два компаратора, каждый со своим цветовым входом, выход на "хорошо/плохо"-индикатор — показывает равенство/неравенство |
| `constant_producer` | Постоянный источник кормит фиксированной фигурой две ленты разной длины к двум приёмникам |
| `constant_signal` | Источник постоянного сигнала шлёт зелёный провод в фильтр/роутер (X-образный значок маршрутизации) |
| `cutter` | Два примера рядом: до/после резки, с мусоркой на лишнем выходе |
| `cutter-quad` | 4-полосный вход, резак на 4 части, режет на 4 отдельных выхода |
| `display` | Сетка 2×2 из состояний экрана: цветной сигнал, сигнал-фигура, пустое/выключенное, белое — 4 варианта показа |
| `filter` | **Файла нет** — постройка filter не входит в текущие 44, ничего пересоздавать не нужно |
| `goal_acceptor` | Два кольца-приёмника: активная цель (зелёное кольцо, принимает фигуры) и заблокированная (серое) |
| `item_producer` | Извлекатель фигур шлёт сигнал по проводу в продюсер предметов на слое сигналов (песочница) |
| `lever` | Рычаг-переключатель (зелёный = включён) шлёт булев сигнал по проводу в фильтр |
| `logic_gate-and` | AND-вентиль: два входа "1" и "1" → выход "1" |
| `logic_gate-not` | Два примера: вход "0"→выход "1" и вход "1"→выход "0" |
| `logic_gate-or` | OR-вентиль: входы "1"/"0" → выход "1" |
| `logic_gate-xor` | XOR-вентиль: оба входа "1" → выход "0" (демонстрирует, что XOR — не то же самое, что OR) |
| `miner` | Извлекатель на ресурсном пятне (фон из тусклых кружков-ресурса), кормит ленту |
| `miner-chainable` | Три извлекателя подряд, соединённые цепочкой, на одну общую ленту |
| `mixer` | Два цветных входа (красный/зелёный) смешиваются в жёлтый на выходе |
| `painter` | Фигура слева + цвет сверху (значок валика) → окрашенная фигура на выходе вправо |
| `painter-double` | Два входа-фигуры + один цветовой вход → оба окрашены одним цветом на общий выход |
| `painter-mirrored` | То же, что painter, но цветовой вход снизу, а не сверху |
| `painter-quad` | Провода на слое сигналов подают "1" на все 4 квадранта покрасочника — демонстрирует поквадрантную покраску по сигналам |
| `reader` | Считыватель ленты со живым числовым счётчиком throughput прямо на корпусе |
| `rotator` | До/после: фигура поворачивается на 90° по часовой |
| `rotator-ccw` | То же, но против часовой (отличается направлением витка стрелки-иконки на корпусе, сверься с файлом за точным начертанием) |
| `rotator-rotate180` | То же, но на 180° (иконка того же семейства, другой акцент — сверься с файлом) |
| `stacker` | Два примера: слияние совместимых фигур в одну (бок о бок) и укладка одной поверх другой |
| `storage` | Хранилище с числовым индикатором заполненности ("124") и приоритетным (со звездой) + обычным выходом |
| `transistor` | Два примера: боковой сигнал "1" пропускает нижний сигнал дальше, боковой "0" — блокирует |
| `trash` | Мусорка на 4-стороннем перекрёстке лент, поглощает фигуры со всех направлений |
| `underground_belt` | Пара тоннель-вход/выход, лента визуально продолжается "под землёй" между ними |
| `underground_belt-tier2` | То же, но сравнение обычной и увеличенной (tier2) дальности тоннеля рядом |
| `virtual_processor-cutter` | Два извлекателя фигур шлют сигналы в виртуальный резак, результат — на индикатор-π |
| `virtual_processor-painter` | Извлекатель фигуры + извлекатель цвета → виртуальный покрасочник → окрашенный сигнал на π-индикаторе |
| `virtual_processor-rotator` | Извлекатель фигуры → виртуальный ротатор (значок как у обычного rotator) → повернутый сигнал |
| `virtual_processor-stacker` | Извлекатель фигуры → виртуальный стакер → результат на π-индикаторе |
| `virtual_processor-unstacker` | Извлекатель фигуры → виртуальный анстакер (значок звезды-развёртки) → два раздельных π-индикатора |
| `wire` | Рычаг соединён зелёным проводом с фильтром/роутером — базовая прокладка провода |
| `wire-second` | Два независимых рычага — один на зелёном, другой на синем проводе — показывает, что два слоя проводов не пересекаются |
| `wire_tunnel` | Простой Х-перекрёсток: два провода пересекаются, не соединяясь |

Обрати внимание: файл называется `virtual_processor-cutter.png` (с суффиксом
`-cutter`) — это отличается от папки физических построек `res_raw/sprites/
buildings/`, где соответствующий файл называется просто `virtual_processor.png`
без суффикса (см. §2.1/§2.2). Символ (ножницы) при этом один и тот же —
только имя файла разное между двумя папками, не путай при поиске/замене.

---

## 17. Интерактивные обучающие GIF (`res/ui/interactive_tutorial.noinline/*.gif`)

11 файлов, 400×400 (один — `2_1_place_cutter.gif` — 400×353), анимированные.
Разобрал один покадрово (`1_2_conveyor.gif`, 119 кадров по 40мс ≈ 4.7с) — это
**буквально запись экрана** реального прохождения: виден курсор мыши, тянущий
ленту от добытчика к хабу, панель хаба в углу, тулбар построек внизу,
зелёные индикаторы валидного соединения — то есть live-геймплей, а не
рисованная анимация.

Досмотрел все 11 файлов покадрово (не только по имени) — вытащил старт/середину/
конец каждого гифа и прогнал глазами. Ниже — что реально происходит на экране,
достаточно конкретно, чтобы повторить то же действие мышью 1:1 (имя файла:
`<стадия>_<шаг>_<действие>`):

| Файл | Что реально происходит на записи |
|---|---|
| `1_1_extractor.gif` | На ресурсном пятне (кластер серых фигур) во второй ячейке тулбара выбирается инструмент "добытчик" (подсвечивается синим), курсор кликает по пятну — добытчик встаёт и начинает извлекать |
| `1_2_conveyor.gif` | От только что поставленного добытчика курсор тянет (drag) ленту буквой Г до входа хаба, по пути виден зелёный индикатор валидного соединения |
| `1_3_expand.gif` | Статичный (без активного клика) вид уже готового результата — 4 параллельные линии "добытчик+лента", ведущие к общему выходу; это не запись действия, а показ итога паттерна, который надо повторить 4 раза |
| `2_1_place_cutter.gif` | 4 ленты с фигурами уже едут; в тулбаре появляются новые инструменты (block, cutter-ножницы), выбирается ножницы, курсор кликает на крайнюю правую ленту — режущая постройка встаёт поперёк |
| `2_2_place_trash.gif` | Резак уже стоит; выбирается инструмент "мусорка" (иконка urны в тулбаре), курсор кликает на боковой (неиспользуемый) выход резака — мусорка встаёт на него |
| `2_3_more_cutters.gif` | Продолжение той же сцены на соседней ленте: ставится второй резак (развёрнутый вбок, выход вправо) + вторая мусорка на его лишний выход, затем лента с этого резака протягивается дальше вбок |
| `3_1_rectangles.gif` | У панели хаба (виден счётчик "0/70 to unlock ROTATING") курсор тянет 4 ленты от 4 квадратных ресурсных пятен наверху экрана к общему входу хаба — сборка маршрута доставки под цель уровня |
| `21_1_place_quad_painter.gif` | На белом пустом поле появляется уже частично собранный учетверённый покрасочник с 4 выходами (первый цвет — красный/malina, остальные пусты); курсор кликает/наводит на 3-й квадрант-выход, который подсвечивается — демонстрация поканальной покраски по квадрантам |
| `21_2_switch_to_wires.gif` | Экран переключается из обычного вида (яркие цвета) в затемнённо-бирюзовый "режим проводов" (кадр посередине уже полностью в режиме проводов); дальше курсор начинает тянуть зелёный провод от выходов покрасочника в общую шину |
| `21_3_place_button.gif` | Провод от покрасочника уже проложен; в тулбаре режима проводов выбирается инструмент "кнопка/рычаг" (3-я ячейка, овальная иконка), курсор кликает рядом и подключает его к той же проводной шине — появляется рычаг с текущим состоянием "0" |
| `21_4_press_button.gif` | Курсор кликает по уже поставленному рычагу, состояние меняется с "0" на "1" — и это сразу видно по эффекту ниже: узор/цвет предметов на выходе покрасочника меняется, наглядно показывая, что сигнал реально управляет покраской |

**Тот же вывод, что и в §16/§9: не генерировать AI-картинкой, а переснять
после готовности всей графики.** В отличие от `building_tutorials/`, тут
готового экспортёра нет (`screenshot_exporter.js` делает только статичный
PNG) — нужен обычный скринкаст с реальным выполнением того же действия мышью,
что и в оригинале, тем же способом, что и фон меню в §9 (`ffmpeg`/OBS), с
конвертацией итога в GIF под нужный размер:

```bash
# запись экрана в mp4 (пример для X11, см. §9 за деталями захвата),
# затем конвертация в зацикленный GIF с приличной палитрой:
ffmpeg -i capture.mp4 -vf "fps=25,scale=400:400:flags=lanczos,split[s0][s1];\
[s0]palettegen[p];[s1][p]paletteuse" -loop 0 res/ui/interactive_tutorial.noinline/1_2_conveyor.gif
```

Порядок: воспроизвести то же самое действие мышью (то же движение, тот же
результат), что и в оригинальном файле того же имени — не придумывать новую
демонстрацию, только новый визуальный стиль вокруг того же обучающего шага.

---

## 18. Текстовые/кодовые упоминания бренда (не картинки, для полноты)

Отдельно от графики есть ~47 файлов с текстом "shapez" (переводы, `package.json`
→ `name`, `config.ts` → ссылки на `github.com/tobspr-games`, `viewer.shapez.io`,
`api.shapez.io`, консольный баннер в `main.js`). Это уже разобрано в предыдущем
ответе в сессии — сюда не дублирую, но не забыть при полном ребрендинге: часть
этих ссылок (`api.shapez.io`, `viewer.shapez.io`) не просто текст, а рабочие
внешние сервисы tobspr, которые в форке нужно либо отключить, либо заменить своим
бэкендом.
