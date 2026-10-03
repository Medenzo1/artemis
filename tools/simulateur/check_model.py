#!/usr/bin/env python3
"""Contrôle que le moteur du site (js/16 + js/17) donne exactement les résultats du classeur.

1. Le moteur de référence Python (xl_oracle.py) est d'abord vérifié sur les valeurs qu'Excel
   a enregistrées dans le fichier (scénario du classeur).
2. N scénarios aléatoires couvrant toutes les options (types d'emprunt, revente ou non,
   location nue/meublée en société, TVA, Pinel, etc.) sont calculés par le moteur de référence,
   puis par le moteur JavaScript (JavaScriptCore de macOS) : chacune des 26 324 cellules
   calculées est comparée.

Usage : python3 tools/simulateur/check_model.py "chemin/Simulateur.xlsm" [nombre_de_scénarios]
"""
import json, os, random, subprocess, sys, tempfile, threading

sys.path.insert(0, os.path.dirname(__file__))
import xl_oracle as X  # noqa: E402
import rawcache  # noqa: E402

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..'))
JSC = '/System/Library/Frameworks/JavaScriptCore.framework/Versions/Current/Helpers/jsc'
IN = '✏️ A COMPLÉTER'


def rand_inputs(rng):
    r = rng.random
    def money(lo, hi, step=10): return round(rng.uniform(lo, hi) / step) * step
    prix = money(40000, 650000, 1000)
    l7 = rng.choice([0] + list(range(1, 26)) * 2)
    typ = rng.choice(['CLASSIQUE', 'CLASSIQUE', 'DIFFÉRÉ PARTIEL', 'DIFFÉRÉ TOTAL', 'IN FINE'])
    inp = {
        'E6': prix, 'E7': rng.choice([0, money(0, 25000)]), 'D8': rng.choice([0.08, 0.075, 0.03, round(r() * 0.1, 3)]),
        'E9': rng.choice([0, 500, money(0, 2000)]), 'E10': rng.choice([0, money(0, 6000)]), 'E11': rng.choice([0, money(0, 6000)]),
        'E12': rng.choice([0, money(0, 150000, 100)]), 'E13': rng.choice([0, money(0, 20000)]), 'E14': rng.choice([0, 1500, money(0, 4000)]),
        'L6': typ, 'L7': l7, 'L8': (rng.choice([None, 0, 6, 12, 24, rng.randint(1, 48)]) if typ.startswith('DIFF') else rng.choice([None, None, 0])),
        'P6': round(r() * 0.06, 4), 'P7': round(r() * 0.006, 4), 'P8': rng.choice([0, money(0, prix * 0.4), money(0, prix * 1.3)]),
        'L11': rng.choice([0, money(0, 250000, 100)]), 'P11': rng.randint(0, 6),
        'L12': rng.choice(['Célibataire ou Divorcé', 'Marié ou Pacsé']), 'L14': rng.choice(['FLAT TAX', 'BARÈME PROGRESSIF']),
        'F17': money(200, prix / 60 + 400), 'G17': money(200, prix / 70 + 300), 'F18': rng.choice([0, money(0, 300)]), 'G18': rng.choice([0, money(0, 300)]),
        'H19': rng.choice(['LOCATION MEUBLÉE', 'LOCATION NUE']),
        'L17': rng.choice([0, None, money(prix * 0.6, prix * 2, 1000)]),
        'L18': rng.choice(list(range(1, 26)) + ['PAS DE REVENTE'] * 4),
        'E22': money(0, 4000), 'E23': money(0, 1200), 'E24': money(0, 5000), 'E25': money(0, 3000),
        'D26': rng.choice([0, 0.05, 0.07, round(r() * 0.12, 3)]), 'E27': rng.choice([0, money(0, 2000)]),
        'E28': money(0, 200), 'H28': money(0, 400), 'E29': money(0, 1500), 'H29': money(0, 3000), 'E30': rng.choice([0, 150, money(0, 400)]), 'E31': money(0, 1000),
        'L22': rng.randint(1, 6), 'P22': round(r() * 0.15, 3), 'L23': rng.choice(['OUI', 'NON']), 'P23': round(r() * 0.08, 3),
        'P24': rng.choice([0.7, 0.6, 0.8, round(rng.uniform(0.3, 1), 2)]), 'L25': rng.choice(['OUI', 'NON']), 'L26': rng.choice(['OUI', 'NON']),
        'L28': rng.choice([0, 20, 50, money(10, 200, 1)]), 'L29': rng.choice([6, 9, 12]), 'L31': rng.choice(['OUI', 'NON']),
    }
    return inp


def enc(v):
    if isinstance(v, X.XLErr): return {'e': v.code}
    if v is X.BLANK: return None
    if isinstance(v, bool): return v
    if isinstance(v, (int, float)): return float(v)
    return v


