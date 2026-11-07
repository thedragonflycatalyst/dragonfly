#!/usr/bin/env python3
"""Builds src/data/coach-library.json from the Dragonfly Coach Exercise Library workbook (the source of truth).

usage: python3 scripts/import-coach-library.py Dragonfly_Coach_Exercise_Library.xlsx
Each exercise gets a stable id from its name ("c-barbell-bench-press"); workouts store that id, so renaming an
exercise in the workbook keeps old workouts only if the old name stays as an alternate name (the id follows the name).
"""
import json, re, sys
import openpyxl

FIELDS = ['Name', 'Alternate Names / Search Terms', 'Exercise Category', 'Movement Pattern', 'Exercise Description', 'Type',
          'Main Muscles Worked', 'Other Muscles Worked', 'Equipment', 'Video']
split = lambda s, sep=',': [x.strip() for x in str(s or '').split(sep) if x.strip()]

def section(text, head):
    m = re.search(rf'{head}\n(.*?)(?:\n\n[A-Z &]+\n|$)', text, re.S)
    return m.group(1).strip() if m else ''

ws = openpyxl.load_workbook(sys.argv[1], read_only=True).worksheets[0]
rows = list(ws.iter_rows(values_only=True))
out, ids, group = [], set(), ''
for i, r in enumerate(rows):
    if r[0] and not r[1] and re.search(r'\(\d+\)\s*$', str(r[0])): group = re.sub(r'\s*\(\d+\)\s*$', '', str(r[0]))
    if r[1] != 'Name': continue
    v = {rows[i + j][1]: rows[i + j][2] for j in range(10)}
    assert list(v) == FIELDS, f'row {i + 1}: unexpected block layout'
    name = re.sub(r'^\d+\.\s*', '', str(v['Name'])).strip()
    cid = 'c-' + re.sub(r'[^a-z0-9]+', '-', name.lower()).strip('-')
    assert cid not in ids, f'duplicate id {cid}'
    ids.add(cid)
    d = str(v['Exercise Description'] or '')
    out.append([cid, name, split(v['Alternate Names / Search Terms'], ';'), v['Exercise Category'] or '', v['Type'] or '', v['Movement Pattern'] or '',
                split(v['Main Muscles Worked']), split(v['Other Muscles Worked']), split(v['Equipment']),
                section(d, 'SETUP'), section(d, 'MOVEMENT & RETURN'), section(d, 'KEY CUES'), v['Video'] or '', group])
json.dump({'source': 'Dragonfly Coach Exercise Library', 'rows': out}, open('src/data/coach-library.json', 'w'), separators=(',', ':'), ensure_ascii=False)
print(len(out), 'exercises')
