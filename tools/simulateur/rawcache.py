# Exact cached values from the xlsm XML (type-preserving): '' for empty strings, bool, float, str, error
import re, zipfile, html
from openpyxl.utils import column_index_from_string as ci
def load(path):
    z = zipfile.ZipFile(path)
    wb = z.read('xl/workbook.xml').decode()
    rels = z.read('xl/_rels/workbook.xml.rels').decode()
    rid = dict(re.findall(r'Id="(rId\d+)"[^>]*Target="([^"]+)"', rels)); rid.update({a: b for b, a in re.findall(r'Target="([^"]+)"[^>]*Id="(rId\d+)"', rels)})
    ss = []
    sst = z.read('xl/sharedStrings.xml').decode()
    for si in re.findall(r'<si>(.*?)</si>', sst, re.S):
        ss.append(html.unescape(''.join(re.findall(r'<t[^>]*>(.*?)</t>', si, re.S))))
    out = {}
    for name, r in re.findall(r'<sheet name="([^"]+)"[^>]*r:id="(rId\d+)"', wb):
        name = html.unescape(name)
        x = z.read('xl/' + rid[r]).decode()
        for m in re.finditer(r'<c r="([A-Z]+)(\d+)"([^>]*?)(?:/>|>(.*?)</c>)', x, re.S):
            col, row, attrs, body = m.groups()
            if body is None or '<f' not in body: continue
            t = re.search(r't="(\w+)"', attrs); t = t.group(1) if t else 'n'
            v = re.search(r'<v[^>]*>(.*?)</v>', body, re.S)
            v = html.unescape(v.group(1)) if v else ''
            if t == 'n': val = float(v) if v != '' else None
            elif t == 'b': val = v == '1'
            elif t == 's': val = ss[int(v)]
            elif t == 'e': val = ('ERR', v)
            else: val = v
            out[(name, int(row), ci(col))] = val
    return out
