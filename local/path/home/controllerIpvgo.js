/**
 * Upgraded Go-playing Bitburner script (v4.1 -> v4.2)
 * - Caching of expensive per-turn computations
 * - Precompiled pattern rotations/mirrors
 * - Weighted aggregated scoring across playbook (instead of first-match winner-takes-all)
 * - Safer move heuristics (avoid creating opponent libs)
 * - Small refactors for readability & maintainability (neighbor helper, centralized caches)
 *
 * Note: behavior/logic kept compatible with original ns.go.* API usage.
 */

/** @param {NS} ns */
export async function main(ns) {
  ns.ui.openTail();
  ns.disableLog("ALL");
  ns.enableLog("print");

  // --- Global Constants & State Variables ---
  const CHEATS = false;
  const LOGTIME = false;
  const REPEAT = true;
  const playAsWhite = !!ns.args[0];
  const me = playAsWhite ? "O" : "X";
  const you = me === "X" ? "O" : "X";

  const WEIGHT_DEFAULT = 1.0;
  const OPPONENT_AVOID_LIB_PENALTY = 0.2; // multiply score by this if move creates lib for opponent
  const SELF_DANGEROUS_PENALTY = 0.25; // multiply score if move creates immediate self-danger (adjacent dying group)

  // --- Opponent Cycling Logic ---
  let OPPONENTS = [
    "Netburners",
    "Slum Snakes",
    "The Black Hand",
    "Tetrads",
    "Illuminati",
    "Daedalus",
    //"????????????"
  ];

  let opponentIndex = 0;

  let turn = 0;
  let board, contested, validMove, validLibMoves, chains;
  let START = performance.now();

  // --- Caches computed each turn (cleared/updated in updateBoardState) ---
  let cache = {
    size: 0,
    chainMembersMap: new Map(),       // chainId -> Set of "x,y"
    chainIdAt: [],                    // chain id grid
    chainValueAt: [],                 // numeric grid of size -> chain size via chain id
    eyeValueAt: [],                   // eye value per position (# of reachable '.' or own stones via flood)
    freeSpaceAt: [],                  // free space per position (using '.' as flood origin)
    surroundLibsAt: [],               // precomputed surround libs count for each pos and player
    surroundLibSpreadAt: [],          // cached spread
    surroundSpaceAt: [],              // number of '.' orthogonally adjacent
    heatMapAt: [],                     // local heat
  };

  // --- Pattern Definitions (original) ---
  const disrupt4 = [["??b?", "?b.b", "b.*b", "?bb?"],["?bb?", "b..b", "b*Xb", "?bb?"],["?bb?", "b..b", "b.*b", "?bb?"],["??b?", "?b.b", "?b*b", "??O?"],["?bbb", "bb.b", "W.*b", "?oO?"],["?bbb", "bb.b", "W.*b", "?Oo?"],[".bbb", "o*.b", ".bbb", "????"],];
  const disrupt5 = [["?bbb?", "b.*.b", "?bbb?", "?????", "?????"],["??OO?", "?b*.b", "?b..b", "??bb?", "?????"],["?????", "??bb?", "?b*Xb", "?boob", "??bb?"],["WWW??", "WWob?", "Wo*b?", "WWW??", "?????"],["??b??", "?b.b?", "?b*b?", "?b.A?", "??b??"],["??b??", "b.b?", "??*.b", "?b?b?", "?????"],["?WWW?", "WoOoW", "WOO*W", "W???W", "?????"],["?WWW?", "Wo*oW", "WOOOW", "W???W", "?????"],];
  const def5 = [["?WW??", "WW.X?", "W.XX?", "WWW??", "?????"],["WWW??", "WW.X?", "W.*X?", "WWW??", "?????"],["BBB??", "BB.X?", "B..X?", "BBB??", "?????"],["?WWW?", "W.*.W", "WXXXW", "?????", "?????"],];

  // Precompile rotated/mirrored pattern variants once
  const compiledPatterns = {
    disrupt4: compileAllPatterns(disrupt4),
    disrupt5: compileAllPatterns(disrupt5),
    def5: compileAllPatterns(def5),
  };

  // =================================================================================================
  //                                     HELPERS & CACHE LAYER
  // =================================================================================================

  function forEachNeighbor(x, y, cb) {
    const coords = [
      [x - 1, y],
      [x + 1, y],
      [x, y - 1],
      [x, y + 1],
    ];
    for (const [nx, ny] of coords) {
      if (nx >= 0 && nx < cache.size && ny >= 0 && ny < cache.size) cb(nx, ny);
    }
  }

  function shuffleArray(a) {
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function compileAllPatterns(patterns) {
    const compiled = [];
    for (const p of patterns) {
      const variants = getAllPatterns(p);
      for (const v of variants) compiled.push(v);
    }
    return compiled;
  }

  function updateBoardState() {
    // Fetch latest engine-provided structures
    board = ns.go.getBoardState();
    contested = ns.go.analysis.getControlledEmptyNodes();
    validMove = ns.go.analysis.getValidMoves(undefined, undefined, playAsWhite);
    validLibMoves = ns.go.analysis.getLiberties();
    chains = ns.go.analysis.getChains();

    // Setup sizes & empty caches
    const size = board[0].length;
    cache.size = size;
    cache.chainMembersMap.clear();
    cache.chainIdAt = Array.from({ length: size }, () => Array(size).fill(null));
    cache.chainValueAt = Array.from({ length: size }, () => Array(size).fill(0));
    cache.eyeValueAt = Array.from({ length: size }, () => Array(size).fill(0));
    cache.freeSpaceAt = Array.from({ length: size }, () => Array(size).fill(0));
    cache.surroundLibsAt = Array.from({ length: size }, () => Array(size).fill(0));
    cache.surroundLibSpreadAt = Array.from({ length: size }, () => Array(size).fill(0));
    cache.surroundSpaceAt = Array.from({ length: size }, () => Array(size).fill(0));
    cache.heatMapAt = Array.from({ length: size }, () => Array(size).fill(0));

    // Build chainMembersMap using engine's chains grid (chain Ids are numbers or null)
    for (let x = 0; x < size; x++) {
      for (let y = 0; y < size; y++) {
        const chainId = chains[x][y];
        cache.chainIdAt[x][y] = chainId;
        if (chainId === undefined || chainId === null) continue;
        const key = `${chainId}:${board[x][y]}`; // include stone color to avoid collisions
        if (!cache.chainMembersMap.has(key)) cache.chainMembersMap.set(key, new Set());
        cache.chainMembersMap.get(key).add(`${x},${y}`);
      }
    }
    // Fill chainValueAt per cell
    for (const [key, members] of cache.chainMembersMap.entries()) {
      const [cid, playerChar] = key.split(":");
      const sizeOfChain = members.size;
      for (const m of members) {
        const [cx, cy] = m.split(",").map(Number);
        cache.chainValueAt[cx][cy] = sizeOfChain;
      }
    }

    // compute surroundSpaceAt (# of '.' neighbors)
    for (let x = 0; x < size; x++) {
      for (let y = 0; y < size; y++) {
        let s = 0;
        forEachNeighbor(x, y, (nx, ny) => { if (board[nx][ny] === ".") s++; });
        cache.surroundSpaceAt[x][y] = s;
      }
    }

    // compute heatMapAt / simple local influence
    for (let x = 0; x < size; x++) {
      for (let y = 0; y < size; y++) {
        let c = 1;
        for (let dx = -2; dx <= 2; dx++) {
          for (let dy = -2; dy <= 2; dy++) {
            const nx = x + dx, ny = y + dy;
            if (nx >= 0 && nx < size && ny >= 0 && ny < size) {
              if (board[nx][ny] === me) c += 1.5;
              else if (board[nx][ny] === ".") c += 1;
            }
          }
        }
        cache.heatMapAt[x][y] = c;
      }
    }

    // compute surroundLibsAt (counts libs contributed by adjacents)
    for (let x = 0; x < size; x++) {
      for (let y = 0; y < size; y++) {
        // for each player compute libs from adjacents; we'll store for 'me' primarily but function getSurroundLibs will use validLibMoves grid directly
        // Here store for me by default (used by some heuristics)
        let s = 0;
        forEachNeighbor(x, y, (nx, ny) => {
          if (board[nx][ny] === ".") s++;
          else if (board[nx][ny] === me) {
            // validLibMoves gives liberties for that stone
            if (validLibMoves[nx][ny] !== undefined && validLibMoves[nx][ny] > 0) s += (validLibMoves[nx][ny] - 1);
          }
        });
        cache.surroundLibsAt[x][y] = s;
      }
    }

    // compute freeSpaceAt (small flood from position counting reachable '.' or same-player)
    for (let x = 0; x < size; x++) {
      for (let y = 0; y < size; y++) {
        cache.freeSpaceAt[x][y] = quickFloodFreeSpace(x, y);
      }
    }

    // compute eyeValueAt (approximate)
    for (let x = 0; x < size; x++) {
      for (let y = 0; y < size; y++) {
        cache.eyeValueAt[x][y] = quickFloodEyeValue(x, y, me);
      }
    }

    // compute surroundLibSpreadAt (simple)
    for (let x = 0; x < size; x++) {
      for (let y = 0; y < size; y++) {
        const coords = new Set([`${x},${y}`]);
        forEachNeighbor(x, y, (nx, ny) => { if (board[nx][ny] === '.') coords.add(`${nx},${ny}`); });
        let s = 0;
        for (const i of coords) {
          const [cx, cy] = i.split(",").map(Number);
          s += getSurroundLibs(cx, cy, me);
        }
        cache.surroundLibSpreadAt[x][y] = s;
      }
    }
  }

  // Quick bounded flood used by caches (safe & fast)
  function quickFloodFreeSpace(sx, sy) {
    const size = cache.size;
    if (sx < 0 || sy < 0 || sx >= size || sy >= size) return 0;
    const visited = new Set();
    const q = [[sx, sy]];
    visited.add(`${sx},${sy}`);
    let count = 0;
    while (q.length && count < 200) { // limit to avoid huge loops
      const [x, y] = q.pop();
      if (board[x][y] === ".") count++;
      forEachNeighbor(x, y, (nx, ny) => {
        if (!visited.has(`${nx},${ny}`) && (board[nx][ny] === "." || board[nx][ny] === "."))
        { visited.add(`${nx},${ny}`); q.push([nx, ny]); }
      });
    }
    return count;
  }

  function quickFloodEyeValue(checkx, checky, player) {
    const size = cache.size;
    if (checkx < 0 || checky < 0 || checkx >= size || checky >= size) return 0;
    const explored = new Set([`${checkx},${checky}`]);
    const toExplore = [[checkx, checky]];
    let count = 0;
    while (toExplore.length) {
      const [x,y] = toExplore.pop();
      if (board[x][y] === '.' || board[x][y] === player) count++;
      forEachNeighbor(x, y, (nx, ny) => {
        if (!explored.has(`${nx},${ny}`) && (board[nx][ny] === player || board[nx][ny] === '.')) {
          explored.add(`${nx},${ny}`); toExplore.push([nx, ny]);
        }
      });
    }
    return count;
  }

  // =================================================================================================
  //                                     SCORING FUNCTIONS (use caches)
  // =================================================================================================

  function getChainValueFromCache(checkx, checky, player) {
    // if stone at loc belongs to player, return chain size via cache.chainValueAt
    if (checkx < 0 || checky < 0 || checkx >= cache.size || checky >= cache.size) return 0;
    return cache.chainValueAt[checkx][checky] || 0;
  }

  function getChainMembersFromCache(checkx, checky, player) {
    const chainId = cache.chainIdAt[checkx][checky];
    const key = `${chainId}:${player}`;
    if (!cache.chainMembersMap.has(key)) return new Set();
    return cache.chainMembersMap.get(key);
  }

  function getChainLibertiesFromMembers(members) {
    const liberties = new Set();
    for (const m of members) {
      const [x, y] = m.split(',').map(Number);
      forEachNeighbor(x, y, (nx, ny) => {
        if (board[nx][ny] === '.') liberties.add(`${nx},${ny}`);
      });
    }
    return liberties;
  }

  function getSurroundLibs(x,y,p) {
    // Use engine-provided validLibMoves for precision mixed with cache
    let s = 0;
    forEachNeighbor(x, y, (nx, ny) => {
      if (board[nx][ny] === '.') s++;
      else if (board[nx][ny] === p && validLibMoves[nx][ny] !== undefined) s += Math.max(0, validLibMoves[nx][ny] - 1);
    });
    return s;
  }

  function getSurroundLibSpread(x, y, player) { return cache.surroundLibSpreadAt[x][y] || 0; }
  function getSurroundSpace(x, y) { return cache.surroundSpaceAt[x][y] || 0; }
  function getSurroundSpaceFull(x, y) { return cache.surroundSpaceAt[x][y] || 0; }
  function getFreeSpace(x,y) { return cache.freeSpaceAt[x][y] || 0; }
  function getEyeValue(x,y,p) { return cache.eyeValueAt[x][y] || 0; }
  function getEyeValueFull(x,y,p) {
    let c=0;
    for (let i=x-1;i<=x+1;i++) for (let j=y-1;j<=y+1;j++) if(i>=0&&i<cache.size&&j>=0&&j<cache.size&&board[i][j]===p) c++;
    return c;
  }
  function getChainAttack(x,y) {
    let c = 0;
    forEachNeighbor(x, y, (nx, ny) => { if (board[nx][ny] === you) c += getChainValueFromCache(nx, ny, you); });
    return c;
  }
  function getChainAttackFull(x,y) {
    let c = 0;
    for (let i = x-1; i <= x+1; i++) for (let j = y-1; j <= y+1; j++) {
      if (i>=0&&i<cache.size&&j>=0&&j<cache.size&&(i!==x||j!==y)&&board[i][j]===you) c += getChainValueFromCache(i,j,you);
    }
    return c;
  }
  function getSurroundEnemiesFull(x,y) { return getChainAttackFull(x,y); }
  function getHeatMap(x,y,p) { return cache.heatMapAt[x][y] || 1; }

  function createsLib(x, y, p) {
    // Original heuristic: if placing there links to a chain with 2 libs or converts neighbor into >2 libs - reuse but check with validLibMoves
    let c = false;
    forEachNeighbor(x, y, (nx, ny) => {
      if (nx>=0&&nx<cache.size&&ny>=0&&ny<cache.size && board[nx][ny] === p && validLibMoves[nx][ny] === 2) c = true;
    });
    if (c) return true;
    let h = false;
    forEachNeighbor(x, y, (nx, ny) => {
      if (nx>=0&&nx<cache.size&&ny>=0&&ny<cache.size && board[nx][ny] === p && validLibMoves[nx][ny] > 2) h = true;
    });
    return !h && c;
  }

  // --- Scorers (adapted to use caches) ---
  function scoreCounterLib(x, y) {
    const size = cache.size;
    let isAdjacentToMyDyingGroup = false;
    let isAdjacentToEnemyDyingGroup = false;
    forEachNeighbor(x, y, (cx, cy) => {
      if (board[cx][cy] === me && validLibMoves[cx][cy] === 1) isAdjacentToMyDyingGroup = true;
      if (board[cx][cy] === you && validLibMoves[cx][cy] === 1) isAdjacentToEnemyDyingGroup = true;
    });
    return (isAdjacentToMyDyingGroup && isAdjacentToEnemyDyingGroup) ? 100 : 0;
  }

  function scoreLibAttack(x, y, minKilled = 1) {
    if (contested[x][y] === me || validLibMoves[x][y] !== -1) return 0;
    let captureCount = 0;
    let chainsValue = 0;
    const checkedChains = new Set();
    forEachNeighbor(x, y, (cx, cy) => {
      if (board[cx][cy] === you && validLibMoves[cx][cy] === 1) {
        const chainId = cache.chainIdAt[cx][cy];
        const key = `${chainId}:${you}`;
        if (!checkedChains.has(key)) {
          captureCount++;
          chainsValue += getChainValueFromCache(cx, cy, you);
          checkedChains.add(key);
        }
      }
    });
    const enemyLibs = getSurroundLibs(x, y, you);
    if (captureCount === 0 || (chainsValue < minKilled && enemyLibs <= 1)) return 0;
    return captureCount * chainsValue * 1.0;
  }

  function scoreLibDefend(x, y, savedMin = 1) {
    if (validLibMoves[x][y] !== -1) return 0;
    const surround = getSurroundLibs(x, y, me);
    const myEyes = getEyeValue(x, y, me);
    if (surround + myEyes < 2) return 0;
    let savedChainValue = 0;
    const checkedChains = new Set();
    forEachNeighbor(x, y, (cx, cy) => {
      if (board[cx][cy] === me && validLibMoves[cx][cy] === 1) {
        const chainId = cache.chainIdAt[cx][cy];
        const key = `${chainId}:${me}`;
        if (!checkedChains.has(key)) { savedChainValue += getChainValueFromCache(cx, cy, me); checkedChains.add(key); }
      }
    });
    if (savedChainValue < savedMin) return 0;
    return savedChainValue * surround;
  }

  function scoreAggroAttack(x, y, libsMin, libsMax, minSurround, minChain = 1, minFreeSpace = 0) {
    if (createsLib(x, y, me)) return 0;
    let isAttack = false; let lowestLibs = 999;
    forEachNeighbor(x, y, (cx, cy) => {
      if (board[cx][cy] === you && validLibMoves[cx][cy] >= libsMin && validLibMoves[cx][cy] <= libsMax) {
        isAttack = true; if (validLibMoves[cx][cy] < lowestLibs) lowestLibs = validLibMoves[cx][cy];
      }
    });
    if (!isAttack || getSurroundLibs(x, y, me) < minSurround || getFreeSpace(x, y) < minFreeSpace) return 0;
    const chainAtk = getChainAttack(x, y);
    if (chainAtk < minChain) return 0;
    const eyeValue = Math.max(1, getEyeValue(x, y, you));
    return (getSurroundLibSpread(x, y, you) * chainAtk) / eyeValue / lowestLibs;
  }

  function scoreDefAttack(x, y, libsMin, libsMax, minSurround, minChain = 1, minFreeSpace = 0) {
    const aggroScore = scoreAggroAttack(x, y, libsMin, libsMax, minSurround, minChain, minFreeSpace);
    if (aggroScore === 0) return 0;
    return aggroScore * getSurroundLibs(x, y, me) * getHeatMap(x, y, me) * (getEyeValue(x, y, me) + 1);
  }

  function scoreExpand(x, y) {
    if (contested[x][y] !== "?" || createsLib(x, y, me) || getSurroundLibs(x, y, you) <= 1) return 0;
    let friendlyNeighbors = 0;
    forEachNeighbor(x, y, (nx, ny) => { if (board[nx][ny] === me) friendlyNeighbors++; });
    if (friendlyNeighbors >= 3 || friendlyNeighbors <= 0) return 0;
    return (getSurroundSpaceFull(x, y) + 1) * (getChainAttack(x, y) + 1) * (getEyeValueFull(x, y, me) + 1) * (getSurroundEnemiesFull(x, y) + 1) * getFreeSpace(x, y);
  }

  function scoreBolster(x, y, libRequired, savedNodesMin, onlyContested = true) {
    if ((onlyContested && contested[x][y] !== "?") || createsLib(x, y, me)) return 0;
    let totalValue = 0; let linkCount = 0; const checkedChains = new Set();
    forEachNeighbor(x, y, (cx, cy) => {
      if (board[cx][cy] === me && validLibMoves[cx][cy] === libRequired) {
        const chainId = cache.chainIdAt[cx][cy];
        const key = `${chainId}:${me}`;
        if (!checkedChains.has(key)) {
          const chainValue = getChainValueFromCache(cx, cy, me);
          if (chainValue >= savedNodesMin) { totalValue += chainValue; linkCount++; }
          checkedChains.add(key);
        }
      }
    });
    if (linkCount <= 0) return 0;
    return totalValue * linkCount * getSurroundLibSpread(x, y, me);
  }

  function scoreAttackGrowDragon(x, y, requiredEyes, killLib = false) {
    if (contested[x][y] !== "?" || createsLib(x, y, me)) return 0;
    if (getSurroundEnemiesFull(x, y) < 1 || getSurroundLibs(x, y, me) < 3) return 0;
    const enemyLibs = getSurroundLibs(x, y, you);
    if (enemyLibs === 1 && !killLib) return 0;
    if (getEyeValueFull(x, y, me) < requiredEyes) return 0;
    return enemyLibs * getChainAttackFull(x, y);
  }

  function scorePattern(x, y, patterns) {
    for (const pattern of patterns) { if (isPattern(x, y, pattern)) return 10; } return 0;
  }

  function scoreDisruptEyes(x, y) { return scorePattern(x, y, compiledPatterns.disrupt4.concat(compiledPatterns.disrupt5)); }
  function scoreDefPattern(x, y) { return scorePattern(x, y, compiledPatterns.def5); }

  function scoreRandomStrat(x, y) {
    if (!["?", you].includes(contested[x][y]) || createsLib(x, y, me)) return 0;
    const size = cache.size;
    const isSupport = (x > 0 && board[x - 1][y] === me) || (x < size - 1 && board[x + 1][y] === me) || (y > 0 && board[x][y - 1] === me) || (y < size - 1 && board[x][y + 1] === me);
    const isAttack = (x > 0 && board[x - 1][y] === you) || (x < size - 1 && board[x + 1][y] === you) || (y > 0 && board[x][y - 1] === you) || (y < size - 1 && board[x][y + 1] === you);
    if (isSupport || isAttack) return 2 + getSurroundSpace(x, y);
    return 1;
  }

  // --- Utility & pattern matching from original (adapted to use precompiled) ---
  function isPattern(x, y, pattern) {
    const size = cache.size + 2;
    // testBoard with walls: create temporary padded string array from board
    // We'll build testBoard lazily once per call (small overhead)
    const testBoard = [];
    const wall = "W".repeat(cache.size + 2);
    testBoard.push(wall);
    for (const row of board) testBoard.push("W" + row + "W");
    testBoard.push(wall);

    const patterns = getAllPatterns(pattern);
    const patternSize = pattern.length;
    for (const patternCheck of patterns) {
      for (let cx = ((patternSize - 1) * -1); cx <= 0; cx++) {
        if (cx + x + 1 < 0 || cx + x + 1 > size - 1) continue;
        for (let cy = ((patternSize - 1) * -1); cy <= 0; cy++) {
          if (cy + y + 1 < 0 || cy + y + 1 > size - 1) continue;
          let count = 0; let abort = false;
          for (let px = 0; px < patternSize && !abort; px++) {
            if (x + cx + px + 1 < 0 || x + cx + px + 1 >= size) { abort = true; break; }
            for (let py = 0; py < patternSize && !abort; py++) {
              if (y + cy + py + 1 < 0 || y + cy + py + 1 >= size) { abort = true; break; }
              const isMoveLocation = (cx + px === 0 && cy + py === 0);
              const patternChar = patternCheck[px][py];
              const boardChar = testBoard[cx + x + 1 + px][cy + y + 1 + py];
              let match = false;
              switch (patternChar) {
                case "X": match = (isMoveLocation && boardChar === '.') || boardChar === me; break;
                case "O": match = boardChar === you; break;
                case "x": match = [me, "."].includes(boardChar); break;
                case "o": match = [you, "."].includes(boardChar); break;
                case "?": match = true; break;
                case ".": match = boardChar === "."; break;
                case "*": match = isMoveLocation && boardChar === "."; break;
                case "W": match = ["W", "#"].includes(boardChar); break;
                case "B": match = ["W", "#", me].includes(boardChar); break;
                case "b": match = ["W", "#", you].includes(boardChar); break;
                case "A": match = ["W", "#", me, you].includes(boardChar); break;
              }
              if (match) count++; else abort = true;
            }
          }
          if (count === patternSize * patternSize) return true;
        }
      }
    }
    return false;
  }
  function getAllPatterns(p) { const p2 = rotate90Degrees(p), p3 = rotate90Degrees(p2), p4 = rotate90Degrees(p3), r = [p, p2, p3, p4]; return [...r, ...r.map(verticalMirror)]; }
  function rotate90Degrees(p) { return p.map((v, i) => p.map(r => r[i]).reverse().join("")); }
  function verticalMirror(p) { return p.slice().reverse(); }

  // =================================================================================================
  //                                     PLAYBOOKS DEFINITION (weights supported)
  // =================================================================================================
  const basePlaybook = [
    { name: 'Counter Lib', scorer: scoreCounterLib, weight: 1.2 },
    { name: 'Lib Attack (Kill)', scorer: scoreLibAttack, params: [88], weight: 3.0 },
    { name: 'Lib Defend', scorer: scoreLibDefend, weight: 2.0 },
    { name: 'Aggro Attack (2-lib)', scorer: scoreAggroAttack, params: [2, 2, 2], weight: 1.8 },
    { name: 'Disrupt Eyes', scorer: scoreDisruptEyes, weight: 1.6 },
    { name: 'Defensive Pattern', scorer: scoreDefPattern, weight: 1.1 },
    { name: 'Aggro Attack (3-lib)', scorer: scoreAggroAttack, params: [3, 3, 3, 1, 6], weight: 1.4 },
    { name: 'Bolster (2-lib)', scorer: scoreBolster, params: [2, 1], weight: 1.2 },
    { name: 'Aggro Attack (4-lib)', scorer: scoreAggroAttack, params: [4, 7, 3, 1, 6], weight: 1.2 },
    { name: 'Attack/Grow Dragon', scorer: scoreAttackGrowDragon, params: [1], weight: 1.5 },
    { name: 'Defensive Attack', scorer: scoreDefAttack, params: [8, 20, 2], weight: 1.3 },
    { name: 'Expand', scorer: scoreExpand, weight: 0.8 },
    { name: 'Bolster (1-lib)', scorer: scoreBolster, params: [2, 1, false, 1], weight: 1.0 },
    { name: 'Lib Attack (Any)', scorer: scoreLibAttack, weight: 2.0 },
    { name: 'Random Safe', scorer: scoreRandomStrat, weight: 0.3 },
  ];
  const playbooks = {
    "Netburners": basePlaybook,
    "The Black Hand": basePlaybook,
    "Slum Snakes": [...basePlaybook.slice(0, 9), { name: 'Defensive Attack (Slum)', scorer: scoreDefAttack, params: [4, 7, 3, 1, 6], weight: 1.6 }, ...basePlaybook.slice(10)],
    "Daedalus": [...basePlaybook.slice(0, 7), { name: 'Aggro Attack (Daedalus)', scorer: scoreAggroAttack, params: [3, 4, 3, 1, 6], weight: 1.7 }, ...basePlaybook.slice(8, 9), { name: 'Defensive Attack (Daedalus)', scorer: scoreDefAttack, params: [5, 7, 3, 2, 6], weight: 1.6 }, ...basePlaybook.slice(10)],
    "Tetrads": [...basePlaybook.slice(0, 7), { name: 'Aggro Attack (Tetrads-A)', scorer: scoreAggroAttack, params: [3, 4, 3], weight: 1.5 }, ...basePlaybook.slice(8, 9), { name: 'Aggro Attack (Tetrads-B)', scorer: scoreAggroAttack, params: [5, 7, 3], weight: 1.5 }, ...basePlaybook.slice(10)],
    "Illuminati": [...basePlaybook.slice(0, 7), { name: 'Aggro Attack (Illum)', scorer: scoreAggroAttack, params: [3, 4, 3], weight: 1.5 }, ...basePlaybook.slice(8, 10), ...basePlaybook.slice(11)],
    "????????????": basePlaybook,
    "default": basePlaybook
  };

  // =================================================================================================
  //                                     MOVE EVALUATION & SELECTION
  // =================================================================================================

  function getAllValidMoves() {
    const moves = [];
    for (let x = 0; x < cache.size; x++) for (let y = 0; y < cache.size; y++) if (validMove[x][y]) moves.push([x, y]);
    return shuffleArray(moves);
  }

  function evaluateAllMoves(currentPlaybook) {
    const scoredMoves = [];
    const moves = getAllValidMoves();
    for (const [x, y] of moves) {
      const moveData = { coords: [x, y], scores: {}, totalScore: 0, highestSingle: 0 };
      for (const strategy of currentPlaybook) {
        try {
          const score = strategy.scorer(x, y, ...(strategy.params || [])) || 0;
          const w = strategy.weight || WEIGHT_DEFAULT;
          moveData.scores[strategy.name] = score * w;
          moveData.totalScore += score * w;
          if (score * w > moveData.highestSingle) moveData.highestSingle = score * w;
        } catch (e) {
          moveData.scores[strategy.name] = 0;
        }
      }
      // penalties and safety adjustments
      if (createsLib(x, y, you)) moveData.totalScore *= OPPONENT_AVOID_LIB_PENALTY;
      // if placing reduces our liberties dangerously (heuristic: adjacent my stone with 1 lib) penalize
      let adjacentMyDying = false;
      forEachNeighbor(x, y, (nx, ny) => { if (board[nx][ny] === me && validLibMoves[nx][ny] === 1) adjacentMyDying = true; });
      if (adjacentMyDying) moveData.totalScore *= SELF_DANGEROUS_PENALTY;

      moveData.totalScore += Math.random() * 0.001; // tiny jitter to break ties
      scoredMoves.push(moveData);
    }
    return scoredMoves;
  }

  function selectBestMoveWeighted(scoredMoves) {
    if (!scoredMoves || scoredMoves.length === 0) return {};
    // pick move with maximal totalScore; tie-break on highestSingle, then random
    scoredMoves.sort((a, b) => {
      if (b.totalScore !== a.totalScore) return b.totalScore - a.totalScore;
      if (b.highestSingle !== a.highestSingle) return b.highestSingle - a.highestSingle;
      return Math.random() - 0.5;
    });
    const top = scoredMoves[0];
    return { coords: top.coords, msg: `WeightedPick (Score: ${top.totalScore.toFixed(2)})` };
  }

  // --- Cheats: snake eyes preserved, using existing helpers but referencing caches where possible ---
  function getSnakeEyes(minKilled = 6) {
    if (!CHEATS) return {};
    const moveOptions = []; let highValue = 1; const checked = new Set(); const size = cache.size;
    for (let x = 0; x < size; x++)
      for (let y = 0; y < size; y++) {
        if (contested[x][y] === me || board[x][y] !== you || validLibMoves[x][y] !== 2 || checked.has(`${x},${y}`)) continue;
        const chain = getChainValueFromCache(x, y, you); if (chain < minKilled) continue;
        const chainMembers = getChainMembersFromCache(x, y, you); const liberties = getChainLibertiesFromMembers(chainMembers);
        chainMembers.forEach(m => checked.add(m));
        if (liberties.size === 2) {
          const [move1, move2] = Array.from(liberties);
          const pair = [...move1, ...move2];
          if (chain > highValue) { highValue = chain; moveOptions.length = 0; moveOptions.push(pair); }
          else if (chain === highValue) { moveOptions.push(pair); }
        }
      }
    if (moveOptions.length === 0) return {};
    const randomIndex = Math.floor(Math.random() * moveOptions.length);
    return moveOptions[randomIndex] ? { coords: moveOptions[randomIndex], msg: "SnakeEyes Cheat" } : {};
  }

  // =================================================================================================
  //                                     MOVE EXECUTION
  // =================================================================================================

  async function movePiece(attack) {
    if (!attack.coords) return false;
    const [x, y] = attack.coords;
    if (x === undefined) return false;
    let mid = performance.now();
    ns.print(attack.msg);
    const results = await ns.go.makeMove(x, y, playAsWhite);
    let END = performance.now();
    if (LOGTIME) ns.printf("Time: Me: %s  Them: %s", ns.tFormat(mid - START, true), ns.tFormat(END - mid, true));
    START = performance.now();
    return results;
  }

  async function moveSnakeEyes(attack) {
    if (!attack.coords || !CHEATS) return false;
    const [s1x, s1y, s2x, s2y] = attack.coords;
    if (s1x === undefined) return false;
    try {
      const chance = ns.go.cheat.getCheatSuccessChance(undefined, playAsWhite);
      if (chance < 0.7) return false;
      let mid = performance.now();
      ns.print(attack.msg);
      const results = await ns.go.cheat.playTwoMoves(s1x, s1y, s2x, s2y, playAsWhite);
      let END = performance.now();
      if (LOGTIME) ns.printf("Time: Me: %s  Them: %s", ns.tFormat(mid - START, true), ns.tFormat(END - mid, true));
      START = performance.now();
      return results;
    } catch { return false; }
  }

  // =================================================================================================
  //                                     GAME CHECKS & OPENING
  // =================================================================================================

  function checkNewGame(gameInfo, passed) {
    if (gameInfo && (gameInfo.type === "gameOver" || (gameInfo.type === "pass" && passed))) {
      if (!REPEAT) ns.exit();

      opponentIndex++;
      if (opponentIndex >= OPPONENTS.length) {
        opponentIndex = 0;
        ns.print("=== Opponent cycle complete! Restarting with the first opponent. ===");
      }
      const nextOpponent = OPPONENTS[opponentIndex];
      ns.print(`--- GAME OVER, starting new game against: ${nextOpponent} ---`);
      ns.go.resetBoardState(nextOpponent, 9); // keep 9x9 default

      turn = 0;
      ns.clearLog();
    }
  }

  function getOpeningMove() {
    const size = cache.size;
    const o = size > 10 ? [2, 3, 4] : size > 7 ? [2, 3] : [2, 1];
    for (const offset of o) {
      const corners = [[offset, offset], [offset, size - 1 - offset], [size - 1 - offset, size - 1 - offset], [size - 1 - offset, offset]];
      for (const [x, y] of corners) if (validMove[x][y] && getSurroundSpace(x, y) === 4) return { coords: [x, y], msg: "Opening Move: Corner" };
    }
    const center = Math.floor(size / 2);
    return scoreRandomStrat(center, center) > 0 ? { coords: [center, center], msg: "Opening Move: Center" } : { coords: getAllValidMoves()[0], msg: "Opening Move: Random" };
  }

  // =================================================================================================
  //                                     MAIN SCRIPT EXECUTION
  // =================================================================================================

  // --- Initial Game State Check ---
  let inProgress = false;
  const startBoard = ns.go.getBoardState();
  for (let x = 0; x < startBoard[0].length; x++) {
    for (let y = 0; y < startBoard[0].length; y++) {
      if (startBoard[x][y] === me) {
        inProgress = true; turn = 3; break;
      }
    }
    if (inProgress) break;
  }
  ns.print("Playing as ", playAsWhite ? "White" : "Black");

  // --- This section now handles resuming from any opponent in the cycle ---
  const currentOpponentName = ns.go.getOpponent();
  const foundIndex = OPPONENTS.indexOf(currentOpponentName);
  if (foundIndex !== -1) {
    opponentIndex = foundIndex;
    ns.print(`Resuming game against current opponent: ${currentOpponentName}`);
  } else {
    ns.print(`Starting opponent cycle with: ${OPPONENTS[opponentIndex]}`);
    ns.go.resetBoardState(OPPONENTS[opponentIndex], 9);
  }

  checkNewGame(await ns.go.opponentNextTurn(false, playAsWhite), false);

  // --- Main Game Loop ---
  while (true) {
    await ns.sleep(4);
    turn++;
    updateBoardState();
    let results;
    let passed = false;

    const opponentName = ns.go.getOpponent();
    const playbook = playbooks[opponentName] || playbooks.default;

    if (turn <= 1) {
      results = await movePiece(getOpeningMove());
    } else {
      let moveFound = false;

      // try snake eyes if allowed
      const snakeEyesMove = getSnakeEyes(6);
      if (snakeEyesMove.coords) {
        results = await moveSnakeEyes(snakeEyesMove);
        if (results) moveFound = true;
      }

      if (!moveFound) {
        const allScoredMoves = evaluateAllMoves(playbook);
        const bestMove = selectBestMoveWeighted(allScoredMoves, playbook);
        if (bestMove.coords) {
          results = await movePiece(bestMove);
          if (results) moveFound = true;
        }
      }

      // If no strategic move was found, pass the turn.
      if (!moveFound) {
        ns.print("No strategic move found. Passing turn.");
        results = await ns.go.passTurn(playAsWhite);
        passed = true;
      }
    }
    checkNewGame(results, passed);
  }
}
