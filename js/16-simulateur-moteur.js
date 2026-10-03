// ════════════════════════════════════════════
//  SIMULATEUR — MOTEUR DE FORMULES EXCEL
//  Exécute les formules du classeur « Simulateur de Rentabilité » (js/17-simulateur-modele.js)
//  avec la même sémantique qu'Excel : mêmes fonctions, mêmes arrondis, même TRI, formules
//  matricielles, erreurs (#N/A, #VALEUR!…) et SIERREUR. Les résultats sont donc ceux du classeur.
//  Référence de contrôle : tools/simulateur/xl_oracle.py (même algorithme, vérifié sur les
//  valeurs enregistrées par Excel) et tools/simulateur/check_model.py.
// ════════════════════════════════════════════

const SimXL = (function () {
  class XLErr {
    constructor(code) { this.code = code; }
    toString() { return this.code; }
  }
  const NA = new XLErr('#N/A'), VALUE = new XLErr('#VALUE!'), DIV0 = new XLErr('#DIV/0!'),
    REF = new XLErr('#REF!'), NUM = new XLErr('#NUM!'), NAME = new XLErr('#NAME?');
  const ERRS = { '#N/A': NA, '#VALUE!': VALUE, '#DIV/0!': DIV0, '#REF!': REF, '#NUM!': NUM, '#NAME?': NAME, '#NULL!': REF };
  const BLANK = { blank: true, toString() { return ''; } };
  const INPROG = {};

  class Rng { constructor(sh, r1, c1, r2, c2) { this.sh = sh; this.r1 = r1; this.c1 = c1; this.r2 = r2; this.c2 = c2; } }
  class Arr { constructor(rows) { this.rows = rows; } }

  const isErr = v => v instanceof XLErr;
  const isNum = v => typeof v === 'number';

  // ─────────── analyse des formules (même grammaire que xl_oracle.py, références réécrites [s|r|c]) ───────────
  const TOK = /\s+|("(?:[^"]|"")*")|(#(?:N\/A|VALUE!|DIV\/0!|REF!|NUM!|NAME\?|NULL!))|(\[[^\]]*\])|(\d+(?:\.\d*)?(?:[eE][+-]?\d+)?|\.\d+)|([A-Z][A-Z0-9.]*\()|(TRUE|FALSE)|(<>|<=|>=|[-+*\/^&=<>%(),:!])/y;

  function tokenize(s) {
    const out = [];
    TOK.lastIndex = 0;
    while (TOK.lastIndex < s.length) {
      const i = TOK.lastIndex;
      const m = TOK.exec(s);
      if (!m || TOK.lastIndex === i) throw new Error('Formule illisible : ' + s.slice(i, i + 30));
      if (m[1] !== undefined) out.push(['str', m[1]]);
      else if (m[2] !== undefined) out.push(['err', m[2]]);
      else if (m[3] !== undefined) out.push(['ref', m[3]]);
      else if (m[4] !== undefined) out.push(['num', m[4]]);
      else if (m[5] !== undefined) out.push(['func', m[5]]);
      else if (m[6] !== undefined) out.push(['bool', m[6]]);
      else if (m[7] !== undefined) out.push(['op', m[7]]);
    }
    return out;
  }

  // [s|r|c] ou [s|r1|c1|r2|c2] ; s vide = feuille courante ; "~n" = relatif
  function parseRefTok(text) {
    const p = text.slice(1, -1).split('|');
    const sh = p[0] === '' ? -1 : +p[0];
    const co = x => x[0] === '~' ? [0, +x.slice(1)] : [1, +x];
    const r1 = co(p[1]), c1 = co(p[2]);
    const r2 = p.length > 3 ? co(p[3]) : r1, c2 = p.length > 3 ? co(p[4]) : c1;
    return ['ref', sh, r1[0], r1[1], c1[0], c1[1], r2[0], r2[1], c2[0], c2[1]];
  }

  const BIN = { '=': 1, '<>': 1, '<': 1, '>': 1, '<=': 1, '>=': 1, '&': 2, '+': 3, '-': 3, '*': 4, '/': 4, '^': 5 };

  function parse(src) {
    const t = tokenize(src);
    let i = 0;
    const peek = () => t[i] || [null, null];
    const next = () => t[i++] || [null, null];
    function expr(minp) {
      let lhs = unary();
      for (;;) {
        const [k, v] = peek();
        if (k === 'op' && v === '%') { next(); lhs = ['pct', lhs]; continue; }
        if (k === 'op' && BIN[v] !== undefined && BIN[v] >= minp) {
          const p = BIN[v]; next();
          lhs = ['bin', v, lhs, expr(p + 1)];
          continue;
        }
        return lhs;
      }
    }
    function unary() {
      const [k, v] = peek();
      if (k === 'op' && (v === '+' || v === '-')) {
        next(); const e = unary();
        return v === '-' ? ['neg', e] : ['pos', e];
      }
      return primary();
    }
    function primary() {
      const [k, v] = next();
      if (k === 'num') return ['num', parseFloat(v)];
      if (k === 'str') return ['str', v.slice(1, -1).replace(/""/g, '"')];
      if (k === 'bool') return ['bool', v === 'TRUE'];
      if (k === 'err') return ['err', ERRS[v] || REF];
      if (k === 'ref') return parseRefTok(v);
      if (k === 'func') {
        const name = v.slice(0, -1), args = [];
        if (peek()[0] === 'op' && peek()[1] === ')') { next(); return ['fn', name, args]; }
        for (;;) {
          const pk = peek();
          if (pk[0] === 'op' && (pk[1] === ',' || pk[1] === ')')) args.push(['blankarg']);
          else args.push(expr(0));
          const [, v2] = next();
          if (v2 === ')') break;
          if (v2 !== ',') throw new Error('« , » attendu dans ' + src);
        }
        return ['fn', name, args];
      }
      if (k === 'op' && v === '(') {
        const e = expr(0);
        const [, v2] = next();
        if (v2 !== ')') throw new Error('« ) » attendu dans ' + src);
        return e;
      }
      throw new Error('Jeton inattendu ' + v + ' dans ' + src);
    }
    const ast = expr(0);
    if (i < t.length) throw new Error('Fin de formule inattendue : ' + src);
    return ast;
  }

  // ─────────── conversions de valeurs ───────────
  const PLAINNUM = /^[-+]?(\d+\.?\d*|\.\d+)(e[-+]?\d+)?$/i;
  const NUMSTR = /^\s*[-+]?(\d[\d\s  ]*)([.,]\d+)?\s*(€|%)?\s*$/;

  function toNum(v) {
    if (isErr(v)) throw v;
    if (v === BLANK || v === null || v === undefined) return 0;
    if (typeof v === 'boolean') return v ? 1 : 0;
    if (isNum(v)) return v;
    if (typeof v === 'string') {
      const s = v.trim();
      if (PLAINNUM.test(s)) return parseFloat(s);
      const m = NUMSTR.exec(s);
      if (m) {
        let n = parseFloat(m[1].replace(/[\s  ]/g, '') + (m[2] || '').replace(',', '.'));
        if (s.replace(/^\s+/, '')[0] === '-') n = -n;
        if (m[3] === '%') n /= 100;
        return n;
      }
      throw VALUE;
    }
    throw VALUE;
  }

  function toStr(v) {
    if (isErr(v)) throw v;
    if (v === BLANK || v === null || v === undefined) return '';
    if (typeof v === 'boolean') return v ? 'TRUE' : 'FALSE';
    if (isNum(v)) {
      if (Number.isInteger(v) && Math.abs(v) < 1e15) return String(v === 0 ? 0 : v);
      return String(parseFloat(v.toPrecision(15))).replace('.', ',');
    }
    return String(v);
  }

  function toBool(v) {
    if (isErr(v)) throw v;
    if (v === BLANK || v === null || v === undefined) return false;
    if (typeof v === 'boolean') return v;
    if (isNum(v)) return v !== 0;
    if (typeof v === 'string') {
      const u = v.toUpperCase();
      if (u === 'TRUE') return true;
      if (u === 'FALSE') return false;
      throw VALUE;
    }
    throw VALUE;
  }

  const typeRank = v => typeof v === 'boolean' ? 2 : typeof v === 'string' ? 1 : 0;

  function compare(a, b, op) {
    if (isErr(a)) return a;
    if (isErr(b)) return b;
    if (a === BLANK) a = typeof b === 'string' ? '' : (typeof b === 'boolean' ? false : 0);
    if (b === BLANK) b = typeof a === 'string' ? '' : (typeof a === 'boolean' ? false : 0);
    const ra = typeRank(a), rb = typeRank(b);
    let c;
    if (ra !== rb) c = ra > rb ? 1 : -1;
    else if (ra === 1) { const x = a.toLowerCase(), y = b.toLowerCase(); c = x > y ? 1 : x < y ? -1 : 0; }
    else { const x = Number(a), y = Number(b); c = x > y ? 1 : x < y ? -1 : 0; }
    switch (op) {
      case '=': return c === 0; case '<>': return c !== 0; case '<': return c < 0;
      case '>': return c > 0; case '<=': return c <= 0; case '>=': return c >= 0;
    }
  }

  // ARRONDI / ARRONDI.INF : arithmétique décimale sur l'écriture la plus courte du nombre (comme Excel)
  function addOne(s) {
    const d = s.split('');
    let i = d.length - 1;
    while (i >= 0) { if (d[i] === '9') { d[i] = '0'; i--; } else { d[i] = String(+d[i] + 1); return d.join(''); } }
    return '1' + d.join('');
  }
  function decRound(x, n, half) {
    if (!isFinite(x)) return x;
    n = Math.trunc(n);
    const neg = x < 0;
    let s = String(Math.abs(x));
    let e = 0;
    const ei = s.indexOf('e');
    if (ei >= 0) { e = parseInt(s.slice(ei + 1), 10); s = s.slice(0, ei); }
    const dot = s.indexOf('.');
    const ip = dot >= 0 ? s.slice(0, dot) : s, fp = dot >= 0 ? s.slice(dot + 1) : '';
    let digits = ip + fp, point = ip.length + e;
    while (digits.length > 1 && digits[0] === '0') { digits = digits.slice(1); point--; }
    if (/^0+$/.test(digits)) return 0;
    const keep = point + n;
    if (keep >= digits.length) return x;
    if (keep < 0) return 0;
    let kept = digits.slice(0, keep) || '0';
    if (half && digits[keep] >= '5') kept = addOne(kept);
    const r = Number(kept + 'e' + (-n));
    return neg ? -r : r;
  }

  // TRI compatible Excel. L'algorithme d'Excel n'est pas public ; celui-ci a été reconstitué en comparant
  // des milliers de TRI calculés par Excel : 1) Newton sur x = 1/(1+taux) depuis l'estimation,
  // 2) en cas d'échec, Newton sur le taux depuis -10 %. 20 itérations au plus, précision 1e-7,
  // un taux <= -100 % est rejeté. Identique au xl_oracle.py.
  function irr(vals, guess) {
    const newtonX = g => {
      let x = 1 / (1 + g);
      for (let it = 0; it < 20; it++) {
        let f = 0, d = 0;
        for (let i = 0; i < vals.length; i++) {
          f += vals[i] * x ** i;
          if (i) d += i * vals[i] * x ** (i - 1);
        }
        if (d === 0) return null;
        const nx = x - f / d;
        if (nx === 0 || !isFinite(nx)) return null;
        const r0 = 1 / x - 1, r1 = 1 / nx - 1;
        if (Math.abs(r1 - r0) <= 1e-7) return r1 > -1 ? r1 : null;
        x = nx;
      }
      return null;
    };
    const newtonR = g => {
      let r = g;
      for (let it = 0; it < 20; it++) {
        let f = 0, d = 0;
        for (let i = 0; i < vals.length; i++) {
          f += vals[i] / (1 + r) ** i;
          d -= i * vals[i] / (1 + r) ** (i + 1);
        }
        if (d === 0 || !isFinite(f) || !isFinite(d)) return null;
        const nr = r - f / d;
        if (!isFinite(nr)) return null;
        if (Math.abs(nr - r) <= 1e-7) return nr > -1 ? nr : null;
        r = nr;
      }
      return null;
    };
    let v = newtonX(guess);
    if (v === null) v = newtonR(-0.1);
    if (v === null) throw NUM;
    return v;
  }

  // ─────────── classeur ───────────
  const key = (sh, r, c) => (sh * 1024 + r) * 256 + c;

  class Workbook {
    constructor(model) {
      this.sheets = model.sheets;
      this.sheetIdx = {};
      model.sheets.forEach((s, i) => { this.sheetIdx[s] = i; });
      this.templates = model.t;
      this.asts = new Array(model.t.length);
      this.formulas = new Map();
      this.consts = new Map();
      model.f.forEach((list, sh) => list.forEach(([r, c, t, arr]) => this.formulas.set(key(sh, r, c), [t, !!arr, sh, r, c])));
      model.k.forEach((list, sh) => list.forEach(([r, c, v]) => this.consts.set(key(sh, r, c), v)));
      this.over = new Map();
      this.memo = new Map();
    }

    // ── API ──
    addr(a) {
      const m = /^([A-Z]+)(\d+)$/.exec(a);
      let c = 0;
      for (const ch of m[1]) c = c * 26 + ch.charCodeAt(0) - 64;
      return [+m[2], c];
    }
    set(sheet, a, value) {
      const [r, c] = this.addr(a);
      this.over.set(key(this.sheetIdx[sheet], r, c), value === null || value === undefined ? BLANK : value);
      this.memo.clear();
    }
    get(sheet, a) { const [r, c] = this.addr(a); return this.cellAt(this.sheetIdx[sheet], r, c); }
    getRC(sheet, r, c) { return this.cellAt(this.sheetIdx[sheet], r, c); }

    // ── évaluation ──
    cellAt(sh, r, c) {
      const k = key(sh, r, c);
      if (this.over.has(k)) return this.over.get(k);
      if (this.memo.has(k)) {
        const v = this.memo.get(k);
        if (v === INPROG) throw new Error('Référence circulaire : ' + this.sheets[sh] + ' L' + r + 'C' + c);
        return v;
      }
      const f = this.formulas.get(k);
      if (f) {
        this.memo.set(k, INPROG);
        let ast = this.asts[f[0]];
        if (!ast) ast = this.asts[f[0]] = parse(this.templates[f[0]]);
        const at = { sh, r, c, arr: f[1] };
        let v;
        try {
          v = this.ev(ast, at);
          if (v instanceof Rng) v = this.implicit(v, at);
          if (v instanceof Arr) v = v.rows[0][0];
          if (v === BLANK) v = 0;
        } catch (e) {
          if (!isErr(e)) throw e;
          v = e;
        }
        this.memo.set(k, v);
        return v;
      }
      return this.consts.has(k) ? this.consts.get(k) : BLANK;
    }

    resolve(n, at) {
      const sh = n[1] === -1 ? at.sh : n[1];
      return new Rng(sh, n[2] ? n[3] : at.r + n[3], n[4] ? n[5] : at.c + n[5], n[6] ? n[7] : at.r + n[7], n[8] ? n[9] : at.c + n[9]);
    }

    implicit(r, at) {
      if (r.r1 === r.r2 && r.c1 === r.c2) return this.cellAt(r.sh, r.r1, r.c1);
      if (r.r1 === r.r2 && r.c1 <= at.c && at.c <= r.c2) return this.cellAt(r.sh, r.r1, at.c);
      if (r.c1 === r.c2 && r.r1 <= at.r && at.r <= r.r2) return this.cellAt(r.sh, at.r, r.c1);
      throw VALUE;
    }

    rngRows(r) {
      const rows = [];
      for (let i = r.r1; i <= r.r2; i++) {
        const row = [];
        for (let j = r.c1; j <= r.c2; j++) row.push(this.cellAt(r.sh, i, j));
        rows.push(row);
      }
      return rows;
    }
    grid(v) { return v instanceof Rng ? this.rngRows(v) : v instanceof Arr ? v.rows : [[v]]; }
    flat(v) { return this.grid(v).flat(); }

    scal(v, at) {
      if (v instanceof Rng) return at.arr ? new Arr(this.rngRows(v)) : this.implicit(v, at);
      return v;
    }

    ev(n, at) {
      switch (n[0]) {
        case 'num': case 'str': case 'bool': return n[1];
        case 'err': throw n[1];
        case 'blankarg': return BLANK;
        case 'ref': {
          const r = this.resolve(n, at);
          if (r.r1 === r.r2 && r.c1 === r.c2) return this.cellAt(r.sh, r.r1, r.c1);
          return r;
        }
        case 'neg': return this.unop(x => -toNum(x), this.scal(this.ev(n[1], at), at));
        case 'pos': return this.scal(this.ev(n[1], at), at);
        case 'pct': return this.unop(x => toNum(x) / 100, this.scal(this.ev(n[1], at), at));
        case 'bin': {
          const a = this.scal(this.ev(n[2], at), at);
          const b = this.scal(this.ev(n[3], at), at);
          return this.binop(n[1], a, b);
        }
        case 'fn': return this.call(n[1], n[2], at);
      }
      throw new Error('Nœud inconnu ' + n[0]);
    }

    safe(f, ...xs) { try { return f(...xs); } catch (e) { if (isErr(e)) return e; throw e; } }

    unop(f, a) {
      if (a instanceof Arr) return new Arr(a.rows.map(row => row.map(x => this.safe(f, x))));
      return f(a);
    }

    binop(op, a, b) {
      if (a instanceof Arr || b instanceof Arr) {
        const ga = a instanceof Arr ? a.rows : [[a]], gb = b instanceof Arr ? b.rows : [[b]];
        const R = Math.max(ga.length, gb.length), C = Math.max(ga[0].length, gb[0].length);
        const pick = (g, i, j) => {
          const ii = g.length === 1 ? 0 : i, jj = g[0].length === 1 ? 0 : j;
          if (ii >= g.length || jj >= g[0].length) return NA;
          return g[ii][jj];
        };
        const rows = [];
        for (let i = 0; i < R; i++) {
          const row = [];
          for (let j = 0; j < C; j++) row.push(this.safe((x, y) => this.binop(op, x, y), pick(ga, i, j), pick(gb, i, j)));
          rows.push(row);
        }
        return new Arr(rows);
      }
      if (isErr(a)) throw a;
      if (isErr(b)) throw b;
      if (op === '=' || op === '<>' || op === '<' || op === '>' || op === '<=' || op === '>=') return compare(a, b, op);
      if (op === '&') return toStr(a) + toStr(b);
      const x = toNum(a), y = toNum(b);
      switch (op) {
        case '+': return x + y;
        case '-': return x - y;
        case '*': return x * y;
        case '/': if (y === 0) throw DIV0; return x / y;
        case '^': { const p = Math.pow(x, y); if (!isFinite(p)) throw NUM; return p; }
      }
    }

    // ─────────── fonctions ───────────
    call(name, args, at) {
      const S = a => this.scal(this.ev(a, at), at);
      // Pour les fonctions d'agrégation, une référence (même à une seule cellule) se lit comme une plage
      const E = a => a[0] === 'ref' ? this.resolve(a, at) : this.ev(a, at);
      switch (name) {
        case 'IF': {
          const c = S(args[0]);
          if (c instanceof Arr) {
            const t = args.length > 1 ? S(args[1]) : true;
            const f = args.length > 2 ? S(args[2]) : false;
            const gt = t instanceof Arr ? t.rows : null, gf = f instanceof Arr ? f.rows : null;
            return new Arr(c.rows.map((row, i) => row.map((cv, j) => {
              try {
                if (toBool(cv)) return gt ? gt[gt.length > 1 ? i : 0][gt[0].length > 1 ? j : 0] : t;
                return gf ? gf[gf.length > 1 ? i : 0][gf[0].length > 1 ? j : 0] : f;
              } catch (e) { if (isErr(e)) return e; throw e; }
            })));
          }
          if (toBool(c)) return args.length > 1 && args[1][0] !== 'blankarg' ? S(args[1]) : (args.length < 2 ? true : 0);
          if (args.length > 2) return args[2][0] !== 'blankarg' ? S(args[2]) : 0;
          return false;
        }
        case 'IFERROR': {
          try {
            const v = S(args[0]);
            if (isErr(v)) throw v;
            if (v instanceof Arr) {
              let alt;
              return new Arr(v.rows.map(row => row.map(x => {
                if (isErr(x)) { if (alt === undefined) alt = S(args[1]); return alt; }
                return x;
              })));
            }
            return v;
          } catch (e) {
            if (!isErr(e)) throw e;
            return S(args[1]);
          }
        }
        case 'AND': case 'OR': {
          const vals = [];
          for (const a of args) {
            const v = E(a);
            if (v instanceof Rng || v instanceof Arr) {
              for (const x of this.flat(v)) {
                if (isErr(x)) throw x;
                if (isNum(x) || typeof x === 'boolean') vals.push(toBool(x));
              }
            } else vals.push(toBool(v));
          }
          if (!vals.length) throw VALUE;
          return name === 'AND' ? vals.every(Boolean) : vals.some(Boolean);
        }
        case 'SUM': case 'MAX': case 'MIN': {
          const nums = [];
          for (const a of args) {
            const v = E(a);
            if (v instanceof Rng || v instanceof Arr) {
              for (const x of this.flat(v)) {
                if (isErr(x)) throw x;
                if (isNum(x)) nums.push(x);
              }
            } else nums.push(toNum(v));
          }
          if (name === 'SUM') { let s = 0; for (const x of nums) s += x; return s; }
          if (!nums.length) return 0;
          return name === 'MAX' ? Math.max(...nums) : Math.min(...nums);
        }
        case 'POWER': return this.binop('^', S(args[0]), S(args[1]));
        case 'ROUND': case 'ROUNDDOWN': {
          const x = toNum(S(args[0])), d = args.length > 1 ? toNum(S(args[1])) : 0;
          return decRound(x, d, name === 'ROUND');
        }
        case 'LEFT': case 'RIGHT': {
          const s = toStr(S(args[0])), k = args.length > 1 ? Math.trunc(toNum(S(args[1]))) : 1;
          return name === 'LEFT' ? s.slice(0, k) : (k ? s.slice(-k) : '');
        }
        case 'HLOOKUP': case 'VLOOKUP': {
          const k = S(args[0]), tv = E(args[1]), idx = Math.trunc(toNum(S(args[2])));
          let approx = true;
          if (args.length > 3) { const a3 = S(args[3]); approx = a3 !== BLANK ? toBool(a3) : false; }
          if (isErr(k)) throw k;
          if (tv instanceof Rng) {
            const r = tv;
            if (name === 'HLOOKUP') {
              if (idx > r.r2 - r.r1 + 1) throw REF;
              const keys = [];
              for (let j = r.c1; j <= r.c2; j++) keys.push(this.cellAt(r.sh, r.r1, j));
              const j = this.lookup(k, keys, approx);
              return this.cellAt(r.sh, r.r1 + idx - 1, r.c1 + j);
            }
            if (idx > r.c2 - r.c1 + 1) throw REF;
            const keys = [];
            for (let i = r.r1; i <= r.r2; i++) keys.push(this.cellAt(r.sh, i, r.c1));
            const j = this.lookup(k, keys, approx);
            return this.cellAt(r.sh, r.r1 + j, r.c1 + idx - 1);
          }
          const tbl = this.grid(tv);
          if (name === 'HLOOKUP') return tbl[idx - 1][this.lookup(k, tbl[0], approx)];
          return tbl[this.lookup(k, tbl.map(row => row[0]), approx)][idx - 1];
        }
        case 'MATCH': {
          const k = S(args[0]), arr = this.flat(E(args[1]));
          const mt = args.length > 2 ? toNum(S(args[2])) : 1;
          if (isErr(k)) throw k;
          if (mt === 0) return this.lookup(k, arr, false) + 1;
          if (mt === 1) return this.lookup(k, arr, true) + 1;
          throw new Error('EQUIV type -1 non géré');
        }
        case 'INDEX': {
          const tv = E(args[0]);
          let r = args.length > 1 && args[1][0] !== 'blankarg' ? Math.trunc(toNum(S(args[1]))) : 0;
          let c = args.length > 2 && args[2][0] !== 'blankarg' ? Math.trunc(toNum(S(args[2]))) : 0;
          let R, C, g;
          if (tv instanceof Rng) { R = tv.r2 - tv.r1 + 1; C = tv.c2 - tv.c1 + 1; }
          else { g = this.grid(tv); R = g.length; C = g[0].length; }
          if (R === 1 && args.length === 2) { c = r; r = 1; }
          if (r === 0) r = 1;
          if (c === 0) c = 1;
          if (r > R || c > C || r < 1 || c < 1) throw REF;
          const v = tv instanceof Rng ? this.cellAt(tv.sh, tv.r1 + r - 1, tv.c1 + c - 1) : g[r - 1][c - 1];
          if (isErr(v)) throw v;
          return v;
        }
        case 'SUMIFS': {
          const sr = this.flat(E(args[0]));
          const mask = sr.map(() => true);
          for (let k = 1; k < args.length; k += 2) {
            const cr = this.flat(E(args[k])), test = this.crit(S(args[k + 1]));
            cr.forEach((x, i) => { mask[i] = mask[i] && test(x); });
          }
          let s = 0;
          sr.forEach((x, i) => { if (mask[i] && isNum(x)) s += x; });
          return s;
        }
        case 'SUMPRODUCT': {
          const grids = args.map(a => {
            let v = E(a);
            if (v instanceof Rng) v = new Arr(this.rngRows(v));
            else if (!(v instanceof Arr)) v = new Arr([[v]]);
            return v.rows;
          });
          const R = grids[0].length, C = grids[0][0].length;
          for (const g of grids) if (g.length !== R || g[0].length !== C) throw VALUE;
          let tot = 0;
          for (let i = 0; i < R; i++) for (let j = 0; j < C; j++) {
            let p = 1;
            for (const g of grids) {
              const x = g[i][j];
              if (isErr(x)) throw x;
              p *= isNum(x) ? x : 0;
            }
            tot += p;
          }
          return tot;
        }
        case 'NPV': {
          const rate = toNum(S(args[0])), vals = [];
          for (const a of args.slice(1)) {
            const v = E(a);
            if (v instanceof Rng || v instanceof Arr) {
              for (const x of this.flat(v)) { if (isErr(x)) throw x; if (isNum(x)) vals.push(x); }
            } else vals.push(toNum(v));
          }
          let s = 0;
          vals.forEach((x, i) => { s += x / (1 + rate) ** (i + 1); });
          return s;
        }
        case 'IRR': {
          const vals = [];
          for (const x of this.flat(E(args[0]))) { if (isErr(x)) throw x; if (isNum(x)) vals.push(x); }
          return irr(vals, args.length > 1 ? toNum(S(args[1])) : 0.1);
        }
      }
      throw new Error('Fonction Excel non gérée : ' + name);
    }

    crit(c) {
      if (typeof c === 'string') {
        const m = /^(<=|>=|<>|<|>|=)?([\s\S]*)$/.exec(c);
        const op = m[1] || '=', rhs = m[2];
        const rv = PLAINNUM.test(rhs.trim()) && rhs.trim() !== '' ? parseFloat(rhs) : rhs;
        if (typeof rv === 'string') return x => isErr(x) ? false : compare(typeof x === 'string' ? x : toStr(x), rv, op) === true;
        return x => isNum(x) && compare(x, rv, op) === true;
      }
      if (isErr(c)) throw c;
      return x => !isErr(x) && x !== BLANK && compare(x, c, '=') === true;
    }

    lookup(k, keys, approx) {
      const same = kk => !(kk === BLANK || isErr(kk)) && typeRank(kk) === typeRank(k);
      if (!approx) {
        for (let j = 0; j < keys.length; j++) if (same(keys[j]) && compare(keys[j], k, '=') === true) return j;
        throw NA;
      }
      let lo = 0, hi = keys.length - 1, best = -1;
      while (lo <= hi) {
        const mid = (lo + hi) >> 1, kk = keys[mid];
        if (!same(kk)) {
          let last = -1;
          keys.forEach((x, j) => { if (same(x) && compare(x, k, '<=') === true) last = j; });
          if (last < 0) throw NA;
          return last;
        }
        if (compare(kk, k, '<=') === true) { best = mid; lo = mid + 1; } else hi = mid - 1;
      }
      if (best < 0) throw NA;
      return best;
    }
  }

  return { Workbook, XLErr, BLANK, isErr, decRound, irr, parse };
})();
