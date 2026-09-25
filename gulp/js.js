import { rspack } from "@rspack/core";
import { BUILD_VARIANTS } from "./build_variants.js";

import rspackConfig from "./rspack.config.js";
import rspackProductionConfig from "./rspack.production.config.js";

/**
 * @param {import("@rspack/core").Configuration} config
 * @returns {Promise<void>}
 */
function runRspack(config) {
    return new Promise((resolve, reject) => {
        rspack(config, (err, stats) => {
            if (err || stats.hasErrors()) {
                console.error(stats?.toString("errors-only") || err);
                return reject(new Error("Build failed"));
            }
            resolve();
        });
    });
}

/**
 * @param {import("@rspack/core").Configuration} config
 * @param {string} variant
 */
function withVariantDefines(config, variant) {
    return {
        ...config,
        plugins: [
            ...config.plugins,
            new rspack.DefinePlugin({
                G_IS_YANDEX: JSON.stringify(variant === "yandex"),
                G_IS_VK: JSON.stringify(variant === "vk"),
                G_IS_ANDROID: JSON.stringify(variant === "android"),
                // Yandex РСЯ ad units for the Android build; unset = Yandex demo units (never pay).
                G_YAN_BANNER_ID: JSON.stringify(process.env.YAN_BANNER_ID || "demo-banner-yandex"),
                G_YAN_INTERSTITIAL_ID: JSON.stringify(
                    process.env.YAN_INTERSTITIAL_ID || "demo-interstitial-yandex"
                ),
                G_YAN_REWARDED_ID: JSON.stringify(process.env.YAN_REWARDED_ID || "demo-rewarded-yandex"),
            }),
        ],
    };
}

/**
 * PROVIDES (per <variant>)
 *
 * js.<variant>.dev.watch
 * js.<variant>.dev
 * js.<variant>.prod
 *
 */

// TODO: Move webpack config to build_variants.js and use a separate
// build variant for development
export default Object.fromEntries(
    Object.keys(BUILD_VARIANTS).map(variant => {
        const dev = {
            build: () => runRspack(withVariantDefines(rspackConfig, variant)),
        };

        const prod = {
            build: () => runRspack(withVariantDefines(rspackProductionConfig, variant)),
        };

        return [variant, { dev, prod }];
    })
);
