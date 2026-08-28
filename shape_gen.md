const OrigamiShape = (() => {

  // ------------------------------------------------------------
  // НАСТРОЙКИ ГЕОМЕТРИИ
  // ------------------------------------------------------------

  const R = 72;

  // Насколько глубоко проваливается звезда между лучами
  const STAR_INNER = 42;

  // Форма лопасти мельницы.
  // Чем меньше число — тем сильнее выражено вращение.
  const WINDMILL_INNER = 34;

  // Источник света: сверху-слева
  const LIGHT_ANGLE = -135;


  // ------------------------------------------------------------
  // ЦВЕТ
  // ------------------------------------------------------------

  function clamp(v, min = 0, max = 255) {
    return Math.max(min, Math.min(max, v));
  }

  function hexToRgb(hex) {
    hex = hex.replace("#", "");

    if (hex.length === 3) {
      hex = hex.split("").map(c => c + c).join("");
    }

    return {
      r: parseInt(hex.slice(0, 2), 16),
      g: parseInt(hex.slice(2, 4), 16),
      b: parseInt(hex.slice(4, 6), 16)
    };
  }

  function rgbToHex({ r, g, b }) {
    return "#" + [r, g, b]
      .map(v => Math.round(clamp(v)).toString(16).padStart(2, "0"))
      .join("");
  }

  function mix(colorA, colorB, amount) {
    const a = hexToRgb(colorA);
    const b = hexToRgb(colorB);

    return rgbToHex({
      r: a.r + (b.r - a.r) * amount,
      g: a.g + (b.g - a.g) * amount,
      b: a.b + (b.b - a.b) * amount
    });
  }


  // ------------------------------------------------------------
  // ОСВЕЩЕНИЕ
  // ------------------------------------------------------------

  function litColor(baseColor, faceAngle, strength = 1) {
    const rad = Math.PI / 180;

    const light =
      Math.cos((faceAngle - LIGHT_ANGLE) * rad);

    if (light >= 0) {
      // освещённая грань
      return mix(
        baseColor,
        "#ffffff",
        light * 0.20 * strength
      );
    }

    // теневая грань
    return mix(
      baseColor,
      "#000000",
      -light * 0.16 * strength
    );
  }


  function palette(baseColor) {
    return {
      base: baseColor,

      // Цвет торца бумаги / внешнего контура
      edge: mix(baseColor, "#25292c", 0.60),

      // Сгиб
      crease: mix(baseColor, "#202326", 0.48),

      // Светлая линия возле сгиба
      creaseLight: mix(baseColor, "#ffffff", 0.42)
    };
  }


  // ------------------------------------------------------------
  // SVG UTILITIES
  // ------------------------------------------------------------

  function polygon(points, fill) {
    return `
      <polygon
        points="${points.map(p => p.join(",")).join(" ")}"
        fill="${fill}"
      />
    `;
  }

  function line(x1, y1, x2, y2, color, width, opacity = 1) {
    return `
      <line
        x1="${x1}"
        y1="${y1}"
        x2="${x2}"
        y2="${y2}"
        stroke="${color}"
        stroke-width="${width}"
        stroke-linecap="round"
        opacity="${opacity}"
      />
    `;
  }


  // ------------------------------------------------------------
  // 1. ЧЕТВЕРТЬ КВАДРАТА
  // ------------------------------------------------------------

  function square(color, rotation) {

    const p = palette(color);

    const face1 = litColor(color, rotation - 35);
    const face2 = litColor(color, rotation + 35);

    return `
      ${polygon([
        [0, 0],
        [0, -R],
        [R, -R]
      ], face1)}

      ${polygon([
        [0, 0],
        [R, -R],
        [R, 0]
      ], face2)}

      <path
        d="M 0 0
           L 0 ${-R}
           L ${R} ${-R}
           L ${R} 0
           Z"
        fill="none"
        stroke="${p.edge}"
        stroke-width="5"
        stroke-linejoin="round"
      />

      ${line(
        0, 0,
        R, -R,
        p.crease,
        3,
        0.58
      )}
    `;
  }


  // ------------------------------------------------------------
  // 2. СЕКТОР КРУГА
  // ------------------------------------------------------------

  function circle(color, rotation) {

    const p = palette(color);

    const D = R * Math.SQRT1_2;

    const face1 = litColor(color, rotation - 35);
    const face2 = litColor(color, rotation + 35);

    return `
      <path
        d="
          M 0 0
          L 0 ${-R}
          A ${R} ${R} 0 0 1 ${D} ${-D}
          Z
        "
        fill="${face1}"
      />

      <path
        d="
          M 0 0
          L ${D} ${-D}
          A ${R} ${R} 0 0 1 ${R} 0
          Z
        "
        fill="${face2}"
      />

      <path
        d="
          M 0 0
          L 0 ${-R}
          A ${R} ${R} 0 0 1 ${R} 0
          Z
        "
        fill="none"
        stroke="${p.edge}"
        stroke-width="5"
        stroke-linejoin="round"
      />

      ${line(
        0, 0,
        D, -D,
        p.crease,
        3,
        0.55
      )}
    `;
  }


  // ------------------------------------------------------------
  // 3. ЛУЧ ЗВЕЗДЫ
  //
  // Именно такая геометрия даёт при сборке четырёх частей
  // четырёхлучевую звезду как на твоём скриншоте.
  // ------------------------------------------------------------

  function star(color, rotation) {

    const p = palette(color);

    const face1 = litColor(color, rotation - 40);
    const face2 = litColor(color, rotation + 40);

    return `
      ${polygon([
        [0, 0],
        [0, -STAR_INNER],
        [R, -R]
      ], face1)}

      ${polygon([
        [0, 0],
        [R, -R],
        [STAR_INNER, 0]
      ], face2)}

      <path
        d="
          M 0 0
          L 0 ${-STAR_INNER}
          L ${R} ${-R}
          L ${STAR_INNER} 0
          Z
        "
        fill="none"
        stroke="${p.edge}"
        stroke-width="5"
        stroke-linejoin="round"
      />

      ${line(
        0, 0,
        R, -R,
        p.crease,
        3,
        0.62
      )}
    `;
  }


  // ------------------------------------------------------------
  // 4. ЛОПАСТЬ МЕЛЬНИЦЫ
  //
  // Вся магия формы — во внутренней диагонали.
  // Четыре таких квадранта превращаются в pinwheel.
  // ------------------------------------------------------------

  function windmill(color, rotation) {

    const p = palette(color);

    const face1 = litColor(color, rotation - 20);
    const face2 = litColor(color, rotation + 55);

    return `
      ${polygon([
        [0, 0],
        [0, -R],
        [R, -R]
      ], face1)}

      ${polygon([
        [0, 0],
        [R, -R],
        [R, -WINDMILL_INNER]
      ], face2)}

      <path
        d="
          M 0 0
          L 0 ${-R}
          L ${R} ${-R}
          L ${R} ${-WINDMILL_INNER}
          Z
        "
        fill="none"
        stroke="${p.edge}"
        stroke-width="5"
        stroke-linejoin="round"
      />

      ${line(
        0, 0,
        R, -R,
        p.crease,
        3,
        0.55
      )}
    `;
  }


  // ------------------------------------------------------------
  // РЕНДЕР ОДНОГО КВАДРАНТА
  // ------------------------------------------------------------

  function renderQuadrant(type, color, rotation) {

    let content;

    switch (type) {

      case "circle":
        content = circle(color, rotation);
        break;

      case "square":
        content = square(color, rotation);
        break;

      case "star":
        content = star(color, rotation);
        break;

      case "windmill":
        content = windmill(color, rotation);
        break;

      default:
        throw new Error(`Unknown shape type: ${type}`);
    }

    return `
      <g transform="rotate(${rotation})">
        ${content}
      </g>
    `;
  }


  // ------------------------------------------------------------
  // СОБРАТЬ ФИГУРУ ИЗ 4 КВАДРАНТОВ
  //
  // quadrants:
  //
  // 0 = верхний правый
  // 1 = нижний правый
  // 2 = нижний левый
  // 3 = верхний левый
  // ------------------------------------------------------------

  function render(quadrants, options = {}) {

    const {
      size = 128,
      shadow = true
    } = options;

    const uid =
      "origami_" +
      Math.random().toString(36).slice(2);

    const q = [
      quadrants[0] || null,
      quadrants[1] || null,
      quadrants[2] || null,
      quadrants[3] || null
    ];

    let body = "";

    q.forEach((part, index) => {

      if (!part)
        return;

      body += renderQuadrant(
        part.type,
        part.color,
        index * 90
      );

    });


    return `
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="${size}"
        height="${size}"
        viewBox="-82 -82 164 164"
      >

        <defs>

          <filter
            id="${uid}"
            x="-30%"
            y="-30%"
            width="160%"
            height="160%"
          >

            <feDropShadow
              dx="1.5"
              dy="2.5"
              stdDeviation="2.2"
              flood-color="#000000"
              flood-opacity="0.22"
            />

          </filter>

        </defs>

        <g
          ${shadow ? `filter="url(#${uid})"` : ""}
        >

          ${body}

        </g>

      </svg>
    `;
  }


  return {
    render
  };

})();