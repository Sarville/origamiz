/**
 * @typedef {import("../game/entity").Entity} Entity
 *
 * @typedef {{
 *   id: string;
 *   version: string;
 *   website: string;
 *   name: string;
 *   author: string;
 * }[]} SavegameStoredMods
 *
 * @typedef {{
 *   camera: any,
 *   time: any,
 *   entityMgr: any,
 *   map: any,
 *   gameMode: object,
 *   hubGoals: any,
 *   pinnedShapes: any,
 *   waypoints: any,
 *   entities: Array<Entity>,
 *   beltPaths: Array<any>,
 *   modExtraData: Object
 * }} SerializedGame
 *
 * @typedef {{
 *   version: number,
 *   dump: SerializedGame,
 *   lastUpdate: number,
 *   mods: SavegameStoredMods
 * }} SavegameData
 *
 * @typedef {{
 *   lastUpdate: number,
 *   version: number,
 *   internalId: string,
 *   level: number
 *   name: string|null
 * }} SavegameMetadata
 *
 * @typedef {{
 *   version: number,
 *   savegames: Array<SavegameMetadata>
 * }} SavegamesData
 */

export default {};
