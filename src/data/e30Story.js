// ===========================================================================
// STORY DATA — the single source of truth for the whole experience.
//
// Components read from here; nothing historical is hardcoded in JSX and no
// camera position is hardcoded in the 3D layer.
//
// ---------------------------------------------------------------------------
// FACTS — every published figure is for the ORIGINAL road car (S14B23, 1986,
// 200 hp without catalytic converter) unless a row says otherwise. Evolution,
// Evolution II and Sport Evolution figures are never mixed in. Sources:
//   BMW Group Classic, "BMW M3 (E30)" model page — engine, output, rpm,
//     catalyst/195 hp and 09/1989 215 hp variants, production 09/1986-12/1990
//   BMW S14 / BMW M3 (E30) technical references — 240 Nm @ 4,750 rpm,
//     1,200 kg, 0-100 km/h 6.7 s, 235 km/h, Getrag 265 dog-leg five-speed,
//     280 mm vented / 282 mm solid discs, Cd 0.33 (0.38 standard E30),
//     wheelbase 2,562 mm, length 4,345 mm
//   Championship results: 1987 WTCC Ravaglia (Schnitzer); 1987 ETCC Vogt
//     (Linder); DTM 1987 van de Poele (Zakspeed), 1989 Ravaglia (Schnitzer);
//     1987 ATCC Richards (JPS Team BMW); BTCC 1988 Sytner, 1991 Hoy;
//     1987 Tour de Corse Béguin; Nürburgring 24 Hours 1989-1992.
// Anything that could not be confirmed (track widths, tyre sizes, LSD lock)
// is left out rather than estimated.
//
// ---------------------------------------------------------------------------
// UNITS — metres, in MODEL SPACE before the loader re-centres the car.
// Verified against the GLB (BMW-E30-M3-optimized.glb):
//   overall      x ±0.957   y 0.000 → 1.352   z -2.240 → +2.122
//   after the loader offset (+0.001 y, +0.059 z) the scene-space extents are
//   nose +2.18, tail -2.18, roof +1.35, ground 0.
//   headlights   z +1.95   y 0.60
//   front wheels x ±0.70   y 0.31   z +1.35
//   rear wheels  x ±0.71   y 0.31   z -1.24
//   greenhouse   y 0.84 → 1.29
// ===========================================================================

/* ---------------------------------------------------------------------------
   RIG BUILDER
   One beat = one complete frame of the film: where the camera is, where the
   car is pointing, how hard it is lit, and how present the atmosphere is.
   Missing channels fall back to `carry`, so a beat only declares what it
   actually changes.
   --------------------------------------------------------------------------- */

const cam = (px, py, pz, tx, ty, tz, fov, sx = 0.14, sy = 0) => ({
  px, py, pz, tx, ty, tz, fov, sx, sy,
})

const beat = (id, opts) => ({
  id,
  ease: 'power2.inOut',
  layout: 'left-upper',
  ...opts,
})

/* ---------------------------------------------------------------------------
   PROLOGUE — before chapter 01. Not a chapter (no nav entry, no index): a
   black screen in which the headlamps ignite and the car advances on the
   viewer, head-on, lit only by its own lamps and a sliver of bonnet light.
   It then hands over to `beginning.open`, which orbits the camera round to
   the side and brings the studio back (`dark` 1 -> 0).
     lamps  0..1 headlamp power (reflector glow, halos, streak, floor beam)
     dark   0..1 how much of the studio is blacked out (atmosphere, nav,
            floor grid, fixed studio lights)
   `mobile` restates the camera so phones keep the head-on, centred frame
   instead of the generic pulled-back projection.
   --------------------------------------------------------------------------- */
