import fitz, sys, os
src, outdir = sys.argv[1], sys.argv[2]; pages=[int(x) for x in sys.argv[3].split(',')]
zoom=float(sys.argv[4]) if len(sys.argv)>4 else 2.0
os.makedirs(outdir, exist_ok=True)
doc = fitz.open(src)
for pn in pages:
    pix = doc[pn-1].get_pixmap(matrix=fitz.Matrix(zoom,zoom))
    out=os.path.join(outdir,f'p{pn}.png'); pix.save(out); print(out, pix.width, pix.height)
