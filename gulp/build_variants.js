// Single place to configure browser build outputs.
export const BRAND_NAME = "Origamiz";

export const BUILD_VARIANTS = {
    // Self-contained static files for a regular web server or a game portal.
    web: {},
    // Same build, plus the Yandex Games SDK script tag and G_IS_YANDEX=true.
    yandex: {},
};
