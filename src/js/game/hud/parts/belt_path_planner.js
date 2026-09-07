import { globalConfig } from "../../../core/config";
import { gMetaBuildingRegistry } from "../../../core/global_registries";
import { enumAngleToDirection, enumDirectionToAngle, enumDirectionToVector, Vector } from "../../../core/vector";
import { MetaBalancerBuilding, enumBalancerVariants } from "../../buildings/balancer";
import { MetaUndergroundBeltBuilding, enumUndergroundBeltVariants } from "../../buildings/underground_belt";
import { enumUndergroundBeltMode } from "../../components/underground_belt";
import { defaultBuildingVariant } from "../../meta_building";
import { enumHubGoalRewards } from "../../tutorial_goals";

/**
 * @typedef {{ tile: Vector, rotation: number, rotationVariant: number, isTunnel?: boolean, tunnelVariant?: string, isMerger?: boolean, mergerVariant?: string, isSplitter?: boolean, splitterVariant?: string }} PathEntry
 */

// Shop auto-merger/auto-splitter: a belt run must have at least this many
// more straight tiles continuing past the join tile (the drop tile for a
// merger, the start tile for a splitter) for it to count as a real trunk
// worth forking, not just the run's own tail - see pickAutoMergerVariant's
// and pickAutoSplitterVariant's docs.
const MIN_AUTO_BELT_TRUNK_TILES = 2;

// Shop long-distance routing (reward_shop_long_route): the normal bend cap
// for the belt auto-router, and the raised one once purchased.
const MAX_BENDS_DEFAULT = 6;
const MAX_BENDS_LONG_ROUTE = 20;

/**
 * Item 9's belt auto-tunnel/routing engine: given a `from`/`to` pair, finds a
 * bounded-bend path between them (bridging obstacles with tunnels where
 * possible) and can commit the result to the map as one atomic placement.
 * Extracted out of mobile_controls.js (where this started, and where the
 * eleven follow-up rounds that hardened it happened - see that file's git
 * history for the reasoning behind each rule) so building_placer_logic.js
 * (desktop's belt drag) can reuse the exact same, already-battle-tested
 * logic instead of re-deriving its own copy.
 *
 * Deliberately stateless about belt *continuation* (mobile's tap-to-extend
 * feature, item 8) - `continuationTile`/`continuationIncoming` are passed in
 * by the caller (mobile_controls.js keeps its own `lastBeltTile`/
 * `lastBeltIncomingDirection`; desktop has no such concept and always omits
 * them) rather than owned here, so one planner instance has no per-caller
 * assumptions baked in.
 */
export class BeltPathPlanner {
    /**
     * @param {import("../../root").GameRoot} root
     */
    constructor(root) {
        this.root = root;
    }

    /**
     * Building-selection state (current meta building/variant/rotation, the
     * shared fakeEntity) always lives on the one HUDBuildingPlacer instance
     * regardless of which HUD part is actually driving a drag right now.
     */
    get placerLogic() {
        return this.root.hud.parts.buildingPlacer;
    }

    get tunnelMetaBuilding() {
        return gMetaBuildingRegistry.findByClass(MetaUndergroundBeltBuilding);
    }

    get balancerMetaBuilding() {
        return gMetaBuildingRegistry.findByClass(MetaBalancerBuilding);
    }

    /**
     * Shop item "autoPath" (reward_shop_auto_path): whether the bounded-bend
     * search below (findBeltPath/findBeltPathToward) may run at all. Until
     * bought, both callers (building_placer_logic.js's drag/tap,
     * mobile_controls.js's drag/tap) fall back to straightDragPath instead -
     * a plain single-axis line, no bends, no tunnel-bridging, no
     * continuation onto a previous run.
     * @returns {boolean}
     */
    get isAutoPathUnlocked() {
        return this.root.hubGoals.isRewardUnlocked(enumHubGoalRewards.reward_shop_auto_path);
    }

    /**
     * The pre-purchase fallback for findBeltPathToward: a straight run from
     * `from` toward `to`, locked to whichever axis has the larger delta -
     * never a corner, never routed around obstacles. Recomputed fresh from
     * `from` every call (same "always from the anchor, not accumulated"
     * convention findBeltPathToward's own callers already use), so it can't
     * drift onto the other axis mid-drag as long as the caller keeps
     * re-deriving `to` from the live cursor/finger position.
     * @param {Vector} from
     * @param {Vector} to
     * @returns {Array<Vector>}
     */
    straightDragPath(from, to) {
        if (from.equals(to)) {
            return [from];
        }
        const dx = to.x - from.x;
        const dy = to.y - from.y;
        return Math.abs(dx) >= Math.abs(dy)
            ? this.axisSegment(from, new Vector(to.x, from.y))
            : this.axisSegment(from, new Vector(from.x, to.y));
    }

    /**
     * All tiles on a straight run between two tiles that already share an axis (same
     * x or same y) - a single leg of an L-shaped corner path.
     * @param {Vector} from
     * @param {Vector} to
     * @returns {Array<Vector>}
     */
    axisSegment(from, to) {
        const path = [];
        if (from.x === to.x) {
            const step = to.y >= from.y ? 1 : -1;
            for (let y = from.y; y !== to.y + step; y += step) {
                path.push(new Vector(from.x, y));
            }
        } else {
            const step = to.x >= from.x ? 1 : -1;
            for (let x = from.x; x !== to.x + step; x += step) {
                path.push(new Vector(x, from.y));
            }
        }
        return path;
    }

    /**
     * Connects two arbitrary tiles with an L-shaped path: straight along whichever
     * axis has the larger delta first, then one turn, then straight the rest of the
     * way.
     * @param {Vector} from
     * @param {Vector} to
     * @returns {Array<Vector>}
     */
    computeCornerPath(from, to, horizontalFirst = Math.abs(to.x - from.x) >= Math.abs(to.y - from.y)) {
        const corner = horizontalFirst ? new Vector(to.x, from.y) : new Vector(from.x, to.y);
        const firstLeg = this.axisSegment(from, corner);
        const secondLeg = this.axisSegment(corner, to);
        return firstLeg.concat(secondLeg.slice(1));
    }

