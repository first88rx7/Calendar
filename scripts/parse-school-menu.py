#!/usr/bin/env python3
"""Parse school lunch/breakfast PDFs into JSON meal rows.

Supports:
  - St. John's Lutheran School landscape Mon–Fri calendar grids
  - West Lutheran / FACTS SIS order calendars (blue = ordered)

Reads a PDF path from argv. Optional: --month YYYY-MM, --filename name.pdf
Prints JSON on stdout.
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from calendar import monthrange
from collections import defaultdict
from datetime import date, timedelta
from pathlib import Path

try:
    import pymupdf
except ImportError:  # pragma: no cover
    try:
        import fitz as pymupdf
    except ImportError:
        print(
            json.dumps(
                {
                    "error": "pymupdf is not installed. On the LXC: pip3 install --break-system-packages pymupdf"
                }
            ),
            file=sys.stderr,
        )
        sys.exit(2)


MONTHS = {
    "january": 1,
    "february": 2,
    "march": 3,
    "april": 4,
    "may": 5,
    "june": 6,
    "july": 7,
    "august": 8,
    "september": 9,
    "october": 10,
    "november": 11,
    "december": 12,
    "jan": 1,
    "feb": 2,
    "mar": 3,
    "apr": 4,
    "jun": 6,
    "jul": 7,
    "aug": 8,
    "sep": 9,
    "sept": 9,
    "oct": 10,
    "nov": 11,
    "dec": 12,
}

WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]

PORTION_RE = re.compile(
    r"""
    \s+
    \d[\d\s/,]*
    (?:oz|floz|ea\.?|pkg|c|cup|cups)
    (?:
        \s*,\s*
        \d[\d\s/,]*
        (?:oz|floz|ea\.?|pkg|c|cup|cups)
    )*
    \s*$
    """,
    re.IGNORECASE | re.VERBOSE,
)
PRICE_RE = re.compile(r"\(\$\d+(?:\.\d{2})?\)")
QTY_RE = re.compile(r"\(x(\d+)\)", re.IGNORECASE)
DAY_NUM_RE = re.compile(r"^\d{1,2}$")
NO_SCHOOL_RE = re.compile(r"no\s*school", re.IGNORECASE)
NO_ORDER_RE = re.compile(r"no school lunch being ordered", re.IGNORECASE)
BOILERPLATE_RE = re.compile(
    r"""
    equal\s+opportunity
    | available\s+daily
    | percent\s+milk
    | ^daily\.?$
    | wg\s*=\s*whole\s+grain
    | ^\*?fresh\s+vegetables
    | cinnamon\s+roll\s+day
    | national\s+\w+\s+month
    | start\s+your\s+day
    """,
    re.IGNORECASE | re.VERBOSE,
)
SIDE_RE = re.compile(
    r"""
    ^(
        fruit(?:\s*cup)?
        | milk
        | juice(?:\s*cup)?
        | fruit,\s*milk
        | juice\s*cup,\s*milk
    )\b
    """,
    re.IGNORECASE | re.VERBOSE,
)
BREAKFAST_HINT = re.compile(
    r"breakfast|pancake|cereal|omelet|hashbrown|muffin|cinni|cinnamon\s+roll|scrambled\s+eggs|yogurt",
    re.IGNORECASE,
)
LUNCH_HINT = re.compile(
    r"\blunch\b|nachos|corn\s*dog|hot\s*dog|taco|meatball|pulled\s+pork|grilled\s+cheese|chick-?fila",
    re.IGNORECASE,
)


def rgb_of(color: int) -> tuple[int, int, int]:
    return (color >> 16) & 255, (color >> 8) & 255, color & 255


def is_blue(color: int) -> bool:
    r, g, b = rgb_of(color)
    return b >= 180 and r < 90 and g < 90


def norm_space(text: str) -> str:
    return re.sub(r"\s+", " ", text).strip()


def extract_spans(page) -> list[dict]:
    out: list[dict] = []
    data = page.get_text("dict")
    for block in data.get("blocks", []):
        if block.get("type") != 0:
            continue
        for line in block.get("lines", []):
            for span in line.get("spans", []):
                text = norm_space(span.get("text") or "")
                if not text:
                    continue
                x0, y0, x1, y1 = span["bbox"]
                color = int(span.get("color") or 0)
                out.append(
                    {
                        "text": text,
                        "x": float(x0),
                        "y": float(y0),
                        "x1": float(x1),
                        "y1": float(y1),
                        "color": color,
                        "blue": is_blue(color),
                        "size": float(span.get("size") or 0),
                    }
                )
    out.sort(key=lambda s: (s["y"], s["x"]))
    return out


def page_text(spans: list[dict]) -> str:
    return " ".join(s["text"] for s in spans)


def parse_month_year(text: str, filename: str, override: str | None) -> tuple[int | None, int | None]:
    year = month = None
    if override:
        m = re.fullmatch(r"(\d{4})-(\d{2})", override)
        if m:
            year, month = int(m.group(1)), int(m.group(2))
    blob = f"{text} {filename}"
    titled = re.search(
        r"(January|February|March|April|May|June|July|August|September|October|November|December)"
        r"\s*,?\s*(\d{4})",
        blob,
        re.IGNORECASE,
    )
    if titled:
        month = month or MONTHS[titled.group(1).lower()]
        year = year or int(titled.group(2))
    if month is None:
        for name, num in MONTHS.items():
            if len(name) < 3:
                continue
            if re.search(rf"\b{name}\b", blob, re.IGNORECASE):
                month = num
                break
    return year, month


def detect_meal_type(text: str, filename: str) -> str | None:
    name = filename.lower()
    if "breakfast" in name:
        return "breakfast"
    if "lunch" in name:
        return "lunch"
    if re.search(r"\bbreakfast\b", text, re.IGNORECASE):
        return "breakfast"
    if re.search(r"\blunch\b", text, re.IGNORECASE):
        return "lunch"
    b = len(BREAKFAST_HINT.findall(text))
    l = len(LUNCH_HINT.findall(text))
    if b > l and b >= 3:
        return "breakfast"
    if l > b and l >= 3:
        return "lunch"
    return None


def detect_person(text: str) -> str | None:
    m = re.search(
        r"(?:Lunch|Breakfast)\s+for\s+([A-Z][a-z'’-]+(?:\s+[A-Z][a-z'’-]+)+)",
        text,
    )
    if m:
        return m.group(1).strip()
    return None


def strip_portion(line: str) -> str:
    cleaned = PORTION_RE.sub("", line).strip(" *")
    cleaned = re.sub(r"^WG\s+", "", cleaned)
    return cleaned.strip(" ,")


def is_boilerplate(line: str) -> bool:
    t = line.strip()
    if not t:
        return True
    if BOILERPLATE_RE.search(t):
        return True
    return False


def is_side(line: str) -> bool:
    return bool(SIDE_RE.match(strip_portion(line) or line))


def kmeans_1d(values: list[float], k: int, iters: int = 24) -> list[float]:
    xs = sorted(values)
    if not xs:
        return []
    if len(xs) <= k:
        return xs
    centers = [xs[int(i * (len(xs) - 1) / (k - 1))] for i in range(k)]
    for _ in range(iters):
        buckets: list[list[float]] = [[] for _ in range(k)]
        for v in xs:
            idx = min(range(k), key=lambda i: abs(v - centers[i]))
            buckets[idx].append(v)
        nxt = []
        for i, bucket in enumerate(buckets):
            nxt.append(sum(bucket) / len(bucket) if bucket else centers[i])
        nxt.sort()
        centers = nxt
    return centers


def nearest_index(value: float, centers: list[float]) -> int:
    return min(range(len(centers)), key=lambda i: abs(value - centers[i]))


def monday_weeks(year: int, month: int) -> list[list[date]]:
    first = date(year, month, 1)
    start = first - timedelta(days=first.weekday())
    weeks: list[list[date]] = []
    cur = start
    for _ in range(6):
        week = [cur + timedelta(days=i) for i in range(5)]
        if any(d.month == month for d in week):
            weeks.append(week)
        cur += timedelta(days=7)
        if cur.month != month and cur > date(year, month, monthrange(year, month)[1]):
            break
    return weeks


def cluster_week_rows(spans: list[dict], gap: float = 28.0) -> list[list[dict]]:
    rows: list[list[dict]] = []
    for span in spans:
        if not rows or span["y"] - rows[-1][-1]["y"] > gap:
            rows.append([span])
        else:
            rows[-1].append(span)
    return rows


def clean_st_johns_title(lines: list[str]) -> tuple[str | None, str]:
    foods = []
    for line in lines:
        if is_boilerplate(line):
            continue
        if NO_SCHOOL_RE.search(line):
            return None, ""
        foods.append(line)
    joined = " ".join(foods)
    if NO_SCHOOL_RE.search(joined):
        return None, ""
    if not foods:
        return None, ""
    entrees = []
    for line in foods:
        if is_side(line):
            continue
        cleaned = strip_portion(line)
        if not cleaned or cleaned.lower().startswith("w/"):
            continue
        entrees.append(cleaned)
    title = entrees[0] if entrees else strip_portion(foods[0])
    if not title:
        return None, ""
    detail_parts = []
    for line in foods:
        cleaned = strip_portion(line)
        if cleaned and cleaned.lower() != title.lower():
            detail_parts.append(cleaned)
    return title, ", ".join(detail_parts)


def parse_st_johns(spans: list[dict], page_width: float, year: int, month: int, filename: str, text: str) -> dict:
    body = [s for s in spans if s["y"] > 120 and not is_boilerplate(s["text"])]
    if not body:
        raise ValueError("Could not find menu items on this St. John's calendar.")
    # Column centers from the denser week rows (skip the first partial week notes).
    xs = [s["x"] for s in body if s["y"] > min(s["y"] for s in body) + 40]
    if len(xs) < 10:
        xs = [s["x"] for s in body]
    centers = kmeans_1d(xs, 5)
    if len(centers) < 5:
        left = 36.0
        centers = [left + i * ((page_width - left) / 5) + 20 for i in range(5)]
    weeks = cluster_week_rows(body)
    cal = monday_weeks(year, month)
    meals = []
    skipped = []
    for wi, row in enumerate(weeks):
        if wi >= len(cal):
            break
        by_col: dict[int, list[str]] = defaultdict(list)
        for span in sorted(row, key=lambda s: (s["y"], s["x"])):
            col = nearest_index(span["x"], centers)
            by_col[col].append(span["text"])
        for col in range(5):
            day = cal[wi][col]
            if day.month != month:
                continue
            lines = by_col.get(col, [])
            title, detail = clean_st_johns_title(lines)
            if not title:
                if lines and NO_SCHOOL_RE.search(" ".join(lines)):
                    skipped.append(f"{day.isoformat()} no school")
                continue
            meals.append(
                {
                    "date": day.isoformat(),
                    "title": title,
                    "detail": detail,
                    "quantity": 1,
                }
            )
    return {
        "kind": "st-johns",
        "school": "St. John's Lutheran School",
        "personHint": None,
        "mealTypeHint": detect_meal_type(text + " " + filename, filename) or "lunch",
        "year": year,
        "month": month,
        "meals": meals,
        "skipped": skipped,
    }


def facts_column_xs(spans: list[dict]) -> list[float]:
    day_spans = [
        s
        for s in spans
        if DAY_NUM_RE.fullmatch(s["text"]) and s["y"] > 50 and s["size"] < 12
    ]
    if len(day_spans) < 7:
        raise ValueError("Could not find day numbers on this FACTS menu.")
    xs = kmeans_1d([s["x"] for s in day_spans], 7)
    if len(xs) != 7:
        raise ValueError("Could not map the FACTS weekday columns.")
    return xs


def facts_week_ys(spans: list[dict]) -> list[float]:
    day_spans = [
        s
        for s in spans
        if DAY_NUM_RE.fullmatch(s["text"]) and s["y"] > 50 and s["size"] < 12
    ]
    ys = sorted(s["y"] for s in day_spans)
    bands = []
    for y in ys:
        if not bands or y - bands[-1] > 18:
            bands.append(y)
    return bands


def assign_col(x: float, col_xs: list[float]) -> int:
    best = 0
    for i, cx in enumerate(col_xs):
        if x + 10 >= cx:
            best = i
    return best


def assign_week(y: float, week_ys: list[float]) -> int | None:
    for i, y0 in enumerate(week_ys):
        y1 = week_ys[i + 1] if i + 1 < len(week_ys) else 10_000
        if y0 - 2 <= y < y1 - 2:
            return i
    return None


def date_for_cell(year: int, month: int, week: int, col: int, day_n: int) -> date:
    """Map a FACTS cell day number onto a real date."""
    first = date(year, month, 1)
    grid_start = first - timedelta(days=(first.weekday() + 1) % 7)  # Sunday-based
    guessed = grid_start + timedelta(days=week * 7 + col)
    # Prefer the printed day number when it is consistent with the grid.
    if guessed.day == day_n:
        return guessed
    # Walk nearby months for that day number at this weekday slot.
    for delta in range(-40, 45):
        d = grid_start + timedelta(days=delta)
        if d.day == day_n and (d - grid_start).days // 7 == week:
            return d
    return guessed


def sunday_grid_start(year: int, month: int) -> date:
    first = date(year, month, 1)
    return first - timedelta(days=(first.weekday() + 1) % 7)


def clean_facts_title(text: str) -> tuple[str | None, str, int]:
    if NO_ORDER_RE.search(text):
        return None, "", 1
    qty = 1
    m = QTY_RE.search(text)
    if m:
        qty = int(m.group(1))
    cleaned = QTY_RE.sub("", text)
    cleaned = PRICE_RE.sub("", cleaned)
    cleaned = norm_space(cleaned).strip(" ,;:-")
    cleaned = re.sub(r"^(Mon|Tue|Tues|Wed|Thu|Thurs|Fri|Sat|Sun)\s+", "", cleaned, flags=re.I)
    if cleaned.lower().startswith("chick-fila"):
        cleaned = "Chick-Fil-A" + cleaned[10:]
    if not cleaned:
        return None, "", qty
    suffix = f" ×{qty}" if qty > 1 and "×" not in cleaned and not re.search(r"\bx2\b", cleaned, re.I) else ""
    parts = [p.strip() for p in re.split(r",(?!\s*\d)", cleaned) if p.strip()]
    if parts:
        parts[0] = re.sub(r"\s+x1$", "", parts[0], flags=re.I)
    if len(parts) > 1 and len(parts[0]) >= 8:
        return parts[0] + suffix, ", ".join(parts[1:]), qty
    return (parts[0] if parts else cleaned) + suffix, "", qty


def facts_options_from_cell(spans: list[dict]) -> list[str]:
    """Prefer blue ordered text; otherwise keep option blocks that include (xN)."""
    legend = {"blue", "=", "items ordered"}
    blue = [s for s in spans if s["blue"] and s["text"].lower() not in legend]
    if blue:
        return [norm_space(" ".join(s["text"] for s in sorted(blue, key=lambda s: (s["y"], s["x"]))))]
    joined = norm_space(" ".join(s["text"] for s in sorted(spans, key=lambda s: (s["y"], s["x"]))))
    joined = re.sub(r"^\d{1,2}\s+", "", joined)
    parts = re.split(r"(\(\$\d+(?:\.\d{2})?\))", joined)
    options = []
    buf = ""
    for part in parts:
        buf += part
        if PRICE_RE.fullmatch(part) or QTY_RE.search(buf) and PRICE_RE.search(buf):
            if QTY_RE.search(buf):
                options.append(norm_space(buf))
            buf = ""
    if buf and QTY_RE.search(buf):
        options.append(norm_space(buf))
    return options


def parse_facts(spans: list[dict], year: int, month: int, filename: str, text: str) -> dict:
    col_xs = facts_column_xs(spans)
    week_ys = facts_week_ys(spans)
    cells: dict[tuple[int, int], list[dict]] = defaultdict(list)
    day_nums: dict[tuple[int, int], int] = {}
    for span in spans:
        if span["y"] < week_ys[0] - 4:
            continue
        if span["text"].lower() in {"sun", "mon", "tue", "wed", "thu", "fri", "sat", "blue"}:
            continue
        week = assign_week(span["y"], week_ys)
        if week is None:
            continue
        col = assign_col(span["x"], col_xs)
        key = (week, col)
        if DAY_NUM_RE.fullmatch(span["text"]) and abs(span["y"] - week_ys[week]) < 14:
            try:
                day_nums[key] = int(span["text"])
            except ValueError:
                pass
            continue
        cells[key].append(span)

    meals = []
    skipped = []
    seen_dates: set[str] = set()
    start = sunday_grid_start(year, month)
    for week in range(len(week_ys)):
        for col in range(7):
            key = (week, col)
            n = day_nums.get(key)
            cell_date = start + timedelta(days=week * 7 + col)
            if n is not None and cell_date.day != n:
                # printed number wins when the Sunday-grid slipped
                cell_date = date_for_cell(year, month, week, col, n)
            if cell_date.month != month or cell_date.year != year:
                continue
            options = facts_options_from_cell(cells.get(key, []))
            titles: list[str] = []
            details: list[str] = []
            qty = 1
            for raw in options:
                title, detail, q = clean_facts_title(raw)
                if not title:
                    if NO_ORDER_RE.search(raw):
                        skipped.append(f"{cell_date.isoformat()} not ordered")
                    continue
                titles.append(title)
                if detail:
                    details.append(detail)
                qty = max(qty, q)
            if not titles:
                continue
            iso = cell_date.isoformat()
            if iso in seen_dates:
                continue
            seen_dates.add(iso)
            meals.append(
                {
                    "date": iso,
                    "title": " · ".join(titles),
                    "detail": "; ".join(details),
                    "quantity": qty,
                }
            )

    person = detect_person(text)
    return {
        "kind": "facts",
        "school": "West Lutheran High School",
        "personHint": person,
        "mealTypeHint": detect_meal_type(text + " " + filename, filename) or "lunch",
        "year": year,
        "month": month,
        "meals": meals,
        "skipped": skipped,
    }


def parse_pdf(path: Path, filename: str, month_override: str | None) -> dict:
    doc = pymupdf.open(path)
    if doc.page_count < 1:
        raise ValueError("That PDF has no pages.")
    page = doc[0]
    spans = extract_spans(page)
    text = page_text(spans)
    year, month = parse_month_year(text, filename, month_override)
    if not month:
        raise ValueError("Could not tell which month this menu is for. Pick a month and try again.")
    if not year:
        raise ValueError("Could not tell which year this menu is for. Pick a month and try again.")

    lower = text.lower()
    if "factsmgt" in lower or "items ordered" in lower or re.search(r"lunch for\s+", lower):
        return parse_facts(spans, year, month, filename, text)
    if page.rect.width > page.rect.height:
        return parse_st_johns(spans, float(page.rect.width), year, month, filename, text)
    # Portrait but not FACTS — still try FACTS-style if there are weekday headers.
    if any(s["text"] in WEEKDAYS for s in spans):
        return parse_facts(spans, year, month, filename, text)
    return parse_st_johns(spans, float(page.rect.width), year, month, filename, text)


def main() -> int:
    parser = argparse.ArgumentParser(description="Parse a school menu PDF")
    parser.add_argument("pdf")
    parser.add_argument("--month", default=None, help="YYYY-MM fallback / override")
    parser.add_argument("--filename", default=None)
    args = parser.parse_args()
    path = Path(args.pdf)
    if not path.is_file():
        print(json.dumps({"error": f"File not found: {path}"}), file=sys.stderr)
        return 1
    filename = args.filename or path.name
    try:
        result = parse_pdf(path, filename, args.month)
    except Exception as exc:
        print(json.dumps({"error": str(exc)}), file=sys.stderr)
        return 1
    json.dump(result, sys.stdout, indent=2)
    sys.stdout.write("\n")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
