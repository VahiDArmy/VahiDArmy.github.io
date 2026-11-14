import re, glob, sys
FILES=['tokens','base','layout','components','chat','views','settings','animations','responsive']
def strip_comments(s): return re.sub(r'/\*.*?\*/','',s,flags=re.S)
def parse(css):
    """returns list of nodes: ('rule',sel,body) or ('at',header,[children])"""
    i=0; out=[]
    def block(i):
        nodes=[]
        while i<len(css):
            # read prelude until { or } or ;
            j=i; depth_paren=0
            while j<len(css) and css[j] not in '{};' : j+=1
            if j>=len(css): break
            if css[j]=='}': return nodes,j+1
            if css[j]==';': i=j+1; continue
            prelude=css[i:j].strip()
            # find matching }
            k=j+1; d=1
            while k<len(css) and d:
                if css[k]=='{': d+=1
                elif css[k]=='}': d-=1
                k+=1
            inner=css[j+1:k-1]
            if prelude.startswith('@'):
                nodes.append(('at',prelude,inner))
            else: nodes.append(('rule',prelude,inner))
            i=k
        return nodes,i
    nodes,_=block(0); return nodes
def split_top(s,sep):
    out=[];d=0;cur=''
    for ch in s:
        if ch in '([': d+=1
        if ch in ')]': d-=1
        if ch==sep and d==0: out.append(cur);cur=''
        else: cur+=ch
    out.append(cur); return out
def decls(body):
    res=[]
    for d in split_top(body,';'):
        if ':' not in d: continue
        k,v=d.split(':',1); res.append((k.strip(),v.strip()))
    return res
def swap_lr(name): return name.replace('left','\0').replace('right','left').replace('\0','right')
def flip_len(v):
    v=v.strip()
    if v.startswith('-'): return v[1:]
    if v in('0','0px','auto','none'): return v
    if v.startswith('calc(') or v.startswith('var('): return None
    return '-'+v
def tokens(v):
    out=[];d=0;cur=''
    for ch in v:
        if ch=='(': d+=1
        if ch==')': d-=1
        if ch==' ' and d==0:
            if cur: out.append(cur); cur=''
        else: cur+=ch
    if cur: out.append(cur)
    return out
def mirror_decls(ds):
    names={k:v for k,v in ds}
    out=[]
    done=set()
    for k,v in ds:
        imp=''
        if v.endswith('!important'): imp=' !important'; v=v[:-10].strip()
        base=k
        if k in('left','right'):
            o=swap_lr(k)
            if o in names:
                if k not in done: 
                    out.append((k,names[o].replace('!important','').strip()+imp)); out.append((o,v+imp)); done.update([k,o])
            else:
                out.append((k,'auto'+imp)); out.append((o,v+imp)); done.add(k)
        elif re.fullmatch(r'(margin|padding|border|scroll-margin)-(left|right)(-[a-z-]+)?|border-(left|right)(-[a-z]+)?',k):
            o=swap_lr(k)
            if k in done: continue
            if o in names:
                out.append((k,names[o].replace('!important','').strip()+imp)); out.append((o,v+imp)); done.update([k,o])
            else:
                out.append((k,'unset'+imp)); out.append((o,v+imp)); done.add(k)
        elif k in('margin','padding','scroll-padding') :
            t=tokens(v)
            if len(t)==4: out.append((k,' '.join([t[0],t[3],t[2],t[1]])+imp))
        elif k=='border-radius':
            if '/' in v: continue
            t=tokens(v)
            if len(t)==1: continue
            e={2:[t[0],t[1],t[0],t[1]],3:[t[0],t[1],t[2],t[1]],4:t}[len(t)]
            out.append((k,' '.join([e[1],e[0],e[3],e[2]])+imp))
        elif re.fullmatch(r'border-(top|bottom)-(left|right)-radius',k):
            o=k.replace('left','\0').replace('right','left').replace('\0','right')
            if k in done: continue
            if o in names: out.append((k,names[o]+imp)); out.append((o,v+imp)); done.update([k,o])
            else: out.append((k,'0'+imp)); out.append((o,v+imp)); done.add(k)
        elif k in('text-align','float','clear') and v in('left','right'):
            out.append((k,('right' if v=='left' else 'left')+imp))
        elif k in('background-position','transform-origin','object-position','mask-position') and re.search(r'\b(left|right)\b',v):
            out.append((k,re.sub(r'\b(left|right)\b',lambda m:'right' if m.group(1)=='left' else 'left',v)+imp))
        elif k=='transform' and re.search(r'translate(X|3d)?\(',v):
            def fx(m):
                a=m.group(2); parts=split_top(a,',')
                f=flip_len(parts[0])
                if f is None: return m.group(0)
                parts[0]=f; return m.group(1)+'('+','.join(parts)+')'
            nv=re.sub(r'(translateX|translate3d|translate)\(([^)]*(?:\([^)]*\)[^)]*)*)\)',fx,v)
            if nv!=v: out.append((k,nv+imp))
        elif k=='box-shadow' and v!='none':
            layers=split_top(v,','); new=[]; ch=False
            for L in layers:
                t=tokens(L.strip())
                if t and t[0]!='inset' and re.match(r'^-?[\d.]+(px|rem|em)?$',t[0]) and not re.match(r'^-?0(px)?$',t[0]):
                    t[0]=flip_len(t[0]) or t[0]; ch=True
                elif len(t)>1 and t[0]=='inset' and re.match(r'^-?[\d.]+(px)?$',t[1]) and not re.match(r'^-?0(px)?$',t[1]):
                    t[1]=flip_len(t[1]) or t[1]; ch=True
                new.append(' '.join(t))
            if ch: out.append((k,', '.join(new)+imp))
        elif k=='background' or k=='background-image':
            if re.search(r'linear-gradient\(\s*(90deg|270deg|to (left|right))',v):
                nv=v.replace('(90deg','(@@').replace('(270deg','(90deg').replace('(@@','(270deg')
                nv=re.sub(r'to (left|right)',lambda m:'to '+('right' if m.group(1)=='left' else 'left'),nv)
                out.append((k,nv+imp))
    return out