    /**
     * Resolves a belt path from `from` to `to` - see findBeltPath for the
     * actual search. `path` in the return value is only ever
     * computeCornerPath's plain two-leg shape, used purely as a red-flash
     * preview's outline on total failure (the real search may have explored
     * tiles well outside it - this is just a reasonable "here's roughly
     * where it was headed" hint, not a claim that shape was actually tried).
     * @param {Vector} from
     * @param {Vector} to
     * @param {boolean} allowReshape See findBeltPath.
     * @param {Vector=} continuationTile See findBeltPath.
     * @param {number=} continuationIncoming See findBeltPath.
     * @param {Vector=} approachTile See findBeltPath.
     * @returns {{ path: Array<Vector>, resolved: Array<PathEntry>|null }}
     */
    findBeltPathToward(
        from,
        to,
        allowReshape,
        continuationTile = null,
        continuationIncoming = undefined,
        approachTile = null
    ) {
        return {
            path: this.computeCornerPath(from, to),
            resolved: this.findBeltPath(
                from,
                to,
                allowReshape,
                continuationTile,
                continuationIncoming,
                approachTile
            ),
        };
    }

    /**
     * Compass direction (0/90/180/270) of travel from one tile to an adjacent one.
     * @param {Vector} from
     * @param {Vector} to
     */
    directionBetween(from, to) {
        const delta = to.sub(from);
        return (Math.round(Math.degrees(delta.angle()) / 90) * 90 + 360) % 360;
    }

    /**
     * Turns an ordered belt-tile path into entries with a rotation and curve
     * rotationVariant derived from the tile *sequence*.
     * @param {Array<Vector>} path
     * @returns {Array<PathEntry>}
     */
    beltTilesToEntries(path) {
        if (path.length === 0) {
            return [];
        }
        const entries = [];
        for (let i = 0; i < path.length; ++i) {
            let outgoing;
            if (i < path.length - 1) {
                outgoing = this.directionBetween(path[i], path[i + 1]);
            } else if (i > 0) {
                // Last tile in a multi-tile path: keep pointing the way it was heading.
                outgoing = this.directionBetween(path[i - 1], path[i]);
            } else {
                entries.push({
                    tile: path[i],
                    rotation: this.placerLogic.currentBaseRotation,
                    rotationVariant: 0,
                });
                continue;
            }
            const incoming = i > 0 ? this.directionBetween(path[i - 1], path[i]) : undefined;
            entries.push(this.curvedEntry(path[i], outgoing, incoming));
        }
        return entries;
    }

    /**
     * Rotation + curve rotationVariant for one belt tile, given the
     * direction it heads onward (outgoing) and the direction it was reached
     * from (incoming - omit for a path's very first tile, which has none).
     * @param {Vector} tile
     * @param {number} outgoing
     * @param {number=} incoming
     */
    curvedEntry(tile, outgoing, incoming) {
        let rotation = outgoing;
        let rotationVariant = 0;
        if (incoming !== undefined) {
            if (incoming === (outgoing + 270) % 360) {
                // Fed from the right - curves to meet it, same as
                // MetaBeltBuilding.computeOptimalDirectionAndRotationVariantAtTile
                // does for a real ejector feeding in from that side.
                rotation = (outgoing + 270) % 360;
                rotationVariant = 2;
            } else if (incoming === (outgoing + 90) % 360) {
                rotation = (outgoing + 90) % 360;
                rotationVariant = 1;
            }
        }
        return { tile, rotation, rotationVariant };
    }

    /**
     * The Belt component at the given tile, or null.
     * @param {Vector} tile
     */
    beltAt(tile) {
        const contents = this.root.map.getLayerContentXY(tile.x, tile.y, "regular");
        return (contents && contents.components.Belt) || null;
    }

    /**
     * The UndergroundBelt component at the given tile, or null.
     * @param {Vector} tile
     */
    tunnelAt(tile) {
        const contents = this.root.map.getLayerContentXY(tile.x, tile.y, "regular");
        return (contents && contents.components.UndergroundBelt) || null;
    }

    /**
     * Item 9 (12th/15th follow-up fix): the real outgoing direction of the
     * existing belt at `tile` - the exact inverse of curvedEntry's own
     * incoming/rotation/rotationVariant math, so a search step that merely
     * *passes through* a pre-existing belt (isTileBlockedForBelt waves a
     * same-direction one through as harmless reuse) can be forced to leave
     * it exactly the way it already does, instead of free to bend it onto a
     * new outgoing and sever whatever it used to feed.
     * @param {Vector} tile
     * @returns {number}
     */
    existingBeltOutgoing(tile) {
        const staticComp = this.root.map.getLayerContentXY(tile.x, tile.y, "regular").components.StaticMapEntity;
        const rotation = staticComp.rotation;
        switch (staticComp.getRotationVariant()) {
            case 1:
                return (rotation - 90 + 360) % 360;
            case 2:
                return (rotation + 90) % 360;
            default:
                return rotation;
        }
    }

    /**
     * Item 9 (building endpoints): world-space feed info for every
     * ItemAcceptor slot of the real building at `tile` - the tile a belt
     * would need to occupy to feed each slot, and the compass direction it'd
     * need to eject in to do it. Mirrors GameLogic.getEjectorsAndAcceptorsAtTile's
     * own acceptor math exactly.
     * @param {Vector} tile
     * @returns {Array<{ slotTile: Vector, feedTile: Vector, direction: number }>}
     */
    buildingAcceptorFeeds(tile) {
        const contents = this.root.map.getLayerContentXY(tile.x, tile.y, "regular");
        const acceptor = contents && contents.components.ItemAcceptor;
        if (!acceptor) {
            return [];
        }
        const staticComp = contents.components.StaticMapEntity;
        return acceptor.slots.map(slot => {
            const worldTile = staticComp.localTileToWorld(slot.pos);
            const towardFeedTile = enumDirectionToAngle[staticComp.localDirectionToWorld(slot.direction)];
            return {
                slotTile: worldTile,
                feedTile: worldTile.add(enumDirectionToVector[enumAngleToDirection[towardFeedTile]]),
                direction: (towardFeedTile + 180) % 360,
            };
        });
    }

