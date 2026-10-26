"""Validated calibration edits applied before artifact checksums and storage."""
import math
import re


def validate_calibration(options, printer):
    bounds = {"Temperature": (130, 350), "Pressure Advance": (0, 1), "Flow Ratio": (.5, 1.5), "Retraction": (0, 8), "Volumetric Speed": (.1, 100)}
    kind, start, end, step = (options[key] for key in ("kind", "start", "end", "step"))
    low, high = bounds[kind]
    if not all(math.isfinite(v) for v in (start, end, step)) or step == 0 or (end - start) / step < 1 or (end - start) / step > 29 or min(start, end) < low or max(start, end) > high:
        raise ValueError(f"Invalid {kind} calibration range; use 2–30 values between {low} and {high}")
    if kind in {"Pressure Advance", "Retraction"} and str(printer.get("gcode_flavor", "")).lower() != "klipper":
        raise ValueError("Pressure advance and retraction towers currently require a Klipper printer preset")


def apply_calibration(content, options):
    text = content.decode("utf-8")
    kind, start, end, step = (options[key] for key in ("kind", "start", "end", "step"))
    last_band = -1
    value = start
    output = []
    x = y = e = 0.0
    relative_e = False
    for line in text.splitlines():
        command = line.split(";", 1)[0].strip()
        if command.startswith("M83"):
            relative_e = True
        elif command.startswith("M82"):
            relative_e = False
        axes = {key.upper(): float(v) for key, v in re.findall(r"([XYZEF])(-?(?:\d+(?:\.\d*)?|\.\d+))", command, re.I)}
        if command.startswith("G92") and "E" in axes:
            e = axes["E"]
        height = re.match(r";\s*(?:Z|Z_HEIGHT)\s*:\s*([\d.]+)", line, re.I)
        if height:
            band = max(0, min(int((float(height[1]) - .001) / options.get("bandHeight", 5)), int(round((end - start) / step))))
            if band != last_band:
                value = round(start + band * step, 6)
                last_band = band
                output.append(line)
                output.append(f"; PrintHub {kind}: {value}")
                if kind == "Temperature":
                    output.append(f"M104 S{value:g}")
                elif kind == "Flow Ratio":
                    output.append(f"M221 S{value * 100:g}")
                elif kind == "Pressure Advance":
                    output.append(f"SET_PRESSURE_ADVANCE ADVANCE={value:g}")
                elif kind == "Retraction":
                    output.append(f"SET_RETRACTION RETRACT_LENGTH={value:g}")
                continue
        if re.match(r"G[01](?:\s|$)", command):
            next_x, next_y = axes.get("X", x), axes.get("Y", y)
            extrusion = axes.get("E", 0) if relative_e else axes.get("E", e) - e
            distance = math.hypot(next_x - x, next_y - y)
            if kind == "Volumetric Speed" and extrusion > 0 and distance > .01:
                area = extrusion * math.pi * (1.75 / 2) ** 2 / distance
                feed = min(30000, value / area * 60)
                body, separator, comment = line.partition(";")
                body = re.sub(r"\bF[\d.]+", "", body).rstrip() + f" F{feed:.1f}"
                line = body + (f" ;{comment}" if separator else "")
            x, y = next_x, next_y
            if not relative_e and "E" in axes:
                e = axes["E"]
        output.append(line)
    if last_band < 0:
        raise ValueError("Calibration output has no Orca layer-height markers")
    if kind == "Flow Ratio":
        output.append("M221 S100 ; restore flow multiplier")
    return ("\n".join(output) + "\n").encode()
