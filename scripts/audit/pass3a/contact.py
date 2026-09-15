import fitz, sys, os
from PIL import Image
src, outdir = sys.argv[1], sys.argv[2]
os.makedirs(outdir, exist_ok=True)
doc = fitz.open(src)
# contact sheet: 6 columns of thumbnails
thumbs=[]
for i,p in enumerate(doc):
    pix = p.get_pixmap(matrix=fitz.Matrix(0.35,0.35))
    img = Image.frombytes('RGB',[pix.width,pix.height],pix.samples)
    thumbs.append(img)
cols=6; w=max(t.width for t in thumbs); h=max(t.height for t in thumbs)
rows=(len(thumbs)+cols-1)//cols
sheet=Image.new('RGB',(cols*w, rows*h),'white')
from PIL import ImageDraw
dr=ImageDraw.Draw(sheet)
for i,t in enumerate(thumbs):
    x=(i%cols)*w; y=(i//cols)*h
    sheet.paste(t,(x,y)); dr.rectangle([x,y,x+60,y+22],fill='yellow'); dr.text((x+4,y+4),f'p{i+1}',fill='black')
sheet.save(os.path.join(outdir,'contact.png'))
print('sheet', sheet.size, 'pages', len(doc))
