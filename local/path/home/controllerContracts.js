/** @param {NS} ns */
export async function main(ns) {
	ns.disableLog("ALL");
	ns.ui.openTail();
	while (true) {
		await attemptAllContracts(ns);
		await ns.sleep(5 * 60 * 1000);
	}
}

/** @param {NS} ns */
export async function attemptAllContracts(ns) {
	const contracts = getContracts(ns);
	if (contracts.length > 0) {
		ns.print(`Found ${contracts.length} contracts.`);
	}
	for (const contract of contracts) {
		await attemptContract(ns, contract);
	}
}

/** @param {NS} ns */
export function getContracts(ns) {
	const allServers = ["home"];
	for (const server of allServers) {
		ns.scan(server).forEach((s) => !allServers.includes(s) && allServers.push(s));
	}

	return allServers.flatMap((host) =>
		ns.ls(host, ".cct").map((file) => ({
			host: host,
			file: file,
			type: ns.codingcontract.getContractType(file, host),
		}))
	);
}

/** @param {NS} ns */
export async function attemptContract(ns, contract) {
	const solver = solvers[contract.type];
	if (!solver) {
		return ns.print(`WARNING: No solver for "${contract.type}" on ${contract.host}`);
	}

	ns.print(`INFO: Attempting "${contract.type}" on ${contract.host}`);
	const data = ns.codingcontract.getData(contract.file, contract.host);
	const solution = solver(data);

	if (solution !== null && solution !== undefined) {
		const reward = ns.codingcontract.attempt(solution, contract.file, contract.host, { returnReward: true });
		if (reward) {
			ns.print(`SUCCESS: ${reward}`);
		} else {
			ns.print(`FAIL: Incorrect solution for "${contract.type}" on ${contract.host}.`);
		}
	} else {
		ns.print(`ERROR: Solver for "${contract.type}" returned null or undefined.`);
	}
}