def prefix(sel):
    res=[]
    for s in split_top(sel,','):
        s=s.strip()
        if s.startswith('html'): res.append('html[dir="rtl"]'+s[4:])
        elif s.startswith(':root'): res.append(':root[dir="rtl"]'+s[5:])
        else: res.append('html[dir="rtl"] '+s)
    return ',\n'.join(res)
def emit(nodes,indent=''):
    out=[]
    for n in nodes:
        if n[0]=='rule':
            ds=decls(n[2]); m=mirror_decls(ds)
            if m:
                out.append(f'{indent}{prefix(n[1])} {{\n'+''.join(f'{indent}  {k}: {v};\n' for k,v in m)+f'{indent}}}\n')
        else:
            hdr=n[1]
            if hdr.startswith('@media') or hdr.startswith('@supports'):
                inner=emit(parse(n[2]),indent+'  ')
                if inner: out.append(f'{indent}{hdr} {{\n{inner}{indent}}}\n')
    return ''.join(out)
res=['/* ═══════════════════════════════════════════════════════════════════════════\n   RTL · generated mirror of every physical left/right rule (see README → Languages)\n   Applies only under <html dir="rtl">. Regenerate with tools/rtlgen.py after CSS edits.\n   ═══════════════════════════════════════════════════════════════════════════ */\n']
for f in FILES:
    css=strip_comments(open(f'assets/css/{f}.css').read())
    body=emit(parse(css))
    if body: res.append(f'/* ── {f}.css ── */\n'+body)
# Persian script has a small x-height: lift tiny rem font sizes so micro-labels stay legible.
def tiny(nodes, indent=''):
    out=[]
    for n in nodes:
        if n[0]=='rule':
            for k,v in decls(n[2]):
                m=re.fullmatch(r'([\d.]+)rem',v.strip())
                if k=='font-size' and m and float(m.group(1))<0.72:
                    sel=',\n'.join((x.strip().replace('html','html[lang="fa"]',1) if x.strip().startswith('html') else 'html[lang="fa"] '+x.strip()) for x in split_top(n[1],','))
                    out.append(f'{indent}{sel} {{ font-size: max(0.64rem, {float(m.group(1))*1.2:.3f}rem); }}\n')
        elif n[1].startswith('@media'):
            inner=tiny(parse(n[2]),indent+'  ')
            if inner: out.append(f'{indent}{n[1]} {{\n{inner}{indent}}}\n')
    return ''.join(out)
fa=['/* ── Persian: lift tiny font sizes (generated) ── */']
for f in FILES:
    css=strip_comments(open(f'assets/css/{f}.css').read())
    b=tiny(parse(css))
    if b: fa.append(f'/* {f}.css */\n'+b)
res.append('\n'.join(fa))
res.append(open('tools/rtl.manual.css').read())
open('assets/css/rtl.css','w').write('\n'.join(res))
print(len('\n'.join(res)))
