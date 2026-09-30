import math
import numpy as np
import matplotlib.pyplot as plt
from PIL import Image

# --- FAA DOT/FAA/AR-99/11 Appendix A model ---
# Vrel = (-Vx + Vinf, -Vy)
# D    = 0.5*rho*Cd*S*|Vrel|^2
# Dx   = (-Vx + Vinf)*D/|Vrel| ; Dy = (-Vy)*D/|Vrel|
# ax   = Dx/m ; ay = Dy/m
# Euler scheme: V[i] = V[i-1] + a[i-1]*dt
#               X[i] = X[i-1] + V[i-1]*dt + 0.5*a[i-1]*dt^2
#
# JT8D-219:
# LP spool = 8120 rpm; LPT stage-3 blade P/N 798403, 88 blades.
# LPT casing diameter used here = 0.889 m (~35 in): MODEL ASSUMPTION.
# Blade mass/area are also engineering placeholders because public sources
# do not give a verified P/N 798403 mass + frontal dimensions:
#       mass = 0.12 kg, blade envelope = 0.20 x 0.05 m.
# FAA Appendix A: Cd = 1.17 for a tumbling rectangular plate;
# average presented frontal area = 45 degrees.
#
# Flight condition used: 30,000 ft, Mach 0.85.
# "Clock" is the 2-D projected release clock: 0 deg = 12 o'clock;
# clockwise rotation is assumed. "Most severe" = maximum +x excursion.

AIRCRAFT = "/mnt/data/1000086998.png"       # uploaded MD-80 side view
SCALE_PX_M = 29.6                            # side-view scale-bar calibration
ENGINE_X_PX = 806                            # engine centerline in uploaded image
ENGINE_Y_PX = 231                            # engine axis in uploaded image

R = 0.889 / 2                               # m, LPT casing radius (assumed)
RPM = 8120
MASS = 0.12                                 # kg, assumed
BLADE_L = 0.20                              # m, assumed
BLADE_W = 0.05                              # m, assumed
S = BLADE_L * BLADE_W / math.sqrt(2)         # 45-deg presented area
CD = 1.17
ALT = 30_000 * 0.3048                        # m
MACH = 0.85
DT = 0.001
TMAX = 1.5

def isa(h):
    T0, p0, L, Rair, g = 288.15, 101325., 0.0065, 287.05287, 9.80665
    if h <= 11000:
        T = T0 - L*h
        p = p0 * (T/T0)**(g/(Rair*L))
    else:
        T = 216.65
        p = 22632.06 * math.exp(-g*(h-11000)/(Rair*T))
    return p/(Rair*T), math.sqrt(1.4*Rair*T)

rho, a = isa(ALT)
Vinf = MACH * a
Vtip = 2*math.pi*RPM/60 * R

def trajectory(clock_deg):
    q = math.radians(clock_deg)
    # 0 deg = 12 o'clock; clockwise around the 2-D casing circle
    x, y = R*math.sin(q), R*math.cos(q)
    vx, vy = Vtip*math.cos(q), -Vtip*math.sin(q)

    X, Y = [x], [y]
    for _ in range(int(TMAX/DT)):
        vrx, vry = -vx + Vinf, -vy
        vr = math.hypot(vrx, vry)
        D = 0.5*rho*CD*S*vr**2
        ax, ay = vrx*D/(vr*MASS), vry*D/(vr*MASS)

        x += vx*DT + 0.5*ax*DT**2
        y += vy*DT + 0.5*ay*DT**2
        vx += ax*DT
        vy += ay*DT
        X.append(x); Y.append(y)

        if max(abs(x), abs(y)) > 12:
            break
    return np.array(X), np.array(Y)

clocks = np.arange(0, 360, 45)
paths = {int(c): trajectory(c) for c in clocks}
worst = max(clocks, key=lambda c: paths[int(c)][0].max())

# --- scaled MD-80 side view as the plot base ---
img = Image.open(AIRCRAFT).convert("RGBA")
W, H = img.size
extent = ((0-ENGINE_X_PX)/SCALE_PX_M, (W-ENGINE_X_PX)/SCALE_PX_M,
          (ENGINE_Y_PX-H)/SCALE_PX_M, (ENGINE_Y_PX-0)/SCALE_PX_M)

fig, ax = plt.subplots(figsize=(8, 8))
ax.imshow(img, extent=extent, origin="upper", alpha=0.32, zorder=0)

for c, (x, y) in paths.items():
    ax.plot(x, y, lw=1.2, label=f"{c}°")
x, y = paths[int(worst)]
ax.plot(x, y, lw=3, label=f"most severe: {int(worst)}°")

ax.scatter([0], [0], s=18, zorder=4)
ax.set(xlim=(-10, 10), ylim=(-10, 10), aspect="equal",
       xlabel="x (m), engine centerline", ylabel="y (m)")
ax.grid(alpha=0.2)
ax.legend(fontsize=7, ncol=2)
plt.tight_layout()
plt.show()