    /**
     * Item 9 (opportunistic connection): world-space launch info for
     * *every* slot of the real building at `tile`'s ItemEjector, whatever
     * the slot count - unlike buildingEjectorLaunch (below), which only
     * resolves a single-slot ejector since starting a path directly off a
     * multi-output building has no unambiguous "the" output tile to use, a
     * neighbour lookup asks about one already-known tile and has no such
     * ambiguity, so a multi-output building (e.g. the quad cutter) can still
     * be opportunistically connected to.
     * @param {Vector} tile
     * @returns {Array<{ launchTile: Vector, direction: number }>}
     */
    buildingEjectorLaunches(tile) {
        const contents = this.root.map.getLayerContentXY(tile.x, tile.y, "regular");
        const ejector = contents && contents.components.ItemEjector;
        if (!ejector) {
            return [];
        }
        const staticComp = contents.components.StaticMapEntity;
        return ejector.slots.map(slot => {
            const worldTile = staticComp.localTileToWorld(slot.pos);
            const direction = enumDirectionToAngle[staticComp.localDirectionToWorld(slot.direction)];
            return {
                launchTile: worldTile.add(enumDirectionToVector[enumAngleToDirection[direction]]),
                direction,
            };
        });
    }

    /**
     * Item 9 (building endpoints): world-space launch info for the real
     * building at `tile`'s ItemEjector, only when it has exactly one slot -
     * see buildingEjectorLaunches's doc for why multi-slot is refused here.
     * @param {Vector} tile
     * @returns {{ launchTile: Vector, direction: number }|null}
     */
    buildingEjectorLaunch(tile) {
        const launches = this.buildingEjectorLaunches(tile);
        return launches.length === 1 ? launches[0] : null;
    }

    /**
     * Item 9 (opportunistic connection, 3rd outstanding debt): if a tile
     * adjacent to `tile` has a building whose ItemAcceptor feed tile is
     * exactly `tile`, the direction that acceptor needs fed in - null
     * otherwise. Lets an ordinary belt endpoint that lands next to a
     * building's input bend into it even when the drag/tap never explicitly
     * targeted that building (buildingAcceptorFeeds only looks at the tile
     * itself, not its neighbours).
     * @param {Vector} tile
     * @returns {number|null}
     */
    nearbyAcceptorDirection(tile) {
        for (const dir of [0, 90, 180, 270]) {
            const neighbor = tile.add(enumDirectionToVector[enumAngleToDirection[dir]]);
            for (const feed of this.buildingAcceptorFeeds(neighbor)) {
                if (feed.feedTile.equals(tile)) {
                    return feed.direction;
                }
            }
        }
        return null;
    }

    /**
     * Item 9 (opportunistic connection): symmetric to
     * nearbyAcceptorDirection, for a belt's *start* landing next to a
     * building's output instead of its own tile.
     * @param {Vector} tile
     * @returns {number|null}
     */
    nearbyEjectorDirection(tile) {
        for (const dir of [0, 90, 180, 270]) {
            const neighbor = tile.add(enumDirectionToVector[enumAngleToDirection[dir]]);
            for (const launch of this.buildingEjectorLaunches(neighbor)) {
                if (launch.launchTile.equals(tile)) {
                    return launch.direction;
                }
            }
        }
        return null;
    }

    /**
     * Item 9: whether a plain belt can't go on this tile without either
     * failing outright or silently severing something unrelated.
     * @param {Vector} tile
     * @param {number} incomingDirection Compass degrees (0/90/180/270) our
     * own path travels through this tile.
     * @param {Array<Vector>} anchorTiles
     */
    isTileBlockedForBelt(tile, incomingDirection, anchorTiles) {
        const contents = this.root.map.getLayerContentXY(tile.x, tile.y, "regular");
        if (!contents) {
            return false;
        }
        const staticComp = contents.components.StaticMapEntity;
        if (
            !staticComp
                .getMetaBuilding()
                .getIsReplaceable(staticComp.getVariant(), staticComp.getRotationVariant())
        ) {
            return true;
        }
        if (!contents.components.Belt) {
            return false;
        }
        const touchesAnchor = anchorTiles.some(
            anchor => anchor && Math.abs(anchor.x - tile.x) + Math.abs(anchor.y - tile.y) <= 1
        );
        if (touchesAnchor) {
            return false;
        }
        return staticComp.rotation !== incomingDirection;
    }

    /**
     * Item 9: the smallest unlocked tunnel tier whose range covers the given
     * tile distance, or null if none does.
     * @param {number} distance
     * @returns {string|null}
     */
    pickTunnelTier(distance) {
        if (!this.root.hubGoals.isRewardUnlocked(enumHubGoalRewards.reward_tunnel)) {
            return null;
        }
        if (!this.root.hubGoals.isRewardUnlocked(enumHubGoalRewards.reward_shop_auto_tunnel)) {
            return null;
        }
        if (distance <= globalConfig.undergroundBeltMaxTilesByTier[0]) {
            return defaultBuildingVariant;
        }
        if (
            this.root.hubGoals.isRewardUnlocked(enumHubGoalRewards.reward_underground_belt_tier_2) &&
            distance <= globalConfig.undergroundBeltMaxTilesByTier[1]
        ) {
            return enumUndergroundBeltVariants.tier2;
        }
        return null;
    }

