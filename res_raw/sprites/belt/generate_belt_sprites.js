/**
 *
 * Run `yarn global add canvas` first
 */

const { createCanvas, loadImage } = require("canvas");
const fs = require("node:fs");
const path = require("node:path");
const { fileURLToPath } = require("node:url");

async function run() {
    console.log("Running");

    const fps = 14;
    const dimensions = 192;
    const beltBorder = 23.5;
    const lineSize = 5;
    const curbWidth = 10;

    const borderColor = "#a87a42";
    const arrowColor = "#f5efe0";

    const texture = await loadImage(path.join(__dirname, "belt_texture.png"));
    const woodTexture = await loadImage(path.join(__dirname, "wood_texture.png"));

    // Path helpers, parametrized by the border inset — used twice per frame:
    // once with a wider inset (curbWidth less) filled in borderColor to make
    // a raised-looking curb band along the sides, then again at the normal
    // inset filled with the lane texture. Keeping this as one shared
    // function (instead of copy-pasting the path twice) guarantees the
    // curb and lane always stay perfectly parallel/concentric.
    function forwardPath(context, border) {
        context.beginPath();
        context.rect(border, -10, dimensions - 2 * border, dimensions + 20);
    }

    function turnPath(context, border) {
        const innerRadius = border;
        const outerRadius = dimensions - 2 * border;
        const originX = dimensions - innerRadius;
        const originY = dimensions - innerRadius;
        const sqrt = x => Math.pow(Math.abs(x), 0.975) * Math.sign(x);
        const steps = 256;

        context.beginPath();
        context.moveTo(border, dimensions + 10);
        context.lineTo(border, dimensions - innerRadius);
        for (let k = 0; k <= steps; ++k) {
            const pct = k / steps;
            const angleRad = Math.PI + pct * Math.PI * 0.5;
            context.lineTo(
                originX + sqrt(Math.cos(angleRad)) * outerRadius,
                originY + sqrt(Math.sin(angleRad)) * outerRadius
            );
        }
        context.lineTo(dimensions + 10, border);
        context.lineTo(dimensions + 10, dimensions - border);
        context.lineTo(dimensions, dimensions - border);
        for (let k = 0; k <= steps; ++k) {
            const pct = 1 - k / steps;
            const angleRad = Math.PI + pct * Math.PI * 0.5;
            context.lineTo(
                dimensions + Math.cos(angleRad) * innerRadius,
                dimensions + Math.sin(angleRad) * innerRadius
            );
        }
        context.lineTo(dimensions - border, dimensions + 10);
        context.closePath();
    }

    // Generate arrow sprite — a chevron/bracket shape (notched at the back)
    // instead of a solid triangle, closer to a conventional belt arrow.

    const arrowW = 60;
    const arrowH = arrowW / 2;
    /** @type {HTMLCanvasElement} */
    const arrowSprite = createCanvas(arrowW, arrowH);
    const arrowContext = arrowSprite.getContext("2d");

    arrowContext.quality = "best";
    arrowContext.fillStyle = arrowColor;
    arrowContext.clearRect(0, 0, arrowW, arrowH);
    arrowContext.beginPath();
    arrowContext.moveTo(0, arrowH);
    arrowContext.lineTo(arrowW / 2, 0);
    arrowContext.lineTo(arrowW, arrowH);
    arrowContext.lineTo(arrowW * 0.72, arrowH);
    arrowContext.lineTo(arrowW / 2, arrowH * 0.42);
    arrowContext.lineTo(arrowW * 0.28, arrowH);
    arrowContext.closePath();
    arrowContext.fill();

    const promises = [];

    // First, generate the forward belt
    for (let i = 0; i < fps; ++i) {
        /** @type {HTMLCanvasElement} */
        const canvas = createCanvas(dimensions, dimensions);
        const context = canvas.getContext("2d");
        context.quality = "best";

        const procentual = i / fps;
        context.clearRect(0, 0, dimensions, dimensions);

        // curb band (wider inset, solid border color) then the textured
        // lane on top (normal inset) — gives the belt raised-looking side
        // edges instead of just a thin outline.
        forwardPath(context, beltBorder - curbWidth);
        context.fillStyle = context.createPattern(woodTexture, "repeat");
        context.fill();

        forwardPath(context, beltBorder);
        context.fillStyle = context.createPattern(texture, "repeat");
        context.strokeStyle = borderColor;
        context.lineWidth = lineSize;
        context.fill();
        context.stroke();

        const spacingBetweenArrows = (dimensions - 3 * arrowH) / 3;
        const spacingTotal = spacingBetweenArrows + arrowH;

        for (let k = 0; k < 5; ++k) {
            let y = dimensions - arrowH - (k - 1) * spacingTotal - procentual * spacingTotal;
            context.drawImage(arrowSprite, dimensions / 2 - arrowW / 2, y);
        }

        const out = fs.createWriteStream(path.join(__dirname, "built", "forward_" + i + ".png"));
        const stream = canvas.createPNGStream();
        stream.pipe(out);
        promises.push(new Promise(resolve => stream.on("end", resolve)));
    }

    // Generate left and right side belt
    for (let i = 0; i < fps; ++i) {
        /** @type {HTMLCanvasElement} */
        const canvas = createCanvas(dimensions, dimensions);
        const context = canvas.getContext("2d");
        context.quality = "best";

        const procentual = i / fps;
        context.clearRect(0, 0, dimensions, dimensions);

        // curb band, then the textured lane on top — same two-pass
        // technique as the forward belt, so both share the same raised-edge
        // look (this is also why the corner and straight piece can never
        // drift apart in style: identical code, identical constants).
        turnPath(context, beltBorder - curbWidth);
        context.fillStyle = context.createPattern(woodTexture, "repeat");
        context.fill();

        turnPath(context, beltBorder);
        context.fillStyle = context.createPattern(texture, "repeat");
        context.strokeStyle = borderColor;
        context.lineWidth = lineSize;
        context.fill();
        context.stroke();

        // Arrows
        const rotationalRadius = dimensions / 2 - arrowH / 2 + 0.5;

        const circumfence = (rotationalRadius * Math.PI * 2) / 4;
        console.log("Circumfence:", circumfence, "px");

        const remainingSpace = circumfence - 3 * arrowH + arrowH;
        console.log("Remainig:", remainingSpace);
        const spacing = remainingSpace / 3 + arrowH;

        console.log("Spacing: ", spacing);
        const angleSpacing = ((spacing / circumfence) * Math.PI) / 2;

        for (let i = 0; i < 5; ++i) {
            let angleRad = Math.PI + procentual * angleSpacing + (i - 1) * angleSpacing;
            const offX = dimensions - arrowH / 2 + Math.cos(angleRad * 0.995) * rotationalRadius;
            const offY = dimensions - arrowH / 2 + Math.sin(angleRad * 0.995) * rotationalRadius;

            angleRad = Math.max(Math.PI, Math.min(1.5 * Math.PI, angleRad));

            context.save();
            context.translate(offX, offY);
            context.rotate(angleRad + Math.PI);
            context.drawImage(arrowSprite, -arrowW / 2, -arrowH / 2);
            context.restore();
        }

        /** @type {HTMLCanvasElement} */
        const flippedCanvas = createCanvas(dimensions, dimensions);
        const flippedContext = flippedCanvas.getContext("2d");
        flippedContext.quality = "best";
        flippedContext.clearRect(0, 0, dimensions, dimensions);
        flippedContext.scale(-1, 1);
        flippedContext.drawImage(canvas, -dimensions, 0, dimensions, dimensions);

        const outRight = fs.createWriteStream(path.join(__dirname, "built", "right_" + i + ".png"));
        const streamRight = canvas.createPNGStream();
        streamRight.pipe(outRight);

        const outLeft = fs.createWriteStream(path.join(__dirname, "built", "left_" + i + ".png"));
        const streamLeft = flippedCanvas.createPNGStream();
        streamLeft.pipe(outLeft);

        promises.push(new Promise(resolve => streamRight.on("end", resolve)));
        promises.push(new Promise(resolve => streamLeft.on("end", resolve)));
    }

    console.log("Waiting for completion");
    await Promise.all(promises);

    // Also wait a bit more
    await new Promise(resolve => setTimeout(resolve, 1000));

    console.log("Copying files to all locations");

    // Copy other files
    fs.copyFileSync(
        path.join(__dirname, "built", "forward_0.png"),
        path.join(__dirname, "..", "buildings", "belt_top.png")
    );

    fs.copyFileSync(
        path.join(__dirname, "built", "right_0.png"),
        path.join(__dirname, "..", "buildings", "belt_right.png")
    );

    fs.copyFileSync(
        path.join(__dirname, "built", "left_0.png"),
        path.join(__dirname, "..", "buildings", "belt_left.png")
    );

    console.log("Done!");
}

run();
