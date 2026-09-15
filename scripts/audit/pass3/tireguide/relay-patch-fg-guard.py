"""One-off: add foreground guard (/foreground + require_fg on /type and /key) to win-relay server.py."""
import sys, io
p = sys.argv[1]
s = io.open(p, encoding="utf-8").read()
if "def fg_guard" in s:
    print("already patched"); sys.exit(0)

helpers = '''

def fg_info():
    """Foreground window hwnd + title."""
    try:
        hwnd = win32gui.GetForegroundWindow()
        return {"hwnd": hwnd, "title": win32gui.GetWindowText(hwnd)}
    except Exception as e:
        return {"hwnd": 0, "title": "", "error": str(e)}


def fg_guard(data):
    """If request carries require_fg (list of title substrings), refuse unless the foreground
    window title contains one of them. Keeps automation keystrokes out of the wrong window."""
    req = data.get("require_fg")
    if not req:
        return None
    if isinstance(req, str):
        req = [req]
    fg = fg_info()
    title = (fg.get("title") or "").lower()
    if any(x.lower() in title for x in req):
        return None
    return jsonify({"error": "foreground guard", "foreground": fg, "require_fg": req}), 409

'''
anchor = 'os.makedirs(SCREENSHOT_DIR, exist_ok=True)\n'
assert anchor in s
s = s.replace(anchor, anchor + helpers, 1)

route = '''@app.route("/foreground")
def foreground():
    return jsonify(fg_info())


@app.route("/windows")
'''
assert '@app.route("/windows")\n' in s
s = s.replace('@app.route("/windows")\n', route, 1)

t_anchor = '''    if not text:
        return jsonify({"error": "text required"}), 400
'''
assert t_anchor in s
s = s.replace(t_anchor, t_anchor + "    g = fg_guard(data)\n    if g:\n        return g\n", 1)

k_anchor = '''    if not keys:
        return jsonify({"error": "keys required"}), 400
'''
assert k_anchor in s
s = s.replace(k_anchor, k_anchor + "    g = fg_guard(data)\n    if g:\n        return g\n", 1)

io.open(p, "w", encoding="utf-8", newline="\n").write(s)
print("patched", p)