    /**
     * Item 9 - auto-tunnel planning: a 0-1 BFS over (tile, facing direction)
     * states. Continuing straight (including jumping a tunnel across a
     * bridgeable obstacle) costs nothing; turning 90 degrees costs one
     * "bend". Capped at MAX_BENDS bends total and a padded bounding box
     * around from/to.
     * @param {Vector} from
     * @param {Vector} to
     * @param {boolean} allowReshape Drag (a held pointer moving across the
     * map) may reshape/merge whichever belts the path starts and ends on.
     * Tap-continuation never may: each tap only ever *extends* the belt
     * from wherever it last ended.
     * @param {number=} forcedStartIncoming Overrides the usual "read
     * continuationIncoming/rotation off an existing belt at `from`"
     * derivation - set by findBeltPath when `from` is actually a building's
     * ItemEjector launch tile (see buildingEjectorLaunch).
     * @param {number=} forcedEndOutgoing Overrides the usual "read rotation
     * off an existing belt at `to`" derivation - set by findBeltPath when
     * `to` is actually a building's ItemAcceptor feed tile (see
     * buildingAcceptorFeeds).
     * @param {Vector=} continuationTile The caller's own "belt last ended
     * here" tile (mobile's lastBeltTile) - when `from` equals this tile, its
     * real incoming direction (continuationIncoming) is used instead of
     * re-reading the tile's own (outgoing) rotation off the map. Omit (the
     * default) for a caller with no continuation concept, e.g. desktop.
     * @param {number=} continuationIncoming See continuationTile.
     * @returns {Array<PathEntry>|null}
     */
    findBeltPathSearch(
        from,
        to,
        allowReshape,
        forcedStartIncoming,
        forcedEndOutgoing,
        continuationTile = null,
        continuationIncoming = undefined
    ) {
        if (from.equals(to)) {
            if (forcedStartIncoming === undefined && forcedEndOutgoing === undefined) {
                return this.beltTilesToEntries([from]);
            }
            // Degenerate case: a building's ejector launch tile and another
            // (or the same) building's acceptor feed tile are literally the
            // same single tile - one curved piece routes straight from one
            // into the other.
            return [
                this.curvedEntry(
                    from,
                    forcedEndOutgoing !== undefined ? forcedEndOutgoing : forcedStartIncoming,
                    forcedStartIncoming
                ),
            ];
        }

        const MAX_BENDS = this.root.hubGoals.isRewardUnlocked(enumHubGoalRewards.reward_shop_long_route)
            ? MAX_BENDS_LONG_ROUTE
            : MAX_BENDS_DEFAULT;
        const MAX_VISITED = 6000;
        const maxTunnelRange =
            globalConfig.undergroundBeltMaxTilesByTier[globalConfig.undergroundBeltMaxTilesByTier.length - 1];

        const startBelt = this.beltAt(from);
        const startTunnel = this.tunnelAt(from);
        const endBelt = this.beltAt(to);
        const anchorTiles = allowReshape ? [from, to] : [from];
        const isOwnChain = tile => {
            if (allowReshape || !startBelt || !startBelt.assignedPath) {
                return false;
            }
            const belt = this.beltAt(tile);
            return !!belt && belt.assignedPath === startBelt.assignedPath;
        };
        // A tunnel exit/entrance can never land on a tile that already has
        // *anything* on it, even a same-direction belt isTileBlockedForBelt
        // would otherwise wave through as a harmless overwrite for a plain
        // tile.
        const isStrictlyClear = tile => !this.root.map.getLayerContentXY(tile.x, tile.y, "regular");
        const isBlocked = (tile, dir) => this.isTileBlockedForBelt(tile, dir, anchorTiles);
        // Distinct from (and deliberately narrower than) isTileBlockedForBelt's
        // own touchesAnchor - that one waves through the whole radius-1
        // neighbourhood around from/to (needed so the anchor's own re-curve
        // isn't treated as blocked), but only the anchor tile *itself* is
        // exempt from the forcedExitDirection restriction below - its
        // neighbours are real pre-existing chain, and letting one of them
        // re-bend just because it happens to sit next to the anchor is
        // exactly the "hijack a nearby tile of my own chain" loophole this
        // restriction exists to close (12th/15th follow-ups).
        const isAnchorTile = tile => anchorTiles.some(anchor => anchor && anchor.equals(tile));

        const forcedStartDirection =
            startTunnel && startTunnel.mode === enumUndergroundBeltMode.receiver
                ? this.root.map.getLayerContentXY(from.x, from.y, "regular").components.StaticMapEntity.rotation
                : undefined;
        const startIncomingDirection =
            forcedStartIncoming !== undefined
                ? forcedStartIncoming
                : forcedStartDirection === undefined && startBelt
                ? !!continuationTile && from.equals(continuationTile)
                    ? continuationIncoming
                    : this.root.map.getLayerContentXY(from.x, from.y, "regular").components.StaticMapEntity
                          .rotation
                : undefined;
        const endOutgoingDirection =
            forcedEndOutgoing !== undefined
                ? forcedEndOutgoing
                : endBelt
                ? this.root.map.getLayerContentXY(to.x, to.y, "regular").components.StaticMapEntity.rotation
                : undefined;

        const padding = 24;
        const minX = Math.min(from.x, to.x) - padding;
        const maxX = Math.max(from.x, to.x) + padding;
        const minY = Math.min(from.y, to.y) - padding;
        const maxY = Math.max(from.y, to.y) + padding;
        const inBounds = tile => tile.x >= minX && tile.x <= maxX && tile.y >= minY && tile.y <= maxY;

        const DIRECTIONS = [0, 90, 180, 270];
        const stepFor = dir => enumDirectionToVector[enumAngleToDirection[dir]];
        const tileKey = tile => tile.x + "," + tile.y;
        const manhattanToGoal = tile => Math.abs(tile.x - to.x) + Math.abs(tile.y - to.y);

        // The search only guarantees the *fewest bends*, not *where* they
        // land - among directions that make equal progress toward `to`,
        // DIRECTIONS' fixed enumeration order used to decide the tie, which
        // had nothing to do with the drag's actual shape (a far input could
        // get a late bend right at its doorstep instead of an early one
        // right off the source). `deprioritize`, when given, is tried last
        // among ties instead: at the seed this is the forced ejector
        // direction, so a genuine lateral option is preferred over
        // continuing straight when both help equally (the mandatory turn
        // still renders "for free" as a curve on the source tile itself);
        // during expansion it's `current.dir`, so an unavoidable turn is
        // taken as soon as it's no worse than continuing straight, instead
        // of being deferred to the last possible tile.
        const orderTowardGoal = (tile, dirs, deprioritize) =>
            dirs.slice().sort((a, b) => {
                const distA = manhattanToGoal(tile.add(stepFor(a)));
                const distB = manhattanToGoal(tile.add(stepFor(b)));
                if (distA !== distB) {
                    return distA - distB;
                }
                if (a === deprioritize) {
                    return 1;
                }
                if (b === deprioritize) {
                    return -1;
                }
                return 0;
            });

        /**
         * @typedef {{ tile: Vector, dir: number, bends: number, parentKey: string|null,
         * viaTunnel: boolean, tunnelTier?: string, usedTiles: Set<string>,
         * forcedExitDirection?: number }} SearchNode
         */
        /** @type {Map<string, SearchNode>} */
        const visited = new Map();
        const key = (tile, dir) => tile.x + "," + tile.y + "," + dir;

        /** @type {Array<string>} */
        const deque = [];
        const initialDirs =
            forcedStartDirection !== undefined
                ? [forcedStartDirection]
                : orderTowardGoal(from, DIRECTIONS, startIncomingDirection);
        for (const dir of initialDirs) {
            const k = key(from, dir);
            visited.set(k, {
                tile: from,
                dir,
                bends: 0,
                parentKey: null,
                viaTunnel: false,
                usedTiles: new Set([tileKey(from)]),
            });
            deque.push(k);
        }

        let goalKey = null;
        let iterations = 0;
        while (deque.length > 0) {
            if (++iterations > MAX_VISITED) {
                break;
            }
            const currentKey = deque.shift();
            const current = visited.get(currentKey);
            if (current.tile.equals(to)) {
                goalKey = currentKey;
                break;
            }
            if (current.bends >= MAX_BENDS) {
                continue;
            }

            // A tunnel receiver's ItemEjector is a single fixed slot facing
            // its own rotation - unlike a plain belt tile, it has no curve
            // variant and can never eject any other way. The very next step
            // off a receiver therefore has to keep going straight - same for
            // a tile the path merely passed *through* because it was an
            // existing belt already flowing the same way in
            // (isTileBlockedForBelt waves those through as harmless reuse):
            // it's forced to leave exactly the way that belt already does
            // (forcedExitDirection, see existingBeltOutgoing), whether
            // that's straight or an existing curve - bending it onto some
            // *other* new outgoing would silently redirect it away from
            // whatever it used to feed, stranding its old remainder as a
            // disconnected dead path (see BeltPathPlanner's class doc /
            // item 9's 12th and 15th follow-ups). A genuinely new
            // (previously empty) tile has no such history and may still
            // bend freely.
            const forcedExitDirection =
                current.forcedExitDirection !== undefined
                    ? current.forcedExitDirection
                    : current.parentKey === null && forcedStartDirection !== undefined
                    ? current.dir // continuing from an existing tunnel receiver at `from`
                    : undefined;

            for (const dir of orderTowardGoal(current.tile, DIRECTIONS, current.dir)) {
                if (forcedExitDirection !== undefined && dir !== forcedExitDirection) {
                    continue;
                }
                const bendCost = dir === current.dir ? 0 : 1;
                if (current.bends + bendCost > MAX_BENDS) {
                    continue;
                }
                const step = stepFor(dir);
                const nextTile = current.tile.add(step);
                if (!inBounds(nextTile)) {
                    continue;
                }

                if (!isBlocked(nextTile, dir)) {
                    // Never step onto a tile this same path has already
                    // claimed elsewhere.
                    if (current.usedTiles.has(tileKey(nextTile))) {
                        continue;
                    }
                    // Reaching the goal itself from a direction that's
                    // exactly opposite the existing belt's own established
                    // continuation there is a dead end, not a valid
                    // approach.
                    if (
                        nextTile.equals(to) &&
                        endOutgoingDirection !== undefined &&
                        endOutgoingDirection === (dir + 180) % 360
                    ) {
                        continue;
                    }
                    const k = key(nextTile, dir);
                    if (!visited.has(k)) {
                        const usedTiles = new Set(current.usedTiles);
                        usedTiles.add(tileKey(nextTile));
                        // Only reachable here (unblocked) for a pre-existing
                        // belt when its own rotation already matches `dir` -
                        // isTileBlockedForBelt only waves through an anchor-
                        // adjacent tile (any direction) or a same-direction
                        // one elsewhere. Force the latter's *next* step to
                        // exactly the tile's own real outgoing (straight or
                        // an existing curve alike) instead of leaving it free
                        // to bend onto a new one.
                        const throughExisting = !!this.beltAt(nextTile) && !isAnchorTile(nextTile);
                        visited.set(k, {
                            tile: nextTile,
                            dir,
                            bends: current.bends + bendCost,
                            parentKey: currentKey,
                            viaTunnel: false,
                            usedTiles,
                            forcedExitDirection: throughExisting
                                ? this.existingBeltOutgoing(nextTile)
                                : undefined,
                        });
                        if (bendCost === 0) {
                            deque.unshift(k);
                        } else {
                            deque.push(k);
                        }
                    }
                    continue;
                }

                // Blocked - only a straight continuation (never a turn
                // landing directly on an obstacle) may try tunnelling under
                // it, and never right after another tunnel jump.
                if (dir !== current.dir || current.viaTunnel) {
                    continue;
                }
                if (current.parentKey === null) {
                    // The very first jump, right off the start tile: an
                    // existing tunnel piece there can never become a brand
                    // new sender, and a known real incoming/fixed ejector
                    // direction that disagrees with `dir` can't legally
                    // send this way either.
                    if (startTunnel) {
                        continue;
                    }
                    if (startIncomingDirection !== undefined && dir !== startIncomingDirection) {
                        continue;
                    }
                }
                if (isOwnChain(nextTile)) {
                    continue;
                }
                let scanTile = nextTile;
                let distance = 1;
                while (distance <= maxTunnelRange) {
                    if (isOwnChain(scanTile)) {
                        break;
                    }
                    if (!isBlocked(scanTile, dir)) {
                        // A tunnel receiver's own rotation is fixed to the
                        // direction it's travelling - so a receiver landing
                        // exactly on `to` has to be travelling the
                        // direction `to` actually needs or it'd silently
                        // eject the wrong way.
                        const wrongForcedExit =
                            scanTile.equals(to) &&
                            endOutgoingDirection !== undefined &&
                            dir !== endOutgoingDirection;
                        if (
                            isStrictlyClear(scanTile) &&
                            inBounds(scanTile) &&
                            !current.usedTiles.has(tileKey(scanTile)) &&
                            !wrongForcedExit
                        ) {
                            const tier = this.pickTunnelTier(distance);
                            if (tier !== null) {
                                const k = key(scanTile, dir);
                                if (!visited.has(k)) {
                                    const usedTiles = new Set(current.usedTiles);
                                    usedTiles.add(tileKey(scanTile));
                                    visited.set(k, {
                                        tile: scanTile,
                                        dir,
                                        bends: current.bends,
                                        parentKey: currentKey,
                                        viaTunnel: true,
                                        tunnelTier: tier,
                                        usedTiles,
                                        // A tunnel receiver's ItemEjector is a
                                        // single fixed slot facing its own
                                        // rotation - it has no curve variant
                                        // and can never eject any other way.
                                        forcedExitDirection: dir,
                                    });
                                    deque.unshift(k);
                                }
                            }
                        }
                        // Either landed (pushed above) or this tile ends the
                        // scan either way - a tunnel can only bridge one
                        // contiguous blocked run in a straight line.
                        break;
                    }
                    scanTile = scanTile.add(step);
                    distance++;
                }
            }
        }

        if (!goalKey) {
            return null;
        }

        // Reconstruct the chain of states from start to goal, then walk it
        // forward turning each edge into a PathEntry - a tunnel jump becomes
        // a sender/receiver pair, everything else a curvedEntry.
        /** @type {Array<SearchNode>} */
        const chain = [];
        for (let k = goalKey; k !== null; ) {
            const node = visited.get(k);
            chain.push(node);
            k = node.parentKey;
        }
        chain.reverse();

        const entries = [];
        for (let idx = 0; idx < chain.length - 1; ++idx) {
            const node = chain[idx];
            const next = chain[idx + 1];
            if (idx === 0 && startTunnel) {
                // from is already a tunnel piece being continued from, not
                // replaced - nothing to place there.
                continue;
            }
            if (next.viaTunnel) {
                entries.push({
                    tile: node.tile,
                    rotation: next.dir,
                    rotationVariant: 0, // sender
                    isTunnel: true,
                    tunnelVariant: next.tunnelTier,
                });
                entries.push({
                    tile: next.tile,
                    rotation: next.dir,
                    rotationVariant: 1, // receiver
                    isTunnel: true,
                    tunnelVariant: next.tunnelTier,
                });
            } else if (!node.viaTunnel) {
                const incoming = idx === 0 ? startIncomingDirection : node.dir;

                const splitterVariant =
                    idx === 0
                        ? this.pickAutoSplitterVariant(from, startBelt, startIncomingDirection, next.dir)
                        : null;
                if (splitterVariant) {
                    // Starting a new drag mid-trunk of an existing straight
                    // belt run with a genuinely different outgoing direction
                    // - replace the plain curve with a splitter so the
                    // trunk's own downstream feed isn't severed (mirror of
                    // pickAutoMergerVariant, see its doc).
                    entries.push({
                        tile: node.tile,
                        rotation: startIncomingDirection,
                        rotationVariant: 0,
                        isSplitter: true,
                        splitterVariant,
                    });
                } else {
                    entries.push(this.curvedEntry(node.tile, next.dir, incoming));
                }
            }
            // node.viaTunnel && !next.viaTunnel: node.tile is itself a
            // receiver the previous iteration already pushed above - skip
            // re-deriving a plain curvedEntry for the same tile here.
        }

        // The goal tile itself - curve into whatever it's connecting to
        // (endOutgoingDirection, an existing belt being merged into) if
        // that's known *and* geometrically possible.
        //
        // None of this applies when the goal itself was reached by a
        // tunnel jump (lastNode.viaTunnel) - the loop above already pushed
        // it as a receiver.
        const lastNode = chain[chain.length - 1];
        if (!lastNode.viaTunnel) {
            const lastIncoming = lastNode.dir;

            const mergerVariant = this.pickAutoMergerVariant(to, endBelt, endOutgoingDirection, lastIncoming);
            if (mergerVariant) {
                // Landing mid-trunk of an existing straight belt run with a
                // genuinely different incoming direction - replace the plain
                // curve with a merger so the trunk's own upstream feed isn't
                // severed (see pickAutoMergerVariant's doc).
                entries.push({
                    tile: lastNode.tile,
                    rotation: endOutgoingDirection,
                    rotationVariant: 0,
                    isMerger: true,
                    mergerVariant,
                });
            } else {
                const outgoingConflicts = endOutgoingDirection === (lastIncoming + 180) % 360;
                const lastOutgoing =
                    endOutgoingDirection !== undefined && !outgoingConflicts ? endOutgoingDirection : lastNode.dir;
                entries.push(this.curvedEntry(lastNode.tile, lastOutgoing, lastIncoming));
            }
        }

        return entries;
    }

