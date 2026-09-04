import childProcess from "node:child_process";
import delEmpty from "delete-empty";
import gulp from "gulp";
import pathNative from "node:path";
import path from "node:path/posix";
import { promisify } from "node:util";
import { BUILD_VARIANTS } from "./build_variants.js";
import {
    browserSync,
    buildFolder,
    generatedCodeFolder,
    imageResourcesGlobs,
    nonImageResourcesGlobs,
    rawImageResourcesGlobs,
} from "./config.js";
const exec = promisify(childProcess.exec);

// Load other plugins
import gulpClean from "gulp-clean";
import gulpWebserver from "gulp-webserver";

import * as css from "./css.js";
import * as environment from "./environment.js";
import html from "./html.js";
import * as imgres from "./image-resources.js";
import js from "./js.js";
import * as sounds from "./sounds.js";
import * as translations from "./translations.js";

export { css, environment, html, imgres, js, sounds, translations };

/////////////////////  BUILD TASKS  /////////////////////

// Cleans up everything
function cleanBuildFolder() {
    return gulp.src(buildFolder, { read: false, allowEmpty: true }).pipe(gulpClean({ force: true }));
}
function cleanBuildTempFolder() {
    return gulp.src(generatedCodeFolder, { read: false, allowEmpty: true }).pipe(gulpClean({ force: true }));
}
function cleanImageBuildFolder() {
    return gulp
        .src(path.join("res_built"), { read: false, allowEmpty: true })
        .pipe(gulpClean({ force: true }));
}

const cleanup = gulp.parallel(cleanBuildFolder, cleanImageBuildFolder, cleanBuildTempFolder);

// Requires no uncomitted files
async function requireCleanWorkingTree() {
    let output = (await exec("git status -su", { encoding: "buffer" })).stdout
        .toString("ascii")
        .trim()
        .replace(/\r/gi, "")
        .split("\n");

    // Filter files which are OK to be untracked
    output = output
        .map(x => x.replace(/[\r\n]+/gi, ""))
        .filter(x => x.indexOf(".local.js") < 0)
        .filter(x => x.length > 0);
    if (output.length > 0) {
        console.error("\n\nYou have unstaged changes, please commit everything first!");
        console.error("Unstaged files:");
        console.error(output.map(x => "'" + x + "'").join("\n"));
        process.exit(1);
    }
}

function copyAdditionalBuildFiles() {
    const additionalFolder = path.join("additional_build_files");
    const additionalSrcGlobs = [
        path.join(additionalFolder, "**/*.*"),
        path.join(additionalFolder, "**/.*"),
        path.join(additionalFolder, "**/*"),
    ];

    return gulp.src(additionalSrcGlobs).pipe(gulp.dest(buildFolder));
}

export const utils = {
    cleanBuildFolder,
    cleanBuildTempFolder,
    cleanImageBuildFolder,
    cleanup,
    requireCleanWorkingTree,
    copyAdditionalBuildFiles,
};

// Starts a webserver on the built directory (useful for testing prod build)
function webserver() {
    return gulp.src(buildFolder).pipe(
        gulpWebserver({
            livereload: {
                enable: true,
            },
            directoryListing: false,
            open: true,
            port: 3005,
        })
    );
}

/**
 *
 * @param {object} param0
 * @param {keyof typeof BUILD_VARIANTS} param0.version
 */
async function serveHTML({ version = "web-dev" }) {
    browserSync.init({
        server: buildFolder,
        port: 3005,
        ghostMode: false,
        logLevel: "info",
        logPrefix: "BS",
        online: false,
        notify: false,
        reloadDebounce: 100,
        watchEvents: ["add", "change"],
        open: false,
    });

    gulp.watch("../src/js/**", js[version].dev.build);

    // Watch .scss files, those trigger a css rebuild
    gulp.watch("../src/css/**", css.dev);

    // Watch .html files, those trigger a html rebuild
    gulp.watch("../src/html/**", () => html(version));

    // Watch translations
    gulp.watch("../translations/*.yaml", translations.convertToJson);

    gulp.watch(
        ["../res_raw/sounds/sfx/**/*.mp3", "../res_raw/sounds/sfx/**/*.wav"],
        gulp.series(sounds.sfx, sounds.copy)
    );
    gulp.watch(
        ["../res_raw/sounds/music/**/*.mp3", "../res_raw/sounds/music/**/*.wav"],
        gulp.series(sounds.music, sounds.copy)
    );

    // Watch resource files and copy them on change
    gulp.watch(rawImageResourcesGlobs, imgres.buildAtlas);
    gulp.watch(nonImageResourcesGlobs, imgres.copyNonImageResources);
    gulp.watch(imageResourcesGlobs, imgres.copyImageResources);

    // Watch .atlas files and recompile the atlas on change
    gulp.watch("../res_built/atlas/*.atlas", imgres.atlasToJson);
    gulp.watch("../res_built/atlas/*.json", imgres.atlas);

    // Watch the build folder and reload when anything changed
    gulp.watch(path.join(buildFolder, "**")).on("change", p =>
        gulp.src(pathNative.resolve(p).replaceAll(pathNative.sep, path.sep)).pipe(browserSync.stream())
    );
}

// Pre and postbuild
const baseResources = imgres.allOptimized;
async function deleteEmpty() {
    await delEmpty(buildFolder);
}

const postbuild = gulp.series(imgres.cleanupUnusedCssInlineImages, deleteEmpty);

export const step = {
    baseResources,
    deleteEmpty,
    postbuild,
};

/////////////////////  RUNNABLE TASKS  /////////////////////

// Builds everything (dev)
const prepare = {
    dev: variant =>
        gulp.series(
            utils.cleanup,
            gulp.parallel(
                utils.copyAdditionalBuildFiles,
                gulp.series(imgres.buildAtlas, gulp.parallel(imgres.atlasToJson, imgres.atlas)),
                gulp.series(imgres.copyImageResources, css.dev),
                imgres.copyNonImageResources,
                () => html(variant),
                gulp.series(gulp.parallel(sounds.dev, translations.fullBuild), js[variant].dev.build)
            )
        ),
};

/**
 * @typedef {import("gulp").TaskFunction} TaskFunction
 */

export const build =
    /**
     * @type {Record<string, {
     *  code: TaskFunction,
     *  resourcesAndCode: TaskFunction,
     *  all: TaskFunction,
     *  full: TaskFunction,
     * }> & { prepare: typeof prepare }}
     */
    ({
        prepare,
    });
/** @type {Record<string, TaskFunction>} */
export const serve = {};

// Builds everything for every variant
for (const variant in BUILD_VARIANTS) {
    // build
    const code = gulp.series(
        sounds.fullbuild,
        translations.fullBuild,
        js[variant].prod.build
    );

    const resourcesAndCode = gulp.parallel(step.baseResources, code, utils.copyAdditionalBuildFiles);

    const all = gulp.series(resourcesAndCode, css.prod, () => html(variant));

    const full = gulp.series(utils.cleanup, all, step.postbuild);

    build[variant] = { code, resourcesAndCode, all, full };

    // serve
    serve[variant] = gulp.series(build.prepare.dev(variant), () => serveHTML({ version: variant }));
}

export const main = {
    webserver,
};

// Default task (dev, localhost)
export default gulp.series(serve["web"]);