export const solvers = {
	"Algorithmic Stock Trader I": (data) => {
		let maxCur = 0,
			maxSoFar = 0;
		for (let i = 1; i < data.length; ++i) {
			maxCur = Math.max(0, (maxCur += data[i] - data[i - 1]));
			maxSoFar = Math.max(maxCur, maxSoFar);
		}
		return maxSoFar;
	},

	"Algorithmic Stock Trader II": (data) => {
		let profit = 0;
		for (let p = 1; p < data.length; ++p) {
			profit += Math.max(data[p] - data[p - 1], 0);
		}
		return profit;
	},

	"Algorithmic Stock Trader III": (data) => {
		let hold1 = -Infinity,
			hold2 = -Infinity;
		let release1 = 0,
			release2 = 0;
		for (const price of data) {
			release2 = Math.max(release2, hold2 + price);
			hold2 = Math.max(hold2, release1 - price);
			release1 = Math.max(release1, hold1 + price);
			hold1 = Math.max(hold1, -price);
		}
		return release2;
	},

	"Algorithmic Stock Trader IV": (data) => {
		const k = data[0],
			prices = data[1];
		if (k === 0 || prices.length < 2) return 0;
		if (k >= prices.length / 2) {
			let profit = 0;
			for (let i = 1; i < prices.length; i++) {
				profit += Math.max(0, prices[i] - prices[i - 1]);
			}
			return profit;
		}
		const hold = Array(k + 1).fill(-Infinity);
		const rele = Array(k + 1).fill(0);
		for (const price of prices) {
			for (let j = k; j > 0; j--) {
				rele[j] = Math.max(rele[j], hold[j] + price);
				hold[j] = Math.max(hold[j], rele[j - 1] - price);
			}
		}
		return rele[k];
	},

	"Array Jumping Game": (data) => {
		let maxReach = 0;
		for (let i = 0; i < data.length; i++) {
			if (i > maxReach) return 0;
			maxReach = Math.max(maxReach, i + data[i]);
		}
		return 1;
	},

	"Array Jumping Game II": (data) => {
		if (data.length <= 1) return 0;
		let jumps = 0,
			currentEnd = 0,
			farthest = 0;

		for (let i = 0; i < data.length - 1; i++) {
			farthest = Math.max(farthest, i + data[i]);

			if (i === currentEnd) {
				if (!(farthest > i)) return 0;
				jumps++;
				currentEnd = farthest;
			}
		}
		return currentEnd >= data.length - 1 ? jumps : 0;
	},

	"Unique Paths in a Grid I": (data) => {
		const [m, n] = data;
		const dp = Array(n).fill(1);
		for (let i = 1; i < m; i++) {
			for (let j = 1; j < n; j++) {
				dp[j] += dp[j - 1];
			}
		}
		return dp[n - 1];
	},

	"Merge Overlapping Intervals": (data) => {
		if (!data.length) return [];
		data.sort((a, b) => a[0] - b[0]);
		const merged = [data[0]];
		for (let i = 1; i < data.length; i++) {
			const last = merged[merged.length - 1];
			if (data[i][0] <= last[1]) {
				last[1] = Math.max(last[1], data[i][1]);
			} else {
				merged.push(data[i]);
			}
		}
		return merged;
	},

	"Generate IP Addresses": (data) => {
		const result = [];
		for (let a = 1; a <= 3; a++)
			for (let b = 1; b <= 3; b++)
				for (let c = 1; c <= 3; c++)
					for (let d = 1; d <= 3; d++) {
						if (a + b + c + d !== data.length) continue;
						const A = data.substring(0, a);
						const B = data.substring(a, a + b);
						const C = data.substring(a + b, a + b + c);
						const D = data.substring(a + b + c);
						const parts = [A, B, C, D];
						if (parts.every((p) => p.length > 0 && (p.length === 1 || p[0] !== "0") && parseInt(p) <= 255)) {
							result.push(parts.join("."));
						}
					}
		return result;
	},

	"Sanitize Parentheses in Expression": (data) => {
		// This is a complex DFS solution. It's kept as is for correctness and readability.
		let left = 0,
			right = 0;
		const res = [];
		for (const char of data) {
			if (char === "(") left++;
			else if (char === ")") {
				left > 0 ? left-- : right++;
			}
		}
		function dfs(pair, index, left, right, s, solution, res) {
			if (s.length === index) {
				if (left === 0 && right === 0 && pair === 0) {
					if (!res.includes(solution)) res.push(solution);
				}
				return;
			}
			if (s[index] === "(") {
				if (left > 0) dfs(pair, index + 1, left - 1, right, s, solution, res);
				dfs(pair + 1, index + 1, left, right, s, solution + s[index], res);
			} else if (s[index] === ")") {
				if (right > 0) dfs(pair, index + 1, left, right - 1, s, solution, res);
				if (pair > 0) dfs(pair - 1, index + 1, left, right, s, solution + s[index], res);
			} else {
				dfs(pair, index + 1, left, right, s, solution + s[index], res);
			}
		}
		dfs(0, 0, left, right, data, "", res);
		return res;
	},

	"Unique Paths in a Grid II": (data) => {
		const m = data.length,
			n = data[0].length;
		if (data[0][0] === 1 || data[m - 1][n - 1] === 1) return 0;
		const dp = Array(n).fill(0);
		dp[0] = 1;
		for (let i = 0; i < m; i++) {
			for (let j = 0; j < n; j++) {
				if (data[i][j] === 1) {
					dp[j] = 0;
				} else if (j > 0) {
					dp[j] += dp[j - 1];
				}
			}
		}
		return dp[n - 1];
	},

	"Find Largest Prime Factor": (data) => {
		let n = data;
		let factor = 2;
		while (n > 1) {
			if (n % factor === 0) {
				n /= factor;
			} else {
				factor++;
			}
		}
		return factor;
	},

	"Subarray with Maximum Sum": (data) => {
		if (data.length === 0) return 0;
		let maxSoFar = data[0];
		let maxEndingHere = data[0];
		for (let i = 1; i < data.length; i++) {
			maxEndingHere = Math.max(data[i], maxEndingHere + data[i]);
			maxSoFar = Math.max(maxSoFar, maxEndingHere);
		}
		return maxSoFar;
	},

	"Total Ways to Sum": (data) => {
		const ways = Array(data + 1).fill(0);
		ways[0] = 1;
		for (let i = 1; i < data; i++) {
			for (let j = i; j <= data; j++) {
				ways[j] += ways[j - i];
			}
		}
		return ways[data];
	},

	"Total Ways to Sum II": (data) => {
		const [target, coins] = data;
		const ways = Array(target + 1).fill(0);
		ways[0] = 1;
		for (const coin of coins) {
			for (let i = coin; i <= target; i++) {
				ways[i] += ways[i - coin];
			}
		}
		return ways[target];
	},

	"Find All Valid Math Expressions": (data) => {
		// Complex recursive solution, kept for correctness.
		const [num, target] = data;
		const result = [];
		function helper(path, pos, evaluated, multed) {
			if (pos === num.length) {
				if (target === evaluated) result.push(path);
				return;
			}
			for (let i = pos; i < num.length; ++i) {
				if (i != pos && num[pos] == "0") break;
				const cur = parseInt(num.substring(pos, i + 1));
				if (pos === 0) {
					helper(path + cur, i + 1, cur, cur);
				} else {
					helper(path + "+" + cur, i + 1, evaluated + cur, cur);
					helper(path + "-" + cur, i + 1, evaluated - cur, -cur);
					helper(path + "*" + cur, i + 1, evaluated - multed + multed * cur, multed * cur);
				}
			}
		}
		helper("", 0, 0, 0);
		return result;
	},

	"Spiralize Matrix": (data) => {
		const result = [];
		let top = 0,
			bottom = data.length - 1,
			left = 0,
			right = data[0].length - 1;
		while (top <= bottom && left <= right) {
			for (let i = left; i <= right; i++) result.push(data[top][i]);
			top++;
			for (let i = top; i <= bottom; i++) result.push(data[i][right]);
			right--;
			if (top <= bottom) {
				for (let i = right; i >= left; i--) result.push(data[bottom][i]);
				bottom--;
			}
			if (left <= right) {
				for (let i = bottom; i >= top; i--) result.push(data[i][left]);
				left++;
			}
		}
		return result;
	},

	"Minimum Path Sum in a Triangle": (data) => {
		for (let i = data.length - 2; i >= 0; i--) {
			for (let j = 0; j < data[i].length; j++) {
				data[i][j] += Math.min(data[i + 1][j], data[i + 1][j + 1]);
			}
		}
		return data[0][0];
	},

	"Shortest Path in a Grid": (data) => {
		// BFS solution, kept for correctness.
		const m = data.length,
			n = data[0].length;
		if (data[0][0] === 1 || data[m - 1][n - 1] === 1) return "";
		const queue = [[0, 0, ""]];
		const visited = Array.from({ length: m }, () => Array(n).fill(false));
		visited[0][0] = true;
		const dirs = [
			[-1, 0, "U"],
			[1, 0, "D"],
			[0, -1, "L"],
			[0, 1, "R"],
		];
		while (queue.length > 0) {
			const [r, c, path] = queue.shift();
			if (r === m - 1 && c === n - 1) return path;
			for (const [dr, dc, move] of dirs) {
				const nr = r + dr,
					nc = c + dc;
				if (nr >= 0 && nr < m && nc >= 0 && nc < n && !visited[nr][nc] && data[nr][nc] === 0) {
					visited[nr][nc] = true;
					queue.push([nr, nc, path + move]);
				}
			}
		}
		return "";
	},

	"HammingCodes: Integer to Encoded Binary": (data) => {
		// Complex bit manipulation, kept as is.
		const bits = data.toString(2).split("").map(Number);
		const n = bits.length;
		let p = 0;
		while (2 ** p < n + p + 1) p++;
		const hamming = Array(n + p);
		for (let i = 0; i < p; i++) hamming[2 ** i - 1] = "P";
		let bitIndex = 0;
		for (let i = 0; i < hamming.length; i++) {
			if (hamming[i] !== "P") {
				hamming[i] = bits[bitIndex++];
			}
		}
		for (let i = 0; i < p; i++) {
			const pIndex = 2 ** i - 1;
			let parity = 0;
			for (let j = pIndex; j < hamming.length; j++) {
				if (((j + 1) & (pIndex + 1)) !== 0) {
					if (hamming[j] === 1) parity++;
				}
			}
			hamming[pIndex] = parity % 2;
		}
		let overallParity = hamming.reduce((acc, val) => acc + (val === 1), 0) % 2;
		return overallParity.toString() + hamming.join("");
	},

	"HammingCodes: Encoded Binary to Integer": (data) => {
		let bits = data.split("").map(Number);
		let n = bits.length;

		// indexy parity bitů (včetně pozice 0)
		let parityPositions = [0];
		for (let i = 0; 1 << i < n; i++) parityPositions.push(1 << i);

		// vytažení parity bitů v LSB-first pořadí (bez pozice 0)
		let parityBits = parityPositions.slice(1).map((pos) => bits[pos]);
		parityBits.reverse();
		for (let i = 0; i < parityBits.length; i++) bits[parityPositions[i + 1]] = parityBits[i];

		// kontrola parity
		let errorPos = 0;
		for (let i = 1; i < parityPositions.length; i++) {
			let step = parityPositions[i];
			let count = 0;
			for (let j = step; j < n; j += step * 2) for (let k = 0; k < step && j + k < n; k++) count += bits[j + k];
			if (count % 2 !== 0) errorPos += step;
		}

		// celková parita
		let overallParity = bits[0];
		let calculatedOverall = bits.slice(1).reduce((a, b) => a + b, 0) % 2;

		// oprava chyby
		if (errorPos > 0 && overallParity !== calculatedOverall) {
			bits[errorPos] ^= 1;
		} else if (errorPos === 0 && overallParity !== calculatedOverall) {
			return "";
		}

		// vytažení datových bitů
		let dataBits = [];
		for (let i = 1; i < n; i++) {
			if (!parityPositions.includes(i)) dataBits.push(bits[i]);
		}

		return parseInt(dataBits.join(""), 2);
	},

	"Proper 2-Coloring of a Graph": ([N, edges]) => {
		const adj = Array.from({ length: N }, () => []);
		for (const [u, v] of edges) {
			adj[u].push(v);
			adj[v].push(u);
		}
		const colors = Array(N).fill(-1);
		for (let i = 0; i < N; i++) {
			if (colors[i] === -1) {
				const queue = [i];
				colors[i] = 0;
				while (queue.length > 0) {
					const u = queue.shift();
					for (const v of adj[u]) {
						if (colors[v] === -1) {
							colors[v] = 1 - colors[u];
							queue.push(v);
						} else if (colors[v] === colors[u]) {
							return [];
						}
					}
				}
			}
		}
		return colors;
	},

	"Compression I: RLE Compression": (data) => {
		let encoded = "";
		for (let i = 0; i < data.length; ) {
			const char = data[i];
			let count = 1;
			while (i + count < data.length && data[i + count] === char && count < 9) {
				count++;
			}
			encoded += count + char;
			i += count;
		}
		return encoded;
	},

	"Compression II: LZ Decompression": (data) => {
		let decompressed = "";
		for (let i = 0; i < data.length; ) {
			const literalLen = parseInt(data[i]);
			i++;
			if (literalLen > 0) {
				decompressed += data.substring(i, i + literalLen);
				i += literalLen;
			}
			if (i >= data.length) break;
			const backRefLen = parseInt(data[i]);
			i++;
			if (backRefLen > 0) {
				const backRefDist = parseInt(data[i]);
				i++;
				for (let j = 0; j < backRefLen; j++) {
					decompressed += decompressed[decompressed.length - backRefDist];
				}
			}
		}
		return decompressed;
	},

	"Compression III: LZ Compression": (plain) => {
		let N = plain.length;
		let dp = Array.from({ length: N + 1 }, () => [null, null]);
		dp[0][0] = "";

		for (let i = 0; i <= N; ++i) {
			for (let t = 0; t <= 1; ++t) {
				if (dp[i][t] === null) continue;

				if (t === 0) {
					for (let L = 1; L <= 9 && i + L <= N; ++L) {
						const s = dp[i][t] + L + plain.substring(i, i + L);
						if (dp[i + L][1] === null || s.length < dp[i + L][1].length) dp[i + L][1] = s;
					}
				} else {
					for (let B = 1; B <= 9 && B <= i; ++B) {
						let L = 0;
						while (i + L < N && plain[i + L] === plain[i - B + L] && L < 9) {
							++L;
							const s = dp[i][t] + `${L}${B}`;
							if (dp[i + L][0] === null || s.length < dp[i + L][0].length) dp[i + L][0] = s;
						}
					}
				}

				const s = dp[i][t] + "0";
				if (dp[i][1 - t] === null || s.length < dp[i][1 - t].length) dp[i][1 - t] = s;
			}
		}

		let res0 = dp[N][0],
			res1 = dp[N][1];
		return !res0 ? res1 : !res1 ? res0 : res0.length <= res1.length ? res0 : res1;
	},

	"Encryption I: Caesar Cipher": ([plaintext, shift]) => {
		const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
		return plaintext
			.split("")
			.map((char) => {
				if (char === " ") return " ";
				const index = alphabet.indexOf(char);
				return alphabet[(index - shift + 26) % 26];
			})
			.join("");
	},

	"Encryption II: Vigenère Cipher": ([plaintext, keyword]) => {
		const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
		return plaintext
			.split("")
			.map((char, i) => {
				const plainIndex = alphabet.indexOf(char);
				const keyIndex = alphabet.indexOf(keyword[i % keyword.length]);
				return alphabet[(plainIndex + keyIndex) % 26];
			})
			.join("");
	},

	"Square Root": (data) => {
		// Binary search with BigInt, kept as is.
		const n = BigInt(data);
		if (n < 0n) return 0;
		if (n === 0n) return 0;
		let x0 = n,
			x1 = (n + 1n) / 2n;
		while (x1 < x0) {
			x0 = x1;
			x1 = (x0 + n / x0) / 2n;
		}
		const x0s = x0 * x0;
		const x1s = (x0 + 1n) * (x0 + 1n);
		return (n - x0s < x1s - n ? x0 : x0 + 1n).toString();
	},
};