    /**
     * Shop auto-merger (reward_shop_auto_merger): whether landing on `to`
     * should insert a merger instead of curving a plain belt into it.
     *
     * Only when: the purchase is unlocked; `to` already has a belt; the new
     * path's incoming direction genuinely differs from the trunk's own
     * (equal means the same-direction "reuse" case, already handled earlier
     * by isTileBlockedForBelt waving it through as harmless overlap); `to`
     * is a *straight* tile (rotationVariant 0) - only then does its
     * rotation unambiguously give both the trunk's own incoming direction
     * and the eject direction to preserve, a curved tile's accept/eject
     * sides don't line up the same way, so those are left to the existing
     * curve-in behavior; and `to` sits mid-trunk, not at the run's own tail
     * - see hasStraightBeltRunAhead.
     * @param {Vector} to
     * @param {*} endBeltComponent
     * @param {number=} endOutgoingDirection
     * @param {number} newIncoming
     * @returns {string|null} the balancer variant to place, or null
     */
    pickAutoMergerVariant(to, endBeltComponent, endOutgoingDirection, newIncoming) {
        if (!endBeltComponent || endOutgoingDirection === undefined || newIncoming === endOutgoingDirection) {
            return null;
        }
        if (!this.root.hubGoals.isRewardUnlocked(enumHubGoalRewards.reward_shop_auto_merger)) {
            return null;
        }
        const staticComp = this.root.map.getLayerContentXY(to.x, to.y, "regular").components.StaticMapEntity;
        if (staticComp.getRotationVariant() !== 0) {
            return null;
        }
        if (!this.hasStraightBeltRunAhead(to, endOutgoingDirection, MIN_AUTO_BELT_TRUNK_TILES)) {
            return null;
        }
        if (newIncoming === (endOutgoingDirection + 270) % 360) {
            return enumBalancerVariants.merger;
        }
        if (newIncoming === (endOutgoingDirection + 90) % 360) {
            return enumBalancerVariants.mergerInverse;
        }
        // Anything else (a head-on 180deg approach) has no matching
        // acceptor slot on a merger - leave it to the existing behavior.
        return null;
    }

