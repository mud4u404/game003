// 可存档的确定性随机数（mulberry32）。状态是一个 32 位整数，存档后恢复结果完全一致。
export function createRng(seed) {
  let state = seed >>> 0;
  const next = () => {
    state = (state + 0x6D2B79F5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    int: (min, max) => min + Math.floor(next() * (max - min + 1)),
    pick: list => list[Math.floor(next() * list.length)],
    // 按权重抽取；weights 与 items 等长，全为 0 时返回 null。
    weighted(items, weights) {
      const total = weights.reduce((a, b) => a + b, 0);
      if (!(total > 0)) return null;
      let r = next() * total;
      for (let i = 0; i < items.length; i++) { r -= weights[i]; if (r < 0) return items[i]; }
      return items[items.length - 1];
    },
    // 小均值泊松抽样（每分钟到院数）。
    poisson(lambda) {
      const limit = Math.exp(-lambda); let k = 0, p = 1;
      do { k++; p *= next(); } while (p > limit);
      return k - 1;
    },
    get state() { return state; },
    set state(v) { state = v >>> 0; },
  };
}
