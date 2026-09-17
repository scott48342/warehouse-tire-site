"""Parse a Tire Guide Pro 'Print All' PDF (Tire Power front counter) into structured JSON. Deterministic (PyMuPDF), no LLM.

usage: python tg-parse.py <pdf> [--out out.json] [--dump]

PDF layout (text mode): header 'Tire Guide Search for: <year> <make words> <model words>', then repeating blocks:
  <Option name>\n Vehicle Option:\n <17 column labels>\n <primary rank 1|2|3>\n <RunFlat Y/N>\n <tire size>\n <front psi or 'Back:'>...
Values appear in a stable order after the labels: rank, run_flat, tire_size, [front psi], 'Back:<psi>' or 'Back:', speed, rim width code,
bolt circle '5-114.3mm', tpms, 'Front:', gvwr base, gvwr max, rim size '15x6-15x7', torque, alt torque, load index.
"""
import sys, re, json
import fitz

TIRE = re.compile(r"^(?:LT|P|T|ST)?\d{2,3}/\d{2,3}\s?Z?RF?\s?\d{2}(?:\.\d)?[A-Z]?(?:/[CDEF])?$|^\d{2}(?:\.\d{1,2})?[xX]\d{1,2}(?:\.\d{1,2})?\s?Z?R\s?\d{2}(?:\.\d)?(?:LT)?(?:/[CDEF])?$")
BOLT = re.compile(r"^(\d)-(\d{2,3}(?:\.\d{1,2})?)mm$", re.I)
RIM = re.compile(r"^(\d{2}(?:\.\d)?)x(\d{1,2}(?:\.\d{1,2})?)(?:-(\d{2}(?:\.\d)?)x(\d{1,2}(?:\.\d{1,2})?))?$", re.I)
LABELS = {"Vehicle Option:", "Torque /", "Standard Tire Size", "Spd Rating", "No. Holes & Bolt Circle", "Base", "Max Gross", "Wheel", "Rim",
          "TPMS", "Alternate Torque", "Primary", "Load Index /", "Diameter", "Run Flat", "Weight", "Rim Size /", "Important Notice:"}
NOISE_PREFIX = ("CAUTION:", "owners manual", "Warehouse Tire", "Phone:", "http", "1100 Cesar", "Tire Guide Pro Warning", "The information contained",
                "modified.", "knowledge, they are", "covered by the", "Page:")
DATE_RE = re.compile(r"^\d{1,2}/\d{1,2}/\d{4}$|^\d{1,2}:\d{2} [AP]M$")


def page_text(pdf):
    doc = fitz.open(pdf)
    return "\n".join(p.get_text("text") for p in doc)