export const prologue = {
  id: 'prologue',
  beats: [
    beat('p-void', {
      kind: 'prologue',
      cue: true,
      ease: 'power1.inOut',
      layout: 'flow',
      cam: cam(0.4, 0.42, 17, 0, 0.58, 0.6, 16, 0, 0),
      mobile: { px: 0.4, py: 0.42, pz: 19, fov: 24, sy: 0 },
      model: { ry: 0, rz: 0 },
      light: { env: 0, key: 0, rim: 0, exp: 1, energy: 0, lamps: 0, dark: 1 },
      veil: 0,
    }),
    beat('p-ignite', {
      kind: 'prologue',
      ease: 'power2.in',
      layout: 'flow',
      cam: cam(0.38, 0.42, 13.5, 0, 0.58, 0.8, 17, 0, 0),
      mobile: { px: 0.38, py: 0.42, pz: 15.5, fov: 25, sy: 0 },
      light: { env: 0, key: 0, rim: 0, exp: 1, lamps: 0.85, dark: 1 },
    }),
    beat('p-stare', {
      kind: 'prologue',
      ease: 'power1.inOut',
      layout: 'flow',
      cam: cam(0.3, 0.46, 8.8, 0, 0.6, 1.0, 20, 0, 0),
      mobile: { px: 0.3, py: 0.46, pz: 10.5, fov: 28, sy: 0 },
      light: { env: 0.004, key: 0, rim: 0.04, exp: 1, lamps: 1, dark: 1 },
    }),
    beat('p-close', {
      kind: 'prologue',
      ease: 'power2.inOut',
      layout: 'flow',
      // low and close, a touch above the lamps: the bonnet's leading edge
      // catches the overhead strip; everything behind it stays black
      cam: cam(0.16, 0.8, 4.9, 0, 0.62, 1.7, 27, 0, -0.04),
      mobile: { px: 0.16, py: 0.85, pz: 6.4, fov: 34, sy: 0 },
      light: { env: 0.012, key: 0, rim: 0.1, exp: 1, lamps: 1, dark: 1 },
    }),
  ],
}