    /**
     * Shop auto-splitter (reward_shop_auto_splitter): the mirror image of
     * pickAutoMergerVariant, applied at the *start* of a drag instead of the
     * end - whether starting a new belt from `from` should insert a
     * splitter instead of curving a plain belt out of it.
     *
     * Same conditions as the merger, mirrored: `from` already has a
     * *straight* belt (rotationVariant 0) that keeps going for at least
     * MIN_AUTO_BELT_TRUNK_TILES more tiles past `from` in its own direction
     * (not the run's own tail), and the new drag's outgoing direction
     * genuinely differs from that trunk direction (equal means the
     * same-direction "extend the belt further" case - completely normal,
     * not a fork).
     *
     * The left/right test is the mirror of the merger's: there, an
     * *incoming* direction of (rotation+270)%360 means "entered from the
     * right" (curvedEntry's own convention) because direction-of-travel
     * points away from the entry side. Here it's an *outgoing* direction,
     * which points straight at the exit side instead, so the sign is
     * flipped: (rotation+90)%360 is the right-hand branch.
     * @param {Vector} from
     * @param {*} startBeltComponent
     * @param {number=} startIncomingDirection
     * @param {number} newOutgoing
     * @returns {string|null} the balancer variant to place, or null
     */
    pickAutoSplitterVariant(from, startBeltComponent, startIncomingDirection, newOutgoing) {
        if (
            !startBeltComponent ||
            startIncomingDirection === undefined ||
            newOutgoing === startIncomingDirection
        ) {
            return null;
        }
        if (!this.root.hubGoals.isRewardUnlocked(enumHubGoalRewards.reward_shop_auto_splitter)) {
            return null;
        }
        const staticComp = this.root.map.getLayerContentXY(from.x, from.y, "regular").components.StaticMapEntity;
        if (staticComp.getRotationVariant() !== 0) {
            return null;
        }
        if (!this.hasStraightBeltRunAhead(from, startIncomingDirection, MIN_AUTO_BELT_TRUNK_TILES)) {
            return null;
        }
        if (newOutgoing === (startIncomingDirection + 90) % 360) {
            return enumBalancerVariants.splitter;
        }
        if (newOutgoing === (startIncomingDirection + 270) % 360) {
            return enumBalancerVariants.splitterInverse;
        }
        // Anything else (a head-on 180deg branch) has no matching ejector
        // slot on a splitter - leave it to the existing behavior.
        return null;
    }