def parse(pdf):
    lines = [l.strip() for l in page_text(pdf).splitlines()]
    hdr = {"year": None, "make_model_raw": None}
    for l in lines[:20]:
        m = re.match(r"Tire Guide Search for:\s*(\d{4})\s+(.*)", l, re.I)
        if m:
            hdr["year"] = int(m.group(1)); hdr["make_model_raw"] = m.group(2).strip(); break

    # locate option blocks: the line BEFORE 'Vehicle Option:' is the option name
    idx = [i for i, l in enumerate(lines) if l == "Vehicle Option:"]
    options = {}
    order = []
    for k, i in enumerate(idx):
        name = lines[i - 1] if i > 0 else "?"
        end = idx[k + 1] - 1 if k + 1 < len(idx) else len(lines)
        vals = [l for l in lines[i + 1:end] if l and l not in LABELS and not l.startswith(NOISE_PREFIX) and not l.startswith("Important")]
        # drop label-ish leftovers and page headers repeated on page breaks
        vals = [v for v in vals if not re.match(r"Tire Guide Search for:", v) and not DATE_RE.match(v)]
        row = {"rank": None, "run_flat": None, "tire_size": None, "inflation_front": None, "inflation_rear": None, "speed": None,
               "rim_width_code": None, "bolt_circle": None, "tpms": None, "gvwr_base": None, "gvwr_max": None, "rim_size": None,
               "torque_ftlb": None, "wheelbase_in": None, "load_index": None, "_unparsed": []}
        yn = []
        nums = []
        for v in vals:
            if TIRE.match(v.replace(" ", "")):
                row["tire_size"] = v.replace(" ", ""); continue
            if BOLT.match(v):
                m = BOLT.match(v); row["bolt_circle"] = f"{m.group(1)}x{m.group(2)}"; continue
            if RIM.match(v) and row["tire_size"] is not None and row["rim_size"] is None:
                row["rim_size"] = v.lower(); continue
            if re.fullmatch(r"[YN]", v):
                yn.append(v); continue
            if re.fullmatch(r"[1-3]", v) and row["rank"] is None and row["tire_size"] is None:
                row["rank"] = int(v); continue
            if re.fullmatch(r"[A-Z]", v) and row["speed"] is None:
                row["speed"] = v; continue
            m = re.fullmatch(r"Back:\s*(\d{2})?", v)
            if m:
                row["inflation_rear"] = int(m.group(1)) if m.group(1) else None; continue
            if v == "Front:":
                continue
            m = re.fullmatch(r"(\d{1,2}),(\d{3})", v)
            if m:
                g = int(m.group(1) + m.group(2))
                if row["gvwr_max"] is None: row["gvwr_max"] = g
                elif row["gvwr_base"] is None: row["gvwr_base"] = g
                else: row["_unparsed"].append(v)
                continue
            if re.fullmatch(r"\d{1,2}(?:\.\d{1,2})?(?:J{1,2}|JJ|JK|K|B)?(?:-\d{1,2}(?:\.\d)?J{0,2})?", v) and row["tire_size"] is not None and row["rim_width_code"] is None and not re.fullmatch(r"\d{2,3}", v):
                row["rim_width_code"] = v; continue
            if re.fullmatch(r"\d{2,3}", v):
                nums.append(int(v)); continue
            row["_unparsed"].append(v)
        # y/n order in print: run_flat first (before tire size), tpms after bolt circle
        if yn:
            row["run_flat"] = yn[0]
            if len(yn) > 1: row["tpms"] = yn[1]
        # numeric order in print: [front psi right after tire size], then after rim size: load index, torque, wheelbase
        # front psi = first 2-digit number that appears BEFORE 'Back:' — detect by position in vals
        try:
            ti = next(i for i, v in enumerate(vals) if v.replace(" ", "") == row["tire_size"])
            nxt = vals[ti + 1] if ti + 1 < len(vals) else ""
            if re.fullmatch(r"\d{2}", nxt):
                row["inflation_front"] = int(nxt); nums.remove(int(nxt))
        except StopIteration:
            pass
        # The trailing block is POSITIONAL: the values right after the rim size are [load index, torque, wheelbase].
        # A second wheelbase (longer variant) is printed between Max Gross and Base weight, so pooling all
        # integers and taking the last three shifted the columns (2021 Silverado: LI=157 torque=115). Fixed 2026-09-17.
        NUM = re.compile(r"^\d{2,3}(?:\.\d{1,2})?$")
        start = None
        if row["rim_size"] is not None:
            start = next((i for i, v in enumerate(vals) if v.lower() == row["rim_size"]), None)
        if start is None:
            # no rim size on this line: start after the last weight / 'Front:' token
            wi = [i for i, v in enumerate(vals) if v == "Front:" or re.fullmatch(r"\d{1,2},\d{3}", v)]
            start = wi[-1] if wi else -1
        tail = []
        for v in vals[start + 1:]:
            if NUM.match(v):
                tail.append(float(v) if "." in v else int(v))
            elif tail:
                break
        tail = tail[:3]
        if len(tail) == 3:
            row["load_index"], row["torque_ftlb"], row["wheelbase_in"] = tail
        elif len(tail) == 2:
            # [LI, torque] normally; a decimal second value can only be a wheelbase
            if isinstance(tail[1], float): row["load_index"], row["wheelbase_in"] = tail
            else: row["load_index"], row["torque_ftlb"] = tail
        elif len(tail) == 1:
            row["load_index"] = tail[0]
        for k in ("load_index", "torque_ftlb"):
            if isinstance(row[k], float): row[k] = int(row[k]) if row[k] == int(row[k]) else row[k]
        # values consumed positionally must not linger in _unparsed
        row["_unparsed"] = [u for u in row["_unparsed"] if not (NUM.match(u) and "." in u)]
        if not row["_unparsed"]:
            del row["_unparsed"]
        if name not in options:
            options[name] = []; order.append(name)
        options[name].append(row)
    out = [{"option": n, "sizes": options[n]} for n in order]
    return {"header": hdr, "n_options": len(out), "n_sizes": sum(len(o["sizes"]) for o in out), "options": out}


if __name__ == "__main__":
    a = sys.argv[1:]
    if not a:
        print(__doc__); sys.exit(2)
    if "--dump" in a:
        print(page_text(a[0])); sys.exit(0)
    res = parse(a[0])
    if "--out" in a:
        o = a[a.index("--out") + 1]
        with open(o, "w", encoding="utf-8") as f:
            json.dump(res, f, indent=1)
        print(f"{o}: {res['n_options']} options, {res['n_sizes']} sizes")
    else:
        print(json.dumps(res, indent=1))