export const e30Story = {
  meta: {
    title: 'BMW E30 M3',
    subtitle: 'A MACHINE BUILT FOR THE CIRCUIT',
    canvasAlt:
      'A BMW E30 M3 rendered in 3D. The camera travels around the car as the story of the model unfolds: a dark three-quarter front view, low wheel-arch studies, front and rear details, and finally a return to the opening framing.',
  },

  /* ----------------------------------------------------------------------
     COPY ROLES (rendered by Beat.jsx — see typography.css for each style)
       label    small mono marker above the statement (uppercase by CSS)
       lines    the statement. Sentence case; light display weight.
                A line may be { text, em: true } for one heavy word.
       variant  'title' sets `lines` heavy + uppercase instead
       body     a readable sentence under the statement
       word     a single giant word set BEHIND the car
     LAYOUT  where the held text sits:  left|right|centre  -  upper|lower
             'flow' = not held (ledgers, the generation plates, end of film)
     DESKTOP `desktop: { fov }` tightens the lens on desktop only, so wide
             shots keep the car large; phones keep their own projection
     MOBILE  `mobile: { ... }` overrides the projected phone rig (absolute
             values, e.g. a tighter fov or a deeper veil)
     ---------------------------------------------------------------------- */

  /* ======================================================================
     01 — THE BEGINNING
     Rhythm: the car emerges from black, one line at a time.
     ====================================================================== */
  beginning: {
    chapter: '01',
    id: 'beginning',
    camera: 'hero',
    title: 'THE BEGINNING',
    eyebrow: 'BMW MOTORSPORT',
    theme: 'calm',
    kicker: ['BMW MOTORSPORT', 'THE M3'],
    caption: 'FIG. 01 — THREE-QUARTER FRONT',
    cue: 'SCROLL TO ENTER',
    statement: ['A MACHINE', 'BUILT FOR', 'THE CIRCUIT.'],
    beats: [
      beat('open', {
        kind: 'line',
        lines: ['Some cars are', 'built to win.'],
        ease: 'power2.inOut',
        layout: 'left-lower',
        cam: cam(7.6, 1.92, 6.4, 0, 0.68, 0.2, 25, 0.2),
        model: { ry: -0.62, rz: 0.014 },
        // the studio comes back up; the lamps settle to a low running glow
        light: { env: 0.5, key: 0.42, rim: 1.8, exp: 0.82, energy: 0, lamps: 0.35, dark: 0 },
        veil: 0.08,
      }),
      beat('legends', {
        kind: 'line',
        lines: ['Some become', { text: 'legends.', em: true }],
        ease: 'expo.out',
        layout: 'right-lower',
        cam: cam(-3.4, 1.15, 6.0, 0, 0.6, 0.1, 28, -0.27),
        desktop: { fov: 26 },
        model: { ry: -0.24 },
        light: { env: 0.56, key: 0.5, rim: 1.3, exp: 0.84, energy: 0.05 },
        veil: 0.05,
      }),
      beat('name', {
        kind: 'word',
        word: 'BMW M3',
        label: 'THE M3',
        body: 'The machine that would change the template.',
        ease: 'expo.out',
        layout: 'left-upper',
        cam: cam(3.2, 1.25, 5.9, 0.1, 0.62, 0.3, 28, 0.06),
        desktop: { fov: 24 },
        model: { ry: 0.06 },
        light: { env: 0.8, key: 0.72, rim: 1.0, exp: 0.92, energy: 0.12 },
        veil: 0,
      }),
      beat('year', {
        kind: 'year',
        year: '1986',
        variant: 'title',
        lines: ['A machine', 'built for', 'the circuit.'],
        kicker: ['BMW MOTORSPORT', 'THE M3'],
        caption: 'FIG. 01 — THREE-QUARTER FRONT',
        ease: 'power3.out',
        layout: 'left-lower',
        cam: cam(5.0, 1.1, 5.8, 0, 0.52, 0.35, 30, 0.17),
        model: { ry: 0.24 },
        light: { env: 0.95, key: 0.9, rim: 0.8, exp: 0.98, energy: 0.16 },
        veil: 0,
      }),
    ],
  },

  /* ======================================================================
     02 — BUILT FOR THE RULES
     Rhythm: curiosity. The camera starts wide and obedient, gets pressed
     down by the rules, then the number arrives and everything opens out.
     ====================================================================== */
  origin: {
    chapter: '02',
    id: 'origin',
    camera: 'origin',
    title: 'BUILT FOR THE RULES',
    eyebrow: 'HOMOLOGATION',
    theme: 'curiosity',
    beats: [
      beat('want', {
        kind: 'line',
        label: 'THE MOTORSPORT DIVISION',
        lines: ['BMW wanted', 'to race.'],
        ease: 'expo.out',
        layout: 'left-upper',
        cam: cam(-6.6, 2.35, 5.6, 0, 0.62, 0, 29, 0.14),
        desktop: { fov: 25 },
        model: { ry: -0.35 },
        light: { env: 0.8, key: 0.75, rim: 0.9, exp: 0.94, energy: 0.14 },
      }),
      beat('rules', {
        kind: 'line',
        label: 'A REGULATION YOU CANNOT ARGUE WITH',
        lines: ['But racing', 'had rules.'],
        ease: 'power2.inOut',
        layout: 'left-upper',
        cam: cam(-7.4, 0.62, 0.7, 0, 0.55, -0.1, 27, 0.24),
        model: { ry: -0.1 },
        light: { env: 0.6, key: 0.5, rim: 1.25, exp: 0.84, energy: 0.08 },
      }),
      beat('counterpart', {
        kind: 'line',
        label: 'RACE CAR → ROAD CAR',
        lines: ['To compete,'],
        body: "BMW had to build the race car's road counterpart.",
        ease: 'power2.inOut',
        layout: 'left-lower',
        cam: cam(2.5, 1.4, 6.2, 0, 0.6, 0.6, 33, 0.15),
        desktop: { fov: 27 },
        model: { ry: 0.12 },
        light: { env: 0.85, key: 0.8, rim: 0.7, exp: 0.96, energy: 0.16 },
      }),
      beat('number', {
        kind: 'number',
        value: '5,000',
        label: ['ROAD CARS REQUIRED', 'FOR GROUP A HOMOLOGATION'],
        ease: 'expo.out',
        layout: 'left-upper',
        cam: cam(1.1, 2.75, 8.9, 0, 0.62, 0, 33, 0),
        desktop: { fov: 26 },
        model: { ry: 0 },
        light: { env: 1.05, key: 1.05, rim: 0.6, exp: 1, energy: 0.24 },
      }),
      beat('aftermath', {
        kind: 'line',
        label: 'ONE CAR, TWO JOBS',
        lines: ['Every E30 M3', 'left the line', 'as proof.'],
        ease: 'power2.inOut',
        layout: 'left-upper',
        cam: cam(-5.2, 4.0, 7.4, 0, 0.5, 0, 29, 0.12),
        desktop: { fov: 26 },
        mobile: { fov: 28 },
        model: { ry: -0.25 },
        light: { env: 0.85, key: 0.8, rim: 0.8, exp: 0.94, energy: 0.18 },
      }),
    ],
  },

  /* ======================================================================
     03 — THE MACHINE
     Rhythm: engineering. The car becomes the diagram. Each callout is
     anchored to a measured point on the model and drawn in screen space.
     ====================================================================== */
  machine: {
    chapter: '03',
    id: 'machine',
    camera: 'machine',
    title: 'THE MACHINE',
    eyebrow: 'ENGINEERING',
    theme: 'engineering',
    beats: [
      beat('engine', {
        kind: 'callout',
        index: '01',
        label: 'ENGINE',
        figure: 'S14B23',
        figureSub: '2.3 L · Inline four',
        lines: ['The four-cylinder', 'became the point.'],
        anchor: [0.12, 0.78, 1.28],
        leader: [-1, -1],
        facts: [
          { label: 'DISPLACEMENT', value: '2,302 cc' },
          { label: 'VALVETRAIN', value: 'DOHC · 16 valves' },
          { label: 'OUTPUT', value: '200 hp @ 6,750 rpm' },
          { label: 'TORQUE', value: '240 Nm @ 4,750 rpm' },
        ],
        qualifier: 'Without catalytic converter. Catalyst cars: 195 hp.',
        ease: 'power2.inOut',
        layout: 'left-upper',
        cam: cam(2.15, 1.95, 3.95, 0.1, 0.72, 1.3, 29, 0.22),
        light: { env: 0.9, key: 0.85, rim: 0.9, exp: 0.96, energy: 0.15 },
      }),
      beat('chassis', {
        kind: 'callout',
        index: '02',
        label: 'CHASSIS',
        figure: '1,200 kg',
        figureSub: 'Kerb weight',
        lines: ['Everything', 'moves outward.'],
        anchor: [0.74, 0.52, 1.36],
        leader: [1, -1],
        facts: [
          { label: 'FRONT', value: 'MacPherson struts' },
          { label: 'REAR', value: 'Semi-trailing arms' },
          { label: 'WHEELBASE', value: '2,562 mm' },
          { label: 'WHEELS', value: '7J × 15 cross-spoke' },
        ],
        ease: 'power2.inOut',
        layout: 'left-upper',
        cam: cam(2.4, 0.58, 2.6, 0.66, 0.44, 1.36, 37, 0.33),
        light: { env: 0.92, key: 0.75, rim: 1.0, exp: 0.97, energy: 0.15 },
      }),
      beat('transmission', {
        kind: 'callout',
        index: '03',
        label: 'TRANSMISSION',
        figure: 'Getrag 265',
        figureSub: 'Five-speed · dog-leg',
        lines: ['Dog-leg first.', 'A racing habit.'],
        anchor: [0, 0.62, 0.1],
        leader: [1, -1],
        facts: [
          { label: 'GEARBOX', value: 'Five-speed manual' },
          { label: 'DRIVE', value: 'Rear · limited-slip' },
          { label: '0–100 KM/H', value: '6.7 s' },
          { label: 'TOP SPEED', value: '235 km/h' },
        ],
        ease: 'power2.inOut',
        layout: 'left-upper',
        cam: cam(-7.8, 0.78, 1.0, 0, 0.6, -0.15, 25, 0.2),
        light: { env: 0.85, key: 0.7, rim: 1.2, exp: 0.94, energy: 0.14 },
      }),
      beat('brakes', {
        kind: 'callout',
        index: '04',
        label: 'BRAKES',
        figure: '280 mm',
        figureSub: 'Ventilated front discs',
        lines: ['It stops', 'the way it goes.'],
        anchor: [-0.74, 0.36, -1.3],
        leader: [-1, 1],
        facts: [
          { label: 'FRONT', value: '280 mm, ventilated' },
          { label: 'REAR', value: '282 mm, solid' },
        ],
        ease: 'power2.inOut',
        layout: 'left-upper',
        cam: cam(-2.95, 0.44, -2.95, -0.7, 0.38, -1.3, 33, 0.3),
        light: { env: 0.88, key: 0.72, rim: 1.1, exp: 0.95, energy: 0.14 },
      }),
      beat('aero', {
        kind: 'callout',
        index: '05',
        label: 'AERODYNAMICS',
        figure: 'Cd 0.33',
        figureSub: 'Standard E30: 0.38',
        lines: ['The front end', 'does work.'],
        anchor: [0, 0.5, 2.08],
        leader: [-1, 1],
        facts: [
          { label: 'FRONT', value: 'Deep apron, spoiler lip' },
          { label: 'REAR SCREEN', value: 'Flatter rake' },
          { label: 'BOOT LID', value: 'Raised, with wing' },
        ],
        ease: 'power2.inOut',
        layout: 'left-upper',
        cam: cam(1.5, 0.66, 4.6, 0.05, 0.52, 2.0, 35, 0.2),
        light: { env: 0.95, key: 0.8, rim: 0.8, exp: 0.98, energy: 0.16 },
      }),
      beat('bodywork', {
        kind: 'callout',
        index: '06',
        label: 'BODYWORK',
        figure: '4,345 mm',
        figureSub: 'Overall length',
        lines: ['The proportion', 'is the argument.'],
        anchor: [0, 0.72, -0.2],
        leader: [1, -1],
        facts: [
          { label: 'ARCHES', value: 'Box-flared, front and rear' },
          { label: 'BODY', value: 'Two-door coupé' },
          { label: 'BUILT', value: '1986 – 1991' },
        ],
        ease: 'expo.out',
        layout: 'left-upper',
        cam: cam(-4.6, 3.35, 3.6, 0, 0.64, 0.1, 29, 0.2),
        light: { env: 1.0, key: 0.9, rim: 0.9, exp: 1, energy: 0.18 },
      }),
    ],
  },

  /* ======================================================================
     04 — BORN TO RACE
     Rhythm: speed. Low angles, wide lenses, faster eases, the only chapter
     where the accent light is allowed to speak.
     ====================================================================== */
  race: {
    chapter: '04',
    id: 'race',
    camera: 'race',
    title: 'BORN TO RACE',
    eyebrow: 'COMPETITION',
    theme: 'speed',
    beats: [
      beat('y1987', {
        kind: 'year-only',
        year: '1987',
        label: 'FIRST SEASON',
        lines: ['Its first season', 'ends with a', { text: 'world title.', em: true }],
        body: 'Roberto Ravaglia wins the World Touring Car Championship — the only one ever held.',
        ease: 'power4.out',
        layout: 'left-lower',
        cam: cam(3.1, 0.38, 5.5, 0, 0.45, 0.5, 39, 0.12),
        desktop: { fov: 32 },
        mobile: { fov: 38 },
        model: { ry: 0.34 },
        light: { env: 0.85, key: 0.75, rim: 1.4, exp: 1, energy: 0.42 },
      }),
      beat('touring', {
        kind: 'ledger',
        label: '1987 — THE FIRST YEAR',
        lines: ['A touring car is', 'a road car', 'with a timer.'],
        rows: [
          { year: '1987', series: 'World Touring Car Championship', driver: 'Roberto Ravaglia', team: 'Schnitzer' },
          { year: '1987', series: 'European Touring Car Championship', driver: 'Winfried Vogt', team: 'Linder' },
          { year: '1987', series: 'Deutsche Tourenwagen Meisterschaft', driver: 'Eric van de Poele', team: 'Zakspeed' },
          { year: '1987', series: 'Australian Touring Car Championship', driver: 'Jim Richards', team: 'JPS Team BMW' },
          { year: '1987', series: 'Tour de Corse — World Rally Championship', driver: 'Bernard Béguin', team: 'Prodrive' },
        ],
        ease: 'power2.out',
        layout: 'flow',
        cam: cam(-5.2, 0.95, -3.4, 0, 0.5, -0.6, 41, 0.19),
        desktop: { fov: 34 },
        mobile: { veil: 0.64 },
        model: { ry: -0.3 },
        // The archive moment: the car steps back behind the ledger.
        veil: 0.42,
        light: { env: 0.8, key: 0.7, rim: 1.7, exp: 1, energy: 0.5 },
      }),
      beat('dtm', {
        kind: 'word',
        word: 'DTM',
        label: 'DEUTSCHE TOURENWAGEN MEISTERSCHAFT',
        facts: [
          { label: '1987 CHAMPION', value: 'Eric van de Poele' },
          { label: '1989 CHAMPION', value: 'Roberto Ravaglia' },
        ],
        ease: 'power4.out',
        layout: 'left-upper',
        cam: cam(4.8, 0.32, 3.3, 0, 0.42, 0.3, 47, 0.04),
        desktop: { fov: 38 },
        mobile: { fov: 42 },
        model: { ry: 0.1 },
        light: { env: 0.9, key: 0.8, rim: 1.9, exp: 1.02, energy: 0.58 },
        veil: 0,
      }),
      beat('championships', {
        kind: 'ledger',
        label: 'CHAMPIONSHIPS',
        lines: ['Then the', 'titles kept coming.'],
        rows: [
          { year: '1988', series: 'British Touring Car Championship', driver: 'Frank Sytner', team: 'BMW Team Finance' },
          { year: '1989', series: 'Deutsche Tourenwagen Meisterschaft', driver: 'Roberto Ravaglia', team: 'Schnitzer' },
          { year: '1989–92', series: 'Nürburgring 24 Hours', driver: 'Four consecutive wins', team: '' },
          { year: '1991', series: 'British Touring Car Championship', driver: 'Will Hoy', team: '' },
        ],
        ease: 'power2.out',
        layout: 'flow',
        cam: cam(-2.5, 4.5, -6.4, 0, 0.5, -0.3, 43, 0.2),
        desktop: { fov: 30 },
        mobile: { veil: 0.64 },
        model: { ry: -0.18 },
        veil: 0.42,
        light: { env: 0.75, key: 0.6, rim: 2.2, exp: 1, energy: 0.52 },
      }),
      beat('racing-legacy', {
        kind: 'line',
        variant: 'title',
        lines: ['Racing', 'legacy.'],
        body: 'The part nobody argues with.',
        ease: 'power4.out',
        layout: 'right-upper',
        cam: cam(0.5, 0.3, 7.6, 0, 0.45, 0.8, 51, -0.1),
        desktop: { fov: 30 },
        mobile: { fov: 36 },
        model: { ry: 0.42, my: 0.02 },
        light: { env: 0.95, key: 0.9, rim: 1.5, exp: 1.04, energy: 0.46 },
        veil: 0,
      }),
    ],
  },

  /* ======================================================================
     05 — THE ICON
     Rhythm: still. Long lenses, close subjects; the text annotates the car.
     ====================================================================== */
  icon: {
    chapter: '05',
    id: 'icon',
    camera: 'icon',
    title: 'THE ICON',
    eyebrow: 'DESIGN',
    theme: 'design',
    beats: [
      beat('silhouette', {
        kind: 'line',
        lines: ['The silhouette', 'is the signature.'],
        body: 'Recognisable from the outline alone.',
        ease: 'expo.out',
        layout: 'left-upper',
        cam: cam(10.2, 1.05, 0.5, 0, 0.62, 0, 20, 0.14),
        model: { ry: 0.06 },
        light: { env: 1.0, key: 0.75, rim: 0.9, exp: 0.98, energy: 0.14 },
      }),
      beat('arches', {
        kind: 'callout',
        index: '01',
        label: 'WHEEL ARCHES',
        lines: ['Wider. Lower.', 'Purposeful.'],
        anchor: [0.74, 0.6, 1.34],
        leader: [1, -1],
        ease: 'power2.inOut',
        layout: 'left-upper',
        cam: cam(3.15, 0.52, 2.55, 0.72, 0.52, 1.34, 25, 0.3),
        light: { env: 1.0, key: 0.8, rim: 0.7, exp: 1, energy: 0.15 },
      }),
      beat('grille', {
        kind: 'callout',
        index: '02',
        label: 'FRONT GRILLE',
        lines: ['The nose', 'stays upright.'],
        anchor: [0, 0.6, 2.12],
        leader: [-1, -1],
        ease: 'power2.inOut',
        layout: 'right-lower',
        cam: cam(1.2, 0.88, 4.35, 0, 0.62, 2.05, 31, -0.34),
        light: { env: 1.05, key: 0.85, rim: 0.6, exp: 1, energy: 0.16 },
      }),
      beat('lights', {
        kind: 'callout',
        index: '03',
        label: 'HEADLIGHTS',
        lines: ['Flat. Wide.', 'Unhurried.'],
        anchor: [0.5, 0.6, 1.95],
        leader: [1, -1],
        ease: 'power2.inOut',
        layout: 'left-lower',
        cam: cam(1.55, 0.8, 3.55, 0.5, 0.6, 1.95, 31, 0.32),
        light: { env: 1.05, key: 0.9, rim: 0.55, exp: 1.02, energy: 0.16 },
      }),
      beat('spoiler', {
        kind: 'callout',
        index: '04',
        label: 'REAR SPOILER',
        lines: ['A line', 'across the tail.'],
        anchor: [0, 0.95, -2.05],
        leader: [-1, -1],
        ease: 'power2.inOut',
        layout: 'left-upper',
        cam: cam(-2.5, 1.55, -3.65, 0, 0.95, -2.0, 31, 0.26),
        light: { env: 1.0, key: 0.8, rim: 0.8, exp: 0.98, energy: 0.15 },
      }),
      beat('wheels', {
        kind: 'callout',
        index: '05',
        label: 'WHEELS',
        lines: ['Cross-spoke,', 'and all business.'],
        anchor: [0.7, 0.31, 1.35],
        leader: [1, 1],
        facts: [{ label: 'FITMENT', value: '7J × 15 cross-spoke' }],
        ease: 'power2.inOut',
        layout: 'left-upper',
        cam: cam(3.0, 0.52, 2.45, 0.7, 0.34, 1.35, 26, 0.3),
        light: { env: 1.05, key: 0.85, rim: 0.7, exp: 1, energy: 0.16 },
      }),
      beat('for-track', {
        kind: 'line',
        lines: ['Designed', 'for the track.'],
        body: 'And sold, in the same shape, on the street.',
        ease: 'expo.out',
        layout: 'left-upper',
        cam: cam(-9.2, 1.25, 2.8, 0, 0.6, 0, 22, 0.17),
        model: { ry: -0.1 },
        light: { env: 1.0, key: 0.8, rim: 1.0, exp: 1, energy: 0.2 },
      }),
    ],
  },

  /* ======================================================================
     06 — THE LEGACY
     Rhythm: release. The quietest chapter: the light comes down, the type
     gets smaller, and it ends where it started.
     ====================================================================== */
  legacy: {
    chapter: '06',
    id: 'legacy',
    camera: 'legacy',
    title: 'THE LEGACY',
    eyebrow: 'AFTER',
    theme: 'legacy',
    // Full-screen plates for "It evolved." (public/images, WebP copies of
    // the supplied PNGs). `focusMobile` is the horizontal focal point on
    // portrait screens, where `cover` keeps only ~30% of a landscape photo:
    // it holds the car's front three-quarters in frame. Year = public debut of each M3 generation. The
    // fifth generation (F80, 2014) has no plate and is not listed.
    generations: [
      { code: 'E30', label: 'THE ORIGINAL', year: '1986', engine: 'S14 · 2.3 L inline four',
        image: 'images/e30.webp', focusMobile: '20%', alt: 'Red BMW M3 E30 parked on a gravel track beside a field' },
      { code: 'E36', label: 'SECOND GENERATION', year: '1992', engine: 'S50 · inline six',
        image: 'images/e36.webp', focusMobile: '24%', alt: 'Dark green BMW M3 E36 at speed on a tree-lined road' },
      { code: 'E46', label: 'THIRD GENERATION', year: '2000', engine: 'S54 · 3.2 L inline six',
        image: 'images/e46.webp', focusMobile: '28%', alt: 'Yellow BMW M3 E46 coupé on a road above a valley' },
      { code: 'E9X', label: 'FOURTH GENERATION', year: '2007', engine: 'S65 · 4.0 L V8',
        image: 'images/e9x.webp', focusMobile: '31%', alt: 'Orange BMW M3 E92 GTS with rear wing on a mountain road' },
      { code: 'G80', label: 'SIXTH GENERATION', year: '2020', engine: 'S58 · 3.0 L twin-turbo inline six',
        image: 'images/g80.webp', focusMobile: '27%', alt: 'Green BMW M3 G80 on a wet road through a forest' },
    ],
    beats: [
      beat('didnt-end', {
        kind: 'line',
        lines: ['The M3 didn’t end', 'with the E30.'],
        body: 'The template outlived the car.',
        ease: 'expo.out',
        layout: 'left-upper',
        cam: cam(6.2, 1.9, 6.2, 0, 0.6, 0.2, 26, 0.14),
        desktop: { fov: 21 },
        model: { ry: 0.3 },
        light: { env: 0.85, key: 0.75, rim: 0.8, exp: 0.94, energy: 0.16 },
      }),
      beat('evolved', {
        kind: 'generations',
        label: 'E30 → G80',
        lines: ['It evolved.'],
        ease: 'power2.inOut',
        layout: 'flow',
        cam: cam(-7.4, 2.6, -5.0, 0, 0.6, -0.4, 27, 0.12),
        desktop: { fov: 25 },
        model: { ry: -0.34 },
        light: { env: 0.7, key: 0.6, rim: 1.0, exp: 0.88, energy: 0.12 },
        veil: 0.35,
      }),
      beat('carries', {
        kind: 'line',
        lines: ['But every generation', 'carries something', 'from the original.'],
        ease: 'power2.inOut',
        layout: 'left-upper',
        cam: cam(0, 5.4, 0.2, 0, 0.6, 0, 30, 0.22),
        model: { ry: 0.2 },
        light: { env: 0.8, key: 0.75, rim: 0.7, exp: 0.92, energy: 0.12 },
        veil: 0.08,
      }),
      beat('return', {
        kind: 'line',
        variant: 'title',
        lines: ['The original.'],
        ease: 'expo.out',
        layout: 'left-upper',
        cam: cam(5.0, 1.1, 5.8, 0, 0.52, 0.35, 30, 0.17),
        model: { ry: 0.24 },
        light: { env: 0.85, key: 0.85, rim: 0.8, exp: 0.94, energy: 0.1 },
        veil: 0,
      }),
      beat('m3', {
        kind: 'word',
        word: 'M3',
        label: 'BMW E30 · 1986',
        ease: 'expo.out',
        layout: 'left-upper',
        cam: cam(4.4, 1.05, 5.2, 0, 0.55, 0.3, 31, 0.06),
        desktop: { fov: 26 },
        model: { ry: 0.16 },
        light: { env: 0.7, key: 0.6, rim: 0.9, exp: 0.8, energy: 0.06 },
        veil: 0.1,
      }),
      beat('fade', {
        kind: 'fade',
        ease: 'power2.inOut',
        layout: 'flow',
        cam: cam(5.6, 1.0, 6.2, 0, 0.52, 0.3, 30, 0.17),
        model: { ry: 0.12 },
        light: { env: 0.24, key: 0.16, rim: 0.7, exp: 0.6, energy: 0 },
        // The studio goes quiet: the scene veil takes the car AND the
        // environment down to a rim-lit outline. Kept at 0.78 so --final (the
        // whole-frame veil, which would dim the type too) never engages.
        veil: 0.78,
      }),
    ],
  },
}

/* ---------------------------------------------------------------------------
   ORDER. `chapterOrder` keeps the legacy name consumed by ModelScene and
   Navigation; `chapters` is the flat list the UI iterates.
   `beginning` is chapter 01 and doubles as the hero, so it carries the
   `data-camera="hero"` key the camera layer already resolves.
   --------------------------------------------------------------------------- */
export const chapterOrder = ['beginning', 'origin', 'machine', 'race', 'icon', 'legacy']
export const chapters = chapterOrder.map((key) => e30Story[key])

/** Flat, ordered list of every beat in the film — the timeline the rig walks.
 *  The prologue comes first; it is part of the film but not a chapter. */
export const beats = [
  ...prologue.beats.map((b) => ({ ...b, chapterId: prologue.id })),
  ...chapterOrder.flatMap((chapterId) => e30Story[chapterId].beats.map((b) => ({ ...b, chapterId }))),
]

/** Beats that anchor a callout to a measured point on the model. */
export const anchoredBeats = beats.filter((b) => b.anchor)
