// Tear pass: turns a soft mask into a physical paper edge with real volume.
//
// Key technique: reconstruct an approximate *pixel-space* signed distance to the
// cut line from the blurred mask's gradient. That makes every edge band (core,
// fibers, shadow) measured in real pixels and consistent across resolutions —
// which is what kills the "it's just a mask" feeling.
//
// u_invert = 0 -> keep INSIDE the selection (the cut-out fragment)
// u_invert = 1 -> keep OUTSIDE (the donor with a hole)
// Both edges come from the same mask, so fragment and hole stay consistent.
//
// u_style : 0 scissors (clean cut) | 1 hand-torn | 2 old worn paper

import { NOISE_GLSL } from './common.glsl'

export const TEAR_FRAG = `#version 300 es
precision highp float;

in vec2 v_uv;
out vec4 outColor;

uniform sampler2D u_src;
uniform sampler2D u_mask;
uniform vec2  u_resolution;
uniform float u_seed;
uniform float u_invert;
uniform float u_style;
uniform vec3  u_edgeColor;   // user-chosen colour of the cut edge / paper interior

${NOISE_GLSL}

void main() {
  vec2 res = u_resolution;
  vec2 texel = 1.0 / res;
  vec2 uv = v_uv;
  vec2 pw = uv * res;                 // pixel coordinates

  vec4 src = texture(u_src, uv);
  float m = texture(u_mask, uv).r;

  // --- reconstruct pixel-space signed distance from the blurred mask -------
  float sp = 1.5; // sampling radius in texels
  float dl = texture(u_mask, uv - vec2(texel.x, 0.0) * sp).r;
  float dr = texture(u_mask, uv + vec2(texel.x, 0.0) * sp).r;
  float dbb = texture(u_mask, uv - vec2(0.0, texel.y) * sp).r;
  float dtt = texture(u_mask, uv + vec2(0.0, texel.y) * sp).r;
  vec2 grad = vec2(dr - dl, dtt - dbb) / (2.0 * sp); // change per pixel
  float glen = max(length(grad), 1e-4);
  float sd = (m - 0.5) / glen;        // + inside selection, in pixels

  // --- style parameters ----------------------------------------------------
  bool torn = u_style >= 0.5;
  bool worn = u_style >= 1.5;
  float aLarge, aMed, aMicro, soft, coreWidth, coreStr, fiberLen, fiberAmt;
  if (worn) {
    aLarge = 11.0; aMed = 5.0; aMicro = 2.5; soft = 1.6;
    coreWidth = 7.0; coreStr = 0.90; fiberLen = 10.0; fiberAmt = 1.0;
  } else if (torn) {
    aLarge = 6.0;  aMed = 3.0; aMicro = 1.5; soft = 1.2;
    coreWidth = 5.0; coreStr = 0.85; fiberLen = 6.0;  fiberAmt = 0.8;
  } else {
    aLarge = 0.0;  aMed = 0.25; aMicro = 0.4; soft = 0.9;
    coreWidth = 1.5; coreStr = 0.55; fiberLen = 0.0; fiberAmt = 0.0;
  }

  // Edge interior colour: the exposed paper stock, NOT a drawn outline. We
  // seed it from the surrounding image tone so the cut reads as real paper
  // thickness, then warm it toward the fibrous interior. The user edge colour
  // only tints it slightly (it never becomes a flat white/coloured stroke).
  float srcL = dot(src.rgb, vec3(0.299, 0.587, 0.114));
  vec3 stock = mix(src.rgb, vec3(srcL), 0.5) * 1.06 + 0.03; // desaturated, a touch lighter
  vec3 coreCol;
  if (worn)      coreCol = mix(stock, vec3(0.74, 0.67, 0.55), 0.6);  // dirty aged interior
  else if (torn) coreCol = mix(stock, vec3(0.90, 0.86, 0.78), 0.5);  // warm pale fibre core
  else           coreCol = mix(stock, vec3(0.93, 0.91, 0.86), 0.4);  // clean paper cut
  coreCol = mix(coreCol, u_edgeColor, 0.2); // subtle user tint only

  // --- multi-scale boundary warp (large damage / fibers / micro) ----------
  float large  = fbm(pw * 0.012 + u_seed * 3.0, 4);
  float medium = fbm(pw * 0.05  + u_seed * 7.0, 4);
  float micro  = fbm(pw * 0.20  + u_seed * 11.0, 3);
  float warp = large * aLarge + medium * aMed + micro * aMicro;
  float sdw = sd + warp;              // warped signed distance (px)

  // --- inside/outside + which side we keep --------------------------------
  float inside = smoothstep(-soft, soft, sdw);
  float keep = mix(inside, 1.0 - inside, u_invert);

  // Distance into the kept paper, and distance into the void, both >=0.
  float keptDist = mix(sdw, -sdw, u_invert);
  float voidDist = mix(-sdw, sdw, u_invert);

  // --- fiber direction from the edge normal -------------------------------
  vec2 nrm = grad / glen;             // points into selection
  vec2 tang = vec2(-nrm.y, nrm.x);
  float along = dot(pw, tang) + fbm(pw * 0.02 + u_seed, 2) * 22.0;

  // Protruding fibers on the VOID side, extending outward from the edge.
  float hairAlpha = 0.0;
  if (fiberAmt > 0.0 && voidDist > 0.0) {
    float fib1 = fbm(vec2(along * 0.35, u_seed * 5.0), 3);
    float h1 = smoothstep(0.12, 0.55, fib1) * smoothstep(fiberLen, 0.0, voidDist);
    float fib2 = fbm(vec2(along * 1.30, u_seed * 8.0), 2);
    float h2 = smoothstep(0.30, 0.62, fib2) * smoothstep(fiberLen * 0.5, 0.0, voidDist);
    hairAlpha = max(h1, h2 * 0.7) * fiberAmt;
  }

  // --- colour: exposed core, fibers, volume -------------------------------
  vec3 col = src.rgb;

  // exposed paper core just inside the kept edge
  float coreT = (1.0 - smoothstep(0.0, coreWidth, keptDist)) * step(0.0, keptDist);
  col = mix(col, coreCol, coreT * coreStr);

  // stray fibers are made of the same core material
  col = mix(col, coreCol, hairAlpha);

  // raised paper ridge catches light (subtle, from the sheet's thickness —
  // kept low so it never becomes a bright white outline)
  float ridge = (1.0 - smoothstep(0.0, 1.6, abs(sdw))) * (torn ? 0.10 : 0.03);
  col += ridge * coreT;

  // donor hole: recessed shadow band just inside the rim
  float recess = smoothstep(coreWidth * 3.0, coreWidth * 0.5, keptDist)
               * step(coreWidth * 0.5, keptDist);
  col *= 1.0 - recess * 0.30 * u_invert;

  // worn: grime + pigment erosion along the edge
  if (worn) {
    float dirt = smoothstep(0.5, 0.82, fbm(pw * 0.15 + u_seed * 4.0, 3));
    float edgeBand = (1.0 - smoothstep(0.0, coreWidth * 1.5, keptDist)) * step(0.0, keptDist);
    col *= 1.0 - dirt * edgeBand * 0.30;
  }

  col = clamp(col, 0.0, 1.0);

  // --- final alpha: kept shape + fibers reaching into the void ------------
  float alpha = keep;
  alpha = max(alpha, hairAlpha * (1.0 - keep));

  outColor = vec4(col, src.a * alpha);
}
`
