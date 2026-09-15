"""One-off: win-relay server.py — add grab=1 to /screenshot (skip PrintWindow; focus + ImageGrab of the window rect)
and include rect in /windows entries. Usage: python _patch-relay-grab.py G:\\clawd\\win-relay\\server.py"""
import sys, io
p = sys.argv[1]
s = io.open(p, encoding="utf-8").read()
changed = False
old = '''            # Try PrintWindow first (no focus steal), fall back to ImageGrab
            img = capture_via_printwindow(hwnd)
            if img is None:'''
new = '''            # Try PrintWindow first (no focus steal), fall back to ImageGrab. grab=1 forces the screen grab
            # (PrintWindow returns blank bitmaps for RDP child dialogs).
            img = None if request.args.get("grab") else capture_via_printwindow(hwnd)
            if img is None:'''
if old in s:
    s = s.replace(old, new, 1); changed = True
old2 = '''                results.append({
                    "hwnd": hwnd,
                    "title": title,
                    "process": proc_name,
                    "pid": pid,
                })'''
new2 = '''                try:
                    rect = win32gui.GetWindowRect(hwnd)
                except Exception:
                    rect = (0, 0, 0, 0)
                results.append({
                    "hwnd": hwnd,
                    "title": title,
                    "process": proc_name,
                    "pid": pid,
                    "rect": {"left": rect[0], "top": rect[1], "right": rect[2], "bottom": rect[3]},
                })'''
if old2 in s:
    s = s.replace(old2, new2, 1); changed = True
if changed:
    io.open(p, "w", encoding="utf-8", newline="\n").write(s)
print("patched" if changed else "nothing to patch (already applied?)")
