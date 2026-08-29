// Full material pass: printer -> paper substrate -> parametric damage ->
// hand-painted damage mask -> scanner capture. Physically ordered so it reads
// as a real sheet going through a real process, not stacked filters.
//
// Two principles keep it from turning the image to mush:
//  1. MASTER INTENSITY. The whole pipeline runs, then the result is mixed back
//     toward the original by u_intensity. 0 = untouched, 1 = full physical layer.
//  2. RESOLUTION AWARENESS. Feature sizes (halftone dots, noise, dust) scale
//     with the image's own resolution (u_dpiScale) so a 300px thumbnail and a
//     4000px poster both look physically plausible instead of identical.

import { NOISE_GLSL } from './common.glsl'

export const MATERIAL_FRAG = `#version 300 es
precision highp float;

in vec2 v_uv;
out vec4 outColor;

uniform sampler2D u_src;
uniform vec2  u_resolution;
uniform float u_seed;
uniform float u_intensity;   // master 0..1
uniform float u_dpiScale;    // ~ max(res)/1400, clamped

uniform int u_paperType;
uniform int u_printerType;
uniform int u_prepress;      // 0 full 1 cmyk 2 gray 3 blackInk 4 newspaper 5 riso
uniform int u_scannerMode;   // 0 none 1 home 2 pro 3 phone
uniform vec3 u_paperColor;   // base paper stock colour

// per-engine master switches (0 = engine fully skipped)
uniform int u_paperOn;
uniform int u_printerOn;
uniform int u_damageOn;
uniform int u_scannerOn;

uniform float u_yellowing, u_fibers, u_roughness, u_thickness;
uniform float u_stains, u_moisture, u_creases, u_pScratches;
uniform float u_halftone, u_inkDensity, u_colorShift, u_registration, u_fade;
uniform float u_dpi, u_dotGain;
uniform float u_dScratches, u_abrasions, u_worn, u_paperDamage;
uniform float u_scNoise, u_scDust, u_scStreaks, u_scDistortion, u_scColor;
uniform float u_scJpeg, u_scBlur, u_scExposure;

// scratch pattern (replaces the old sandpaper tool)
uniform int   u_scratchOn;      // 0/1
uniform int   u_scratchPattern; // 0 fine 1 coarse 2 crosshatch 3 directional 4 random
uniform float u_scratchAmount;
uniform float u_scratchAngle;   // degrees
uniform float u_scratchDepth;

// colour presentation
uniform int   u_colorMode;      // 0 color 1 bw 2 tint
uniform vec3  u_tint;

// role-bound scanned textures (luminance used; colour ignored). Each is fed
// into its own pipeline stage and driven by the matching parametric slider.
uniform sampler2D u_paperTex;   // paper substrate fibre / tone
uniform int   u_paperTexOn;
uniform float u_paperTexAmt;
uniform float u_paperTexMid;
uniform vec2  u_paperTexRes;
uniform sampler2D u_stainTex;   // ageing stains / foxing (damage stage)
uniform int   u_stainTexOn;
uniform float u_stainTexAmt;
uniform float u_stainTexMid;
uniform vec2  u_stainTexRes;
uniform sampler2D u_scanTex;    // scanner dust / streaks / hairs
uniform int   u_scanTexOn;
uniform float u_scanTexAmt;
uniform float u_scanTexMid;
uniform vec2  u_scanTexRes;

${NOISE_GLSL}

// --- colour helpers: work in linear light so B&W keeps highlight/shadow detail
vec3 toLinear(vec3 c) { return pow(max(c, 0.0), vec3(2.2)); }
vec3 toGamma(vec3 c) { return pow(max(c, 0.0), vec3(1.0 / 2.2)); }
float lumaLin(vec3 c) { return dot(toLinear(c), vec3(0.2126, 0.7152, 0.0722)); }
// gamma-correct grey: proper luminance conversion, not a flat desaturation
float toneGray(vec3 c) { return toGamma(vec3(lumaLin(c))).r; }

// Colour preparation applied BEFORE any printing (prepress separation).
vec3 prepress(vec3 c, int mode) {
  if (mode == 2) {                       // Grayscale
    return vec3(toneGray(c));
  } else if (mode == 3) {                // Black Ink (single-ink, detail kept)
    float g = toneGray(c);
    return vec3(clamp((g - 0.5) * 1.06 + 0.5, 0.0, 1.0));
  } else if (mode == 4) {                // Newspaper (neutral grey, faint warm black)
    float g = toneGray(c);
    return clamp(vec3(g) * vec3(1.0, 0.99, 0.96), 0.0, 1.0);
  } else if (mode == 5) {                // Risograph (limited warm duotone + hue hint)
    float g = toneGray(c);
    vec3 duo = mix(vec3(0.10, 0.10, 0.16), vec3(1.0), g);
    return clamp(mix(duo, c, 0.35), 0.0, 1.0);
  } else if (mode == 1) {                // CMYK Offset (soft-clip to printable gamut)
    float mx = max(max(c.r, c.g), c.b);
    float mn = min(min(c.r, c.g), c.b);
    float sat = mx - mn;
    vec3 desat = mix(c, vec3(toneGray(c)), 0.08);
    return clamp(mix(desat, c, 1.0 - sat * 0.15), 0.0, 1.0);
  }
  return c;                              // Full Color
}

// Prepressed source sample: the colour that actually reaches the plate. Used
// for neighbourhood sampling (ink spread / detail loss) so absorption works on
// the printed ink, not the raw screen pixels.
vec3 srcPrep(vec2 p) { return prepress(texture(u_src, p).rgb, u_prepress); }

// One printed halftone dot cell. Returns ink coverage 0..1 for the cell that
// fragPx falls in: a real screen dot whose radius grows with ink amount, so a
// tonal image is reproduced by dot SIZE (AM screening) — not a digital blur.
// cellPx = dot pitch in pixels (from DPI); gain fattens the dot (dot gain).
float halftoneCoverage(vec2 fragPx, float ink, float angleDeg, float cellPx, float gain) {
  float a = radians(angleDeg);
  mat2 rot = mat2(cos(a), -sin(a), sin(a), cos(a));
  vec2 p = rot * fragPx / max(cellPx, 1.0);
  vec2 cell = fract(p) - 0.5;
  float d = length(cell);
  float cov = clamp(ink, 0.0, 1.0);
  cov = clamp(cov + gain * 0.45 * sin(cov * 3.14159), 0.0, 1.0); // dot gain fattens mids
  float radius = sqrt(cov) * 0.63;
  float aa = fwidth(d) + 0.015 + gain * 0.06;                    // paper/edge softness
  return 1.0 - smoothstep(radius - aa, radius + aa, d);
}

// Seed-driven placement of a role texture: cover-fit to the image aspect, then
// tile / rotate / offset by the seed so the same scan never repeats identically.
vec2 analogUV(vec2 uv, vec2 texRes, float tile, float sd) {
  float rot = radians(mod(sd * 47.0, 360.0));
  mat2 R = mat2(cos(rot), -sin(rot), sin(rot), cos(rot));
  float imgA = u_resolution.x / max(u_resolution.y, 1.0);
  float texA = texRes.x / max(texRes.y, 1.0);
  vec2 cover = imgA > texA ? vec2(1.0, texA / imgA) : vec2(imgA / texA, 1.0);
  vec2 p = (uv - 0.5) / cover;
  p = R * p * tile + 0.5 + vec2(fract(sd * 0.317), fract(sd * 0.719));
  return fract(p);
}

void main() {
  vec2 res = u_resolution;
  float ds = u_dpiScale;          // feature-size multiplier (bigger image -> bigger features)
  float nf = 1.0 / max(ds, 0.35); // noise frequency divisor (keeps grain fine on big images)
  vec2 uv = v_uv;
  vec2 texel = 1.0 / res;

  // ---- scanner geometric distortion (gentle, scaled) --------------------
  if (u_scannerOn == 1 && u_scannerMode != 0 && u_scDistortion > 0.001) {
    vec2 c = uv - 0.5;
    float r2 = dot(c, c);
    uv = 0.5 + c * (1.0 + u_scDistortion * 0.12 * r2);
    uv += vec2(sin(uv.y * 40.0 + u_seed) * 0.0006, 0.0) * u_scDistortion * 2.5;
  }

  vec2 px = uv * res;
  vec2 npx = px * nf;             // resolution-normalized coords for noise
  vec4 src = texture(u_src, uv);
  if (src.a < 0.001) { outColor = vec4(0.0); return; }
  vec3 orig = texture(u_src, v_uv).rgb; // pristine reference (undistorted)
  vec3 col = src.rgb;

  // ---- PAPER STOCK (the substrate the ink sits on) ----------------------
  // Computed up front (independent of engine toggles) because the printer
  // needs to know how the sheet takes ink, and damage needs the true paper
  // tone to expose. absorb = how much ink soaks & spreads; maxDensity = the
  // deepest reflectance the sheet can hold (so black is never pure #000).
  vec3 paperBase = u_paperColor;              // user paper colour
  float pAbsorb = 0.45, pMaxDensity = 0.90;   // oldAd-ish defaults
  if (u_paperType == 0) { paperBase *= vec3(0.98, 0.95, 0.86); pAbsorb = 0.90; pMaxDensity = 0.82; } // newsprint
  else if (u_paperType == 1) { paperBase *= vec3(0.97, 0.93, 0.82); pAbsorb = 0.60; pMaxDensity = 0.86; } // old ad
  else if (u_paperType == 2) { paperBase *= vec3(0.99, 0.97, 0.92); pAbsorb = 0.50; pMaxDensity = 0.88; } // cardboard
  else if (u_paperType == 3) { paperBase *= vec3(1.0, 1.0, 0.99); pAbsorb = 0.15; pMaxDensity = 0.95; }   // glossy
  else if (u_paperType == 4) { paperBase *= vec3(0.96, 0.94, 0.88); pAbsorb = 0.78; pMaxDensity = 0.83; } // cheap
  // paper condition modulates absorbency: damp & rough sheets drink more ink.
  if (u_paperOn == 1) pAbsorb = clamp(pAbsorb * (1.0 + u_moisture * 0.6 + u_roughness * 0.35), 0.0, 1.0);
  vec3 paperTone = clamp(paperBase, 0.0, 1.0);  // reused by paper & damage stages

  // =================== PRINT SIMULATION ===================
  // A real sheet going through a real press, in physical order:
  //   analyse image -> ink amount -> paper properties -> absorption ->
  //   spread along fibres -> detail loss -> halftone -> form the print.
  // Every feature size is resolution/DPI relative, so identical settings look
  // identical at any resolution and small images do not turn to mush.
  if (u_printerOn == 1) {
  // ---- 1. content analysis ----------------------------------------------
  // edge = local contrast (protect fine detail), flat = smooth fill area,
  // tone = local brightness (0 dark .. 1 light). Sample spacing scales w/ res.
  float sp = max(1.0, ds);
  float lC = toneGray(texture(u_src, uv).rgb);
  float lL = toneGray(texture(u_src, uv - vec2(texel.x * sp, 0.0)).rgb);
  float lR = toneGray(texture(u_src, uv + vec2(texel.x * sp, 0.0)).rgb);
  float lU = toneGray(texture(u_src, uv - vec2(0.0, texel.y * sp)).rgb);
  float lD = toneGray(texture(u_src, uv + vec2(0.0, texel.y * sp)).rgb);
  float edge = clamp(length(vec2(lR - lL, lD - lU)) * 2.0, 0.0, 1.0);
  float flatness = 1.0 - edge;
  float tone = lC;

  // ---- 2. colour preparation (prepress separation) ----------------------
  col = prepress(col, u_prepress);

  // ---- 3. ink amount ----------------------------------------------------
  // How much ink each colourant must lay down to reproduce the pixel. Ink is
  // subtractive (ink = 1 - reflectance); density scales how heavily it lays.
  vec3 ink = clamp(1.0 - col, 0.0, 1.0);
  ink *= 0.55 + u_inkDensity * 1.05;                 // ink density: washed <-> rich

  // ---- 4-5. absorption & spread along the fibres ------------------------
  // Wet ink soaks into the sheet and creeps along the grain. Sample the
  // prepressed neighbourhood in ink space and blend by how absorbent the
  // paper is and how wet the process runs. Spread is anisotropic (follows the
  // ~20deg fibre weave) and only acts where ink actually sits.
  float wet = 0.30;                                  // offset litho
  if (u_printerType == 1) wet = 0.10;                // laser: dry toner
  else if (u_printerType == 2) wet = 0.35;           // photocopier
  else if (u_printerType == 3) wet = 0.70;           // inkjet: wet, bleeds
  else if (u_printerType == 4) wet = 0.95;           // newspaper web press
  else if (u_printerType == 5) wet = 0.55;           // risograph
  float spread = clamp(pAbsorb * (0.35 + wet * 0.85), 0.0, 1.1);
  if (spread > 0.001) {
    float a = radians(20.0);
    vec2 grain = vec2(cos(a), sin(a));
    vec2 perp = vec2(-grain.y, grain.x);
    float r = (0.6 + spread * 2.2) * ds;             // creep radius in px, res-relative
    vec3 acc = ink;
    float wsum = 1.0;
    // 4 taps: heavier along the grain than across it
    vec3 s1 = clamp(1.0 - srcPrep(uv + grain * texel * r), 0.0, 1.0) * (0.55 + u_inkDensity * 1.05);
    vec3 s2 = clamp(1.0 - srcPrep(uv - grain * texel * r), 0.0, 1.0) * (0.55 + u_inkDensity * 1.05);
    vec3 s3 = clamp(1.0 - srcPrep(uv + perp  * texel * r * 0.5), 0.0, 1.0) * (0.55 + u_inkDensity * 1.05);
    vec3 s4 = clamp(1.0 - srcPrep(uv - perp  * texel * r * 0.5), 0.0, 1.0) * (0.55 + u_inkDensity * 1.05);
    acc += (s1 + s2) * 0.8 + (s3 + s4) * 0.4;
    wsum += 0.8 * 2.0 + 0.4 * 2.0;
    vec3 spreadInk = acc / wsum;
    // ink only bleeds outward: take the wetter (darker) of self vs spread in
    // inked areas, so the dark form grows into the paper, edges soften.
    float inkHere = max(max(ink.r, ink.g), ink.b);
    ink = mix(ink, max(ink, spreadInk), spread * 0.75 * smoothstep(0.02, 0.25, inkHere));
    // ---- 6. detail loss: absorbed ink smears fine detail into the fibres.
    ink = mix(ink, spreadInk, spread * 0.35 * (1.0 - edge * 0.5));
  }

  // ---- 6b. dot gain: ink expands on contact, darkening mids & shadows ----
  ink = pow(ink, vec3(clamp(1.0 - u_dotGain * 0.6, 0.3, 1.0)));

  // ---- 7. halftone screening --------------------------------------------
  // Tone reproduced by dot SIZE (AM screen), dot pitch driven by DPI and
  // resolution. Tiny sub-pixel dots (small image / high DPI) fade out instead
  // of shattering into noise -> no mush on small images.
  float cellBase = 2.0;  float gain = 0.25;                        // offset (Heidelberg)
  if (u_printerType == 1) { cellBase = 1.6; gain = 0.16; }         // laser (HP LaserJet)
  else if (u_printerType == 2) { cellBase = 2.3; gain = 0.55; }    // photocopier (Xerox)
  else if (u_printerType == 3) { cellBase = 1.5; gain = 0.14; }    // inkjet (Canon)
  else if (u_printerType == 4) { cellBase = 2.6; gain = 0.7; }     // newspaper web press (Goss)
  else if (u_printerType == 5) { cellBase = 2.4; gain = 0.5; }     // risograph (Riso)
  float cellPx = cellBase * ds * (300.0 / max(u_dpi, 1.0));
  cellPx = max(cellPx, 1.15);
  gain += u_dotGain * 0.4;
  if (u_halftone > 0.001) {
    float c = halftoneCoverage(px, ink.r, 15.0, cellPx, gain);
    float m = halftoneCoverage(px, ink.g, 75.0, cellPx, gain);
    float y = halftoneCoverage(px, ink.b, 0.0,  cellPx, gain);
    vec3 screenedInk = vec3(c, m, y);
    // fade the screen out when dots get sub-pixel, and spare hard edges so
    // fine detail / type does not disintegrate.
    float screenVis = smoothstep(1.0, 2.2, cellPx);
    float screenAmt = u_halftone * screenVis * (1.0 - edge * 0.8);
    ink = mix(ink, screenedInk, screenAmt);
  }

  // ---- 8. form the printed ink layer ------------------------------------
  // Ink is a physical dab, never perfectly flat: mottle across fills, pinholes
  // of bare paper in thin coverage, and a paper-limited maximum density so the
  // deepest black holds paper tone instead of collapsing to #000000.
  float inkAmt = max(max(ink.r, ink.g), ink.b);
  float mott = fbm(npx * 0.35 + u_seed * 4.0, 3) * 0.6 + fbm(npx * 1.1 + u_seed * 9.0, 2) * 0.4;
  ink *= 1.0 - (mott - 0.5) * (0.10 + 0.30 * pAbsorb) * inkAmt;
  float pinhole = smoothstep(0.62, 0.92, fbm(npx * 0.8 + u_seed * 12.0, 3));
  ink *= 1.0 - pinhole * (0.10 + 0.30 * (1.0 - u_inkDensity)) * step(0.04, inkAmt) * (1.0 - inkAmt * 0.4);
  float maxInk = pMaxDensity + 0.05 * u_inkDensity;  // paper caps density
  ink = clamp(min(ink, vec3(maxInk)), 0.0, 1.0);
  // ink sits ON the paper: reflectance = paper tone * (1 - ink)
  col = paperTone * (1.0 - ink);
  // deep ink is never one flat digital black: give it fine tonal + warm/cool
  // jitter so shadows read as many slightly different ink tones.
  float deep = smoothstep(0.55, 0.95, inkAmt);
  vec3 tjit = vec3(hash1(px + u_seed), hash1(px * 1.7 + u_seed * 3.0), hash1(px * 2.3 + u_seed * 5.0)) - 0.5;
  col += deep * (tjit * 0.045 + vec3(0.015, 0.006, -0.012));

  // ---- 9. print defects -------------------------------------------------
  // misregistration: colour plates shifted, res-relative, stronger at edges.
  if (u_registration > 0.01) {
    vec2 off = texel * u_registration * ds * (0.5 + 0.5 * edge);
    vec3 sr = paperTone * (1.0 - clamp((1.0 - srcPrep(uv + off)) * (0.55 + u_inkDensity * 1.05), 0.0, maxInk));
    vec3 sb = paperTone * (1.0 - clamp((1.0 - srcPrep(uv - off)) * (0.55 + u_inkDensity * 1.05), 0.0, maxInk));
    col.r = mix(col.r, sr.r, 0.6);
    col.b = mix(col.b, sb.b, 0.6);
  }
  // ink colour cast (warm/cool)
  col.r += u_colorShift * 0.1;
  col.b -= u_colorShift * 0.1;
  // faded ink loses pigment toward the paper tone (uneven, low frequency)
  col = mix(col, paperTone, u_fade * 0.6 * (0.4 + 0.6 * hash1(npx * 0.01 + u_seed)));
  // photocopier / risograph: toner speckle (shadows) + dropouts (flat fills)
  if (u_printerType == 2 || u_printerType == 5) {
    float toner = step(0.96, hash1(npx * 0.7 + u_seed));
    col -= toner * 0.25 * inkAmt;
    float dropout = smoothstep(0.75, 0.93, fbm(npx * 0.02 + u_seed * 6.0, 3));
    col = mix(col, paperTone, dropout * 0.12 * flatness);
  }
  // laser: crisp output, faint toner sheen only in deep shadows
  if (u_printerType == 1) {
    float toner = step(0.985, hash1(npx * 0.9 + u_seed));
    col -= toner * 0.1 * inkAmt;
  }
  col = clamp(col, 0.0, 1.0);
  } // end PRINT SIMULATION

  // =================== PAPER SUBSTRATE ===================
  vec2 np = npx + u_seed * 130.0;
  if (u_paperOn == 1) {

  vec3 paperTint = vec3(1.0);
  float fiberBias = 1.0;
  if (u_paperType == 0) { paperTint = vec3(0.98, 0.95, 0.86); fiberBias = 1.7; }
  else if (u_paperType == 1) { paperTint = vec3(0.97, 0.93, 0.82); fiberBias = 1.3; }
  else if (u_paperType == 2) { paperTint = vec3(0.99, 0.97, 0.92); fiberBias = 0.8; }
  else if (u_paperType == 3) { paperTint = vec3(1.0, 1.0, 0.99); fiberBias = 0.4; }
  else if (u_paperType == 4) { paperTint = vec3(0.95, 0.92, 0.84); fiberBias = 1.9; }
  // user paper colour tints the stock (white = no change). The print stage
  // already lays ink on the tinted stock, so only tint here when the printer
  // engine is off (raw image on bare paper) — avoids double-tinting.
  paperTint *= u_paperColor;
  if (u_printerOn == 0) col *= mix(vec3(1.0), paperTint, 0.7);

  float ang = radians(20.0);
  mat2 weave = mat2(cos(ang), -sin(ang), sin(ang), cos(ang));
  vec2 wp = weave * np;
  float fiberMain  = fbm(vec2(wp.x * 0.03, wp.y * 0.6), 4);
  float fiberCross = fbm(vec2(wp.x * 0.5, wp.y * 0.04), 3);
  float fib = fiberMain * 0.7 + fiberCross * 0.3;
  float fAmt = u_fibers * fiberBias;
  col *= 1.0 - fAmt * 0.2 * (0.5 + 0.5 * fib);
  col += fAmt * 0.05 * fiberMain;

  // real scanned paper tooth/tone (driven by the Fibers slider). Tiled small so
  // it reads as surface texture, and taken relative to the scan's own mean tone
  // so dark or light sheets both add tooth without shifting overall brightness.
  if (u_paperTexOn == 1 && u_paperTexAmt > 0.001) {
    vec2 uvp = analogUV(v_uv, u_paperTexRes, 4.0, u_seed + 1.0);
    float pt = toneGray(texture(u_paperTex, uvp).rgb);
    float dev = pt - clamp(u_paperTexMid, 0.05, 0.95);
    col *= 1.0 + dev * 0.55 * u_paperTexAmt;
  }

  if (u_paperType == 3) col += smoothstep(0.6, 0.95, fbm(npx * 0.01 + u_seed * 3.0, 3)) * 0.04;
  if (u_paperType == 4) col -= step(0.988, hash1(npx * 0.9 + u_seed * 2.0)) * 0.2;

  // micro-roughness: fine surface grain modulates the existing tone
  col *= 1.0 + (hash1(px + u_seed) - 0.5) * u_roughness * 0.22;

  // thickness: soft low-frequency relief shading gives a sense of a real sheet
  float relief = fbm(npx * 0.02 + u_seed * 5.0, 3);
  col *= 1.0 + (relief - 0.5) * u_thickness * 0.18;

  if (u_creases > 0.001) {
    float cr = fbm(vec2(npx.x * 0.004, npx.y * 0.03) + u_seed * 12.0, 4);
    float crease = smoothstep(0.48, 0.5, cr) - smoothstep(0.5, 0.52, cr);
    float creaseHi = smoothstep(0.5, 0.515, cr) - smoothstep(0.515, 0.53, cr);
    col -= crease * u_creases * 0.32;
    col += creaseHi * u_creases * 0.16;
  }

  if (u_moisture > 0.001) {
    // water cockle: soaked zones darken & warm toward brown, with a hard brown
    // tide ring at the wet/dry boundary (a real water stain, not a flat blob).
    float mF = fbm(npx * 0.006 + u_seed * 17.0, 4);
    float damp = smoothstep(0.45, 0.72, mF);
    float ring = smoothstep(0.46, 0.5, mF) - smoothstep(0.5, 0.56, mF);
    col = mix(col, col * vec3(0.86, 0.78, 0.62), damp * u_moisture * 0.5);
    col = mix(col, col * vec3(0.7, 0.55, 0.38), ring * u_moisture * 0.6);
  }

  float stainField = fbm(npx * 0.008 + u_seed * 9.0, 4);
  col = mix(col, col * vec3(0.85, 0.75, 0.55), smoothstep(0.4, 0.72, stainField) * u_stains * 0.5);

  // real scanned stains / foxing (driven by the Stains slider). Big soft blotches
  // (low tiling): darker-than-average patches soak in as brown stains, lighter
  // patches read as bleached / faded spots.
  if (u_stainTexOn == 1 && u_stainTexAmt > 0.001) {
    // tiled so no single scan crease stretches into one big diagonal band; only
    // darker-than-average patches soak in as stains (bright creases ignored).
    vec2 uvs = analogUV(v_uv, u_stainTexRes, 2.7, u_seed + 7.0);
    float st = toneGray(texture(u_stainTex, uvs).rgb);
    float mid = clamp(u_stainTexMid, 0.05, 0.95);
    float darker = max(mid - st, 0.0) / mid;
    col = mix(col, col * vec3(0.82, 0.7, 0.5), darker * 0.7 * u_stainTexAmt);
  }

  float pscr = smoothstep(0.82, 0.9, fbm(vec2(npx.x * 0.09, npx.y * 0.01) + u_seed * 3.0, 3));
  col -= pscr * u_pScratches * 0.25;

  float ageMap = 0.6 + 0.4 * fbm(npx * 0.006 + u_seed * 2.0, 4);
  vec3 aged = col * vec3(1.0, 0.96, 0.82) + vec3(0.1, 0.07, -0.02) * ageMap;
  col = mix(col, aged, u_yellowing * 0.85);
  } // end PAPER SUBSTRATE

  // =================== PARAMETRIC DAMAGE ===================
  // Damage reshapes the pixels that are already there — it never paints a solid
  // line or erases to a flat colour. Every operation is a function of the
  // existing pixel: ink is scraped off (revealing the paper beneath), the
  // surface is smeared/displaced, contrast is rubbed down, tone is darkened.
  if (u_damageOn == 1) {
  // ---- scratches: thin gouges that scrape ink off and drag the surface -----
  float scrF = fbm(vec2(npx.x * 0.12 + npx.y * 0.12, npx.y * 0.006) + u_seed * 15.0, 3);
  float groove = smoothstep(0.87, 0.94, scrF);                 // the cut core
  float lip = smoothstep(0.84, 0.87, scrF) - smoothstep(0.87, 0.90, scrF); // torn edge
  float sAmt = u_dScratches;
  if (sAmt > 0.001) {
    // drag: the gouge smears neighbouring content along its length
    vec2 sdir = normalize(vec2(1.0, 0.12));
    vec3 smear = texture(u_src, uv + sdir * texel * (2.0 + 6.0 * sAmt) * ds).rgb;
    col = mix(col, mix(col, smear, 0.5), groove * sAmt * 0.5);
    // scrape ink toward the paper beneath (proportional reveal, not a fill)
    col = mix(col, mix(col, paperTone, 0.7), groove * sAmt * 0.55);
    col *= 1.0 + lip * sAmt * 0.4;                             // lit torn lip
    col *= 1.0 - groove * sAmt * 0.22;                         // shadow in the gouge
  }

  // ---- abrasions: rubbed matte scuffs — flatten contrast & lift the tone ---
  float abF = smoothstep(0.58, 0.82, fbm(npx * 0.03 + u_seed * 21.0, 4));
  float scuff = abF * (0.4 + 0.6 * hash1(npx * 0.4 + u_seed)) * u_abrasions;
  if (u_abrasions > 0.001) {
    float g = toneGray(col);
    col = mix(col, mix(col, vec3(g), 0.45) * 1.05, clamp(scuff, 0.0, 1.0));
  }

  // ---- worn areas: broad pigment loss — ink thins toward the paper ---------
  float wornF = fbm(npx * 0.01 + u_seed * 27.0, 4);
  col = mix(col, paperTone, smoothstep(0.55, 0.85, wornF) * u_worn * 0.5);

  // ---- paper damage: nicks & pinholes — dark torn fibre, occasional pulp ---
  float dmg = step(0.982, hash1(npx * 0.6 + u_seed * 33.0));
  float dmgClust = smoothstep(0.6, 0.8, fbm(npx * 0.02 + u_seed * 31.0, 3));
  float nick = dmg * dmgClust * u_paperDamage;
  col *= 1.0 - nick * 0.7;                                     // dark torn nick
  float pulp = step(0.994, hash1(npx * 0.55 + u_seed * 41.0)) * dmgClust * u_paperDamage;
  col = mix(col, min(paperTone * 1.05, vec3(1.0)), pulp * 0.6); // bright exposed pulp fleck
  } // end PARAMETRIC DAMAGE

  // =================== PAPER SCRATCHES (procedural variants) ===================
  // Whole-sheet scratch patterns chosen in the Scratches tab. Bright ridge +
  // dark groove so they read as physical cuts in the surface, not overlays.
  if (u_scratchOn == 1 && u_scratchAmount > 0.001) {
    float a = radians(u_scratchAngle);
    vec2 dir = vec2(cos(a), sin(a));
    vec2 perp = vec2(-dir.y, dir.x);
    float along = dot(npx, dir);
    float across = dot(npx, perp);
    float amt = u_scratchAmount;
    float depth = u_scratchDepth;
    float line = 0.0;

    if (u_scratchPattern == 0) {
      // fine: dense thin hairline scratches, mostly one direction with jitter
      float f = fbm(vec2(across * 0.9, along * 0.03) + u_seed * 5.0, 3);
      line = smoothstep(0.72, 0.9, f);
    } else if (u_scratchPattern == 1) {
      // coarse: fewer, wider, deeper gouges
      float f = fbm(vec2(across * 0.25, along * 0.02) + u_seed * 8.0, 3);
      line = smoothstep(0.78, 0.95, f);
    } else if (u_scratchPattern == 2) {
      // crosshatch: two crossing sets
      float f1 = smoothstep(0.74, 0.9, fbm(vec2(across * 0.7, along * 0.03) + u_seed * 5.0, 3));
      float f2 = smoothstep(0.74, 0.9, fbm(vec2(along * 0.7, across * 0.03) + u_seed * 9.0, 3));
      line = max(f1, f2);
    } else if (u_scratchPattern == 3) {
      // directional: strong parallel scratches along the chosen angle
      float f = fbm(vec2(across * 1.3, along * 0.015) + u_seed * 3.0, 2);
      line = smoothstep(0.68, 0.86, f);
    } else {
      // random: scattered short scratches in many directions
      float f = fbm(npx * 0.5 + u_seed * 11.0, 4);
      float g = fbm(npx.yx * 0.5 + u_seed * 13.0, 4);
      line = smoothstep(0.8, 0.95, f) + smoothstep(0.8, 0.95, g);
    }

    line = clamp(line, 0.0, 1.0) * amt;
    // Physical cut, not an overlay: scrape ink off toward the paper beneath,
    // drag the surface along the scratch, and shade the gouge. Depth controls
    // how deep the cut bites. Every term is a function of the existing pixel.
    if (line > 0.001) {
      vec2 sdir = vec2(cos(a), sin(a));
      vec3 smear = texture(u_src, uv + sdir * texel * (2.0 + 5.0 * depth) * ds).rgb;
      col = mix(col, mix(col, smear, 0.5), line * (0.25 + 0.35 * depth));
      col = mix(col, mix(col, paperTone, 0.7), line * (0.35 + 0.4 * depth));
      col *= 1.0 - line * line * (0.2 + 0.4 * depth);          // gouge shadow
    }
  }

  // =================== SCANNER CAPTURE ===================
  // scannerMode: 0 none (skip), 1 home, 2 professional (clean), 3 phone (soft/warm)
  if (u_scannerOn == 1 && u_scannerMode != 0) {
  float smNoise = 1.0, smBlur = 1.0, smClean = 1.0, smWarm = 0.0;
  if (u_scannerMode == 2) { smNoise = 0.4; smBlur = 0.5; smClean = 0.4; }      // professional
  else if (u_scannerMode == 3) { smNoise = 1.3; smBlur = 1.4; smWarm = 1.0; }  // phone

  // blur / softening: apply the local softening ratio so print tint is kept
  float blurAmt = clamp(u_scBlur * smBlur, 0.0, 1.0);
  if (blurAmt > 0.001) {
    float r = blurAmt * 6.0 * ds;
    vec2 t = 1.0 / res;
    vec3 s0 = texture(u_src, uv).rgb;
    vec3 b = s0 * 0.25;
    b += (texture(u_src, uv + vec2(t.x * r, 0.0)).rgb
        + texture(u_src, uv - vec2(t.x * r, 0.0)).rgb
        + texture(u_src, uv + vec2(0.0, t.y * r)).rgb
        + texture(u_src, uv - vec2(0.0, t.y * r)).rgb) * 0.125;
    b += (texture(u_src, uv + vec2(t.x, t.y) * r * 0.7).rgb
        + texture(u_src, uv + vec2(-t.x, t.y) * r * 0.7).rgb
        + texture(u_src, uv + vec2(t.x, -t.y) * r * 0.7).rgb
        + texture(u_src, uv + vec2(-t.x, -t.y) * r * 0.7).rgb) * 0.0625;
    vec3 ratio = (b + 0.003) / (s0 + 0.003);
    col = mix(col, clamp(col * ratio, 0.0, 1.0), clamp(blurAmt * 1.3, 0.0, 1.0));
  }

  if (u_scColor > 0.001) {
    col *= mix(vec3(1.0), vec3(1.03, 0.99, 0.94), u_scColor * smClean);
    col.g += u_scColor * smClean * 0.015 * sin(px.y * 0.01);
  }
  if (u_scStreaks > 0.001) {
    // fine horizontal sensor banding + occasional vertical drag lines
    float lines = 0.5 + 0.5 * sin(px.y * (0.6 + 2.0 * ds) / max(ds, 1.0));
    float banding = smoothstep(0.6, 1.0, lines);
    float vstripe = step(0.994, hash1(vec2(floor(px.x / max(ds, 1.0)), 0.0) + u_seed * 3.0));
    col -= banding * u_scStreaks * smClean * 0.1;
    col -= vstripe * u_scStreaks * smClean * 0.3;
  }
  if (u_scDust > 0.001) {
    float dust = step(0.9955, hash1(npx * 1.3 + u_seed * 51.0));
    float white = step(0.9975, hash1(npx * 1.7 + u_seed * 61.0));
    float hair = smoothstep(0.9, 0.95, fbm(vec2(npx.x * 0.02, npx.y * 0.3) + u_seed * 7.0, 2));
    col -= dust * u_scDust * 0.55;
    col += white * u_scDust * 0.4;
    col -= hair * u_scDust * 0.18;
  }
  // real scanned scanner dirt (driven by Dust + Streaks). Bright specks/hairs on
  // the glass screen up as white flecks; dark scratches groove down.
  if (u_scanTexOn == 1 && u_scanTexAmt > 0.001) {
    // tiled (no single big scan streak spanning the frame); high-frequency dirt
    // only -> bright specks/hairs screen up, dark scratches groove down.
    vec2 uvd = analogUV(uv, u_scanTexRes, 2.2, u_seed + 13.0);
    float dt = toneGray(texture(u_scanTex, uvd).rgb);
    float mid = clamp(u_scanTexMid, 0.05, 0.95);
    float bright = max(dt - mid, 0.0) / (1.0 - mid);
    float dark = max(mid - dt, 0.0) / mid;
    col += pow(bright, 1.6) * 0.4 * smClean * u_scanTexAmt;
    col *= 1.0 - pow(dark, 1.6) * 0.3 * smClean * u_scanTexAmt;
  }
  // JPEG compression: 8x8 blockiness + level quantization (banding)
  float jpeg = clamp(u_scJpeg, 0.0, 1.0);
  if (jpeg > 0.001) {
    float block = 8.0 * ds;
    vec2 bc = (floor(px / block) * block + block * 0.5) / res;
    vec3 blockCol = texture(u_src, bc).rgb;
    col = mix(col, blockCol, 0.25 * jpeg);
    float levels = mix(48.0, 6.0, jpeg);
    col = floor(col * levels + 0.5) / levels;
  }
  if (u_scNoise > 0.001) {
    float n = hash1(px + u_seed * 61.0) - 0.5;
    col += n * u_scNoise * smNoise * 0.1;
    col.r += (hash1(px * 1.7 + u_seed * 71.0) - 0.5) * u_scNoise * smNoise * 0.035;
  }
  // exposure: 0.5 = neutral capture brightness
  col *= pow(2.0, (u_scExposure - 0.5) * 1.2);
  if (smWarm > 0.0) col *= mix(vec3(1.0), vec3(1.05, 1.0, 0.95), smWarm * 0.4);
  } // end SCANNER CAPTURE

  col = clamp(col, 0.0, 1.0);

  // ---- MASTER INTENSITY: physical layer over the original ---------------
  col = mix(orig, col, clamp(u_intensity, 0.0, 1.0));

  // ---- COLOUR MODE ------------------------------------------------------
  if (u_colorMode == 1) {
    // black & white: gamma-correct luminance keeps highlight/shadow detail
    col = vec3(toneGray(col));
  } else if (u_colorMode == 2) {
    // tint: luminance mapped onto the chosen colour (duotone toward white)
    float g = toneGray(col);
    col = mix(u_tint * g, vec3(1.0), g * 0.15);
  }

  col = clamp(col, 0.0, 1.0);
  outColor = vec4(col, src.a);
}
`
