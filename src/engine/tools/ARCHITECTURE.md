# Physical tool simulation

Each physical workshop tool owns an independent engine under its own directory.
An engine owns:

1. its parameter defaults and public controls;
2. its impact geometry;
3. interactions with the current material state;
4. paper changes;
5. paint or pigment changes;
6. surface texture and relief changes;
7. deterministic natural variability;
8. its final dirty-region render boundary.

`core/geometry.ts` only provides path sampling and field storage. It does not
contain tool profiles, tool defaults, material behavior, or a shared brush
model. Tool footprints and deposition/destruction rules live in each engine.

The registry dispatches an operation directly to the matching engine. Adding or
calibrating one tool does not change the implementation of another tool.

## Shared MaterialWorld

Independent engines do not produce independent visual decals. Every engine
writes physical impulses into the same `SheetState` / MaterialWorld:

- free and absorbed water;
- suspended and fixed pigment;
- paper porosity, fibre direction, roughness and structural weakness;
- paint thickness, transparent film and adhesive mass;
- relief, loose particulate, temperature and char.

After an engine applies its impact, `engine/material/solver.ts` advances the
affected region through deterministic material time. It conservatively moves
water and suspended pigment between neighbouring cells, follows fibre
direction and relief, absorbs water into porous stock, evaporates exposed
liquid, deposits pigment at a drying front, transports dirt, cures adhesive,
and converts dry heat into char.

This is the interaction boundary:

`independent applicator -> shared material laws -> unified surface render`

Consequently a second water stroke adds mass to the first one instead of
drawing another stain. Surface relief and scratches redirect liquid through their
height fields, tape blocks transport and evaporation through its film field,
wet paper changes cutting and abrasion strength, heat dries moisture before
charring the stock, and dirt is retained by fibres, recesses, moisture and
adhesive.

Operations record their elapsed application time. Replay and undo therefore
reconstruct the same material evolution, while the incremental cache only
recomposites the dirty region returned by the solver.

Adjacent visible layers participate in limited physical contact during a
stroke: water passes through holes or beyond an upper sheet edge, burn
transfers attenuated heat downward, and glue transfers an adhesive contact to
the immediately overlapping layer. The linked operations are committed as one
undoable history command.

## Reference Development

`engine/reference/development.ts` is a development-only calibration API. It is
not rendered in the product UI. In a development build it is available as
`window.__REFERENCE_DEVELOPMENT__`.

A reference profile binds photographs, measured observations, and parameter
overrides to one specific tool engine. Operations record the profile id and
revision, so the material simulation remains:

`reference profile -> physical parameters -> material state -> render`

Example:

```ts
window.__REFERENCE_DEVELOPMENT__?.register({
  id: 'tape-macro-01',
  revision: 1,
  tool: 'tape',
  images: [
    {
      id: 'raking-light',
      source: '/references/tape/raking-light.jpg',
      scaleMicronsPerPixel: 12,
      lighting: 'raking',
    },
  ],
  observations: [
    { property: 'film-thickness', value: 48, tolerance: 5, unit: 'micron' },
  ],
  parameterOverrides: {
    filmThickness: 0.19,
    adhesiveDarkening: 0.035,
    bubbleRate: 0.21,
  },
})

window.__REFERENCE_DEVELOPMENT__?.activate('tape', 'tape-macro-01')
```

Reference tuning changes only the selected engine's parameters. The material
pipeline and the other tools do not need to be rewritten.
