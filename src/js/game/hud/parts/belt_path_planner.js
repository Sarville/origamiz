import { globalConfig } from "../../../core/config";
import { gMetaBuildingRegistry } from "../../../core/global_registries";
import { enumAngleToDirection, enumDirectionToAngle, enumDirectionToVector, Vector } from "../../../core/vector";
import { MetaUndergroundBeltBuilding, enumUndergroundBeltVariants } from "../../buildings/underground_belt";
import { enumUndergroundBeltMode } from "../../components/underground_belt";
import { defaultBuildingVariant } from "../../meta_building";
import { enumHubGoalRewards } from "../../tutorial_goals";

/**
 * @typedef {{ tile: Vector, rotation: number, rotationVariant: number, isTunnel?: boolean, tunnelVariant?: string }} PathEntry
 */

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
     * @returns {{ path: Array<Vector>, resolved: Array<PathEntry>|null }}
     */
    findBeltPathToward(from, to, allowReshape, continuationTile = null, continuationIncoming = undefined) {
        return {
            path: this.computeCornerPath(from, to),
            resolved: this.findBeltPath(from, to, allowReshape, continuationTile, continuationIncoming),
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
     * Item 9 (building endpoints): world-space feed info for every
     * ItemAcceptor slot of the real building at `tile` - the tile a belt
     * would need to occupy to feed each slot, and the compass direction it'd
     * need to eject in to do it. Mirrors GameLogic.getEjectorsAndAcceptorsAtTile's
     * own acceptor math exactly.
     * @param {Vector} tile
     * @returns {Array<{ feedTile: Vector, direction: number }>}
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
                feedTile: worldTile.add(enumDirectionToVector[enumAngleToDirection[towardFeedTile]]),
                direction: (towardFeedTile + 180) % 360,
            };
        });
    }

    /**
     * Item 9 (building endpoints): world-space launch info for the real
     * building at `tile`'s ItemEjector, only when it has exactly one slot.
     * @param {Vector} tile
     * @returns {{ launchTile: Vector, direction: number }|null}
     */
    buildingEjectorLaunch(tile) {
        const contents = this.root.map.getLayerContentXY(tile.x, tile.y, "regular");
        const ejector = contents && contents.components.ItemEjector;
        if (!ejector || ejector.slots.length !== 1) {
            return null;
        }
        const staticComp = contents.components.StaticMapEntity;
        const slot = ejector.slots[0];
        const worldTile = staticComp.localTileToWorld(slot.pos);
        const direction = enumDirectionToAngle[staticComp.localDirectionToWorld(slot.direction)];
        return {
            launchTile: worldTile.add(enumDirectionToVector[enumAngleToDirection[direction]]),
            direction,
        };
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

        const MAX_BENDS = 6;
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

        /**
         * @typedef {{ tile: Vector, dir: number, bends: number, parentKey: string|null,
         * viaTunnel: boolean, tunnelTier?: string, usedTiles: Set<string> }} SearchNode
         */
        /** @type {Map<string, SearchNode>} */
        const visited = new Map();
        const key = (tile, dir) => tile.x + "," + tile.y + "," + dir;

        /** @type {Array<string>} */
        const deque = [];
        const initialDirs = forcedStartDirection !== undefined ? [forcedStartDirection] : DIRECTIONS;
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
            // off a receiver therefore has to keep going straight.
            const mustContinueStraight =
                current.viaTunnel || (current.parentKey === null && forcedStartDirection !== undefined);

            for (const dir of DIRECTIONS) {
                if (mustContinueStraight && dir !== current.dir) {
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
                        visited.set(k, {
                            tile: nextTile,
                            dir,
                            bends: current.bends + bendCost,
                            parentKey: currentKey,
                            viaTunnel: false,
                            usedTiles,
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
                entries.push(this.curvedEntry(node.tile, next.dir, incoming));
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
            const outgoingConflicts = endOutgoingDirection === (lastIncoming + 180) % 360;
            const lastOutgoing =
                endOutgoingDirection !== undefined && !outgoingConflicts ? endOutgoingDirection : lastNode.dir;
            entries.push(this.curvedEntry(lastNode.tile, lastOutgoing, lastIncoming));
        }

        return entries;
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
     * @returns {Array<PathEntry>|null}
     */
    findBeltPath(from, to, allowReshape, continuationTile = null, continuationIncoming = undefined) {
        if (from.equals(to)) {
            return this.beltTilesToEntries([from]);
        }

        const launch = !this.beltAt(from) && !this.tunnelAt(from) ? this.buildingEjectorLaunch(from) : null;
        const effectiveFrom = launch ? launch.launchTile : from;
        const forcedStartIncoming = launch ? launch.direction : undefined;

        if (!this.beltAt(to) && !this.tunnelAt(to)) {
            const feeds = this.buildingAcceptorFeeds(to);
            if (feeds.length > 0) {
                for (const feed of feeds) {
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
            undefined,
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
                            variant: entry.isTunnel ? entry.tunnelVariant : this.placerLogic.currentVariant.get(),
                            building: entry.isTunnel ? this.tunnelMetaBuilding : metaBuilding,
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
