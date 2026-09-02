export interface Language {
    name: string;
    code: string;
    region: string;
    overrides?: object;
}

export const LANGUAGES: Record<string, Language> = {
    "en": {
        name: "English",
        code: "en",
        region: "",
    },

    "ru": {
        // russian
        name: "Русский",
        code: "ru",
        region: "",
    },
};
