#!/usr/bin/env python3
"""One-off: rewrite single-sided physical CSS properties to logical ones so the
stylesheet mirrors automatically under <html dir="rtl">. Safe to re-run."""
import re, glob
R = {'top-left':'start-start','top-right':'start-end','bottom-left':'end-start','bottom-right':'end-end'}
total = 0
for f in sorted(glob.glob('assets/css/*.css')):
    if f.endswith('rtl.css'): continue
    s = open(f, encoding='utf-8').read(); o = s
    s = re.sub(r'(?m)^(\s*)(margin|padding|scroll-margin)-(left|right)(\s*:)', lambda m: f"{m.group(1)}{m.group(2)}-inline-{'start' if m.group(3)=='left' else 'end'}{m.group(4)}", s)
    s = re.sub(r'(?m)^(\s*)border-(left|right)((?:-(?:width|style|color))?\s*:)', lambda m: f"{m.group(1)}border-inline-{'start' if m.group(2)=='left' else 'end'}{m.group(3)}", s)
    s = re.sub(r'(?m)^(\s*)border-(top-left|top-right|bottom-left|bottom-right)-radius(\s*:)', lambda m: f"{m.group(1)}border-{R[m.group(2)]}-radius{m.group(3)}", s)
    s = re.sub(r'(?m)^(\s*)(left|right)(\s*:)', lambda m: f"{m.group(1)}inset-inline-{'start' if m.group(2)=='left' else 'end'}{m.group(3)}", s)
    s = re.sub(r'(?m)^(\s*text-align\s*:\s*)left(\s*[;!])', r'\1start\2', s)
    s = re.sub(r'(?m)^(\s*text-align\s*:\s*)right(\s*[;!])', r'\1end\2', s)
    if s != o:
        open(f, 'w', encoding='utf-8').write(s); total += 1
        print('rewrote', f)
print(total, 'files')
