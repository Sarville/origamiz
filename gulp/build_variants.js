// Single place to configure browser build outputs.
export const BRAND_NAME = "Origamiz";

export const BUILD_VARIANTS = {
    // Self-contained static files for a regular web server or a game portal.
    web: {},
    // Same build, plus the Yandex Games SDK script tag and G_IS_YANDEX=true.
    yandex: {},
    // Same build, plus G_IS_VK=true (vk-bridge itself is bundled, not injected via script tag
    // like Yandex's SDK - see src/js/platform/vk_wrapper.js).
    vk: {},
};
