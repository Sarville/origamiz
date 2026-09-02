import { gGameModeRegistry } from "../core/global_registries";
import { RegularGameMode } from "./modes/regular";

export function initGameModeRegistry() {
    gGameModeRegistry.register(RegularGameMode);
}
