// Translation dictionary. Every UI string flows through a key here.
export type Lang = 'en' | 'ru'

export const DICT = {
  // app / topbar
  appTitle: { en: 'Nevma', ru: 'Nevma' },
  appSubtitle: { en: 'physical paper editor', ru: 'редактор физической бумаги' },
  earlyDemo: { en: 'early demo', ru: 'ранняя версия' },
  presets: { en: 'Presets', ru: 'Пресеты' },
  backToHome: { en: 'Home', ru: 'На главную' },

  // social links
  socialFollowHint: {
    en: "Enjoyed using the service? I'd love it if you followed / tagged me on social media!",
    ru: 'Если вам понравилось пользоваться сервисом, буду рад, если вы подпишетесь или отметите меня в соц. сетях!',
  },
  socialTelegram: { en: 'Telegram', ru: 'Telegram' },
  socialInstagram: { en: 'Instagram', ru: 'Instagram' },
  socialTiktok: { en: 'TikTok', ru: 'TikTok' },

  // welcome modal
  welcomeTitle: { en: 'Welcome!', ru: 'Добро пожаловать!' },
  welcomeSubtitle: {
    en: 'Thank you for trying Nevma ❤️',
    ru: 'Спасибо, что решили попробовать Nevma ❤️',
  },
  welcomeBody1: {
    en: 'This is not the final version of the project yet.',
    ru: 'Это еще не финальная версия проекта.',
  },
  welcomeBody2: {
    en: 'The service is being actively developed, and I keep improving simulation quality, the tools and performance.',
    ru: 'Сейчас сервис активно развивается, и я продолжаю улучшать качество симуляции, инструменты и производительность.',
  },
  welcomeBody3: {
    en: 'If you spot bugs, strange behaviour, or have ideas for improvement — I would be very glad to hear your feedback.',
    ru: 'Если вы заметите ошибки, странное поведение или у вас появятся идеи по улучшению — буду очень рад обратной связи.',
  },
  welcomeWarn1: {
    en: '⚠️ High-resolution images (2K, 4K and above) may still take significantly longer than usual to process.',
    ru: '⚠️ Изображения высокого разрешения (2K, 4K и выше) пока могут обрабатываться значительно дольше обычного.',
  },
  welcomeWarn2: {
    en: 'I am actively working on optimizing the engine, so processing speed will improve with every update.',
    ru: 'Сейчас я активно работаю над оптимизацией движка, поэтому скорость обработки будет улучшаться с каждым обновлением.',
  },
  welcomeFooter: {
    en: 'If you enjoyed the service or want to share your experience, message me on Telegram.',
    ru: 'Если вам понравился сервис или вы хотите поделиться опытом использования, напишите мне в Telegram.',
  },
  welcomeTelegram: { en: 'Message me on Telegram', ru: 'Написать в Telegram' },
  welcomeStart: { en: 'Get started', ru: 'Начать работу' },
  welcomeDontShow: { en: "Don't show again", ru: 'Больше не показывать' },

  // tools
  toolSelect: { en: 'Select / move', ru: 'Курсор / перемещение' },
  toolPan: { en: 'Pan canvas', ru: 'Рука (холст)' },
  toolZoom: { en: 'Zoom', ru: 'Масштаб' },
  toolLasso: { en: 'Scissors / lasso', ru: 'Ножницы / лассо' },
  toolSand: { en: 'Sandpaper (damage)', ru: 'Наждачка (повреждения)' },
  resetView: { en: 'Reset view', ru: 'Сбросить вид' },
  brushSize: { en: 'Brush size', ru: 'Размер кисти' },
  brushStrength: { en: 'Brush strength', ru: 'Сила кисти' },
  edgeStyle: { en: 'Edge style', ru: 'Тип края' },

  // cut mode (lasso vs pen)
  cutMode: { en: 'Cut mode', ru: 'Режим вырезания' },
  cutModeLasso: { en: 'Lasso', ru: 'Лассо' },
  cutModePen: { en: 'Pen', ru: 'Перо' },

  // edge styles
  edgeScissors: { en: 'Scissors', ru: 'Ножницы' },
  edgeTorn: { en: 'Torn', ru: 'Разрыв' },
  edgeWorn: { en: 'Worn', ru: 'Изношенный' },

  // layers
  layers: { en: 'Layers', ru: 'Слои' },
  layersEmpty: { en: 'Drop an image on the canvas, or use browse.', ru: 'Перетащите изображение на холст или выберите файл.' },
  baseImage: { en: 'base image', ru: 'исходное изображение' },
  fragment: { en: 'fragment', ru: 'фрагмент' },
  reorderHint: { en: 'Drag to reorder', ru: 'Перетащите, чтобы изменить порядок' },
  canvasLayerHint: { en: 'The canvas — always at the bottom, can\u2019t be moved or deleted', ru: 'Холст \u2014 всегда внизу, его нельзя переместить или удалить' },

  // canvas
  dropHere: { en: 'Drag & drop an image here', ru: 'Перетащите изображение сюда' },
  orBrowse: { en: 'or browse', ru: 'или выберите файл' },
  lassoHint: { en: 'Draw a closed shape — it cuts automatically on release', ru: 'Нарисуйте замкнутую форму — вырезание произойдёт автоматически' },
  penHint: { en: 'Click to add points, drag for curves. Click the first point to close & cut. Backspace / Delete undoes the last point. Double-click a point to delete.', ru: 'Клик — точка, перетаскивание — кривая. Клик по первой точке замыкает и вырезает. Backspace / Delete отменяет последнюю точку. Двойной клик — удалить точку.' },
  sandHint: { en: 'Paint on the selected layer to wear the paper', ru: 'Рисуйте по выбранному слою, чтобы истереть бумагу' },
  brushHint: { en: 'Drag across the sheet to apply the tool. Order matters — each pass builds on the last.', ru: 'Проведите по листу, чтобы применить инструмент. Порядок важен — каждый проход опирается на предыдущий.' },
  brushSelectHint: { en: 'Select a layer first, then drag to work on the sheet', ru: 'Сначала выберите слой, затем проведите по листу' },

  // physical brush controls
  brSize: { en: 'Size', ru: 'Размер' },
  brPressure: { en: 'Pressure', ru: 'Давление' },
  brGrit: { en: 'Grit', ru: 'Зернистость' },
  brAngle: { en: 'Direction', ru: 'Направление' },
  brRandom: { en: 'Randomness', ru: 'Случайность' },
  brColor: { en: 'Color', ru: 'Цвет' },
  brLoad: { en: 'Paint load', ru: 'Загрузка краски' },
  brWet: { en: 'Wetness', ru: 'Влажность' },
  brBlend: { en: 'Blending', ru: 'Смешивание' },
  brInk: { en: 'Ink flow', ru: 'Подача чернил' },
  brBleed: { en: 'Bleed', ru: 'Растекание' },
  brHardness: { en: 'Hardness', ru: 'Твёрдость' },
  brGloss: { en: 'Gloss', ru: 'Блеск' },
  brBubbles: { en: 'Air bubbles', ru: 'Пузырьки' },
  brWrinkle: { en: 'Wrinkles', ru: 'Складки' },
  brKerf: { en: 'Cut width', ru: 'Ширина реза' },
  brFiber: { en: 'Fibres', ru: 'Волокна' },

  // inspector
  inspector: { en: 'Inspector', ru: 'Инспектор' },
  selectLayer: { en: 'Select a layer to edit its physical parameters.', ru: 'Выберите слой, чтобы редактировать физические параметры.' },
  material: { en: 'Material', ru: 'Материал' },
  paperLabel: { en: 'Paper', ru: 'Бумага' },
  printerLabel: { en: 'Printer', ru: 'Печать' },
  seed: { en: 'Seed', ru: 'Seed' },
  randomize: { en: 'Randomize all', ru: 'Случайные значения' },
  applyTemplate: { en: 'Apply', ru: 'Применить' },
  randomizeTemplate: { en: 'Randomize', ru: 'Рандомизировать' },
  randomizeTemplateHint: { en: 'Keep this template, new variation of its parameters', ru: 'Сохранить шаблон, новая вариация его параметров' },
  savePreset: { en: 'Save preset', ru: 'Сохранить пресет' },
  renamePreset: { en: 'Rename preset', ru: 'Переименовать пресет' },
  deletePreset: { en: 'Delete preset', ru: 'Удалить пресет' },
  presetChipHint: {
    en: 'Save this exact processing to your own editor and open it there',
    ru: 'Сохранить эту обработку себе в редактор и открыть его',
  },
  presetSavedTitle: { en: 'Preset saved', ru: 'Пресет сохранён' },
  presetSavedBody: {
    en: 'This processing was saved to your editor. Open the Final tab to apply it.',
    ru: 'Эта обработка сохранена у вас в редакторе. Откройте вкладку «Финал», чтобы её применить.',
  },
  presetSavedGo: { en: 'Go to editor', ru: 'Перейти в редактор' },
  loadSaved: { en: 'Load saved…', ru: 'Загрузить сохранённый…' },
  paperEngine: { en: 'Paper Engine', ru: 'Движок бумаги' },
  printEngine: { en: 'Print Engine', ru: 'Движок печати' },
  damageEngine: { en: 'Damage Engine', ru: 'Движок повреждений' },
  scannerEngine: { en: 'Scanner Engine', ru: 'Движок сканера' },
  engineEnabled: { en: 'Engine enabled', ru: 'Движок включён' },

  // paper types
  paperNewsprint: { en: 'Newsprint', ru: 'Газетная' },
  paperOldAd: { en: 'Old advertising', ru: 'Старая рекламная' },
  paperCardboard: { en: 'Cardboard', ru: 'Картон' },
  paperGlossy: { en: 'Glossy', ru: 'Глянцевая' },
  paperCheap: { en: 'Cheap paper', ru: 'Дешёвая бумага' },

  // printer types
  printOffset: { en: 'Offset — Heidelberg GTO', ru: 'Офсет — Heidelberg GTO' },
  printLaser: { en: 'Laser — HP LaserJet', ru: 'Лазерный — HP LaserJet' },
  printXerox: { en: 'Photocopier — Xerox 914', ru: 'Ксерокопия — Xerox 914' },
  printInkjet: { en: 'Inkjet — Canon BJC', ru: 'Струйный — Canon BJC' },
  printNewspaper: { en: 'Web press — Goss Community', ru: 'Газетная ротация — Goss Community' },
  printRiso: { en: 'Risograph — Riso RP', ru: 'Ризограф — Riso RP' },

  // paper params
  pYellowing: { en: 'Yellowing', ru: 'Желтизна' },
  pFibers: { en: 'Fibers', ru: 'Волокна' },
  pRoughness: { en: 'Roughness', ru: 'Шероховатость' },
  pThickness: { en: 'Thickness', ru: 'Толщина' },
  pStains: { en: 'Stains', ru: 'Пятна' },
  pMoisture: { en: 'Moisture', ru: 'Влага' },
  pCreases: { en: 'Creases / folds', ru: 'Складки / заломы' },
  pScratches: { en: 'Surface scratches', ru: 'Царапины поверхности' },

  // printer params
  prHalftone: { en: 'Halftone', ru: 'Растр (halftone)' },
  prInkDensity: { en: 'Ink density', ru: 'Плотность краски' },
  prColorShift: { en: 'Color shift', ru: 'Сдвиг цвета' },
  prRegistration: { en: 'Registration error', ru: 'Ошибка приводки' },
  prFade: { en: 'Faded ink', ru: 'Выцветание краски' },

  // damage params
  dScratches: { en: 'Scratches', ru: 'Царапины' },
  dAbrasions: { en: 'Abrasions', ru: 'Потёртости' },
  dWorn: { en: 'Worn areas', ru: 'Изношенные зоны' },
  dPaperDamage: { en: 'Paper damage', ru: 'Повреждения бумаги' },

  // scanner params
  scNoise: { en: 'Sensor noise', ru: 'Шум сенсора' },
  scDust: { en: 'Dust & specks', ru: 'Пыль и точки' },
  scStreaks: { en: 'Streaks / banding', ru: 'Полосы' },
  scDistortion: { en: 'Distortion', ru: 'Искажения' },
  scColor: { en: 'Color problems', ru: 'Проблемы цвета' },

  // preset names
  presetXeroxZine: { en: 'Xerox zine (80–90s)', ru: 'Ксерокс-зин (80–90-е)' },
  presetNewsHalftone: { en: 'Newsprint halftone', ru: 'Газетный растр' },
  presetSovietOffset: { en: 'Soviet offset (60–70s)', ru: 'Советский офсет (60–70-е)' },
  presetRisoPunk: { en: 'Riso punk poster (90s)', ru: 'Ризо-панк постер (90-е)' },
  presetFadedPhoto: { en: 'Faded photo print', ru: 'Выцветшее фото' },
  presetGrungeCollage: { en: 'Grunge torn collage', ru: 'Гранж-коллаж' },

  customPreset: { en: 'Custom', ru: 'Мой пресет' },

  // intensity + categories
  intensity: { en: 'Effect intensity', ru: 'Интенсивность эффекта' },
  intensityHelp: { en: 'Master strength of the whole physical simulation. 0% = original image, 100% = full effect.', ru: 'Общая сила физической симуляции. 0% = оригинал, 100% = полный эффект.' },
  catPaper: { en: 'Paper', ru: 'Бумага' },
  catPrinter: { en: 'Printer', ru: 'Печать' },
  catInk: { en: 'Ink', ru: 'Краска' },
  catScanner: { en: 'Scanner', ru: 'Сканер' },
  catAnalog: { en: 'Analog Scans', ru: 'Аналоговые сканы' },
  analogAmount: { en: 'Overlay amount', ru: 'Сила наложения' },
  hAnalog: { en: 'Blends a real scanned paper/photocopy sheet over the image. The scan is picked and placed by the seed, so each seed gives a different grunge.', ru: 'Подмешивает реальный скан бумаги/ксерокопии поверх изображения. Скан выбирается и размещается по seed, поэтому каждый seed даёт свою фактуру.' },
  catDamage: { en: 'Damage', ru: 'Повреждения' },
  catCutting: { en: 'Cutting', ru: 'Вырезание' },
  catLighting: { en: 'Lighting', ru: 'Освещение' },

  // tabs
  tabSettings: { en: 'Settings', ru: 'Настройки' },
  tabTemplates: { en: 'Templates', ru: 'Шаблоны' },

  // undo / redo / nav
  undo: { en: 'Undo', ru: 'Отменить' },
  redo: { en: 'Redo', ru: 'Вернуть' },
  historyTitle: { en: 'History', ru: 'История' },
  historyStart: { en: 'Initial state', ru: 'Начальное состояние' },
  historyCurrent: { en: 'current', ru: 'текущее' },
  historyEmpty: { en: 'No actions yet', ru: 'Действий пока нет' },
  navHint: { en: 'Wheel = zoom · Middle-drag or Space+drag = pan', ru: 'Колесо = масштаб · Средняя кнопка или Space+drag = перемещение' },

  // align-to-canvas toolbar
  alignToCanvas: { en: 'Align to canvas', ru: 'Выравнивание по холсту' },
  alignLeft: { en: 'Align left edge', ru: 'По левому краю' },
  alignCenterH: { en: 'Center horizontally', ru: 'По центру по горизонтали' },
  alignRight: { en: 'Align right edge', ru: 'По правому краю' },
  alignTop: { en: 'Align top edge', ru: 'По верхнему краю' },
  alignCenterV: { en: 'Center vertically', ru: 'По центру по вертикали' },
  alignBottom: { en: 'Align bottom edge', ru: 'По нижнему краю' },

  // fit/fill/crop to canvas
  fitToCanvas: { en: 'Fit whole image inside canvas (may leave a gap)', ru: 'Вписать изображение целиком в холст (может остаться зазор)' },
  fitToCanvasShort: { en: 'Fit', ru: 'Вписать' },
  fillCanvas: { en: 'Scale image to fill the whole canvas (may overhang edges)', ru: 'Растянуть изображение на весь холст (может выходить за края)' },
  fillCanvasShort: { en: 'Fill', ru: 'Залить' },
  cropToCanvas: { en: 'Crop layer to canvas — permanently trims whatever sticks out past the edges', ru: 'Обрезать слой по холсту — то, что выходит за края, будет удалено' },
  cropToCanvasShort: { en: 'Crop', ru: 'Обрезать' },
  lockAspect: { en: 'Lock aspect ratio', ru: 'Сохранять пропорции' },
  original: { en: 'Original', ru: 'Оригинал' },
  originalHint: { en: 'Hold to preview the original image', ru: 'Удерживайте, чтобы увидеть оригинал' },

  // sandpaper extra params
  sandRoughness: { en: 'Grit (roughness)', ru: 'Зернистость' },
  sandFiberDir: { en: 'Fiber direction', ru: 'Направление волокон' },
  sandDepth: { en: 'Damage depth', ru: 'Глубина повреждения' },

  // help texts — paper
  hpYellowing: { en: 'Simulates age-related yellowing of paper. Higher values = older, warmer sheet.', ru: 'Имитирует пожелтение бумаги от старения. Больше значение — старее и теплее лист.' },
  hpFibers: { en: 'Visibility of paper fibers and grain direction in the sheet.', ru: 'Видимость волокон бумаги и направление структуры листа.' },
  hpRoughness: { en: 'Micro-roughness of the surface. Adds fine tactile grain.', ru: 'Микрошероховатость поверхности. Добавляет мелкое зерно.' },
  hpThickness: { en: 'Perceived paper thickness via subtle relief shading.', ru: 'Ощущение толщины бумаги через мягкое рельефное затенение.' },
  hpStains: { en: 'Warm age blotches, like coffee or grease marks.', ru: 'Тёплые пятна старения, как от кофе или жира.' },
  hpMoisture: { en: 'Damp blotches with darker tide-line rings from water damage.', ru: 'Влажные пятна с тёмными краями (разводы) от воды.' },
  hpCreases: { en: 'Folds and creases with a shadow and a lit edge.', ru: 'Складки и заломы с тенью и светлым краем.' },
  hpPScratches: { en: 'Fine surface scratches on the paper itself.', ru: 'Тонкие царапины на поверхности самой бумаги.' },
  // help — printer
  hprHalftone: { en: 'Breaks the image into printed dots (CMYK screen). Core of offset/newspaper print.', ru: 'Разбивает изображение на печатные точки (CMYK-растр). Основа офсета и газеты.' },
  hprInkDensity: { en: 'How saturated and heavy the ink lays down. Low = washed out, high = rich.', ru: 'Насколько плотно ложится краска. Мало — блёкло, много — насыщенно.' },
  hprColorShift: { en: 'Warm/cool cast of the inks. Negative = cool, positive = warm.', ru: 'Тёплый/холодный оттенок краски. Минус — холоднее, плюс — теплее.' },
  hprRegistration: { en: 'Misalignment of color layers in printing. High values create the classic old offset look.', ru: 'Смещение цветовых слоёв при печати. Большие значения дают эффект старой офсетной печати.' },
  hprFade: { en: 'Faded, worn-out ink losing pigment toward the paper tone.', ru: 'Выцветшая краска, теряющая пигмент к тону бумаги.' },
  // help — damage
  hdScratches: { en: 'Bright thin scratches across the surface.', ru: 'Светлые тонкие царапины по поверхности.' },
  hdAbrasions: { en: 'Scuffed matte patches from handling.', ru: 'Потёртые матовые участки от обращения.' },
  hdWorn: { en: 'Broad worn areas where pigment is lost.', ru: 'Широкие изношенные зоны с потерей пигмента.' },
  hdPaperDamage: { en: 'Dark nicks and small holes in the sheet.', ru: 'Тёмные надрывы и мелкие дырки в листе.' },
  // help — scanner
  hscNoise: { en: 'Electronic sensor noise from an old scanner.', ru: 'Электронный шум сенсора старого сканера.' },
  hscDust: { en: 'Dust specks and hairs on the scanner glass.', ru: 'Пылинки и волоски на стекле сканера.' },
  hscStreaks: { en: 'Horizontal banding and vertical scan streaks.', ru: 'Горизонтальные полосы и вертикальные штрихи сканирования.' },
  hscDistortion: { en: 'Lens/geometry distortion and slight wobble.', ru: 'Геометрические искажения и лёгкое дрожание.' },
  hscColor: { en: 'White-balance drift and color problems of cheap sensors.', ru: 'Сдвиг баланса белого и проблемы цвета дешёвых сенсоров.' },

  // new printer params
  prDpi: { en: 'Print resolution (DPI)', ru: 'Разрешение печати (DPI)' },
  prDotGain: { en: 'Dot gain', ru: 'Растискивание' },
  hprDpi: { en: 'Printing resolution. Lower DPI = coarser, more visible dots.', ru: 'Разрешение печати. Ниже DPI — крупнее и заметнее точки.' },
  hprDotGain: { en: 'Ink spread on contact — dots grow, midtones and shadows darken.', ru: 'Растекание краски при контакте — точки увеличиваются, средние тона и тени темнеют.' },

  // new scanner params
  scJpeg: { en: 'JPEG compression', ru: 'JPEG-сжатие' },
  scBlur: { en: 'Blur', ru: 'Размытие' },
  scExposure: { en: 'Exposure', ru: 'Экспозиция' },
  hscJpeg: { en: 'Lossy compression: blocky 8×8 artifacts and banding.', ru: 'Сжатие с потерями: блочные артефакты 8×8 и полошение.' },
  hscBlur: { en: 'Softening from an out-of-focus or low-quality capture.', ru: 'Смягчение от неточного фокуса или низкого качества съёмки.' },
  hscExposure: { en: 'Capture brightness. 50% = neutral, lower = darker, higher = brighter.', ru: 'Яркость съёмки. 50% — нейтрально, ниже — темнее, выше — светлее.' },

  // scanner modes
  scannerMode: { en: 'Scanner', ru: 'Сканер' },
  scanNone: { en: 'No scanning', ru: 'Без сканирования' },
  scanHome: { en: 'Home scanner', ru: 'Домашний сканер' },
  scanPro: { en: 'Professional scanner', ru: 'Профессиональный сканер' },
  scanPhone: { en: 'Phone', ru: 'Телефон' },

  // paper colour
  paperColor: { en: 'Paper colour', ru: 'Цвет бумаги' },

  // basic / expert split
  tabBasic: { en: 'Basic', ru: 'Основные' },
  tabExpert: { en: 'Expert', ru: 'Экспертные' },

  // select labels + help icons
  lblColorMode: { en: 'Colour mode', ru: 'Режим цвета' },
  lblPaperType: { en: 'Paper type', ru: 'Тип бумаги' },
  lblPrinterType: { en: 'Printer type', ru: 'Тип принтера' },
  hColorMode: { en: 'How the image colour is presented: full colour, black & white or tint.', ru: 'Как показан цвет: полноцветно, чёрно-белое или тонирование.' },
  hPaperType: { en: 'Paper stock preset — sets base tint and fibre character.', ru: 'Тип бумаги — задаёт базовый оттенок и характер волокон.' },
  hPaperColor: { en: 'Base colour of the paper stock (white = unchanged).', ru: 'Базовый цвет бумаги (белый — без изменений).' },
  hPrepress: { en: 'Colour preparation applied before the print simulation.', ru: 'Подготовка цвета до симуляции печати.' },
  hPrinterType: { en: 'Printing process — changes dot shape and ink behaviour.', ru: 'Способ печати — меняет форму точки и поведение краски.' },
  hScannerMode: { en: 'How the printed sheet is captured. None = skip scanning.', ru: 'Как оцифрован отпечаток. «Без сканирования» — пропустить.' },
  hEdgeColor: { en: 'Colour of the cut edge / paper interior.', ru: 'Цвет среза / внутренней части бумаги.' },
  hTintColor: { en: 'Tint colour used in the tint colour mode.', ru: 'Цвет тонирования для режима тонирования.' },

  // guided preparation wizard
  wizStart: { en: 'Start preparation', ru: 'Начать подготовку' },
  wizNext: { en: 'Next', ru: 'Далее' },
  wizBack: { en: 'Back', ru: 'Назад' },
  wizFinish: { en: 'Open editor', ru: 'Открыть редактор' },
  wizLoadTitle: { en: 'Image loaded', ru: 'Изображение загружено' },
  wizLoadHint: { en: 'Prepare it for print step by step, like real prepress.', ru: 'Подготовьте его к печати по этапам, как в настоящей полиграфии.' },
  wizStepPaper: { en: 'Step 1 · Paper', ru: 'Этап 1 · Бумага' },
  wizStepPrinter: { en: 'Step 2 · Printer', ru: 'Этап 2 · Принтер' },
  wizStepScanner: { en: 'Step 3 · Scanner', ru: 'Этап 3 · Сканер' },
  wizPaperHint: { en: 'Choose the paper stock and its condition.', ru: 'Выберите бумагу и её состояние.' },
  wizPrinterHint: { en: 'Choose the printer and how the ink is laid down.', ru: 'Выберите принтер и как ложится краска.' },
  wizScannerHint: { en: 'Choose how the printed sheet is captured.', ru: 'Выберите, как оцифрован отпечаток.' },

  // prepress (colour preparation before print)
  prepressMode: { en: 'Prepress mode', ru: 'Подготовка к печати' },
  prepFullColor: { en: 'Full Color', ru: 'Полноцветный' },
  prepCmykOffset: { en: 'CMYK Offset', ru: 'CMYK офсет' },
  prepGrayscale: { en: 'Grayscale', ru: 'Оттенки серого' },
  prepBlackInk: { en: 'Black Ink', ru: 'Чёрная краска' },
  prepNewspaper: { en: 'Newspaper', ru: 'Газета' },
  prepRisograph: { en: 'Risograph', ru: 'Ризограф' },

  // colour mode
  catColor: { en: 'Colour', ru: 'Цвет' },
  colorMode: { en: 'Colour mode', ru: 'Режим цвета' },
  colColor: { en: 'Colour', ru: 'Цветное' },
  colBW: { en: 'Black & white', ru: 'Ч/Б' },
  colTint: { en: 'Tint', ru: 'Тон' },
  tintColor: { en: 'Tint colour', ru: 'Цвет тона' },

  // cutting / edge colour
  edgeColor: { en: 'Cut edge colour', ru: 'Цвет края обрезки' },
  edgeColorHelp: { en: 'Colour of the exposed paper interior along a cut edge.', ru: 'Цвет открытой внутренней части бумаги на крае обрезки.' },

  // scratches tab
  tabScratches: { en: 'Scratches', ru: 'Царапины' },
  scratchesEnabled: { en: 'Enable scratches', ru: 'Включить царапины' },
  scratchPattern: { en: 'Pattern', ru: 'Тип' },
  scratchAmount: { en: 'Amount', ru: 'Количество' },
  scratchAngle: { en: 'Angle', ru: 'Угол' },
  scratchDepth: { en: 'Depth', ru: 'Глубина' },
  scrFine: { en: 'Fine hairlines', ru: 'Тонкие' },
  scrCoarse: { en: 'Coarse gouges', ru: 'Грубые' },
  scrCrosshatch: { en: 'Crosshatch', ru: 'Перекрёстные' },
  scrDirectional: { en: 'Directional', ru: 'Направленные' },
  scrRandom: { en: 'Random', ru: 'Случайные' },

  // export
  exportZip: { en: 'Export', ru: 'Экспорт' },
  exporting: { en: 'Exporting…', ru: 'Экспорт…' },

  // new project modal
  npTitle: { en: 'New project', ru: 'Новый проект' },
  npSubtitle: { en: 'Choose a canvas to start with. You can import images and add layers afterwards.', ru: 'Выберите холст для начала. Изображения и слои можно добавить позже.' },
  npResolution: { en: 'Resolution', ru: 'Разрешение' },
  npOrientation: { en: 'Orientation', ru: 'Ориентация' },
  npLandscape: { en: 'Landscape', ru: 'Альбомная' },
  npPortrait: { en: 'Portrait', ru: 'Книжная' },
  npCustom: { en: 'Custom size', ru: 'Свой размер' },
  npWidth: { en: 'Width', ru: 'Ширина' },
  npHeight: { en: 'Height', ru: 'Высота' },
  npName: { en: 'Project name', ru: 'Название проекта' },
  npCreate: { en: 'Create', ru: 'Создать' },
  npImport: { en: 'Import an image instead', ru: 'Или импортировать изображение' },
  npOpen: { en: 'Open a saved project', ru: 'Открыть сохранённый проект' },
  npPx: { en: 'px', ru: 'px' },

  // project save / open
  saveProject: { en: 'Save project', ru: 'Сохранить проект' },
  openProject: { en: 'Open project', ru: 'Открыть проект' },
  saving: { en: 'Saving…', ru: 'Сохранение…' },
  newProject: { en: 'New project', ru: 'Новый проект' },

  // layers panel
  newLayer: { en: 'New layer', ru: 'Новый слой' },
  blankLayer: { en: 'empty layer', ru: 'пустой слой' },
  mergeLayers: { en: 'Merge', ru: 'Объединить' },
  mergeLayersHint: {
    en: 'Combine the checked layers into one new layer on top. The original layers are kept untouched.',
    ru: 'Объединить отмеченные слои в один новый слой сверху. Исходные слои останутся без изменений.',
  },
  selectForMerge: { en: 'Select for merging', ru: 'Выбрать для объединения' },
  layersSelected: { en: 'Selected:', ru: 'Выбрано:' },
  cancelSelection: { en: 'Cancel selection', ru: 'Отменить выбор' },
  shiftSelectHint: {
    en: 'Shift+click a layer to select the whole range at once',
    ru: 'Shift + клик по слою — выбрать сразу несколько слоёв подряд',
  },

  // export modal
  exportTitle: { en: 'Export', ru: 'Экспорт' },
  exportFinalTitle: { en: 'Download Final Image', ru: 'Скачать финальную работу' },
  exportFinalDesc: { en: 'PNG · original resolution · no compression', ru: 'PNG · оригинальное разрешение · без сжатия' },
  exportLayersTitle: { en: 'Download Project Layers', ru: 'Скачать слои проекта' },
  exportLayersDesc: { en: 'ZIP · each layer separately, original sizes, transparency, names, groups', ru: 'ZIP · каждый слой отдельно, оригинальные размеры, прозрачность, имена, группы' },
  supportLine1: { en: 'Nevma will always stay free.', ru: 'Nevma всегда будет бесплатной.' },
  supportLine2: { en: 'If this project helped you create something, you can support its development or simply share your work with me.', ru: 'Если этот проект помог вам что-то создать, вы можете поддержать его развитие или просто поделиться со мной своей работой.' },
  supportPhone: { en: '+79611613618 · Т-Банк', ru: '+79611613618 · Т-Банк' },

  // top-menu workflow stages
  stageUpload: { en: 'Upload', ru: 'Загрузка' },
  stagePrint: { en: 'Print', ru: 'Печать' },
  stageWorkshop: { en: 'Workshop', ru: 'Мастерская' },
  stageScan: { en: 'Scan', ru: 'Сканирование' },
  stageFinal: { en: 'Final', ru: 'Финал' },

  // stage intro cards (shown once per stage on first visit) + "? Help" panel
  introUploadBody: {
    en: 'Here you add the images you\u2019ll work with in Nevma.\n\nLoad an image, set up the background and prepare the composition before printing.',
    ru: 'Здесь вы можете добавить изображения, с которыми будете работать в Nevma.\n\nЗагрузите изображение, настройте фон и подготовьте композицию перед печатью.',
  },
  introUploadButton: { en: 'Got it \u2192', ru: 'Понятно \u2192' },

  introPrintBody: {
    en: 'Here you set how the image will look on a sheet of paper.\n\nChoose the format, size and position of the image before sending it to the workshop.',
    ru: 'Здесь вы задаёте, как изображение будет выглядеть на листе бумаги.\n\nВыберите формат, размер и положение изображения перед тем, как отправить его в мастерскую.',
  },
  introPrintButton: { en: 'Got it \u2192', ru: 'Понятно \u2192' },

  introWorkshopBody: {
    en: 'This is where the physical handling of the image begins.\n\nTear, cut, crease, scratch and change the paper as if you were working with a real print.',
    ru: 'Здесь начинается физическая обработка изображения.\n\nРвите, вырезайте, мните, царапайте и изменяйте бумагу так, будто работаете с настоящей распечаткой.',
  },
  introWorkshopButton: { en: 'Start working \u2192', ru: 'Начать работу \u2192' },

  introScanBody: {
    en: 'Here you can give the piece the look of a real scan.\n\nAdd noise, dust, artifacts, compression and other traces of the physical process.',
    ru: 'Здесь вы можете придать работе вид настоящего скана.\n\nДобавляйте шум, пыль, артефакты, сжатие и другие следы физического процесса.',
  },
  introScanButton: { en: 'Start scanning \u2192', ru: 'Начать сканирование \u2192' },

  introFinalBody: {
    en: 'The piece is ready.\n\nHere you can check the result and export it for further use.',
    ru: 'Работа готова.\n\nЗдесь вы можете проверить результат и экспортировать его для дальнейшего использования.',
  },
  introFinalButton: { en: 'Go to final \u2192', ru: 'Перейти к финалу \u2192' },

  introDontShow: { en: "Don't show again", ru: 'Больше не показывать' },

  // "? Help" panel
  helpButton: { en: 'Help', ru: 'Помощь' },
  helpPanelTitle: { en: 'Help', ru: 'Помощь' },
  helpPanelHint: { en: 'Pick a stage to see what it\u2019s for.', ru: 'Выберите этап, чтобы узнать, для чего он нужен.' },

  helpShortcutsTitle: { en: 'Keyboard shortcuts', ru: 'Горячие клавиши' },
  scUndo: { en: 'Undo', ru: 'Отменить' },
  scRedo: { en: 'Redo', ru: 'Повторить' },
  scMoveTool: { en: 'Move / select tool', ru: 'Инструмент «Перемещение»' },
  scPanTool: { en: 'Pan tool', ru: 'Инструмент «Рука»' },
  scPanHold: { en: 'Pan while held (or middle-drag)', ru: 'Перемещение, пока зажато (или средняя кнопка мыши)' },
  scZoom: { en: 'Zoom in / out', ru: 'Приблизить / отдалить' },
  scDeletePenPoint: { en: 'Remove last pen point', ru: 'Удалить последнюю точку пера' },
  scShiftSelectLayers: { en: 'Select a range of layers in the Layers panel', ru: 'Выбрать сразу несколько слоёв в панели слоёв' },

  // right-panel section titles (iPhone-settings style)
  secUpload: { en: 'Add image', ru: 'Добавить изображение' },
  secBrowse: { en: 'Choose file…', ru: 'Выбрать файл…' },
  secSandpaper: { en: 'Sandpaper', ru: 'Наждачка' },
  secWater: { en: 'Water', ru: 'Вода' },
  secNoise: { en: 'Noise', ru: 'Шум' },
  secDust: { en: 'Dust', ru: 'Пыль' },
  secCompression: { en: 'Compression', ru: 'Сжатие' },
  secExport: { en: 'Export', ru: 'Экспорт' },
  secFinish: { en: 'Finishing', ru: 'Обработка' },
  secTemplates: { en: 'Templates', ru: 'Шаблоны' },
  emptyStage: { en: 'Select a layer to edit its parameters.', ru: 'Выберите слой, чтобы редактировать параметры.' },
  uploadHint: { en: 'Drag an image onto the canvas, or pick one below.', ru: 'Перетащите изображение на холст или выберите ниже.' },

  // layers panel — groups & lock
  newGroup: { en: 'New group', ru: 'Новая группа' },
  ungrouped: { en: 'No group', ru: 'Без группы' },
  lockLayer: { en: 'Lock layer', ru: 'Заблокировать слой' },
  unlockLayer: { en: 'Unlock layer', ru: 'Разблокировать слой' },
  hideLayer: { en: 'Hide layer', ru: 'Скрыть слой' },
  showLayer: { en: 'Show layer', ru: 'Показать слой' },
  deleteLayer: { en: 'Delete layer', ru: 'Удалить слой' },
  renameGroupPrompt: { en: 'Group name', ru: 'Название группы' },
  moveToGroup: { en: 'Move to group', ru: 'Переместить в группу' },

  // placeholder sections (present but not yet backed by an engine)
  secMarker: { en: 'Marker', ru: 'Маркер' },
  secTape: { en: 'Tape', ru: 'Скотч' },
  secCurves: { en: 'Curves', ru: 'Кривые' },
  secLevels: { en: 'Levels', ru: 'Уровни' },
  secContrast: { en: 'Contrast', ru: 'Контраст' },
  secArtifacts: { en: 'Artifacts', ru: 'Артефакты' },
  comingSoon: { en: 'Not available yet', ru: 'Пока недоступно' },

  // Final stage — independent, non-destructive correction layers
  finEnabled: { en: 'Enable adjustment', ru: 'Включить коррекцию' },

  // Applied tools stack — Photoshop-style toggle/edit of already-applied
  // workshop strokes
  appliedToolsTitle: { en: 'Applied tools', ru: 'Применённые инструменты' },
  appliedToolsAll: { en: 'All', ru: 'Все' },
  appliedToolsEmptyFilter: { en: 'No strokes with this tool yet', ru: 'Пока нет слоёв этого инструмента' },
  opEnabled: { en: 'Enabled', ru: 'Включено' },
  opRemove: { en: 'Remove', ru: 'Удалить' },

  finExposure: { en: 'Exposure', ru: 'Экспозиция' },
  finExposureEv: { en: 'Exposure', ru: 'Экспозиция' },
  hFinExposure: { en: 'Overall light in stops (EV). +1 doubles brightness, −1 halves it.', ru: 'Общая освещённость в ступенях (EV). +1 удваивает яркость, −1 уменьшает вдвое.' },

  finBrightness: { en: 'Brightness', ru: 'Яркость' },
  hFinBrightness: { en: 'Linear brightness — lifts or lowers every tone by the same amount.', ru: 'Линейная яркость — равномерно поднимает или опускает все тона.' },

  finContrast: { en: 'Contrast', ru: 'Контраст' },
  hFinContrast: { en: 'Spreads tones away from mid grey (or compresses them toward it).', ru: 'Раздвигает тона от среднего серого (или сжимает к нему).' },

  finLevels: { en: 'Levels', ru: 'Уровни' },
  hFinLevels: { en: 'Remap the tonal range: clip input black/white and set the output range.', ru: 'Перенастройка диапазона: обрезка входных чёрной/белой точек и выходной диапазон.' },
  finInBlack: { en: 'Input black', ru: 'Вход · чёрная' },
  finInWhite: { en: 'Input white', ru: 'Вход · белая' },
  finGamma: { en: 'Gamma (midtones)', ru: 'Гамма (средние тона)' },
  hFinGamma: { en: 'Midtone brightness. Below 1 darkens, above 1 lightens midtones.', ru: 'Яркость средних тонов. Меньше 1 — темнее, больше 1 — светлее.' },
  finOutBlack: { en: 'Output black', ru: 'Выход · чёрная' },
  finOutWhite: { en: 'Output white', ru: 'Выход · белая' },

  finCurves: { en: 'Curves', ru: 'Кривые' },
  hFinCurves: { en: 'Lift or lower five tonal zones to shape a smooth tone curve.', ru: 'Поднимайте или опускайте пять тональных зон, формируя плавную кривую.' },
  finBlacks: { en: 'Blacks', ru: 'Чёрные' },
  finShadows: { en: 'Shadows', ru: 'Тени' },
  finMidtones: { en: 'Midtones', ru: 'Средние тона' },
  finHighlights: { en: 'Highlights', ru: 'Света' },
  finWhites: { en: 'Whites', ru: 'Белые' },

  finWhiteBalance: { en: 'White balance', ru: 'Баланс белого' },
  hFinWhiteBalance: { en: 'Correct the colour cast with temperature and tint.', ru: 'Коррекция цветового оттенка по температуре и тону.' },
  finTemp: { en: 'Temperature', ru: 'Температура' },
  hFinTemp: { en: 'Cool (blue) to warm (amber) colour shift.', ru: 'Сдвиг от холодного (синий) к тёплому (янтарный).' },
  finTintWB: { en: 'Tint', ru: 'Оттенок' },
  hFinTintWB: { en: 'Green to magenta colour shift.', ru: 'Сдвиг от зелёного к пурпурному.' },

  finHue: { en: 'Hue', ru: 'Цветовой тон' },
  hFinHue: { en: 'Rotate all colours around the hue wheel, keeping brightness.', ru: 'Поворот всех цветов по кругу тонов с сохранением яркости.' },

  finVibrance: { en: 'Vibrance', ru: 'Насыщенность (сочность)' },
  hFinVibrance: { en: 'Saturation that protects already-vivid colours from clipping.', ru: 'Насыщенность, щадящая уже яркие цвета от пересыщения.' },

  finSaturation: { en: 'Saturation', ru: 'Насыщенность' },
  hFinSaturation: { en: 'Overall colour intensity. −100% is greyscale.', ru: 'Общая интенсивность цвета. −100% — оттенки серого.' },

  finVignette: { en: 'Vignette', ru: 'Виньетка' },
  hFinVignette: { en: 'Darken (or lighten) toward the frame corners.', ru: 'Затемнение (или осветление) к углам кадра.' },
  finVigAmount: { en: 'Amount', ru: 'Сила' },
  finVigMidpoint: { en: 'Midpoint', ru: 'Радиус' },
  hFinVigMidpoint: { en: 'Where the vignette starts, from centre to corner.', ru: 'Где начинается виньетка — от центра к углу.' },
  finVigFeather: { en: 'Feather', ru: 'Растушёвка' },
  hFinVigFeather: { en: 'Softness of the transition into the vignette.', ru: 'Мягкость перехода в виньетку.' },

  finGrain: { en: 'Film grain', ru: 'Зерно плёнки' },
  hFinGrain: { en: 'Deterministic monochrome grain keyed to the layer seed.', ru: 'Детерминированное монохромное зерно, привязанное к seed слоя.' },
  finGrainAmount: { en: 'Amount', ru: 'Сила' },
  finGrainSize: { en: 'Grain size', ru: 'Размер зерна' },
  hFinGrainSize: { en: 'Size of each grain cluster in pixels.', ru: 'Размер каждого зерна в пикселях.' },

  // Workshop tool rack (left panel)
  toolsTitle: { en: 'Tools', ru: 'Инструменты' },
  workshopNavActive: { en: 'Navigation active — pick a tool to edit the sheet.', ru: 'Активна навигация — выберите инструмент, чтобы редактировать лист.' },
  renameLayerPrompt: { en: 'Layer name', ru: 'Название слоя' },

  twMove: { en: 'Move', ru: 'Перемещение' },
  twMoveDesc: { en: 'Move, scale and rotate the selected layer on the sheet.', ru: 'Двигайте, масштабируйте и вращайте выбранный слой на листе.' },
  twCut: { en: 'Cut', ru: 'Вырезание' },
  twCutDesc: { en: 'Cut a fragment out with a freehand outline.', ru: 'Вырежьте фрагмент произвольным контуром.' },
  twPen: { en: 'Pen Tool', ru: 'Перо' },
  twPenDesc: { en: 'Cut precisely with straight and curved segments.', ru: 'Точное вырезание прямыми и кривыми сегментами.' },
  twSandpaper: { en: 'Sandpaper', ru: 'Наждачка' },
  twSandpaperDesc: { en: 'Abrade the surface to expose the paper fibres.', ru: 'Затрите поверхность, обнажая волокна бумаги.' },
  twWater: { en: 'Water', ru: 'Вода' },
  twWaterDesc: { en: 'Add moisture and water stains to the sheet.', ru: 'Добавьте влагу и водяные разводы на лист.' },
  twKnife: { en: 'Knife', ru: 'Нож' },
  twKnifeDesc: { en: 'Straight, clean cuts with a blade.', ru: 'Прямые аккуратные разрезы лезвием.' },
  twScratches: { en: 'Scratches', ru: 'Царапины' },
  twScratchesDesc: { en: 'Scratches, abrasions and wear on the print.', ru: 'Царапины, потёртости и износ отпечатка.' },
  twMarker: { en: 'Marker', ru: 'Маркер' },
  twMarkerDesc: { en: 'Bold marker strokes and annotations.', ru: 'Жирные штрихи и пометки маркером.' },
  twPencil: { en: 'Pencil', ru: 'Карандаш' },
  twPencilDesc: { en: 'Light pencil marks and sketch lines.', ru: 'Лёгкие карандашные штрихи и линии.' },
  twBrush: { en: 'Brush', ru: 'Кисть' },
  twBrushDesc: { en: 'Painterly brush strokes.', ru: 'Живописные мазки кистью.' },
  twTape: { en: 'Tape', ru: 'Скотч' },
  twTapeDesc: { en: 'Strips of adhesive tape over the sheet.', ru: 'Полоски клейкой ленты поверх листа.' },
  twGlue: { en: 'Glue', ru: 'Клей' },
  twGlueDesc: { en: 'Glue smears and glossy residue.', ru: 'Пятна и глянцевые следы клея.' },
  twPatch: { en: 'Patch', ru: 'Заплатка' },
  twPatchDesc: { en: 'Paper patches covering damaged areas.', ru: 'Бумажные заплатки на повреждённых местах.' },
  twBurn: { en: 'Burn', ru: 'Ожог' },
  twBurnDesc: { en: 'Scorched, burnt edges and marks.', ru: 'Обугленные края и подпалины.' },
  twPins: { en: 'Pins', ru: 'Кнопки' },
  twPinsDesc: { en: 'Pin holes as if tacked to a wall.', ru: 'Проколы от кнопок, будто лист висел на стене.' },
  twDirt: { en: 'Dirt', ru: 'Грязь' },
  twDirtDesc: { en: 'Dirt, dust and grime stains.', ru: 'Грязь, пыль и потёртые пятна.' },

  // landing page
  landingHeroTitle: { en: 'Nevma — a physical paper editor', ru: 'Nevma — редактор физической бумаги' },
  landingHeroSubtitle: {
    en: 'Simulate real prints: paper, ink, wear and tear — right in the browser.',
    ru: 'Симулируйте настоящую печать: бумагу, чернила, потёртости и повреждения — прямо в браузере.',
  },
  landingScrollHint: { en: 'See what it can do', ru: 'Посмотреть, что умеет' },
  landingAboutTitle: { en: 'What is Nevma?', ru: 'Что такое Nevma?' },
  landingAboutBody1: {
    en: 'Nevma is a physical print simulator. You bring a digital image, and instead of just filtering it, the app models what actually happens when that image becomes a physical object: how it looks printed on a specific paper with a specific printer, how it would age, and how it would look scanned back in.',
    ru: 'Nevma — это симулятор физической печати. Вы загружаете цифровое изображение, и вместо того чтобы просто наложить фильтр, приложение моделирует, что на самом деле происходит, когда это изображение становится физическим объектом: как оно ляжет на конкретную бумагу конкретным принтером, как оно состарится со временем и как будет выглядеть после сканирования обратно.',
  },
  landingAboutBody2: {
    en: 'Under the hood it is a full workshop: paper type and texture, printer and ink behaviour, and a set of physical tools — knife, tape, glue, sandpaper, burn, pins, dirt and more — that let you damage and rework the sheet by hand, layer by layer, with full undo history.',
    ru: 'Внутри — полноценная мастерская: тип и текстура бумаги, поведение принтера и чернил, а также набор физических инструментов — нож, скотч, клей, наждачка, огонь, кнопки, грязь и другие, — которыми можно вручную повреждать и дорабатывать лист, слой за слоем, с полной историей отмены.',
  },
  landingAboutBody3: {
    en: 'You can work entirely on your own — no account needed for the editor — or join the community to publish your presets, browse what others made, and reuse their setups as a starting point.',
    ru: 'Можно работать полностью в одиночку — для редактора аккаунт не нужен, — либо присоединиться к сообществу: публиковать свои пресеты, смотреть, что сделали другие, и использовать их настройки как отправную точку.',
  },
  landingFeature1Title: { en: 'Realistic printing', ru: 'Реалистичная печать' },
  landingFeature1Body: { en: 'Paper, printer and scanner simulation with physically-based materials.', ru: 'Симуляция бумаги, принтера и сканера на физически достоверных материалах.' },
  landingFeature2Title: { en: 'Physical tools', ru: 'Физические инструменты' },
  landingFeature2Body: { en: 'Cut, tear, burn, glue, tape and more — like working with a real sheet.', ru: 'Резать, рвать, жечь, клеить скотчем и не только — как с настоящим листом.' },
  landingFeature3Title: { en: 'Share your presets', ru: 'Делитесь пресетами' },
  landingFeature3Body: { en: 'Publish your looks to the community and browse what others made.', ru: 'Публикуйте свои пресеты в сообществе и смотрите, что сделали другие.' },
  landingChooseEditor: { en: 'Open the editor', ru: 'Открыть редактор' },
  landingChooseEditorBody: { en: 'Jump straight into editing — no account needed.', ru: 'Сразу начать редактировать — аккаунт не нужен.' },
  landingChooseCommunity: { en: 'Browse community', ru: 'Сообщество' },
  landingChooseCommunityBody: { en: 'See presets and posts from other people.', ru: 'Посмотреть пресеты и посты других людей.' },
  landingRecommended: { en: 'Start here', ru: 'Начните отсюда' },

  // community page
  back: { en: 'Back', ru: 'Назад' },
  communityTitle: { en: 'Community', ru: 'Сообщество' },
  openEditor: { en: 'Editor', ru: 'Редактор' },
  communityPublish: { en: 'Publish', ru: 'Опубликовать' },
  toastPostPublished: { en: 'Post published!', ru: 'Пост опубликован!' },
  toastFollowed: { en: 'Now following {name}', ru: 'Вы подписаны на {name}' },
  toastUnfollowed: { en: 'Unfollowed {name}', ru: 'Вы отписались от {name}' },
  toastCommentFailed: { en: 'Comment failed to send', ru: 'Комментарий не отправлен' },
  toastExported: { en: 'Exported!', ru: 'Экспорт готов!' },
  preparingPreview: { en: 'Preparing preview…', ru: 'Готовим превью…' },

  // community nav bar (shared toolbar across community pages)
  navFeed: { en: 'Feed', ru: 'Лента' },
  navPresets: { en: 'Presets', ru: 'Пресеты' },
  navCollections: { en: 'Collections', ru: 'Коллекции' },
  navUsers: { en: 'Users', ru: 'Пользователи' },
  navActivity: { en: 'Activity', ru: 'Активность' },
  navComingSoon: { en: 'Coming soon', ru: 'Скоро' },
  searchPlaceholder: { en: 'Search…', ru: 'Поиск…' },
  sortPopular: { en: 'Popular', ru: 'Популярное' },
  sortRecent: { en: 'Recent', ru: 'Новое' },
  communityLatestTitle: { en: 'Latest from the community', ru: 'Новое в сообществе' },
  communityLatestSubtitle: { en: 'Discover new presets and see what people are making.', ru: 'Смотрите новые пресеты и работы других людей.' },
  statusOnline: { en: 'Online', ru: 'Онлайн' },
  communityPublishHint: { en: 'Sign in to publish, like or comment.', ru: 'Войдите, чтобы публиковать, лайкать и комментировать.' },

  // notifications bell (src/pages/community/NotificationsBell.tsx)
  notificationsTitle: { en: 'Notifications', ru: 'Уведомления' },
  notificationsMarkAllRead: { en: 'Mark all as read', ru: 'Отметить всё прочитанным' },
  notificationsEmpty: { en: 'No notifications yet', ru: 'Пока нет уведомлений' },
  notificationLike: { en: '{name} liked your post', ru: '{name} лайкнул(а) ваш пост' },
  notificationComment: { en: '{name} commented on your post', ru: '{name} прокомментировал(а) ваш пост' },
  notificationFollow: { en: '{name} started following you', ru: '{name} подписался(лась) на вас' },
  timeJustNow: { en: 'just now', ru: 'только что' },
  timeMinutesAgo: { en: '{n}m ago', ru: '{n} мин. назад' },
  timeHoursAgo: { en: '{n}h ago', ru: '{n} ч. назад' },
  timeDaysAgo: { en: '{n}d ago', ru: '{n} дн. назад' },

  // auth / onboarding
  signIn: { en: 'Sign in', ru: 'Войти' },
  signOut: { en: 'Sign out', ru: 'Выйти' },
  authNotConfigured: { en: 'Sign-in coming soon', ru: 'Вход скоро будет доступен' },
  authNotConfiguredHint: { en: 'Backend isn\u2019t connected yet in this build.', ru: 'В этой сборке бэкенд ещё не подключён.' },
  authTabSignIn: { en: 'Sign in', ru: 'Вход' },
  authTabSignUp: { en: 'Create account', ru: 'Регистрация' },
  authEmailPlaceholder: { en: 'Email', ru: 'Email' },
  authPasswordPlaceholder: { en: 'Password', ru: 'Пароль' },
  authFillBothFields: { en: 'Enter your email and password.', ru: 'Введите email и пароль.' },
  authPasswordTooShort: { en: 'Password must be at least 6 characters.', ru: 'Пароль должен быть не короче 6 символов.' },
  authInvalidCredentials: { en: 'Wrong email or password.', ru: 'Неверный email или пароль.' },
  authUserAlreadyRegistered: { en: 'An account with this email already exists \u2014 try signing in instead.', ru: 'Аккаунт с таким email уже существует \u2014 попробуйте войти.' },
  authRateLimited: { en: 'Too many attempts, please wait a moment and try again.', ru: 'Слишком много попыток, подождите немного и попробуйте снова.' },
  authGenericError: { en: 'Something went wrong, please try again.', ru: 'Что-то пошло не так, попробуйте ещё раз.' },
  authCheckEmailTitle: { en: 'Check your email', ru: 'Проверьте почту' },
  authCheckEmailBody: {
    en: 'We\u2019ve sent a confirmation link to your email. Click it to finish creating your account.',
    ru: 'Мы отправили ссылку для подтверждения на вашу почту. Перейдите по ней, чтобы завершить регистрацию.',
  },
  ok: { en: 'OK', ru: 'Понятно' },
  authAgreePrefix: { en: 'I agree to the ', ru: 'Я согласен(-на) с ' },
  authAgreePolicyLink: { en: 'Privacy Policy', ru: 'Политикой конфиденциальности' },
  authAgreeSuffix: { en: ' and consent to the processing of my personal data.', ru: ' и даю согласие на обработку персональных данных.' },
  authMustAgree: { en: 'Please confirm you agree to the Privacy Policy to continue.', ru: 'Подтвердите согласие с Политикой конфиденциальности, чтобы продолжить.' },

  // privacy policy modal (src/pages/community/PrivacyPolicyModal.tsx)
  privacyPolicyTitle: { en: 'Privacy Policy', ru: 'Политика конфиденциальности' },
  privacyPolicyUpdated: { en: 'Last updated: August 30, 2026', ru: 'Дата вступления в силу: 30.08.2026' },
  privacyPolicyBody: {
    en:
      'This Privacy Policy ("Policy") describes what data Nevma ("the Service", "we") collects and processes when you register and use the site, and what rights you have over that data.\n\n' +
      '1. What data we collect\nWhen you register, we collect your email address and password (your password is stored encrypted and is never visible to us in plain text). After registering, you may set a display name (nickname) and upload an avatar \u2014 this information is visible to other users. When you use community features, we also store the posts, comments, likes, follows, and notifications you create or trigger. Technical data (such as your IP address and browser information) may be processed automatically by our hosting and infrastructure providers as part of their standard logs.\n\n' +
      '2. What we use this data for\nWe use your data to: create and operate your account; provide the Service\u2019s features (publishing work, likes, comments, follows, notifications); keep your account secure and prevent abuse; contact you about matters related to your account.\n\n' +
      '3. Legal basis for processing\nWe process your personal data on the basis of the consent you give when registering, by checking the consent box. You may withdraw your consent at any time by deleting your account or contacting us using the details below; this does not affect the lawfulness of processing carried out before withdrawal.\n\n' +
      '4. Who we share data with\nTo operate the Service we use third-party infrastructure providers \u2014 Supabase (database, authentication, file storage) and Netlify (hosting). These providers may process data on their own servers in accordance with their own privacy policies. We do not sell your data or share it with third parties for marketing purposes.\n\n' +
      '5. How long we keep data\nData is kept for as long as your account is active. When you delete your account, your data is removed from our primary database; backups made by infrastructure providers, if any, are removed within a reasonable period under their own policies.\n\n' +
      '6. Your rights\nYou have the right to: request access to your data; correct inaccurate data (via your profile settings); delete your account and the data associated with it; withdraw your consent to processing. To exercise these rights, contact us using the details in the "Contact" section below.\n\n' +
      '7. Cookies and local storage\nThe Service uses your browser\u2019s local storage to keep your authentication token so you stay signed in between visits. We do not use third-party advertising or tracking cookies.\n\n' +
      '8. Changes to this Policy\nWe may update this Policy from time to time. The date at the top of this document shows when it was last updated. We will let users know of any material changes through the Service.\n\n' +
      '9. Contact\nFor any questions about how we process personal data, contact us at: [add your contact email here].',
    ru:
      'Настоящая Политика конфиденциальности («Политика») описывает, какие данные собирает и обрабатывает сервис Nevma («Сервис», «мы») при регистрации и использовании сайта, а также права пользователей в отношении этих данных.\n\n' +
      '1. Какие данные мы собираем\nПри регистрации мы собираем адрес электронной почты и пароль (пароль хранится в зашифрованном виде и никогда не доступен нам в открытом виде). После регистрации вы можете указать отображаемое имя (никнейм) и загрузить аватар \u2014 эти данные видны другим пользователям. При использовании функций сообщества мы также храним созданные вами публикации, комментарии, лайки, подписки и связанные с ними уведомления. Технические данные (например, IP-адрес, данные браузера) могут автоматически обрабатываться нашими поставщиками хостинга и инфраструктуры в рамках их стандартных логов.\n\n' +
      '2. Для чего мы используем данные\nДанные используются для: создания и работы вашей учётной записи; предоставления функций Сервиса (публикация работ, лайки, комментарии, подписки, уведомления); обеспечения безопасности аккаунта и предотвращения злоупотреблений; связи с вами по вопросам, связанным с аккаунтом.\n\n' +
      '3. Правовое основание обработки\nОбработка персональных данных осуществляется на основании вашего согласия, которое вы даёте при регистрации, отмечая соответствующий флажок. Вы можете отозвать согласие в любой момент, удалив аккаунт или обратившись к нам по контактам ниже \u2014 это не влияет на законность обработки, совершённой до отзыва.\n\n' +
      '4. Кому передаются данные\nДля работы Сервиса мы используем сторонних поставщиков инфраструктуры \u2014 Supabase (база данных, аутентификация, хранение файлов) и Netlify (хостинг). Эти поставщики могут обрабатывать данные на своих серверах в соответствии с собственными политиками конфиденциальности. Мы не продаём и не передаём ваши данные третьим лицам в маркетинговых целях.\n\n' +
      '5. Срок хранения\nДанные хранятся, пока ваш аккаунт активен. При удалении аккаунта данные удаляются из основной базы данных; резервные копии, если они создаются поставщиками инфраструктуры, удаляются в течение разумного срока согласно их политикам.\n\n' +
      '6. Ваши права\nВы имеете право: запросить доступ к своим данным; исправить неточные данные (через настройки профиля); удалить свой аккаунт и связанные с ним данные; отозвать согласие на обработку. Для реализации этих прав напишите нам по адресу, указанному в разделе «Контакты».\n\n' +
      '7. Файлы cookie и локальное хранилище\nСервис использует локальное хранилище браузера для хранения токена авторизации, чтобы вы оставались в системе между посещениями. Мы не используем сторонние рекламные или трекинговые cookie.\n\n' +
      '8. Изменения политики\nМы можем время от времени обновлять эту Политику. Дата последнего обновления указана в начале документа. О существенных изменениях мы сообщим пользователям через Сервис.\n\n' +
      '9. Контакты\nПо всем вопросам, связанным с обработкой персональных данных, обращайтесь: [укажите контактный email].',
  },
  privacyPolicyClose: { en: 'Close', ru: 'Закрыть' },
  onboardingTitle: { en: 'Welcome! One last step', ru: 'Добро пожаловать! Последний шаг' },
  onboardingBody: {
    en: 'Pick a nickname and avatar for the community. You can change these later.',
    ru: 'Выберите никнейм и аватар для сообщества. Их можно будет изменить позже.',
  },
  onboardingNicknamePlaceholder: { en: 'Nickname', ru: 'Никнейм' },
  onboardingNicknameRequired: { en: 'Please enter a nickname.', ru: 'Введите никнейм.' },
  onboardingSaveFailed: { en: 'Could not save profile, try again.', ru: 'Не удалось сохранить профиль, попробуйте ещё раз.' },
  onboardingContinue: { en: 'Continue', ru: 'Продолжить' },
  onboardingAvatarChange: { en: 'Change photo', ru: 'Изменить фото' },
  onboardingAvatarRemove: { en: 'Remove photo', ru: 'Удалить фото' },
  avatarCropTitle: { en: 'Reposition photo', ru: 'Расположение фото' },
  avatarCropBody: { en: 'Drag to reposition, use the slider to zoom.', ru: 'Перетащите, чтобы сдвинуть, ползунком — чтобы приблизить.' },
  avatarCropConfirm: { en: 'Use photo', ru: 'Использовать' },
  onboardingAvatarTooLarge: { en: 'That image is too large (max 15MB).', ru: 'Файл слишком большой (максимум 15МБ).' },
  onboardingAvatarInvalidType: { en: 'Please choose an image file.', ru: 'Выберите файл изображения.' },
  onboardingAvatarUploadFailed: { en: 'Could not upload photo, try again.', ru: 'Не удалось загрузить фото, попробуйте ещё раз.' },

  // shared
  cancel: { en: 'Cancel', ru: 'Отмена' },
  save: { en: 'Save', ru: 'Сохранить' },
  loading: { en: 'Loading…', ru: 'Загрузка…' },

  // profile page
  profileTitle: { en: 'Profile', ru: 'Профиль' },
  profilePosts: { en: 'posts', ru: 'постов' },
  profileFollowers: { en: 'followers', ru: 'подписчиков' },
  profileFollowing: { en: 'following', ru: 'подписок' },
  profileEdit: { en: 'Edit profile', ru: 'Редактировать профиль' },
  profileFollow: { en: 'Follow', ru: 'Подписаться' },
  profileUnfollow: { en: 'Unfollow', ru: 'Отписаться' },
  profileNotFound: { en: 'Profile not found.', ru: 'Профиль не найден.' },
  profileNoPosts: { en: 'No posts yet.', ru: 'Пока нет постов.' },
  profileTabPosts: { en: 'Posts', ru: 'Посты' },
  profileTabPresets: { en: 'Presets', ru: 'Пресеты' },
  profileTabCollections: { en: 'Collections', ru: 'Коллекции' },
  profileTabLiked: { en: 'Liked', ru: 'Понравившееся' },
  postEditTitle: { en: 'Edit post', ru: 'Редактировать пост' },
  postDelete: { en: 'Delete post', ru: 'Удалить пост' },
  postDeleteConfirm: { en: 'Delete this post? This cannot be undone.', ru: 'Удалить этот пост? Это действие нельзя отменить.' },

  // publish modal
  communityNoPostsYet: {
    en: 'No real posts published yet — showing a preview feed below.',
    ru: 'Реальных постов пока нет — ниже показана демо-лента для примера.',
  },
  publishTitle: { en: 'Publish', ru: 'Опубликовать' },
  publishBody: { en: 'Give it a short caption.', ru: 'Добавьте короткую подпись.' },
  publishBodyNoImage: { en: 'Choose an image and give it a short caption.', ru: 'Выберите картинку и добавьте короткую подпись.' },
  publishPickImage: { en: 'Choose an image', ru: 'Выбрать картинку' },
  publishPlaceholder: { en: 'e.g. Faded polaroid look', ru: 'например, Выцветший полароид' },
  publishTitleRequired: { en: 'Please enter a caption.', ru: 'Введите подпись.' },
  publishSubmit: { en: 'Publish', ru: 'Опубликовать' },

  // post modal (full post + comments)
  commentsEmpty: { en: 'No comments yet.', ru: 'Пока нет комментариев.' },
  commentPlaceholder: { en: 'Add a comment…', ru: 'Добавить комментарий…' },
  commentSend: { en: 'Send', ru: 'Отправить' },
  commentSendFailed: { en: 'Could not post comment, try again.', ru: 'Не удалось отправить комментарий, попробуйте ещё раз.' },
  commentReply: { en: 'Reply', ru: 'Ответить' },
  postShare: { en: 'Share', ru: 'Поделиться' },
  postLinkCopied: { en: 'Link copied', ru: 'Ссылка скопирована' },
  commentReplyingTo: { en: 'Replying to', ru: 'Ответ для' },
} as const

export type TKey = keyof typeof DICT
