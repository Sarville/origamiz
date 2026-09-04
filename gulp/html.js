import fs from "node:fs";
import gulp from "gulp";
import path from "node:path/posix";
import { buildFolder } from "./config.js";

import gulpDom from "gulp-dom";
import gulpHtmlmin from "gulp-htmlmin";
import gulpRename from "gulp-rename";

/**
 * PROVIDES
 *
 * html
 */

/**
 * @param {string} [variant]
 */
async function buildHtml(variant) {
    return gulp
        .src("../src/html/index.html")
        .pipe(
            gulpDom(function () {
                const style = this.createElement("style");
                style.textContent = fs.readFileSync(path.join("preloader", "preloader.css"), "utf-8");
                this.head.appendChild(style);

                if (variant === "yandex") {
                    const sdk = this.createElement("script");
                    sdk.src = "/sdk.js";
                    this.head.insertBefore(sdk, this.head.querySelector("script"));
                }
            })
        )
        .pipe(
            gulpHtmlmin({
                caseSensitive: true,
                collapseBooleanAttributes: true,
                collapseInlineTagWhitespace: true,
                collapseWhitespace: true,
                preserveLineBreaks: true,
                minifyJS: true,
                minifyCSS: true,
                quoteCharacter: '"',
            })
        )
        .pipe(gulpRename("index.html"))
        .pipe(gulp.dest(buildFolder));
}

export default buildHtml;
