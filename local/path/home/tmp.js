/**
 * Fully optimized Go-playing script.
 * Original by: Sphyxis, Stoneware, gmcew
 * Refactored and Optimized by: Valoneu, EX0
 *
 * --- VERSION 4.1 (PERSISTENCE) ---
 * Removed logic that ended the game on a stalemate. The script will now pass its turn if no
 * productive move is found, allowing the game to continue until a natural win/loss state.
 * Changed default board size for new games to 9x9.
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
  let board, contested, validMove, validLibMoves, chains, testBoard;
  let START = performance.now();

  // --- Pattern Definitions ---
  const disrupt4 = [["??b?", "?b.b", "b.*b", "?bb?"],["?bb?", "b..b", "b*Xb", "?bb?"],["?bb?", "b..b", "b.*b", "?bb?"],["??b?", "?b.b", "?b*b", "??O?"],["?bbb", "bb.b", "W.*b", "?oO?"],["?bbb", "bb.b", "W.*b", "?Oo?"],[".bbb", "o*.b", ".bbb", "????"],]
  const disrupt5 = [["?bbb?", "b.*.b", "?bbb?", "?????", "?????"],["??OO?", "?b*.b", "?b..b", "??bb?", "?????"],["?????", "??bb?", "?b*Xb", "?boob", "??bb?"],["WWW??", "WWob?", "Wo*b?", "WWW??", "?????"],["??b??", "?b.b?", "?b*b?", "?b.A?", "??b??"],["??b??", "b.b?", "??*.b", "?b?b?", "?????"],["?WWW?", "WoOoW", "WOO*W", "W???W", "?????"],["?WWW?", "Wo*oW", "WOOOW", "W???W", "?????"],]
  const def5 = [["?WW??", "WW.X?", "W.XX?", "WWW??", "?????"],["WWW??", "WW.X?", "W.*X?", "WWW??", "?????"],["BBB??", "BB.X?", "B..X?", "BBB??", "?????"],["?WWW?", "W.*.W", "WXXXW", "?????", "?????"],]

  // =================================================================================================
  //                                     ALL HELPER & SCORING FUNCTIONS
  //               (Defined here, at the top, to avoid ReferenceError)
  // =================================================================================================

  function updateBoardState() {
    board = ns.go.getBoardState()
    contested = ns.go.analysis.getControlledEmptyNodes()
    validMove = ns.go.analysis.getValidMoves(undefined, undefined, playAsWhite)
    validLibMoves = ns.go.analysis.getLiberties()
    chains = ns.go.analysis.getChains()
    const size = board[0].length
    testBoard = []
    let testWall = "W".repeat(size + 2);
    testBoard.push(testWall)
    for (const b of board) testBoard.push("W" + b + "W")
    testBoard.push(testWall)
  }

  function evaluateAllMoves(currentPlaybook) {
    const scoredMoves = [];
    const moves = getAllValidMoves();
    for (const [x, y] of moves) {
      const moveData = { coords: [x, y], scores: {} };
      for (const strategy of currentPlaybook) {
        moveData.scores[strategy.name] = strategy.scorer(x, y, ...(strategy.params || []));
      }
      scoredMoves.push(moveData);
    }
    return scoredMoves;
  }

  function selectBestMove(scoredMoves, currentPlaybook) {
    for (const strategy of currentPlaybook) {
      let bestMoveForStrategy = null;
      let highestScore = 0;
      for (const move of scoredMoves) {
        const score = move.scores[strategy.name] || 0;
        if (score > highestScore) {
          highestScore = score;
          bestMoveForStrategy = {
            coords: move.coords,
            msg: `${strategy.name} (Score: ${highestScore.toFixed(2)})`
          };
        }
      }
      if (bestMoveForStrategy) return bestMoveForStrategy;
    }
    return {};
  }
  
  // --- SCORING FUNCTIONS ---

  function scoreCounterLib(x, y) {
    const size = board[0].length;
    let isAdjacentToMyDyingGroup = false;
    let isAdjacentToEnemyDyingGroup = false;
    const checkNeighbors = (cx, cy) => {
        if (cx > 0 && board[cx - 1][cy] === me && validLibMoves[cx - 1][cy] === 1) isAdjacentToMyDyingGroup = true;
        if (cx < size - 1 && board[cx + 1][cy] === me && validLibMoves[cx + 1][cy] === 1) isAdjacentToMyDyingGroup = true;
        if (cy > 0 && board[cx][cy - 1] === me && validLibMoves[cx][cy - 1] === 1) isAdjacentToMyDyingGroup = true;
        if (cy < size - 1 && board[cx][cy + 1] === me && validLibMoves[cx][cy + 1] === 1) isAdjacentToMyDyingGroup = true;
        if (cx > 0 && board[cx - 1][cy] === you && validLibMoves[cx - 1][cy] === 1) isAdjacentToEnemyDyingGroup = true;
        if (cx < size - 1 && board[cx + 1][cy] === you && validLibMoves[cx + 1][cy] === 1) isAdjacentToEnemyDyingGroup = true;
        if (cy > 0 && board[cx][cy - 1] === you && validLibMoves[cx][cy - 1] === 1) isAdjacentToEnemyDyingGroup = true;
        if (cy < size - 1 && board[cx][cy + 1] === you && validLibMoves[cx][cy + 1] === 1) isAdjacentToEnemyDyingGroup = true;
    };
    checkNeighbors(x, y);
    return (isAdjacentToMyDyingGroup && isAdjacentToEnemyDyingGroup) ? 100 : 0;
  }

  function scoreLibAttack(x, y, minKilled = 1) {
    if (contested[x][y] === me || validLibMoves[x][y] !== -1) return 0;
    const size = board[0].length;
    let captureCount = 0;
    let chainsValue = 0;
    const checkedChains = new Set();
    const check = (cx, cy) => {
        if (board[cx][cy] === you && validLibMoves[cx][cy] === 1) {
            const chainId = chains[cx][cy];
            if (!checkedChains.has(chainId)) {
                captureCount++;
                chainsValue += getChainValue(cx, cy, you);
                checkedChains.add(chainId);
            }
        }
    };
    if (x > 0) check(x - 1, y); if (x < size - 1) check(x + 1, y); if (y > 0) check(x, y - 1); if (y < size - 1) check(x, y + 1);
    const enemyLibs = getSurroundLibs(x, y, you);
    if (captureCount === 0 || (chainsValue < minKilled && enemyLibs <= 1)) return 0;
    return captureCount * chainsValue;
  }
  
  function scoreLibDefend(x, y, savedMin = 1) {
    if (validLibMoves[x][y] !== -1) return 0;
    const surround = getSurroundLibs(x, y, me);
    const myEyes = getEyeValue(x, y, me);
    if (surround + myEyes < 2) return 0;
    const size = board[0].length;
    let savedChainValue = 0;
    const checkedChains = new Set();
    const check = (cx, cy) => {
        if (board[cx][cy] === me && validLibMoves[cx][cy] === 1) {
            const chainId = chains[cx][cy];
            if (!checkedChains.has(chainId)) { savedChainValue += getChainValue(cx, cy, me); checkedChains.add(chainId); }
        }
    };
    if (x > 0) check(x - 1, y); if (x < size - 1) check(x + 1, y); if (y > 0) check(x, y - 1); if (y < size - 1) check(x, y + 1);
    if (savedChainValue < savedMin) return 0;
    return savedChainValue * surround;
  }

  function scoreAggroAttack(x, y, libsMin, libsMax, minSurround, minChain = 1, minFreeSpace = 0) {
      if (createsLib(x, y, me)) return 0;
      const size = board[0].length;
      let isAttack = false; let lowestLibs = 999;
      const check = (cx, cy) => {
          if (board[cx][cy] === you && validLibMoves[cx][cy] >= libsMin && validLibMoves[cx][cy] <= libsMax) {
              isAttack = true; if (validLibMoves[cx][cy] < lowestLibs) lowestLibs = validLibMoves[cx][cy];
          }
      };
      if (x > 0) check(x - 1, y); if (x < size - 1) check(x + 1, y); if (y > 0) check(x, y - 1); if (y < size - 1) check(x, y + 1);
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
    const size = board[0].length; let friendlyNeighbors = 0;
    if (x > 0 && board[x - 1][y] === me) friendlyNeighbors++; if (x < size - 1 && board[x + 1][y] === me) friendlyNeighbors++;
    if (y > 0 && board[x][y - 1] === me) friendlyNeighbors++; if (y < size - 1 && board[x][y + 1] === me) friendlyNeighbors++;
    if (friendlyNeighbors >= 3 || friendlyNeighbors <= 0) return 0;
    return (getSurroundSpaceFull(x, y) + 1) * (getChainAttack(x, y) + 1) * (getEyeValueFull(x, y, me) + 1) * (getSurroundEnemiesFull(x, y) + 1) * getFreeSpace(x, y);
  }

  function scoreBolster(x, y, libRequired, savedNodesMin, onlyContested = true) {
      if ((onlyContested && contested[x][y] !== "?") || createsLib(x, y, me)) return 0;
      const size = board[0].length; let totalValue = 0; let linkCount = 0; const checkedChains = new Set();
      const check = (cx, cy) => {
          if (board[cx][cy] === me && validLibMoves[cx][cy] === libRequired) {
              const chainId = chains[cx][cy];
              if (!checkedChains.has(chainId)) {
                  const chainValue = getChainValue(cx, cy, me);
                  if (chainValue >= savedNodesMin) { totalValue += chainValue; linkCount++; }
                  checkedChains.add(chainId);
              }
          }
      };
      if (x > 0) check(x - 1, y); if (x < size - 1) check(x + 1, y); if (y > 0) check(x, y - 1); if (y < size - 1) check(x, y + 1);
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
  
  function scoreDisruptEyes(x, y) { return scorePattern(x, y, [...disrupt4, ...disrupt5]); }
  function scoreDefPattern(x, y) { return scorePattern(x, y, def5); }
  function scoreRandomStrat(x, y) {
      if (!["?", you].includes(contested[x][y]) || createsLib(x, y, me)) return 0;
      const size = board[0].length;
      const isSupport = (x > 0 && board[x - 1][y] === me) || (x < size - 1 && board[x + 1][y] === me) || (y > 0 && board[x][y - 1] === me) || (y < size - 1 && board[x][y + 1] === me);
      const isAttack = (x > 0 && board[x - 1][y] === you) || (x < size - 1 && board[x + 1][y] === you) || (y > 0 && board[x][y - 1] === you) || (y < size - 1 && board[x][y + 1] === you);
      if (isSupport || isAttack) return 2 + getSurroundSpace(x, y);
      return 1;
  }
  
  // --- UTILITY FUNCTIONS ---
  
  async function movePiece(attack) {
    if (!attack.coords) return false
    const [x, y] = attack.coords
    if (x === undefined) return false
    let mid = performance.now()
    ns.print(attack.msg);
    const results = await ns.go.makeMove(x, y, playAsWhite)
    let END = performance.now()
    if (LOGTIME) ns.printf("Time: Me: %s  Them: %s", ns.tFormat(mid - START, true), ns.tFormat(END - mid, true))
    START = performance.now()
    return results
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

  function checkNewGame(gameInfo, passed) {
    if (gameInfo && (gameInfo.type === "gameOver" || (gameInfo.type === "pass" && passed))) {
      if (!REPEAT) ns.exit()
      
      opponentIndex++;
      if (opponentIndex >= OPPONENTS.length) {
        opponentIndex = 0;
        ns.print("=== Opponent cycle complete! Restarting with the first opponent. ===");
      }
      const nextOpponent = OPPONENTS[opponentIndex];
      ns.print(`--- GAME OVER, starting new game against: ${nextOpponent} ---`);
      ns.go.resetBoardState(nextOpponent, 9); // <-- CHANGED board size to 9
      
      turn = 0
      ns.clearLog()
    }
  }

  function getAllValidMoves() {
    let moves = []
    for (let x = 0; x < board[0].length; x++) {
      for (let y = 0; y < board[0].length; y++) {
        if (validMove[x][y]) {
          moves.push([x, y])
        }
      }
    }
    return moves.sort(() => Math.random() - 0.5);
  }

  function isPattern(x, y, pattern) {
    const size = testBoard[0].length; const patterns = getAllPatterns(pattern); const patternSize = pattern.length;
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
                            case "O": match = boardChar === you; break; case "x": match = [me, "."].includes(boardChar); break;
                            case "o": match = [you, "."].includes(boardChar); break; case "?": match = true; break;
                            case ".": match = boardChar === "."; break; case "*": match = isMoveLocation && boardChar === "."; break;
                            case "W": match = ["W", "#"].includes(boardChar); break; case "B": match = ["W", "#", me].includes(boardChar); break;
                            case "b": match = ["W", "#", you].includes(boardChar); break; case "A": match = ["W", "#", me, you].includes(boardChar); break;
                        } if(match) count++; else abort = true;
                    }
                } if (count === patternSize * patternSize) return true;
            }
        }
    } return false;
  }
  function getAllPatterns(p) { const p2=rotate90Degrees(p),p3=rotate90Degrees(p2),p4=rotate90Degrees(p3),r=[p,p2,p3,p4];return[...r,...r.map(verticalMirror)]; }
  function rotate90Degrees(p) { return p.map((v,i) => p.map(r => r[i]).reverse().join("")); }
  function verticalMirror(p) { return p.slice().reverse(); }
  function getSnakeEyes(minKilled = 6) {
    if (!CHEATS) return {}
    const moveOptions = []; let highValue = 1; const checked = new Set(); const size = board[0].length;
    for (let x = 0; x < size; x++)
      for (let y = 0; y < size; y++) {
        if (contested[x][y] === me || board[x][y] !== you || validLibMoves[x][y] !== 2 || checked.has(`${x},${y}`)) continue
        const chain = getChainValue(x, y, you); if (chain < minKilled) continue
        const chainMembers = getChainMembers(x, y, you); const liberties = getChainLiberties(chainMembers);
        chainMembers.forEach(m => checked.add(m));
        if (liberties.size === 2) {
          const [move1, move2] = Array.from(liberties);
            if (chain > highValue) { highValue = chain; moveOptions.length = 0; moveOptions.push([...move1, ...move2]); } 
            else if (chain === highValue) { moveOptions.push([...move1, ...move2]); }
        }
      }
    const randomIndex = Math.floor(Math.random() * moveOptions.length)
    return moveOptions[randomIndex] ? { coords: moveOptions[randomIndex], msg: "SnakeEyes Cheat" } : {}
  }
  function getChainMembers(startX, startY, player) {
      const explored = new Set(); const toExplore = [`${startX},${startY}`]; const members = new Set();
      while(toExplore.length > 0) {
          const currentPos = toExplore.pop(); if(explored.has(currentPos)) continue;
          explored.add(currentPos); const [x, y] = currentPos.split(',').map(Number);
          if (board[x][y] !== player) continue; members.add(`${x},${y}`);
          [[x-1, y], [x+1, y], [x, y-1], [x, y+1]].forEach(([nx, ny]) => {
              if (nx >= 0 && nx < board.length && ny >= 0 && ny < board.length) { toExplore.push(`${nx},${ny}`); }
          });
      } return members;
  }
  function getChainLiberties(chainMembers) {
      const liberties = new Set();
      chainMembers.forEach(member => {
          const [x, y] = member.split(',').map(Number);
          [[x-1, y], [x+1, y], [x, y-1], [x, y+1]].forEach(([nx, ny]) => {
              if (nx >= 0 && nx < board.length && ny >= 0 && ny < board.length && board[nx][ny] === '.') { liberties.add([nx, ny]); }
          });
      }); return liberties;
  }
  function getChainValue(checkx, checky, player) { return getChainMembers(checkx, checky, player).size; }
  function getEyeValue(checkx, checky, player) {
    const size = board[0].length; let count = 0; const explored = new Set([`${checkx},${checky}`]); const toExplore = [`${checkx},${checky}`];
    while(toExplore.length > 0) {
        const [x,y] = toExplore.pop().split(',').map(Number);
        if(board[x][y] === '.' || board[x][y] === player) count++;
        [[x-1,y],[x+1,y],[x,y-1],[x,y+1]].forEach(([nx,ny]) => {
            if(nx >=0 && nx < size && ny >=0 && ny < size && !explored.has(`${nx},${ny}`) && (board[nx][ny] === player || board[nx][ny] === '.')) {
                explored.add(`${nx},${ny}`); toExplore.push(`${nx},${ny}`);
            }
        });
    } return count;
  }
  function getFreeSpace(cx, cy) { return getEyeValue(cx, cy, '.'); }
  function getEyeValueFull(cx,cy, p) { let c=0; for(let x=cx-1;x<=cx+1;x++) for(let y=cy-1;y<=cy+1;y++) if(x>=0&&x<board.length&&y>=0&&y<board.length&&board[x][y]===p) c++; return c; }
  function getChainAttack(x, y) { let c = 0; [[x-1,y],[x+1,y],[x,y-1],[x,y+1]].forEach(([nx,ny]) => { if(nx>=0&&nx<board.length&&ny>=0&&ny<board.length&&board[nx][ny]===you) c+=getChainValue(nx,ny,you); }); return c; }
  function getChainAttackFull(x, y) { let c=0;for(let i=x-1;i<=x+1;i++)for(let j=y-1;j<=y+1;j++)if(i>=0&&i<board.length&&j>=0&&j<board.length&&(i!==x||j!==y)&&board[i][j]===you) c+=getChainValue(i,j,you); return c; }
  function getSurroundSpace(x,y) { let s=0;[[x-1,y],[x+1,y],[x,y-1],[x,y+1]].forEach(([nx,ny])=>{if(nx>=0&&nx<board.length&&ny>=0&&ny<board.length&&board[nx][ny]==='.')s++;}); return s; }
  function getSurroundSpaceFull(sx,sy,p=me,d=1) { let s=0;for(let x=sx-d;x<=sx+d;x++)for(let y=sy-d;y<=sy+d;y++)if(x>=0&&x<board.length&&y>=0&&y<board.length&&[".",p].includes(board[x][y])) s++; return s; }
  function getHeatMap(sx,sy,p=me,d=2) { let c=1;for(let x=sx-d;x<=sx+d;x++)for(let y=sy-d;y<=sy+d;y++)if(x>=0&&x<board.length&&y>=0&&y<board.length)c+=board[x][y]===p?1.5:board[x][y]==="."?1:0; return c; }
  function getSurroundLibs(x,y,p) { let s=0;[[x-1,y],[x+1,y],[x,y-1],[x,y+1]].forEach(([nx,ny])=>{if(nx>=0&&nx<board.length&&ny>=0&&ny<board.length){if(board[nx][ny]==='.')s++;else if(board[nx][ny]===p)s+=validLibMoves[nx][ny]-1;}}); return s; }
  function getSurroundLibSpread(x, y, player) { const c=new Set([`${x},${y}`]);[[x-1,y],[x+1,y],[x,y-1],[x,y+1]].forEach(([nx,ny])=>{if(nx>=0&&nx<board.length&&ny>=0&&ny<board.length&&board[nx][ny]==='.')c.add(`${nx},${ny}`);});let s=0;for(const i of c){const[cx,cy]=i.split(',').map(Number);s+=getSurroundLibs(cx,cy,player);}return s; }
  function getSurroundEnemiesFull(x, y) { return getChainAttackFull(x, y); }
  function createsLib(x, y, p) { let c=false;[[x-1,y],[x+1,y],[x,y-1],[x,y+1]].forEach(([nx,ny])=>{if(nx>=0&&nx<board.length&&ny>=0&&ny<board.length&&board[nx][ny]===p&&validLibMoves[nx][ny]===2)c=true;});if(c)return true;let h=false;[[x-1,y],[x+1,y],[x,y-1],[x,y+1]].forEach(([nx,ny])=>{if(nx>=0&&nx<board.length&&ny>=0&&ny<board.length&&board[nx][ny]===p&&validLibMoves[nx][ny]>2)h=true;});return!h&&c; }
  function getOpeningMove() {
      const size = board[0].length; const o = size > 10 ? [2,3,4] : size > 7 ? [2,3] : [2,1];
      for(const offset of o) {
          const corners = [[offset,offset],[offset,size-1-offset],[size-1-offset,size-1-offset],[size-1-offset,offset]];
          for(const [x,y] of corners) if(validMove[x][y] && getSurroundSpace(x,y)===4) return {coords:[x,y],msg:"Opening Move: Corner"};
      }
      const center = Math.floor(size/2);
      return scoreRandomStrat(center, center) > 0 ? { coords: [center, center], msg: "Opening Move: Center" } : { coords: getAllValidMoves()[0], msg: "Opening Move: Random" };
  }

  // =================================================================================================
  //                                     PLAYBOOKS DEFINITION
  // =================================================================================================
  const basePlaybook = [
      { name: 'Counter Lib', scorer: scoreCounterLib }, { name: 'Lib Attack (Kill)', scorer: scoreLibAttack, params: [88] },
      { name: 'Lib Defend', scorer: scoreLibDefend }, { name: 'Aggro Attack (2-lib)', scorer: scoreAggroAttack, params: [2, 2, 2] },
      { name: 'Disrupt Eyes', scorer: scoreDisruptEyes }, { name: 'Defensive Pattern', scorer: scoreDefPattern },
      { name: 'Aggro Attack (3-lib)', scorer: scoreAggroAttack, params: [3, 3, 3, 1, 6] }, { name: 'Bolster (2-lib)', scorer: scoreBolster, params: [2, 1] },
      { name: 'Aggro Attack (4-lib)', scorer: scoreAggroAttack, params: [4, 7, 3, 1, 6] }, { name: 'Attack/Grow Dragon', scorer: scoreAttackGrowDragon, params: [1] },
      { name: 'Defensive Attack', scorer: scoreDefAttack, params: [8, 20, 2] }, { name: 'Expand', scorer: scoreExpand },
      { name: 'Bolster (1-lib)', scorer: scoreBolster, params: [2, 1, false, 1] }, { name: 'Lib Attack (Any)', scorer: scoreLibAttack },
      { name: 'Random Safe', scorer: scoreRandomStrat },
  ];
  const playbooks = {
      "Netburners": basePlaybook, "The Black Hand": basePlaybook,
      "Slum Snakes": [...basePlaybook.slice(0, 9),{ name: 'Defensive Attack (Slum)', scorer: scoreDefAttack, params: [4, 7, 3, 1, 6] },...basePlaybook.slice(10)],
      "Daedalus": [...basePlaybook.slice(0, 7),{ name: 'Aggro Attack (Daedalus)', scorer: scoreAggroAttack, params: [3, 4, 3, 1, 6] },...basePlaybook.slice(8, 9),{ name: 'Defensive Attack (Daedalus)', scorer: scoreDefAttack, params: [5, 7, 3, 2, 6] },...basePlaybook.slice(10)],
      "Tetrads": [...basePlaybook.slice(0, 7),{ name: 'Aggro Attack (Tetrads-A)', scorer: scoreAggroAttack, params: [3, 4, 3] },...basePlaybook.slice(8, 9),{ name: 'Aggro Attack (Tetrads-B)', scorer: scoreAggroAttack, params: [5, 7, 3] },...basePlaybook.slice(10)],
      "Illuminati": [...basePlaybook.slice(0, 7),{ name: 'Aggro Attack (Illum)', scorer: scoreAggroAttack, params: [3, 4, 3] },...basePlaybook.slice(8, 10),...basePlaybook.slice(11)],
      "????????????": basePlaybook, "default": basePlaybook
  };

  // =================================================================================================
  //                                     MAIN SCRIPT EXECUTION
  // =================================================================================================
  
  // --- Initial Game State Check ---
  let inProgress = false
  const startBoard = ns.go.getBoardState()
  for (let x = 0; x < startBoard[0].length; x++) {
    for (let y = 0; y < startBoard[0].length; y++) {
      if (startBoard[x][y] === me) {
        inProgress = true; turn = 3; break;
      }
    } if (inProgress) break;
  }
  ns.print("Playing as ", playAsWhite ? "White" : "Black")
  
  // --- This section now handles resuming from any opponent in the cycle ---
  const currentOpponentName = ns.go.getOpponent();
  const foundIndex = OPPONENTS.indexOf(currentOpponentName);
  if (foundIndex !== -1) {
    opponentIndex = foundIndex;
    ns.print(`Resuming game against current opponent: ${currentOpponentName}`);
  } else {
    ns.print(`Starting opponent cycle with: ${OPPONENTS[opponentIndex]}`);
    ns.go.resetBoardState(OPPONENTS[opponentIndex], 9); // <-- CHANGED board size to 9
  }

  checkNewGame(await ns.go.opponentNextTurn(false, playAsWhite), false)

  // --- Main Game Loop ---
  while (true) {
    await ns.sleep(4)
    let passed = false
    turn++
    updateBoardState();
    let results;

    const opponentName = ns.go.getOpponent();
    const playbook = playbooks[opponentName] || playbooks.default;

    if (turn <= 1) {
      results = await movePiece(getOpeningMove())
    } else {
      let moveFound = false;
      const snakeEyesMove = getSnakeEyes(6);
      if (snakeEyesMove.coords) {
        results = await moveSnakeEyes(snakeEyesMove);
        if (results) moveFound = true;
      }

      if (!moveFound) {
        const allScoredMoves = evaluateAllMoves(playbook);
        const bestMove = selectBestMove(allScoredMoves, playbook);
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