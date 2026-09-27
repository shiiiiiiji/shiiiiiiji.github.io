(function (root) {
  'use strict';
  const TYPES = {
    multiply: { label: '乘法口诀', symbol: '×', description: '2～9 的乘法练习' },
    missing: { label: '乘法填空', symbol: '□', description: '找出藏起来的乘数' },
    mixed: { label: '乘加乘减', symbol: '±', description: '先算乘法，再算加减' },
    chain: { label: '连加连减', symbol: '+', description: '100 以内，按顺序算' },
    inequality: { label: '比大小填空', symbol: '>', description: '找出最大或最小整数' }
  };
  function randomSource(seed) {
    let n = 2166136261;
    for (const c of String(seed)) n = Math.imul(n ^ c.charCodeAt(0), 16777619);
    return () => {
      n += 0x6D2B79F5;
      let t = n;
      t = Math.imul(t ^ t >>> 15, t | 1);
      t ^= t + Math.imul(t ^ t >>> 7, t | 61);
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }
  function generate({ types = Object.keys(TYPES), count = 40, seed = 'island' } = {}) {
    if (!Array.isArray(types) || !types.length || types.some(t => !TYPES[t])) throw new Error('至少选择一种有效题型');
    types = [...new Set(types)];
    if (![20, 40, 60].includes(count)) throw new Error('题量应为 20、40 或 60');
    const rand = randomSource(seed);
    const int = (a, b) => a + Math.floor(rand() * (b - a + 1));
    const shuffle = a => {
      for (let i = a.length - 1; i > 0; i--) {
        const j = int(0, i); [a[i], a[j]] = [a[j], a[i]];
      }
      return a;
    };
    const multiplicationPool = shuffle(Array.from({ length: 64 }, (_, n) => [2 + Math.floor(n / 8), 2 + n % 8]));
    let multiplicationIndex = 0;
    function one(type) {
      let a, b, c, answer, expression, instruction = '';
      if (type === 'multiply') {
        [a, b] = multiplicationPool[multiplicationIndex++];
        answer = a * b; expression = `${a} × ${b} = □`;
      } else if (type === 'missing') {
        a = int(2, 9); b = int(2, 9);
        const first = int(0, 1) === 0;
        answer = first ? a : b;
        expression = first ? `□ × ${b} = ${a * b}` : `${a} × □ = ${a * b}`;
      } else if (type === 'mixed') {
        a = int(1, 9); b = int(1, 9);
        const product = a * b, layout = int(0, 3);
        if (layout === 0 || layout === 2) {
          c = int(0, 99 - product); answer = product + c;
          expression = layout === 0 ? `${a} × ${b} + ${c} = □` : `${c} + ${a} × ${b} = □`;
        } else if (layout === 1) {
          c = int(0, product); answer = product - c; expression = `${a} × ${b} − ${c} = □`;
        } else {
          c = int(product, 99); answer = c - product; expression = `${c} − ${a} × ${b} = □`;
        }
      } else if (type === 'chain') {
        a = int(1, 99);
        const minus1 = int(0, 1), minus2 = int(0, 1);
        b = minus1 ? int(0, a) : int(0, 99 - a);
        const intermediate = minus1 ? a - b : a + b;
        c = minus2 ? int(0, intermediate) : int(0, 99 - intermediate);
        answer = minus2 ? intermediate - c : intermediate + c;
        expression = `${a} ${minus1 ? '−' : '+'} ${b} ${minus2 ? '−' : '+'} ${c} = □`;
      } else {
        const target = int(1, 30), layout = int(0, 5);
        a = int(2, 35); b = int(2, 20);
        answer = target;
        if (layout === 0) { expression = `□ + ${a} < ${a + target + 1}`; instruction = '最大填几'; }
        if (layout === 1) { expression = `${a} + □ > ${a + target - 1}`; instruction = '最小填几'; }
        if (layout === 2) { expression = `${a + b + target + 1} − □ > ${a} + ${b}`; instruction = '最大填几'; }
        if (layout === 3) { expression = `${a + b + target - 1} − □ < ${a} + ${b}`; instruction = '最小填几'; }
        if (layout === 4) { expression = `□ − ${a} > ${target - a - 1}`; instruction = '最小填几';
          if (target <= a) expression = `□ + ${a} > ${a + target - 1}`;
        }
        if (layout === 5) { expression = `${a} + □ < ${a + b + target + 1} − ${b}`; instruction = '最大填几'; }
      }
      return { type, expression, answer, instruction };
    }
    const seen = new Set(), result = [];
    const schedule = shuffle(Array.from({ length: count }, (_, i) => types[i % types.length]));
    for (const type of schedule) {
      let q, attempts = 0;
      do {
        q = one(type);
        if (++attempts > 3000) throw new Error('暂时无法生成这组题目，请重新换题');
      } while (seen.has(q.expression + q.instruction));
      seen.add(q.expression + q.instruction);
      result.push({ id: result.length + 1, ...q });
    }
    return result;
  }
  function generateSheet({ seed = 'source-layout' } = {}) {
    const types = Object.keys(TYPES);
    const columns = types.slice(0, 4).map(type => generate({ types: [type], count: 20, seed: `${seed}:${type}` }));
    // The source's first column uses 20 distinct multiplication facts without swapped duplicates.
    const rand = randomSource(`${seed}:facts`), facts = [];
    for (let a = 2; a <= 9; a++) for (let b = a; b <= 9; b++) facts.push([a, b]);
    for (let i = facts.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [facts[i], facts[j]] = [facts[j], facts[i]]; }
    columns[0] = facts.slice(0, 20).map(([a, b]) => ({ type: 'multiply', expression: `${a} × ${b} = □`, answer: a * b, instruction: '' }));
    const inequalities = generate({ types: ['inequality'], count: 60, seed: `${seed}:inequalities` });
    const max = inequalities.filter(q => q.instruction === '最大填几').slice(0, 9);
    const min = inequalities.filter(q => q.instruction === '最小填几').slice(0, 9);
    if (max.length < 9 || min.length < 9) return generateSheet({ seed: `${seed}:retry` });
    let id = 0;
    const rows = Array.from({ length: 20 }, (_, row) => {
      const cells = columns.map(column => column[row]);
      cells.push(row === 0 ? { heading: '()最大填几？' } : row === 10 ? { heading: '()最小填几？' } : row < 10 ? max[row - 1] : min[row - 11]);
      return cells.map(cell => cell.heading ? cell : { ...cell, id: ++id });
    });
    return rows;
  }
  const api = { TYPES, generate, generateSheet };
  root.MathIslandEngine = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
