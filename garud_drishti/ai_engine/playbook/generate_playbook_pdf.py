"""
SOC Incident Response Playbook – PDF Generator
================================================
Pixel-aligned template (A4, section headers, justified body).

Public API: generate_playbook_pdf(playbook_data, output_path)
"""

from __future__ import annotations

import logging
from pathlib import Path
from textwrap import wrap
from typing import Any

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.pdfgen import canvas as rl_canvas

logger = logging.getLogger(__name__)

TITLE_COLOR = colors.Color(0.078, 0.157, 0.314)
BODY_COLOR = colors.Color(0.196, 0.196, 0.196)
HEADING_COLOR = colors.black
HEADER_BG = colors.Color(0.902, 0.902, 0.902)

PAGE_W, PAGE_H = A4
LEFT_X = 28.35
RIGHT_X = 566.93
CONTENT_LEFT = 31.2
CONTENT_RIGHT = 564.1
CONTENT_WIDTH = CONTENT_RIGHT - CONTENT_LEFT

TITLE_X = 24.23
TITLE_Y = 34.6

HEADER_H = 22.68
HEADER_TXT_OFFSET = 5.43

TITLE_SIZE = 16.0
HEADING_SIZE = 12.0
BODY_SIZE = 10.0
BODY_LH = 14.0
SECTION_POST_GAP = 10.0
HEADER_PRE_GAP = 8.0


def _rl(top: float) -> float:
    return PAGE_H - top


class PlaybookPDFWriter:
    def __init__(self, output_path: str, title: str):
        self.output_path = output_path
        self.title = title
        Path(output_path).parent.mkdir(parents=True, exist_ok=True)
        self.c = rl_canvas.Canvas(output_path, pagesize=A4)
        self._cursor = 0.0
        self._start_page()

    def _start_page(self):
        self.c.setFont("Helvetica-Bold", TITLE_SIZE)
        self.c.setFillColor(TITLE_COLOR)
        self.c.drawString(TITLE_X, _rl(TITLE_Y + TITLE_SIZE), self.title)
        sep_y = TITLE_Y + TITLE_SIZE + 8
        self.c.setStrokeColor(colors.Color(0.7, 0.7, 0.7))
        self.c.setLineWidth(0.5)
        self.c.line(LEFT_X, _rl(sep_y), RIGHT_X, _rl(sep_y))
        self._cursor = sep_y + 12

    def _new_page(self):
        self.c.showPage()
        self._start_page()

    def _ensure_space(self, needed: float):
        bottom_margin = 30.0
        if self._cursor + needed > PAGE_H - bottom_margin:
            self._new_page()

    def _advance(self, pts: float):
        self._cursor += pts

    def draw_section_header(self, text: str):
        self._ensure_space(HEADER_H + 20)
        rx = LEFT_X
        ry = _rl(self._cursor + HEADER_H)
        self.c.setFillColor(HEADER_BG)
        self.c.rect(rx, ry, RIGHT_X - LEFT_X, HEADER_H, fill=1, stroke=0)
        self.c.setFont("Helvetica-Bold", HEADING_SIZE)
        self.c.setFillColor(HEADING_COLOR)
        text_y = _rl(self._cursor + HEADING_SIZE + HEADER_TXT_OFFSET)
        self.c.drawString(CONTENT_LEFT, text_y, text)
        self._advance(HEADER_H + 8)

    def draw_body_paragraph(self, text: str, indent: float = 0):
        usable_width = CONTENT_WIDTH - indent
        avg_char_w = BODY_SIZE * 0.52
        chars_per_line = max(10, int(usable_width / avg_char_w))
        lines = wrap(text, chars_per_line) or [text]

        for i, line in enumerate(lines):
            self._ensure_space(BODY_LH + 4)
            x = CONTENT_LEFT + (indent if i > 0 else 0)
            is_last = i == len(lines) - 1
            self.c.setFont("Helvetica", BODY_SIZE)
            self.c.setFillColor(BODY_COLOR)
            if not is_last and len(lines) > 1:
                self._draw_justified(line, x, self._cursor + BODY_SIZE, CONTENT_RIGHT - x)
            else:
                self.c.drawString(x, _rl(self._cursor + BODY_SIZE), line)
            self._advance(BODY_LH)

    def _draw_justified(self, text: str, x: float, top: float, width: float):
        words = text.split()
        if len(words) <= 1:
            self.c.drawString(x, _rl(top), text)
            return
        total_word_w = sum(self.c.stringWidth(w, "Helvetica", BODY_SIZE) for w in words)
        space_count = len(words) - 1
        if space_count == 0:
            self.c.drawString(x, _rl(top), text)
            return
        space_w = (width - total_word_w) / space_count
        cur_x = x
        for j, word in enumerate(words):
            self.c.drawString(cur_x, _rl(top), word)
            cur_x += self.c.stringWidth(word, "Helvetica", BODY_SIZE)
            if j < len(words) - 1:
                cur_x += space_w

    def draw_bullet(self, text: str):
        prefix = "- "
        prefix_w = self.c.stringWidth(prefix, "Helvetica", BODY_SIZE)
        usable_w = CONTENT_WIDTH - prefix_w
        avg_char_w = BODY_SIZE * 0.52
        chars_per_line = max(10, int(usable_w / avg_char_w))
        lines = wrap(text, chars_per_line) or [text]

        for i, line in enumerate(lines):
            self._ensure_space(BODY_LH + 4)
            self.c.setFont("Helvetica", BODY_SIZE)
            self.c.setFillColor(BODY_COLOR)
            if i == 0:
                self.c.drawString(CONTENT_LEFT, _rl(self._cursor + BODY_SIZE), prefix + line)
            else:
                self.c.drawString(CONTENT_LEFT + prefix_w, _rl(self._cursor + BODY_SIZE), line)
            self._advance(BODY_LH)

    def draw_numbered(self, n: int, text: str):
        prefix = f"{n}. "
        prefix_w = self.c.stringWidth(prefix, "Helvetica", BODY_SIZE)
        usable_w = CONTENT_WIDTH - prefix_w
        avg_char_w = BODY_SIZE * 0.52
        chars_per_line = max(10, int(usable_w / avg_char_w))
        lines = wrap(text, chars_per_line) or [text]

        for i, line in enumerate(lines):
            self._ensure_space(BODY_LH + 4)
            self.c.setFont("Helvetica", BODY_SIZE)
            self.c.setFillColor(BODY_COLOR)
            if i == 0:
                self.c.drawString(CONTENT_LEFT, _rl(self._cursor + BODY_SIZE), prefix + line)
            else:
                self.c.drawString(CONTENT_LEFT + prefix_w, _rl(self._cursor + BODY_SIZE), line)
            self._advance(BODY_LH)

    def section_gap(self):
        self._advance(SECTION_POST_GAP)

    def pre_header_gap(self):
        self._advance(HEADER_PRE_GAP)

    def save(self):
        self.c.save()