def oracle_values(book, inputs):
    for a, v in inputs.items(): book.set(IN, a, v)
    book.memo = {}
    out = []
    for key in book.ast:
        sh, r, c = key
        out.append([book.sheets.index(sh), r, c, enc(book.cell(key))])
    return out


HARNESS = r'''
load(MODEL);
load(ROOT + '/js/16-simulateur-moteur.js');
const cases = JSON.parse(readFile(CASES));
let bad = 0, total = 0;
const show = [];
const t0 = Date.now();
for (const cs of cases) {
  const wb = new SimXL.Workbook(SIM_MODEL);
  for (const [a, v] of Object.entries(cs.inputs)) wb.set('✏️ A COMPLÉTER', a, v === null ? null : v);
  for (const [sh, r, c, exp] of cs.values) {
    total++;
    const got = wb.getRC(SIM_MODEL.sheets[sh], r, c);
    let ok;
    if (exp !== null && typeof exp === 'object') ok = SimXL.isErr(got) && got.code === exp.e;
    else if (typeof exp === 'number') ok = typeof got === 'number' && (Math.abs(got - exp) <= 1e-6 || Math.abs(got - exp) <= 1e-9 * Math.abs(exp));
    else if (exp === null) ok = got === SimXL.BLANK;
    else ok = got === exp;
    if (!ok) { bad++; if (show.length < 25) show.push(cs.id + ' ' + SIM_MODEL.sheets[sh] + ' R' + r + 'C' + c + ' js=' + (SimXL.isErr(got) ? got.code : JSON.stringify(got)) + ' excel=' + JSON.stringify(exp)); }
  }
}
print(JSON.stringify({ total, bad, show, ms: Date.now() - t0, perCase: (Date.now() - t0) / cases.length }));
'''


def main():
    src = sys.argv[1] if len(sys.argv) > 1 else os.path.expanduser('~/Desktop/Simulateur de Rentabilité_V4.xlsm')
    n = int(sys.argv[2]) if len(sys.argv) > 2 else 200
    seed = int(sys.argv[3]) if len(sys.argv) > 3 else 1
    threading.stack_size(1024 * 1024 * 1024)
    res = {}

    def work():
        book = X.Book(src)
        # 1) le moteur de référence reproduit les valeurs enregistrées par Excel
        raw = rawcache.load(src)
        bad = 0
        for key in book.ast:
            v, c = book.cell(key), raw.get(key)
            if isinstance(c, tuple): ok = isinstance(v, X.XLErr) and v.code == c[1]
            elif isinstance(c, bool): ok = v is c
            elif isinstance(c, float): ok = isinstance(v, float) and abs(v - c) <= 1e-6 * max(1, abs(c))
            else: ok = v == c
            bad += not ok
        res['oracle_vs_excel'] = '%d cellules, %d écart(s)' % (len(book.ast), bad)
        # 2) scénarios aléatoires
        rng = random.Random(seed)
        cases = [{'id': 'classeur', 'inputs': {}, 'values': oracle_values(X.Book(src) if False else book, {})}]
        base = {}
        for i in range(n):
            inp = rand_inputs(rng)
            cases.append({'id': 'scénario %d' % (i + 1), 'inputs': inp, 'values': oracle_values(book, inp)})
        res['cases'] = cases
    t = threading.Thread(target=work); t.start(); t.join()
    print('Moteur de référence vs valeurs Excel :', res['oracle_vs_excel'])
    with tempfile.TemporaryDirectory() as d:
        import build_model
        mpath = os.path.join(d, 'model.js')
        with open(mpath, 'w', encoding='utf-8') as f:
            f.write('const SIM_MODEL = ' + json.dumps(build_model.build(src), ensure_ascii=False) + ';\n')
        cpath = os.path.join(d, 'cases.json')
        with open(cpath, 'w') as f: json.dump(res['cases'], f, ensure_ascii=False)
        hpath = os.path.join(d, 'h.js')
        with open(hpath, 'w') as f:
            f.write('const ROOT = %s; const CASES = %s; const MODEL = %s;\n' % (json.dumps(ROOT), json.dumps(cpath), json.dumps(mpath)) + HARNESS)
        out = subprocess.run([JSC, hpath], capture_output=True, text=True)
        if out.returncode != 0:
            print(out.stdout, out.stderr); sys.exit(1)
        r = json.loads(out.stdout.strip().splitlines()[-1])
    print('Site vs classeur : %d scénarios, %d cellules comparées, %d écart(s) — %.0f ms par simulation'
          % (len(res['cases']), r['total'], r['bad'], r['perCase']))
    for s in r['show']: print('  ', s)
    sys.exit(1 if r['bad'] else 0)


if __name__ == '__main__':
    main()