    /**
     * Whether at least `count` more belt tiles continue straight past
     * `tile` in `direction` - see pickAutoMergerVariant's doc.
     * @param {Vector} tile
     * @param {number} direction
     * @param {number} count
     */
    hasStraightBeltRunAhead(tile, direction, count) {
        let cursor = tile;
        const step = enumDirectionToVector[enumAngleToDirection[direction]];
        for (let i = 0; i < count; ++i) {
            cursor = cursor.add(step);
            const contents = this.root.map.getLayerContentXY(cursor.x, cursor.y, "regular");
            if (!contents || !contents.components.Belt) {
                return false;
            }
            const staticComp = contents.components.StaticMapEntity;
            if (staticComp.getRotationVariant() !== 0 || staticComp.rotation !== direction) {
                return false;
            }
        }
        return true;
    }

    /**
     * Item 9: findBeltPathSearch's public entry point - handles `from`/`to`
     * landing on a real building's own ItemEjector/ItemAcceptor before
     * running the search proper, so a drag or tap can start right out of a
     * building's output or end right into one of its inputs.
     * @param {Vector} from
     * @param {Vector} to
     * @param {boolean} allowReshape See findBeltPathSearch.
     * @param {Vector=} continuationTile See findBeltPathSearch.
     * @param {number=} continuationIncoming See findBeltPathSearch.
     * @param {Vector=} approachTile The tile the drag/tap was over
     * immediately before `to` - the caller's own previous move position, not
     * anything this class tracks itself (stateless, see the class doc). Used
     * only to break ties between a same-tile building's several acceptor
     * slots (see the comment below); irrelevant otherwise.
     * @returns {Array<PathEntry>|null}
     */
    findBeltPath(
        from,
        to,
        allowReshape,
        continuationTile = null,
        continuationIncoming = undefined,
        approachTile = null
    ) {
        if (from.equals(to)) {
            return this.beltTilesToEntries([from]);
        }

        const fromIsFree = !this.beltAt(from) && !this.tunnelAt(from);
        const launch = fromIsFree ? this.buildingEjectorLaunch(from) : null;
        const effectiveFrom = launch ? launch.launchTile : from;
        const forcedStartIncoming = launch
            ? launch.direction
            : fromIsFree
            ? this.nearbyEjectorDirection(from) ?? undefined
            : undefined;

        const toIsFree = !this.beltAt(to) && !this.tunnelAt(to);
        if (toIsFree) {
            const feeds = this.buildingAcceptorFeeds(to);
            if (feeds.length > 0) {
                // A multi-input building (e.g. a balancer) has one feed per
                // input slot, in whatever fixed order its component defines
                // them - trying them in that order picked "first slot that
                // has *any* valid path" regardless of which input the drag
                // actually landed on, so a drag ending right on the near
                // input's own tile could still be routed to the far one (or
                // to one already fed by another belt) as long as *a* path to
                // it existed. A multi-tile building (the ordinary 2-wide
                // balancer) has each slot living on its own distinct world
                // tile, so `to` - the exact tile the drag ended on - already
                // names the intended slot unambiguously; prefer that one
                // first. A single-tile building with several slots on the
                // *same* tile (e.g. the compact merger variant, both its
                // inputs living on the one tile the whole building
                // occupies) has no such tile to disambiguate with -
                // `approachTile` (the drag's actual previous position) is
                // the next best signal: whichever slot the belt is
                // physically walking straight into from there is the one
                // under the finger, not just whichever happens to be closer
                // to the drag's overall origin.
                const orderedFeeds = feeds.slice().sort((a, b) => {
                    const aOnTarget = a.slotTile.equals(to) ? 0 : 1;
                    const bOnTarget = b.slotTile.equals(to) ? 0 : 1;
                    if (aOnTarget !== bOnTarget) {
                        return aOnTarget - bOnTarget;
                    }
                    if (approachTile) {
                        const aApproached = a.feedTile.equals(approachTile) ? 0 : 1;
                        const bApproached = b.feedTile.equals(approachTile) ? 0 : 1;
                        if (aApproached !== bApproached) {
                            return aApproached - bApproached;
                        }
                    }
                    return a.feedTile.distanceSquare(effectiveFrom) - b.feedTile.distanceSquare(effectiveFrom);
                });
                for (const feed of orderedFeeds) {
                    const result = this.findBeltPathSearch(
                        effectiveFrom,
                        feed.feedTile,
                        allowReshape,
                        forcedStartIncoming,
                        feed.direction,
                        continuationTile,
                        continuationIncoming
                    );
                    if (result) {
                        return result;
                    }
                }
                return null;
            }
        }

        return this.findBeltPathSearch(
            effectiveFrom,
            to,
            allowReshape,
            forcedStartIncoming,
            toIsFree ? this.nearbyAcceptorDirection(to) ?? undefined : undefined,
            continuationTile,
            continuationIncoming
        );
    }