def _phase_steps(steps_raw: list[Any], key: str) -> list[str]:
    out: list[str] = []
    if not isinstance(steps_raw, list):
        return out
    for s in steps_raw:
        if not isinstance(s, dict):
            continue
        if str(s.get("phase") or "") != key:
            continue
        purpose = str(s.get("purpose") or "").strip()
        action = str(s.get("action") or "").strip()
        if purpose:
            out.append(purpose if not action else f"[{action}] {purpose}")
        elif action:
            out.append(action)
    return out


def generate_playbook_pdf(playbook_data: dict[str, Any], output_path: str) -> None:
    """
    playbook_data must be fully populated by PlaybookGenerator (no fabricated defaults here).
    Expected keys: incident_id, playbook_title, severity_label, reason, key_indicators,
    steps (list of {phase, action, purpose}), automation_candidates, analyst_notes,
    incident_overview.
    """
    inc_id = str(playbook_data.get("incident_id") or "INC-UNKNOWN")
    pb_title = str(playbook_data.get("playbook_title") or inc_id)
    severity = str(playbook_data.get("severity_label") or "")
    reason = str(playbook_data.get("reason") or "")
    indicators = playbook_data.get("key_indicators")
    if not isinstance(indicators, list):
        indicators = []
    steps_raw = playbook_data.get("steps")
    if not isinstance(steps_raw, list):
        steps_raw = []
    auto_cands = playbook_data.get("automation_candidates")
    if not isinstance(auto_cands, list):
        auto_cands = []
    analyst = str(playbook_data.get("analyst_notes") or "").strip()
    overview = str(playbook_data.get("incident_overview") or "").strip()

    inv_steps = _phase_steps(steps_raw, "INVESTIGATION_STEPS")
    cont_actions = _phase_steps(steps_raw, "CONTAINMENT_ACTIONS")
    erad_actions = _phase_steps(steps_raw, "ERADICATION_ACTIONS")
    rec_steps = _phase_steps(steps_raw, "RECOVERY_STEPS")

    title_line = f"SOC Incident Response Playbook: {pb_title}"
    w = PlaybookPDFWriter(output_path, title_line)

    w.draw_section_header("INCIDENT OVERVIEW")
    w.draw_body_paragraph(overview or reason or f"Incident {inc_id}.")
    w.section_gap()

    w.pre_header_gap()
    w.draw_section_header("RISK ASSESSMENT")
    w.draw_body_paragraph(f"Severity: {severity}" if severity else "Severity: (see incident risk data)")
    w.draw_body_paragraph(f"Reason: {reason}" if reason else "Reason: (see correlation and telemetry context)")
    w.section_gap()

    w.pre_header_gap()
    w.draw_section_header("KEY INDICATORS")
    for ind in indicators:
        w.draw_bullet(str(ind).strip())
    if not indicators:
        w.draw_bullet("(No indicators supplied.)")
    w.section_gap()

    w.pre_header_gap()
    w.draw_section_header("INVESTIGATION STEPS")
    for i, step in enumerate(inv_steps, 1):
        w.draw_numbered(i, step)
    if not inv_steps:
        w.draw_body_paragraph("(No investigation steps.)")
    w.section_gap()

    w.pre_header_gap()
    w.draw_section_header("CONTAINMENT ACTIONS")
    for act in cont_actions:
        w.draw_bullet(act)
    if not cont_actions:
        w.draw_bullet("(No containment actions.)")
    w.section_gap()

    w.pre_header_gap()
    w.draw_section_header("ERADICATION ACTIONS")
    for act in erad_actions:
        w.draw_bullet(act)
    if not erad_actions:
        w.draw_bullet("(No eradication actions.)")
    w.section_gap()

    w.pre_header_gap()
    w.draw_section_header("RECOVERY STEPS")
    for step in rec_steps:
        w.draw_bullet(step)
    if not rec_steps:
        w.draw_bullet("(No recovery steps.)")
    w.section_gap()

    w.pre_header_gap()
    w.draw_section_header("AUTOMATION OPPORTUNITIES")
    for a in auto_cands:
        w.draw_bullet(str(a).strip())
    if not auto_cands:
        w.draw_bullet("(No automation candidates.)")
    w.section_gap()

    w.pre_header_gap()
    w.draw_section_header("ANALYST NOTES")
    w.draw_body_paragraph(analyst or "(None)")

    w.save()
    logger.info("Playbook PDF written: %s", output_path)
