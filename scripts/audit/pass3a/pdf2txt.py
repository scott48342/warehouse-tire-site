import fitz, sys, os, re
d = sys.argv[1]
for f in sorted(os.listdir(d)):
    if not f.endswith('.pdf'): continue
    doc = fitz.open(os.path.join(d,f))
    out = os.path.join(d, f[:-4] + '.txt')
    with open(out,'w',encoding='utf-8') as w:
        total=0
        for i,p in enumerate(doc):
            t = p.get_text()
            total += len(t.strip())
            w.write(f'\n===== PAGE {i+1} =====\n{t}')
    print(f, 'pages', len(doc), 'chars', total)