    /**
     * Places every entry of a completed belt drag/tap as one atomic
     * transaction. Stateless about belt continuation - `continuationBefore`
     * (`{ tile, incoming }`, the caller's own "belt last ended here" state)
     * is only used to fill the undo/redo transaction meta a caller with a
     * continuation feature (mobile) reads back out; omit it for a caller
     * with no such concept (desktop).
     * @param {Array<PathEntry>} entries
     * @param {{ tile: Vector, incoming: number= }=} continuationBefore
     * @returns {{ placed: boolean, lastTile: Vector, lastIncoming: number= }}
     */
    placePath(entries, continuationBefore = null) {
        const fallback = {
            placed: false,
            lastTile: continuationBefore ? continuationBefore.tile : null,
            lastIncoming: continuationBefore ? continuationBefore.incoming : undefined,
        };
        if (entries.length === 0) {
            return fallback;
        }
        const metaBuilding = this.placerLogic.currentMetaBuilding.get();
        if (!metaBuilding) {
            return fallback;
        }

        let anythingPlaced = false;

        // One transaction for the whole path (and any side effects it
        // triggers), not one per tile - so a whole dragged/tapped-out belt
        // undoes in a single step. See ActionHistory's class doc.
        this.root.actionHistory.beginTransaction();
        this.root.logic.performBulkOperation(() => {
            // systems/belt.js's updateSurroundingBeltPlacement listens for
            // entityAdded and re-derives each *neighbour's* rotation from
            // real map state right after every single placement - fatal
            // here, since it would silently revert an earlier tile's
            // rotation to match its still-unchanged old neighbours before
            // the rest of this path exists. Already no-ops entirely under
            // performImmutableOperation - every tile of this path already
            // has its final, whole-path-aware rotation from curvedEntry.
            this.root.logic.performImmutableOperation(() => {
                for (let i = 0; i < entries.length; ++i) {
                    const entry = entries[i];
                    // Bypasses tryPlaceCurrentBuildingAt's own
                    // rotation/rotationVariant auto-detection and calls
                    // GameLogic.tryPlaceBuilding directly - this entry's
                    // rotation/curve was already worked out from the
                    // *whole* path (curvedEntry, or explicitly for a
                    // tunnel), and the single-tile auto-detection
                    // re-deriving one from real map neighbours instead
                    // would override it.
                    if (
                        this.root.logic.tryPlaceBuilding({
                            origin: entry.tile,
                            rotation: entry.rotation,
                            originalRotation: entry.rotation,
                            rotationVariant: entry.rotationVariant,
                            variant: entry.isTunnel
                                ? entry.tunnelVariant
                                : entry.isMerger
                                ? entry.mergerVariant
                                : entry.isSplitter
                                ? entry.splitterVariant
                                : this.placerLogic.currentVariant.get(),
                            building: entry.isTunnel
                                ? this.tunnelMetaBuilding
                                : entry.isMerger || entry.isSplitter
                                ? this.balancerMetaBuilding
                                : metaBuilding,
                        })
                    ) {
                        anythingPlaced = true;
                    }
                }
            });
        });

        // The direction the belt actually flowed into its own final tile.
        // entries[len-2] may be a tunnel sender several tiles away rather
        // than a direct neighbour, but directionBetween still resolves to
        // the right compass direction for any straight axis-aligned span,
        // tunnel gap included.
        const lastIncoming =
            entries.length >= 2
                ? this.directionBetween(entries[entries.length - 2].tile, entries[entries.length - 1].tile)
                : undefined;
        this.root.actionHistory.endTransaction(
            continuationBefore
                ? {
                      beltTileBefore: continuationBefore.tile,
                      beltTileAfter: entries[entries.length - 1].tile,
                      beltIncomingBefore: continuationBefore.incoming,
                      beltIncomingAfter: lastIncoming,
                  }
                : null
        );

        if (anythingPlaced) {
            this.root.soundProxy.playUi(metaBuilding.getPlacementSound());
        }
        return { placed: anythingPlaced, lastTile: entries[entries.length - 1].tile, lastIncoming };
    }
}
