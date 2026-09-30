#!/usr/bin/env python3
"""
Minimal 2-D aerodynamic trajectory model for uncontained engine debris
per FAA Report DOT/FAA/AR-99/11, Appendix A, Section A.1.1 (pp. A-1..A-2).

Coordinate system (Fig. A-1): origin at engine centerline / LPT release plane;
+x aft along engine centerline (aircraft flight direction); +y vertical (up).
Aircraft velocity is in +x. Gravity acts in -y.

Key model elements (explicit Euler, tumbling rectangular-plate drag):
  relative wind   V_rel = V_debris - V_air
  drag magnitude  D = 0.5 * rho * Cd * A_front * |V_rel|^2
  drag components opposite to V_rel
  accelerations   a = -D/m * unit(V_rel) + g
  integration     explicit Euler with fixed dt

Cd = 1.17 (tumbling rectangular plate).  Average orientation 45 deg used for
frontal area (A_front = A_plan * cos(45°)).

JT8D-219 LPT Stage-3 blade parameters are approximate / representative;
replace with exact values if available.
"""

import numpy as np
import matplotlib.pyplot as plt
from matplotlib.patches import Ellipse, Rectangle, FancyBboxPatch

# ---------------------------------------------------------------------------
# Key parameters (SI) – documented in comments
# ---------------------------------------------------------------------------
# Atmosphere / flight condition (report baseline: 35 000 ft, M = 0.85)
rho      = 0.380          # kg/m^3  (ISA \~35 kft)
V_air_x  = 250.0          # m/s    (Mach 0.85 ≈ 250 m/s TAS)
V_air_y  = 0.0
g        = 9.81           # m/s^2  (down)

# Blade (JT8D-219 LPT Stage 3 – representative values)
m        = 0.35           # kg     (typical LPT blade mass order)
A_plan   = 0.012          # m^2    (planform area of airfoil + platform remnant)
Cd       = 1.17           # tumbling rectangular plate (report p. A-2)
theta_avg = np.deg2rad(45.0)          # average tumbling orientation
A_front  = A_plan * np.cos(theta_avg) # projected frontal area

# Release geometry – top of LPT casing, several clock positions
R_case   = 0.55           # m      (approx outer radius of LPT case)
clocks   = [0, 30, 60, 90, 120, 150, 180]   # deg from top (0 = vertical up)
# most severe (highest residual energy / longest path toward fuselage) is usually
# near 90–120 deg for a rear-fuselage engine; we plot all and highlight 90 deg

# Initial speed (tangential residual after case penetration – typical residual)
V0       = 280.0          # m/s

# Integration
dt       = 0.001          # s
t_max    = 0.25           # s      (covers \~20 m travel)
N        = int(t_max / dt)

# ---------------------------------------------------------------------------
# Explicit Euler trajectory integrator
# ---------------------------------------------------------------------------
def trajectory(x0, y0, vx0, vy0):
    x = np.empty(N+1); y = np.empty(N+1)
    vx = np.empty(N+1); vy = np.empty(N+1)
    x[0], y[0], vx[0], vy[0] = x0, y0, vx0, vy0
    for i in range(N):
        # relative wind
        vrx = vx[i] - V_air_x
        vry = vy[i] - V_air_y
        Vrel = np.hypot(vrx, vry)
        if Vrel < 1e-6:
            ax = 0.0; ay = -g
        else:
            # drag force magnitude and direction (opposite relative velocity)
            D = 0.5 * rho * Cd * A_front * Vrel**2
            ax = - (D / m) * (vrx / Vrel)
            ay = - (D / m) * (vry / Vrel) - g
        # explicit Euler
        vx[i+1] = vx[i] + ax * dt
        vy[i+1] = vy[i] + ay * dt
        x[i+1]  = x[i]  + vx[i] * dt
        y[i+1]  = y[i]  + vy[i] * dt
    return x, y

# ---------------------------------------------------------------------------
# Engine outline (schematic, rear-fuselage JT8D on MD-80)
# x through engine centerline; origin at LPT plane, +x aft
# ---------------------------------------------------------------------------
def plot_engine(ax):
    # simplified nacelle / core outline (side view looking outboard)
    # approximate overall length \~4 m, diameter \~1.1 m for JT8D-200 series
    nacelle = Ellipse((0.0, 0.0), width=4.0, height=1.2,
                      fill=False, lw=1.5, color='k', zorder=5)
    ax.add_patch(nacelle)
    # LPT case (release station)
    case = Ellipse((0.0, 0.0), width=0.3, height=1.1,
                   fill=False, lw=1.2, color='0.3', zorder=6)
    ax.add_patch(case)
    # exhaust nozzle
    nozzle = FancyBboxPatch((1.6, -0.35), 0.8, 0.7,
                            boxstyle="round,pad=0.02",
                            fill=False, lw=1.0, color='0.4')
    ax.add_patch(nozzle)
    ax.plot([-2.0, 2.4], [0, 0], 'k--', lw=0.6, alpha=0.5)  # centerline
    ax.text(0.0, -0.85, 'LPT', ha='center', fontsize=8)

# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
fig, ax = plt.subplots(figsize=(8, 8))
ax.set_aspect('equal')
ax.set_xlim(-10, 10)
ax.set_ylim(-10, 10)
ax.set_xlabel('x  (m)  – aft along engine centerline')
ax.set_ylabel('y  (m)  – vertical')
ax.set_title('JT8D-219 LPT Stage-3 blade trajectories\n'
             'FAA AR-99/11 App. A aerodynamic model  (20 m × 20 m)')
ax.grid(True, alpha=0.3)

plot_engine(ax)

# release points and trajectories
colors = plt.cm.viridis(np.linspace(0.1, 0.9, len(clocks)))
for clk, c in zip(clocks, colors):
    phi = np.deg2rad(clk)          # 0 = top
    x0  = 0.0
    y0  = R_case * np.cos(phi)     # top of casing
    # tangential velocity (direction of rotation assumed positive for +clk)
    # for rear engine the most critical direction is often outboard/up
    vx0 = V0 * np.sin(phi)
    vy0 = V0 * np.cos(phi)
    xs, ys = trajectory(x0, y0, vx0, vy0)
    lw = 2.5 if clk == 90 else 1.2
    ax.plot(xs, ys, color=c, lw=lw, label=f'{clk}° clock')
    ax.plot(x0, y0, 'o', color=c, ms=4)

ax.legend(loc='upper right', fontsize=7, title='release clock')
ax.text(0.02, 0.02,
        'Cd=1.17  A_front=A·cos45°  ρ=0.38 kg/m³  V_air=250 m/s\n'
        'explicit Euler  dt=1 ms   m≈0.35 kg  A_plan≈0.012 m²',
        transform=ax.transAxes, fontsize=7, va='bottom',
        bbox=dict(boxstyle='round', facecolor='white', alpha=0.8))

plt.tight_layout()
plt.savefig('JT8D_LPT3_trajectory_20m.png', dpi=150)
plt.show()