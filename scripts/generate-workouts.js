'use strict';
/**
 * generate-workouts.js
 * Creates all 36 workout markdown files (12 weeks × A/B/C),
 * updates workouts/index.json, and updates data.json.
 * Run: node scripts/generate-workouts.js
 */

const fs   = require('fs');
const path = require('path');
const BASE = path.join(__dirname, '..');

// ─── Template helpers ────────────────────────────────────────────────────────

function exLine(n, name, scheme, clint, wife, muscles, notes) {
  const lines = [`### ${n}. ${name} \`${scheme}\``];
  if (muscles) lines.push(`- **Target muscles**: ${muscles}`);
  if (clint && wife) lines.push(`- **Clint**: ${clint} | **Wife**: ${wife}`);
  else if (clint)    lines.push(`- **Weight**: ${clint}`);
  if (notes) for (const note of notes) if (note) lines.push(`- ${note}`);
  return lines.join('\n');
}

function generateAB(weekNum, type, d) {
  const phase = weekNum <= 4 ? 1 : weekNum <= 8 ? 2 : 3;
  const pLabel = ['', 'Foundation', 'Build', 'Peak'][phase];
  const rounds = phase === 3 ? 4 : 3;
  const rest   = phase === 1 ? '60–90 sec' : phase === 2 ? '45–60 sec' : '30–45 sec';
  let n = 1;
  const L = [];

  L.push(`# Week ${weekNum} — Workout ${type} — ${d.title}`);
  L.push(`**Phase**: ${phase} — ${pLabel} | **Week**: ${weekNum} of 12 | **Rounds**: ${rounds} | **Est. Time**: 40–45 min`);
  L.push(`**Focus**: ${d.focus}`);
  L.push('');
  L.push(`> Rest ${rest} between supersets. Set up both stations before starting each round.`);
  L.push(`> Progression rule: complete all reps cleanly → add 5 lbs next session.`);
  L.push('');
  L.push('---');
  L.push('');
  L.push('## Block 1 — Warm-Up (5 min)');
  L.push('');
  for (const [wname, wscheme] of d.warmup) {
    L.push(exLine(n++, wname, wscheme, '', '', '', []));
    L.push('');
  }
  L.push('---');
  L.push('');
  L.push(`## Block 2 — ${d.c1name} (${rounds} rounds)`);
  L.push('');
  for (let i = 0; i < d.c1.length; i++) {
    const [ename, escheme, clint, wife, muscles] = d.c1[i];
    const notes = i === 0
      ? [`Superset 1A/1B: perform back-to-back. Rest ${rest} after each round.`]
      : [];
    L.push(exLine(n++, ename, escheme, clint, wife, muscles, notes));
    L.push('');
  }
  L.push('---');
  L.push('');
  L.push(`## Block 3 — ${d.c2name} (${rounds} rounds)`);
  L.push('');
  for (let i = 0; i < d.c2.length; i++) {
    const [ename, escheme, clint, wife, muscles] = d.c2[i];
    const notes = i === 0
      ? [`Superset 2A/2B: perform back-to-back. Rest ${rest} after each round.`]
      : [];
    L.push(exLine(n++, ename, escheme, clint, wife, muscles, notes));
    L.push('');
  }
  L.push('---');
  L.push('');
  L.push(`## Block 4 — Core Block (${rounds} rounds)`);
  L.push('');
  for (const [cname, cscheme] of d.core) {
    L.push(exLine(n++, cname, cscheme, '', '', '', []));
    L.push('');
  }
  L.push('---');
  L.push('');
  L.push('## Block 5 — Finisher');
  L.push('');
  L.push(exLine(n++, d.finisher[0], d.finisher[1], '', '', '', ['Max effort each interval.']));
  L.push('');
  L.push('---');
  L.push('');
  L.push('## Notes');
  L.push(d.notes);

  return L.join('\n');
}

function generateC(weekNum, d) {
  const phase = weekNum <= 4 ? 1 : weekNum <= 8 ? 2 : 3;
  const pLabel = ['', 'Foundation', 'Build', 'Peak'][phase];
  let n = 1;
  const L = [];

  L.push(`# Week ${weekNum} — Workout C — Active Recovery`);
  L.push(`**Phase**: ${phase} — ${pLabel} | **Week**: ${weekNum} of 12 | **Est. Time**: 30 min`);
  L.push(`**Focus**: Mobility · Recovery · Light Activation · No Heavy Loading`);
  L.push('');
  L.push('> Low intensity — deliberate and continuous. This day accelerates recovery.');
  L.push('> Perform 2–3 slow rounds of the full flow if time allows.');
  L.push('');
  L.push('---');
  L.push('');
  for (const block of d.blocks) {
    L.push(`## ${block.name}`);
    L.push('');
    for (const [ename, escheme] of block.exercises) {
      L.push(exLine(n++, ename, escheme, '', '', '', []));
      L.push('');
    }
    L.push('---');
    L.push('');
  }
  L.push('## Notes');
  L.push(d.notes || '- Foam roll slowly — pause 3–5 sec on tight spots.\n- No grinding through pain. This is recovery, not training.');

  return L.join('\n');
}

// ─── A/B Workout Data ────────────────────────────────────────────────────────

const AB = {

'1A': {
  title: 'Lower Push + Vertical Pull + Core',
  focus: 'Quads · Glutes · Lats · Rear Delts · Core (stability)',
  warmup: [['Elliptical or Bike','3 min moderate pace'],['Glute Bridge','15 reps'],['Band Pull-Aparts','15 reps'],['Leg Swings','10 each side']],
  c1name: 'Circuit 1 — Lower Body + Pull (rack/cable area)',
  c1: [
    ['Goblet Squat','3 × 12','35–45 lb DB','20–25 lb DB','Quads, glutes, core'],
    ['Lat Pulldown (Wide Grip)','3 × 12','120 lb','50–60 lb','Lats, biceps, rear delts'],
  ],
  c2name: 'Circuit 2 — Glutes + Rear Delt (cable/bench area)',
  c2: [
    ['Hip Thrust (Glute Bridge)','3 × 15','45 lb DB on hips','25 lb DB','Glutes, hamstrings, core'],
    ['Cable Face Pull','3 × 15','40 lb','20 lb','Rear delts, external rotators, rhomboids'],
  ],
  core: [['Dead Bug','3 × 10 each side'],['Plank Hold','3 × 30 sec'],['Side Plank','3 × 20 sec each side']],
  finisher: ['Rowing Machine','3 × 45 sec hard / 15 sec rest'],
  notes: '- Goblet squat + lat pulldown: opposite patterns — ideal superset.\n- Hip thrust: upper back on bench, drive heels, 2-sec glute squeeze at top.\n- Face pulls are non-negotiable for long-term shoulder health.',
},

'1B': {
  title: 'Hinge + Horizontal Push + Core',
  focus: 'Hamstrings · Glutes · Chest · Shoulders · Core (anti-rotation)',
  warmup: [['Treadmill Brisk Walk','3 min (3.5–4 mph)'],['Cat-Cow','10 reps'],['Hip Hinge Drill (bodyweight)','10 reps'],["World's Greatest Stretch",'5 each side']],
  c1name: 'Circuit 1 — Hinge + Push (free weight area)',
  c1: [
    ['Romanian Deadlift (DB)','3 × 12','50–60 lb DBs','20–25 lb DBs','Hamstrings, glutes, lower back'],
    ['Dumbbell Bench Press','3 × 12','45 lb DBs','20 lb DBs','Chest, front delts, triceps'],
  ],
  c2name: 'Circuit 2 — Single Leg + Shoulder (same area)',
  c2: [
    ['Reverse Lunge (DB)','3 × 10 each leg','30 lb DBs','15 lb DBs','Quads, glutes, hip flexors'],
    ['Dumbbell Lateral Raise','3 × 15','15 lb each','8 lb each','Medial deltoids, shoulder health'],
  ],
  core: [['Hollow Body Hold','3 × 20 sec'],['Cable Pallof Press','3 × 12 each side'],['Reverse Crunch','3 × 15']],
  finisher: ['Stationary Bike','4 × 30 sec sprint / 30 sec easy'],
  notes: '- RDL: soft knee bend, bar/DBs drag down the legs, feel hamstrings load at bottom.\n- Lateral raises stay light intentionally — shoulder health and posture, not mass.\n- No direct arm isolation across any session in this program.',
},

'2A': {
  title: 'Squat Pattern + Row + Core',
  focus: 'Quads · Back · Hamstrings · Core (flexion/rotation)',
  warmup: [['Bike','3 min'],['Bodyweight Squat','15 reps'],['Face Pull with Band','15 reps'],['Hip Circles','10 each side']],
  c1name: 'Circuit 1 — Legs + Row (cable machine area)',
  c1: [
    ['Leg Press','3 × 12','180–200 lb','90–110 lb','Quads, glutes, hamstrings'],
    ['Seated Cable Row (Wide Grip)','3 × 12','120 lb','55 lb','Mid-back, rhomboids, rear delts'],
  ],
  c2name: 'Circuit 2 — Hip Dominant + Pull (same machine area)',
  c2: [
    ['Lying Leg Curl','3 × 12','90 lb','50 lb','Hamstrings, glutes'],
    ['Cable Straight-Arm Pulldown','3 × 15','50 lb','25 lb','Lats, serratus, core'],
  ],
  core: [['Ab Wheel Rollout (kneeling)','3 × 8'],['Side Plank with Hip Lift','3 × 10 each side'],['Lying Windshield Wipers (knees bent)','3 × 10 each side']],
  finisher: ['Jump Rope or Fast Feet','3 × 50 jumps / 30 sec rest'],
  notes: '- Leg press: keep feet hip-width, full range of motion.\n- Cable straight-arm pulldown: arms straight, lat-initiated — great isolation.',
},

'2B': {
  title: 'Single Leg + Press + Rotational Core',
  focus: 'Quads · Glutes · Chest · Core (anti-rotation/rotation)',
  warmup: [['Rowing Machine','3 min easy'],['Glute Bridge March','10 each side'],['Thoracic Rotation','10 each side'],['Ankle Circles','10 each side']],
  c1name: 'Circuit 1 — Single Leg + Press (free weight area)',
  c1: [
    ['Bulgarian Split Squat (DB)','3 × 10 each leg','30 lb DBs','15 lb DBs','Quads, glutes, hip flexors'],
    ['Cable Chest Press (single arm, standing)','3 × 12 each side','40 lb','20 lb','Chest, front delts, core stability'],
  ],
  c2name: 'Circuit 2 — Glute + Rear Delt (cable area)',
  c2: [
    ['Cable Kickback','3 × 15 each leg','30 lb','15 lb','Glutes (peak contraction)'],
    ['Cable Rear Delt Fly','3 × 15','15 lb each side','8 lb each side','Rear delts, rhomboids'],
  ],
  core: [['Cable Woodchop (Low to High)','3 × 12 each side'],['Plank Shoulder Tap','3 × 12 each side'],['Leg Raise (Flat Bench)','3 × 12']],
  finisher: ['Rowing Machine','3 × 1 min moderate / 30 sec rest'],
  notes: '- Bulgarian split squat: most effective single-leg exercise — progress load steadily.\n- Cable rear delt fly: full range, pause at peak contraction.',
},

'3A': {
  title: 'Deadlift Focus + Incline Push + Core',
  focus: 'Hamstrings · Glutes · Upper Chest · Upper Back · Core (stability)',
  warmup: [['Treadmill','3 min moderate'],['Good Morning (bodyweight)','10 reps'],['Inchworm','5 reps'],['Band Glute Bridge','15 reps']],
  c1name: 'Circuit 1 — Hinge Heavy + Push (barbell/DB area)',
  c1: [
    ['Dumbbell Deadlift','3 × 10','60–70 lb DBs','25–30 lb DBs','Hamstrings, glutes, lower back'],
    ['Incline Dumbbell Press','3 × 12','40 lb DBs','20 lb DBs','Upper chest, front delts, triceps'],
  ],
  c2name: 'Circuit 2 — Upper Back + Lunge (same free weight area)',
  c2: [
    ['Dumbbell Walking Lunge','3 × 10 each leg','25 lb DBs','15 lb DBs','Quads, glutes, hip flexors'],
    ['Dumbbell Bent-Over Row','3 × 12','45 lb DBs','20 lb DBs','Lats, rhomboids, rear delts, biceps'],
  ],
  core: [['Stir the Pot (forearm plank, circles)','3 × 8 each direction'],['Hanging Knee Raise','3 × 12'],['Pallof Press Hold','3 × 20 sec each side']],
  finisher: ['Stationary Bike','5 × 20 sec all-out / 40 sec easy'],
  notes: '- Stir the pot: forearms on stability ball or plate, draw circles. Extremely effective stabilizer.\n- Incline press targets upper chest that flat bench misses.',
},

'3B': {
  title: 'Hip Thrust Heavy + Vertical Press + Core',
  focus: 'Glutes · Shoulders · Back · Core (anti-extension)',
  warmup: [['Elliptical','3 min'],['Clamshells','15 each side'],['Scapular Wall Slide','10 reps'],['Hip Hinge with Pause','10 reps']],
  c1name: 'Circuit 1 — Glute Dominant + Shoulder (bench/DB area)',
  c1: [
    ['Barbell Hip Thrust','3 × 12','bar + 45s','bar only or light plates','Glutes, hamstrings, core'],
    ['Dumbbell Shoulder Press (seated)','3 × 12','35 lb DBs','15 lb DBs','Deltoids, triceps, core'],
  ],
  c2name: 'Circuit 2 — Pull + Step (cable/step area)',
  c2: [
    ['Assisted Pull-Up or Cable Pulldown (neutral grip)','3 × 10','bodyweight','assisted or 50 lb cable','Lats, biceps, rear delts'],
    ['Step-Up with Knee Drive (DB)','3 × 10 each leg','25 lb DBs','12 lb DBs','Quads, glutes, hip flexors'],
  ],
  core: [['Cable Pallof Press (kneeling)','3 × 12 each side'],['V-Up','3 × 10'],['Dead Bug with Dumbbell (arm only)','3 × 10 each side']],
  finisher: ['Rowing Machine','4 × 30 sec hard / 30 sec easy'],
  notes: '- Barbell hip thrust: most effective glute builder — maximize squeeze at top.\n- Step-up with knee drive: adds balance and functional hip flexor challenge.',
},

'4A': {
  title: 'Front Squat + Single-Arm Pull + Core',
  focus: 'Quads · Back · Glutes · Core (flexion)',
  warmup: [['Bike','3 min'],['Ankle Mobility Drill','10 each side'],['Thoracic Extension over Foam Roller','60 sec'],['Glute Bridge','15 reps']],
  c1name: 'Circuit 1 — Quad + Pull (rack/cable area)',
  c1: [
    ['Dumbbell Front Squat','3 × 12','40 lb DBs','20 lb DBs','Quads, glutes, core, front delts'],
    ['Single-Arm Cable Row','3 × 12 each side','60 lb','30 lb','Lats, rhomboids, rear delts, biceps'],
  ],
  c2name: 'Circuit 2 — Posterior Chain + Push (same area)',
  c2: [
    ['Good Morning (bar or DB)','3 × 12','45 lb bar','20 lb DBs','Hamstrings, glutes, lower back'],
    ['Cable Fly (chest)','3 × 15','30 lb each side','15 lb each side','Chest, front delts'],
  ],
  core: [['Lying Leg Raise','3 × 12'],['Side Plank with Reach Through','3 × 10 each side'],['Bird Dog','3 × 10 each side']],
  finisher: ['Jump Rope or Fast Stepping','4 × 40 sec / 20 sec rest'],
  notes: '- Front squat demands more core and upper back than back squat — keep elbows high.\n- Good mornings: excellent hamstring and lower back strength builder.',
},

'4B': {
  title: 'Sumo Deadlift + Press + Rotational Core',
  focus: 'Hamstrings · Inner Quads · Chest · Core (rotation)',
  warmup: [['Rowing Machine','3 min easy'],['Sumo Squat (bodyweight)','10 reps'],['Lateral Hip Stretch','10 each side'],['Band Pull-Aparts','20 reps']],
  c1name: 'Circuit 1 — Wide Stance Hinge + Chest (barbell/bench area)',
  c1: [
    ['Sumo Deadlift (DB or barbell)','3 × 10','95 lb bar','30 lb DBs','Hamstrings, inner quads, glutes, adductors'],
    ['Dumbbell Floor Press','3 × 12','45 lb DBs','20 lb DBs','Chest, triceps, front delts'],
  ],
  c2name: 'Circuit 2 — Lunge Variation + Row (same area)',
  c2: [
    ['Lateral Lunge (DB)','3 × 10 each side','25 lb DBs','12 lb DBs','Inner quads, glutes, adductors'],
    ['Chest-Supported Incline Row (DB)','3 × 12','35 lb DBs','15 lb DBs','Upper back, rhomboids, rear delts'],
  ],
  core: [['Cable Woodchop (High to Low)','3 × 12 each side'],['Hollow Body Rock','3 × 15 sec'],['Ab Wheel Rollout','3 × 8']],
  finisher: ['Stationary Bike','5 × 20 sec sprint / 40 sec easy'],
  notes: '- Sumo deadlift hits inner thighs and glutes differently from conventional — great variation.\n- Chest-supported row removes lower back strain — excellent isolation.',
},

// ── Phase 2 ──────────────────────────────────────────────────────────────────

'5A': {
  title: 'Back Squat + Pull-Up Focus + Anti-Rotation Core',
  focus: 'Quads · Glutes · Lats · Hamstrings · Core (anti-rotation)',
  warmup: [['Treadmill (incline 4, 3.5 mph)','3 min'],['Goblet Squat (bodyweight)','10 reps'],['Scapular Pull-Up Hang','5 reps'],['Hip Circles','10 each side']],
  c1name: 'Circuit 1 — Squat + Vertical Pull (rack/cable area)',
  c1: [
    ['Barbell Back Squat (or Goblet)','3 × 10','bar + 25s each side','35 lb goblet','Quads, glutes, core'],
    ['Assisted Pull-Up','3 × 8','bodyweight','assisted (–40 lb)','Lats, biceps, rear delts'],
  ],
  c2name: 'Circuit 2 — Hip Dominant + Horizontal Push (same zone)',
  c2: [
    ['Single-Leg Romanian Deadlift (DB)','3 × 10 each leg','30 lb DBs','15 lb DBs','Hamstrings, glutes, balance'],
    ['Cable Chest Press (bilateral, standing)','3 × 12','45 lb each side','22 lb each side','Chest, front delts, core'],
  ],
  core: [['Kneeling Pallof Press with Rotation','3 × 10 each side'],['Hanging Knee Raise (slow)','3 × 12'],['Plank with Alternating Leg Lift','3 × 10 each side']],
  finisher: ['Rowing Machine','4 × 45 sec hard / 15 sec rest'],
  notes: '- Phase 2: add 5–10% load vs Phase 1. Rest 45–60 sec between supersets.\n- Single-leg RDL is excellent for hiking and bouldering stability.',
},

'5B': {
  title: 'Hip Thrust Loaded + Arnold Press + Core',
  focus: 'Glutes · Shoulders · Back · Core (lateral/flexion)',
  warmup: [['Bike','3 min'],['Donkey Kick','15 each side'],['Shoulder CARs','5 each side'],['Glute Stretch','30 sec each side']],
  c1name: 'Circuit 1 — Glute + Shoulder (bench/DB area)',
  c1: [
    ['Barbell Hip Thrust','3 × 12','bar + 45 + 25 lbs','bar + 10s','Glutes, hamstrings, core'],
    ['Arnold Press (seated)','3 × 12','30 lb DBs','12 lb DBs','All three deltoid heads, triceps'],
  ],
  c2name: 'Circuit 2 — Row + Step (cable/bench area)',
  c2: [
    ['Half-Kneeling Cable Row','3 × 12 each side','55 lb','27 lb','Lats, rhomboids, core stability'],
    ['Weighted Step-Up (high bench)','3 × 10 each leg','30 lb DBs','15 lb DBs','Quads, glutes, hip flexors'],
  ],
  core: [['Copenhagen Plank (inner thigh)','3 × 20 sec each side'],['Cable Woodchop (High to Low)','3 × 12 each side'],['Reverse Crunch with Hip Lift','3 × 15']],
  finisher: ['Jump Rope','5 × 40 sec / 20 sec rest'],
  notes: '- Arnold press targets all three deltoid heads — superior to standard shoulder press.\n- Half-kneeling row adds core anti-rotation demand.',
},

'6A': {
  title: 'Trap Bar Deadlift + Incline Press + Core',
  focus: 'Full Posterior Chain · Upper Chest · Core (flexion/rotation)',
  warmup: [['Elliptical','3 min'],['Romanian Deadlift (bodyweight)','10 reps'],['Thoracic Spine Rotation','10 each side'],['Hip Flexor Stretch','30 sec each side']],
  c1name: 'Circuit 1 — Trap Bar Hinge + Push (barbell/bench area)',
  c1: [
    ['Trap Bar Deadlift','3 × 8','135 lb','65 lb','Full posterior chain, quads, core'],
    ['Incline Dumbbell Press','3 × 10','45 lb DBs','22 lb DBs','Upper chest, front delts, triceps'],
  ],
  c2name: 'Circuit 2 — Lateral + Rear Chain (same area)',
  c2: [
    ['Lateral Lunge to Curtsy Lunge','3 × 8 each side','20 lb DBs','10 lb DBs','Inner quads, glutes, adductors'],
    ['Cable Face Pull with External Rotation','3 × 15','35 lb','18 lb','Rear delts, external rotators, rhomboids'],
  ],
  core: [['Ab Wheel Rollout','3 × 10'],['Side Plank with Cable Row','3 × 8 each side'],['Lying Windshield Wipers (straight legs)','3 × 8 each side']],
  finisher: ['Stationary Bike','5 × 25 sec all-out / 35 sec easy'],
  notes: '- Trap bar deadlift reduces lower back stress vs straight bar — allows heavier loading.\n- Lateral-to-curtsy combo hits multiple planes — unique movement pattern.',
},

'6B': {
  title: 'Bulgarian Split Squat Heavy + Row + Core',
  focus: 'Quads · Glutes · Back · Core (stability/flexion)',
  warmup: [['Rowing Machine','3 min'],['Hip Flexor Stretch','45 sec each side'],['Lateral Band Walk','15 each side'],['Band Glute Bridge','20 reps']],
  c1name: 'Circuit 1 — Single Leg Strength + Pull (bench/cable area)',
  c1: [
    ['Bulgarian Split Squat (DB, heavy)','3 × 8 each leg','40 lb DBs','20 lb DBs','Quads, glutes, hip flexors'],
    ['Seated Cable Row (close grip)','3 × 10','130 lb','60 lb','Mid-back, lats, biceps'],
  ],
  c2name: 'Circuit 2 — Glute + Chest (same zone)',
  c2: [
    ['Cable Pull-Through (glute focus)','3 × 15','60 lb','30 lb','Glutes, hamstrings, lower back'],
    ['Cable Crossover Fly','3 × 15','25 lb each side','12 lb each side','Chest, front delts'],
  ],
  core: [['Dragon Flag Negative (slow lower)','3 × 5'],['Pallof Press with Squat','3 × 10 each side'],['Single-Leg Glute Bridge on Bench','3 × 12 each side']],
  finisher: ['Rowing Machine','3 × 1 min / 30 sec rest'],
  notes: '- Bulgarian split squat Phase 2: increase load significantly.\n- Dragon flag negative: lower slowly 3–5 sec. One of the most advanced core exercises.',
},

'7A': {
  title: 'Paused Squat + Wide Pull + Advanced Core',
  focus: 'Quads · Lats · Glutes · Core (anti-rotation)',
  warmup: [['Treadmill (incline 5, 3.5 mph)','3 min'],['Glute Bridge','15 reps'],['Deep Squat Hold','30 sec'],['Arm Circles + Band Pull','15 reps']],
  c1name: 'Circuit 1 — Paused Squat + Lat Pull (rack/cable area)',
  c1: [
    ['Goblet Squat with 2-sec Pause at Bottom','3 × 10','50 lb KB','30 lb KB','Quads, glutes, core, mobility'],
    ['Lat Pulldown (Underhand Grip)','3 × 10','130 lb','60 lb','Lats, biceps, rear delts'],
  ],
  c2name: 'Circuit 2 — Hip Thrust Variation + Press (bench area)',
  c2: [
    ['Single-Leg Hip Thrust (bench)','3 × 12 each leg','35 lb DB on hip','bodyweight','Glutes (unilateral), hamstrings'],
    ['Dumbbell Chest Fly (flat bench)','3 × 12','35 lb DBs','15 lb DBs','Chest, front delts'],
  ],
  core: [['Tall Kneeling Pallof Press','3 × 15 each side'],['V-Up with Hold','3 × 10'],['RKC Plank','3 × 20 sec']],
  finisher: ['Stationary Bike','6 × 20 sec sprint / 40 sec easy'],
  notes: '- Paused squat eliminates stretch reflex — builds raw strength and control.\n- Underhand lat pulldown shifts emphasis toward lower lats and biceps.',
},

'7B': {
  title: 'Deficit RDL + Landmine Press + Core',
  focus: 'Hamstrings · Glutes · Shoulders · Core (rotation)',
  warmup: [['Rowing Machine','3 min'],['Hamstring Stretch','45 sec each side'],['Hip Circles','10 each side'],['Scapular Push-Up','10 reps']],
  c1name: 'Circuit 1 — Elevated Hinge + Landmine Push (barbell corner)',
  c1: [
    ['Deficit RDL (standing on plate)','3 × 10','55 lb DBs','25 lb DBs','Hamstrings (increased range), glutes'],
    ['Landmine Press (single arm)','3 × 10 each side','bar + 25 lb plate','bar only','Shoulder, chest, core stability'],
  ],
  c2name: 'Circuit 2 — Cable Pull + Lunge (cable area)',
  c2: [
    ['Cable Kickback (glute)','3 × 15 each leg','35 lb','18 lb','Glutes (peak contraction)'],
    ['Reverse Lunge with Cable Row','3 × 10 each side','40 lb','20 lb','Quads, glutes, back, core'],
  ],
  core: [['Hollow Body to Superman Roll','3 × 8 reps'],['Copenhagen Plank','3 × 25 sec each side'],['Cable Woodchop (Low to High, kneeling)','3 × 12 each side']],
  finisher: ['Jump Rope','4 × 1 min / 30 sec rest'],
  notes: '- Deficit RDL increases hamstring stretch significantly — use lighter load initially.\n- Reverse lunge with cable row: full-body challenge to balance and coordination.',
},

'8A': {
  title: 'Power Complex + Core Intensive',
  focus: 'Posterior Chain · Lats · Quads · Core (all planes)',
  warmup: [['Elliptical','3 min'],['Kettlebell Swing Practice (light)','10 reps'],['Hip Hinge Drill','10 reps'],['Band Clamshell','15 each side']],
  c1name: 'Circuit 1 — Power Hinge + Pull (kettlebell/cable area)',
  c1: [
    ['Kettlebell Swing','3 × 15','35–44 lb KB','18–26 lb KB','Glutes, hamstrings, core (power)'],
    ['Neutral Grip Pull-Up or Pulldown','3 × 8','bodyweight','assisted or 65 lb cable','Lats, biceps, rear delts'],
  ],
  c2name: 'Circuit 2 — Quad + Press (bench/DB area)',
  c2: [
    ['Leg Press (single leg)','3 × 10 each leg','110 lb','55 lb','Quads, glutes, hamstrings'],
    ['Seated DB Press with Rotation','3 × 12','30 lb DBs','12 lb DBs','Deltoids, triceps, rotator cuff'],
  ],
  core: [['Hanging Leg Raise (straight legs)','3 × 10'],['Pallof Press with Overhead Reach','3 × 10 each side'],['Plank to Push-Up','3 × 8 each side']],
  finisher: ['Rowing Machine','4 × 45 sec hard / 15 sec rest'],
  notes: '- KB swing is best power-to-time exercise — drive hips explosively not arms.\n- End of Phase 2: note all your loads for Phase 3 baseline.',
},

'8B': {
  title: 'Deadlift PR Attempt + Shoulder Superset + Core',
  focus: 'Posterior Chain · Shoulders · Core (flexion)',
  warmup: [['Treadmill Brisk Walk','3 min'],['Hip Hinge with Band','10 reps'],['Scapular Pull','10 reps'],['Ankle Drill','10 each side']],
  c1name: 'Circuit 1 — Deadlift Heavy + Row (barbell area)',
  c1: [
    ['Conventional Deadlift','3 × 6','155–175 lb','75–85 lb','Full posterior chain, core'],
    ['Barbell or DB Bent-Over Row','3 × 8','95 lb bar','30 lb DBs','Lats, rhomboids, rear delts, biceps'],
  ],
  c2name: 'Circuit 2 — Glute + Shoulder (same area)',
  c2: [
    ['Sumo Squat with KB','3 × 12','44 lb KB','26 lb KB','Inner quads, glutes, adductors'],
    ['Cable Lateral Raise','3 × 15','15 lb each side','8 lb each side','Medial deltoids, shoulder health'],
  ],
  core: [['Ab Wheel Rollout (feet elevated on bench)','3 × 8'],['Side Bend (Cable, single arm)','3 × 15 each side'],['Dead Bug with Band Pull','3 × 10 each side']],
  finisher: ['Stationary Bike','5 × 25 sec all-out / 35 sec easy'],
  notes: '- Phase 2 deadlift: aim for a near-PR attempt. Record your weight.\n- Cable lateral raise: keep shoulder health as a priority.',
},

// ── Phase 3 ──────────────────────────────────────────────────────────────────

'9A': {
  title: 'Heavy Squat + Chin-Up + Advanced Core',
  focus: 'Quads · Lats · Hamstrings · Upper Chest · Core (advanced)',
  warmup: [['Bike (resistance 8+)','3 min'],['Glute Bridge','20 reps'],['Deep Squat Hold','45 sec'],['Band Pull-Aparts','20 reps']],
  c1name: 'Circuit 1 — Squat Heavy + Pull (rack/cable area)',
  c1: [
    ['Barbell Back Squat','4 × 8','bar + 35s each side','50 lb goblet','Quads, glutes, core'],
    ['Chin-Up (palms facing in)','4 × 6','bodyweight','assisted (–30 lb)','Lats, biceps, rear delts'],
  ],
  c2name: 'Circuit 2 — Posterior + Push (bench/DB area)',
  c2: [
    ['Romanian Deadlift (heavy)','4 × 8','70 lb DBs','30 lb DBs','Hamstrings, glutes, lower back'],
    ['Incline Dumbbell Press','4 × 8','50 lb DBs','25 lb DBs','Upper chest, front delts, triceps'],
  ],
  core: [['Dragon Flag (controlled)','4 × 5'],['Kneeling Cable Crunch','4 × 15'],['Side Plank with Cable Pull','4 × 8 each side']],
  finisher: ['Rowing Machine','5 × 45 sec hard / 15 sec rest'],
  notes: '- Phase 3: heaviest loads, 4 rounds, 30–45 sec rest. Maximum effort.\n- Dragon flag: full-body tension required — one of the most advanced core exercises.',
},

'9B': {
  title: 'Trap Bar + Landmine Row + Rotational Core',
  focus: 'Full Posterior Chain · Back · Quads · Core (rotation)',
  warmup: [['Rowing Machine (moderate-hard)','3 min'],['Hip Hinge Drill','10 reps'],['Scapular Activation','10 reps'],['Hip Flexor Stretch','30 sec each side']],
  c1name: 'Circuit 1 — Trap Bar + Landmine Row (barbell area)',
  c1: [
    ['Trap Bar Deadlift (heavy)','4 × 6','155 lb','80 lb','Full posterior chain, quads, core'],
    ['Landmine Row','4 × 10','bar + 35 lb','bar + 15 lb','Lats, rhomboids, rear delts'],
  ],
  c2name: 'Circuit 2 — Split Squat + Press (bench/DB area)',
  c2: [
    ['Front Foot Elevated Split Squat','4 × 8 each leg','40 lb DBs','20 lb DBs','Quads, glutes, hip flexors'],
    ['Standing DB Shoulder Press','4 × 10','35 lb DBs','15 lb DBs','Deltoids, triceps, core'],
  ],
  core: [['Cable Woodchop (standing, fast)','4 × 12 each side'],['Hanging Leg Raise with Twist','4 × 10'],['Hollow Body Hold','4 × 30 sec']],
  finisher: ['Jump Rope','5 × 1 min / 30 sec rest'],
  notes: '- Front foot elevated split squat: maximum quad depth — most demanding split squat variation.\n- Landmine row: joint-friendly and allows heavy loading.',
},

'10A': {
  title: 'Heavy Hip Thrust + Pull Complex + Core',
  focus: 'Glutes · Back · Quads · Core (advanced stability)',
  warmup: [['Bike','3 min'],['Clamshells','20 each side'],['Glute Bridge March','15 each side'],['Face Pull with Band','20 reps']],
  c1name: 'Circuit 1 — Glute Heavy + Row (bench/cable area)',
  c1: [
    ['Barbell Hip Thrust','4 × 10','bar + 45 + 35 lbs','bar + 25s','Glutes, hamstrings, core'],
    ['Cable Row with Pause (mid-back squeeze)','4 × 10','140 lb','65 lb','Mid-back, rhomboids, rear delts'],
  ],
  c2name: 'Circuit 2 — Lunge + Fly (DB/cable area)',
  c2: [
    ['Reverse Lunge with Knee Drive (weighted)','4 × 10 each leg','35 lb DBs','18 lb DBs','Quads, glutes, hip flexors'],
    ['Cable Fly (mid height)','4 × 15','30 lb each side','15 lb each side','Chest, front delts'],
  ],
  core: [['Ab Wheel Rollout from Feet (full)','4 × 6'],['Copenhagen Plank','4 × 30 sec each side'],['Pallof Press Squat to Press','4 × 10 each side']],
  finisher: ['Rowing Machine','4 × 1 min hard / 30 sec easy'],
  notes: '- Hip thrust at this load is peak — record your weight.\n- Ab wheel from feet is an advanced variation — back must stay neutral throughout.',
},

'10B': {
  title: 'KB Complex + Vertical Push + Core',
  focus: 'Full Body Power · Shoulders · Lats · Core (advanced flexion)',
  warmup: [['Treadmill','3 min'],['KB Halo','10 each direction'],['Hip Circles','10 each side'],['Scapular Push-Up','10 reps']],
  c1name: 'Circuit 1 — KB Complex + Press (kettlebell/DB area)',
  c1: [
    ['KB Swing to Goblet Squat (combo)','4 × 10','35 lb KB','18 lb KB','Glutes, hamstrings, quads, core (power combo)'],
    ['Dumbbell Z-Press (seated on floor)','4 × 10','30 lb DBs','12 lb DBs','Deltoids, triceps, core (no back support)'],
  ],
  c2name: 'Circuit 2 — Pulldown + Step (cable/bench area)',
  c2: [
    ['Lat Pulldown (wide, 3-sec eccentric)','4 × 8','140 lb','65 lb','Lats, biceps, rear delts'],
    ['Weighted Step-Up to Balance','4 × 10 each leg','35 lb DBs','18 lb DBs','Quads, glutes, balance, hip stability'],
  ],
  core: [['Dragon Flag Negative (slow lower)','4 × 6'],['Side Plank with Hip Abduction','4 × 12 each side'],['Slow Leg Raise with Hip Pop','4 × 10']],
  finisher: ['Stationary Bike','6 × 25 sec all-out / 35 sec rest'],
  notes: '- Z-Press eliminates all back support — pure shoulder and core demand.\n- KB swing to goblet combo is highly metabolic — maintain form under fatigue.',
},

'11A': {
  title: 'Squat Variation + Advanced Pull + Core Peak',
  focus: 'Quads · Lats · Hamstrings · Shoulders · Core (advanced all planes)',
  warmup: [['Rowing Machine (hard)','3 min'],['Goblet Squat (slow)','10 reps'],['Hip Flexor Stretch','45 sec each side'],['Band Pull-Aparts','25 reps']],
  c1name: 'Circuit 1 — Paused Squat Heavy + Weighted Pull (rack/cable)',
  c1: [
    ['Barbell Squat with 2-sec Pause','4 × 6','bar + 45s each side','55 lb goblet','Quads, glutes, core, raw strength'],
    ['Weighted Lat Pulldown with Hold','4 × 8','145 lb','70 lb','Lats, biceps, rear delts'],
  ],
  c2name: 'Circuit 2 — Hip Hinge + Press Complex (same zone)',
  c2: [
    ['Single-Leg Deadlift (KB)','4 × 8 each leg','44 lb KB','26 lb KB','Hamstrings, glutes, balance'],
    ['Push Press (DB)','4 × 8','40 lb DBs','18 lb DBs','Deltoids, triceps, power, core'],
  ],
  core: [['Hanging Windshield Wiper','4 × 6 each side'],['Kneeling Cable Crunch with Rotation','4 × 12 each side'],['RKC Plank','4 × 25 sec']],
  finisher: ['Rowing Machine','5 × 1 min hard / 20 sec rest'],
  notes: '- Paused squat: removes bounce, demands full strength from bottom — elite strength builder.\n- Hanging windshield wiper: requires significant lat and hip flexor strength.',
},

'11B': {
  title: 'Deadlift Max + Complex Upper + Core',
  focus: 'Full Posterior Chain · Chest · Quads · Core (advanced)',
  warmup: [['Bike (hard)','3 min'],['Hip Hinge Drill','10 reps'],['Scapular Activation','10 reps'],['Glute Bridge','20 reps']],
  c1name: 'Circuit 1 — Heavy Deadlift + Pendlay Row (barbell area)',
  c1: [
    ['Conventional Deadlift (near max)','4 × 5','175–195 lb','90–100 lb','Full posterior chain, core'],
    ['Pendlay Row (explosive)','4 × 6','95 lb','45 lb','Back, lats, rhomboids (power emphasis)'],
  ],
  c2name: 'Circuit 2 — Split Squat + Chest (bench/DB area)',
  c2: [
    ['Bulgarian Split Squat (heaviest yet)','4 × 6 each leg','45 lb DBs','25 lb DBs','Quads, glutes, hip flexors'],
    ['Dumbbell Decline Press','4 × 8','50 lb DBs','25 lb DBs','Lower chest, triceps, front delts'],
  ],
  core: [['Ab Wheel Full Rollout','4 × 8'],['Stir the Pot (slow)','4 × 10 each direction'],['Pallof Press Lunge','4 × 8 each side']],
  finisher: ['Jump Rope','5 × 1 min / 20 sec rest'],
  notes: '- Near-max deadlift: prioritize form. Record your load — compare to Week 1 and Week 8.\n- Pendlay row: explosive from the floor, builds raw back power.',
},

'12A': {
  title: 'Peak Full Body Complex + Core Showdown',
  focus: 'Quads · Lats · Posterior Chain · Shoulders · Core (peak)',
  warmup: [['Rowing Machine (hard)','3 min'],['Bodyweight Squat','15 reps'],['Hip Hinge Drill','10 reps'],['Arm Circles + Band Work','15 reps']],
  c1name: 'Circuit 1 — Squat + Pull Complex (rack/cable area)',
  c1: [
    ['Barbell Back Squat','4 × 6','bar + 45 + 10 lbs','60 lb goblet','Quads, glutes, core'],
    ['Pull-Up (or Lat Pulldown)','4 × 6','bodyweight','assisted (–25 lb)','Lats, biceps, rear delts'],
  ],
  c2name: 'Circuit 2 — Hinge + Press (barbell/bench area)',
  c2: [
    ['Trap Bar or DB Deadlift','4 × 6','165 lb','75 lb','Full posterior chain, core'],
    ['Standing DB Shoulder Press','4 × 8','40 lb DBs','18 lb DBs','Deltoids, triceps, core'],
  ],
  core: [['Hanging Leg Raise','3 × 12'],['Side Plank','3 × 30 sec each side'],['Cable Woodchop (Low to High)','3 × 12 each side'],['Hollow Body Hold','3 × 30 sec']],
  finisher: ['Stationary Bike','6 × 30 sec all-out / 30 sec rest'],
  notes: '- Final Week 12A. Record every weight — compare to Week 1 baseline.\n- Core: 4-exercise circuit, no rest between exercises, 30 sec rest between rounds.\n- After Phase 3: restart Phase 1 with new heavier baseline loads.',
},

'12B': {
  title: 'Peak Lower Dominant + Full Core Circuit',
  focus: 'Glutes · Hamstrings · Quads · Core (peak all planes)',
  warmup: [['Treadmill (incline 6, 3.8 mph)','3 min'],['Glute Bridge','20 reps'],['Hip Flexor Stretch','45 sec each side'],['Band Lateral Walk','20 each side']],
  c1name: 'Circuit 1 — Glute + Hinge Heavy (bench/barbell area)',
  c1: [
    ['Barbell Hip Thrust (peak load)','4 × 8','bar + 45 + 45 lbs','bar + 35s','Glutes, hamstrings, core'],
    ['Romanian Deadlift (peak load)','4 × 8','75 lb DBs','35 lb DBs','Hamstrings, glutes, lower back'],
  ],
  c2name: 'Circuit 2 — Single Leg + Row (DB/cable area)',
  c2: [
    ['Bulgarian Split Squat','4 × 6 each leg','45 lb DBs','25 lb DBs','Quads, glutes, hip flexors'],
    ['Half-Kneeling Single-Arm Cable Row','4 × 10 each side','65 lb','32 lb','Lats, rhomboids, core stability'],
  ],
  core: [['Ab Wheel Rollout','3 × 10'],['Copenhagen Plank','3 × 30 sec each side'],['Dragon Flag Negative','3 × 6'],['Cable Pallof Press','3 × 15 each side']],
  finisher: ['Rowing Machine','5 × 1 min hard / 20 sec rest'],
  notes: '- Peak session — maximum loads. Record everything.\n- Core: 4-exercise circuit, no rest between exercises, 30 sec rest between rounds.\n- Compare hip thrust and RDL weights to Week 1. Restart Phase 1 with loads up 10–15%.',
},

}; // end AB

// ─── C Workout Data ──────────────────────────────────────────────────────────

const C = {
'1C': { blocks:[
  {name:'Block 1 — Foam Roll + Mobility',exercises:[['Foam Roll — Quads & IT Band','60 sec each side'],['Foam Roll — Upper Back','60 sec'],['Half-Kneeling Hip Flexor Stretch','60 sec each side']]},
  {name:'Block 2 — Stretching',exercises:[['90/90 Hip Stretch','60 sec each side'],['Thoracic Rotation on Mat','10 each side'],["Child's Pose to Cobra",'10 reps']]},
  {name:'Block 3 — Light Core Activation',exercises:[['Seated Cable Row (very light, slow)','3 × 15'],['Band Face Pull','3 × 20'],['Dead Bug (slow, deliberate)','3 × 8 each side']]},
]},
'2C': { blocks:[
  {name:'Block 1 — Foam Roll + Mobility',exercises:[['Foam Roll — Full Body','8 min total'],['Pigeon Pose','90 sec each side'],['Standing Quad Stretch','60 sec each leg']]},
  {name:'Block 2 — Light Activation',exercises:[['Band Pull-Aparts','3 × 20'],['Half-Kneeling Cable Chop (very light)','2 × 10 each side'],['Wall Sit','3 × 30 sec']]},
  {name:'Block 3 — Flow',exercises:[['Cat-Cow into Thread the Needle','10 each side'],['Slow Glute Bridge (hold 3 sec)','10 reps'],["Child's Pose Hold",'90 sec']]},
]},
'3C': { blocks:[
  {name:'Block 1 — Foam Roll + Mobility',exercises:[['Foam Roll — Glutes & Hamstrings','60 sec each'],['Foam Roll — Lats','60 sec each side'],['Supine Figure-4 Stretch','90 sec each side']]},
  {name:'Block 2 — Blood Flow (very light)',exercises:[['Seated Cable Row (very light)','20 reps'],['Incline DB Press (very light)','15 reps'],['Breathing Dead Bug (slow)','3 × 5 each side']]},
  {name:'Block 3 — Final Flow',exercises:[['Box Breathing (4-4-4-4)','4 rounds'],['Slow Hip Circles','10 each side'],['Lying Thoracic Rotation','10 each side']]},
]},
'4C': { blocks:[
  {name:'Block 1 — Foam Roll + Mobility',exercises:[['Foam Roll — Full Body','10 min'],['Hip 90/90 Flow','5 min'],['Doorframe Chest Stretch','60 sec each angle']]},
  {name:'Block 2 — Stretching',exercises:[['Lat Stretch on Cable (light hold)','60 sec each side'],['Slow Glute Bridge with Hold','3 × 10'],['Slow Bird Dog','3 × 8 each side']]},
  {name:'Block 3 — Breathwork',exercises:[['Diaphragmatic Breathing','5 min'],['Child\'s Pose Hold','2 min'],['Supine Rest Scan','2 min']]},
]},
'5C': { blocks:[
  {name:'Block 1 — Foam Roll + Mobility',exercises:[['Foam Roll — Calves & Hamstrings','60 sec each'],['Foam Roll — Glutes & Upper Back','60 sec each'],['Couch Stretch','90 sec each side']]},
  {name:'Block 2 — Stretching',exercises:[['Lat Stretch (hanging or cable hold)','45 sec each side'],['Hip Flexor Kneeling Stretch','60 sec each side'],['Supine Hip External Rotation','60 sec each']]},
  {name:'Block 3 — Light Activation',exercises:[['Band Pull-Aparts','3 × 20'],['Light Cable Face Pull','3 × 20'],['Slow Dead Bug','3 × 6 each side']]},
]},
'6C': { blocks:[
  {name:'Block 1 — Foam Roll + Mobility',exercises:[['Foam Roll — Full Body','8 min'],['90/90 to Pigeon Flow','5 min'],['Half-Kneeling Thoracic Rotation','10 each side']]},
  {name:'Block 2 — Stretching',exercises:[['Supine Hip Stretch','90 sec each side'],['Thread the Needle','10 each side'],['Side-Lying Quad Stretch','60 sec each']]},
  {name:'Block 3 — Light Activation',exercises:[['Band Walks (forward/backward/lateral)','20 each direction'],['Slow Glute Bridge Breathing Drill','5 reps'],['Prone T-Spine Extension','10 reps']]},
]},
'7C': { blocks:[
  {name:'Block 1 — Foam Roll + Mobility',exercises:[['Foam Roll — Thoracic Spine','90 sec'],['Foam Roll — Lats & Glutes','90 sec each'],['Couch Stretch','2 min each side']]},
  {name:'Block 2 — Stretching',exercises:[['Doorframe Pec Stretch','60 sec at each angle'],['Hanging Lat Stretch','30 sec × 3'],['Supine Knee-to-Chest Stretch','60 sec each side']]},
  {name:'Block 3 — Light Activation',exercises:[['Light Cable Face Pull','3 × 20'],['Slow Bird Dog','3 × 8 each side'],['Box Breathing (4-4-4-4)','5 rounds']]},
]},
'8C': { blocks:[
  {name:'Block 1 — Foam Roll + Mobility',exercises:[['Foam Roll — Full Body','10 min'],['Pigeon Pose','2 min each side'],['Supine Hamstring Stretch','90 sec each leg']]},
  {name:'Block 2 — Blood Flow (very light)',exercises:[['Cable Pull-Through (very light, hip mobility focus)','3 × 15'],['Slow Bodyweight Squat with Pause','3 × 8'],['Prone Cobra Hold','3 × 20 sec']]},
  {name:'Block 3 — Breathwork',exercises:[['Diaphragmatic Breathing','5 min'],["Child's Pose to Down Dog Flow",'10 reps'],['Supine Hip External Rotation Hold','60 sec each']]},
]},
'9C': { blocks:[
  {name:'Block 1 — Foam Roll + Mobility',exercises:[['Foam Roll — Full Body','10 min'],['90/90 Hip Flow','5 min'],['Lat Hang on Pull-Up Bar','3 × 30 sec']]},
  {name:'Block 2 — Light Activation',exercises:[['Light KB Swing (blood flow only)','3 × 10'],['Slow Bird Dog','3 × 8 each side'],['Band Face Pull','3 × 20']]},
  {name:'Block 3 — Breathwork',exercises:[['Box Breathing (4-4-4-4)','5 rounds'],['Lying Thoracic Rotation','10 each side'],['Supine Rest Scan','3 min']]},
]},
'10C': { blocks:[
  {name:'Block 1 — Foam Roll + Mobility',exercises:[['Foam Roll — Full Body','8 min'],['Pigeon Pose','2 min each side'],['Thread the Needle','10 each side']]},
  {name:'Block 2 — Stretching',exercises:[['Hanging Decompression','3 × 30 sec'],['Supine Knee-to-Chest','60 sec each'],['Side-Lying Thoracic Rotation','10 each side']]},
  {name:'Block 3 — Light Activation',exercises:[['Light Cable Face Pull','3 × 20'],['Slow Dead Bug','3 × 6 each side'],['Slow Glute Bridge','10 reps']]},
]},
'11C': { blocks:[
  {name:'Block 1 — Foam Roll + Mobility',exercises:[['Foam Roll — Complete','10 min'],['90/90 Extended Hold','2 min each side'],['Lat Decompression Hang','3 × 30 sec']]},
  {name:'Block 2 — Stretching',exercises:[['Couch Stretch','2 min each side'],['Supine Piriformis Stretch','90 sec each'],['Thread the Needle','10 each side']]},
  {name:'Block 3 — Light Flow',exercises:[['Light KB Swing (blood flow)','3 × 10'],['Slow Cat-Cow to Downward Dog','10 rounds'],['Diaphragmatic Breathing','5 min']]},
]},
'12C': { blocks:[
  {name:'Block 1 — Foam Roll + Mobility',exercises:[['Foam Roll — Full Body (final)','12 min'],['Complete Hip Flow: 90/90 + Pigeon + Couch Stretch','2 min each'],['Lat Hang Decompression','3 × 45 sec']]},
  {name:'Block 2 — Full Body Stretch',exercises:[['Full Body Slow Stretch Sequence','10 min'],['Side-Lying Thoracic Rotation','10 each side'],['Supine Rest Scan','3 min']]},
  {name:'Block 3 — Reflection',exercises:[['Review Loads vs Week 1 Baseline','take notes'],['Set Phase 2 Restart Loads (add 10–15%)','plan ahead'],['Diaphragmatic Breathing','5 min']]},
  ], notes:'- Final recovery session of the 12-week program.\n- Note your Week 1 vs Week 12 loads — the difference is your progress.\n- Restart Phase 1 with loads increased 10–15% as your new baseline.'},
};

// ─── Session mapping: calendar week → program week / type ────────────────────

const SESSIONS = [
  // Phase 1
  { id:'2026-W24-A', date:'2026-06-09', week:1,  type:'A' },
  { id:'2026-W24-B', date:'2026-06-12', week:1,  type:'B' },
  { id:'2026-W24-C', date:'2026-06-14', week:1,  type:'C' },
  { id:'2026-W25-A', date:'2026-06-16', week:2,  type:'A' },
  { id:'2026-W25-B', date:'2026-06-19', week:2,  type:'B' },
  { id:'2026-W25-C', date:'2026-06-21', week:2,  type:'C' },
  { id:'2026-W26-A', date:'2026-06-23', week:3,  type:'A' },
  { id:'2026-W26-B', date:'2026-06-26', week:3,  type:'B' },
  { id:'2026-W26-C', date:'2026-06-28', week:3,  type:'C' },
  { id:'2026-W27-A', date:'2026-06-30', week:4,  type:'A' },
  { id:'2026-W27-B', date:'2026-07-03', week:4,  type:'B' },
  { id:'2026-W27-C', date:'2026-07-05', week:4,  type:'C' },
  // Phase 2
  { id:'2026-W28-A', date:'2026-07-07', week:5,  type:'A' },
  { id:'2026-W28-B', date:'2026-07-10', week:5,  type:'B' },
  { id:'2026-W28-C', date:'2026-07-12', week:5,  type:'C' },
  { id:'2026-W29-A', date:'2026-07-14', week:6,  type:'A' },
  { id:'2026-W29-B', date:'2026-07-17', week:6,  type:'B' },
  { id:'2026-W29-C', date:'2026-07-19', week:6,  type:'C' },
  { id:'2026-W30-A', date:'2026-07-21', week:7,  type:'A' },
  { id:'2026-W30-B', date:'2026-07-24', week:7,  type:'B' },
  { id:'2026-W30-C', date:'2026-07-26', week:7,  type:'C' },
  { id:'2026-W31-A', date:'2026-07-28', week:8,  type:'A' },
  { id:'2026-W31-B', date:'2026-07-31', week:8,  type:'B' },
  { id:'2026-W31-C', date:'2026-08-02', week:8,  type:'C' },
  // Phase 3
  { id:'2026-W32-A', date:'2026-08-04', week:9,  type:'A' },
  { id:'2026-W32-B', date:'2026-08-07', week:9,  type:'B' },
  { id:'2026-W32-C', date:'2026-08-09', week:9,  type:'C' },
  { id:'2026-W33-A', date:'2026-08-11', week:10, type:'A' },
  { id:'2026-W33-B', date:'2026-08-14', week:10, type:'B' },
  { id:'2026-W33-C', date:'2026-08-16', week:10, type:'C' },
  { id:'2026-W34-A', date:'2026-08-18', week:11, type:'A' },
  { id:'2026-W34-B', date:'2026-08-21', week:11, type:'B' },
  { id:'2026-W34-C', date:'2026-08-23', week:11, type:'C' },
  { id:'2026-W35-A', date:'2026-08-25', week:12, type:'A' },
  { id:'2026-W35-B', date:'2026-08-28', week:12, type:'B' },
  { id:'2026-W35-C', date:'2026-08-30', week:12, type:'C' },
];

// ─── Generate files ───────────────────────────────────────────────────────────

const phaseLabel = n => n <= 4 ? 1 : n <= 8 ? 2 : 3;
const phaseName  = n => ['','Foundation','Build','Peak'][phaseLabel(n)];

let generated = 0;

for (const s of SESSIONS) {
  const key = `${s.week}${s.type}`;
  let md, fileName, label;

  if (s.type === 'C') {
    const cData = C[key];
    if (!cData) { console.warn(`No data for ${key}`); continue; }
    md       = generateC(s.week, cData);
    fileName = `workout-${s.week}C.md`;
    label    = `Phase ${phaseLabel(s.week)} — Wk ${s.week}C: Active Recovery`;
  } else {
    const abData = AB[key];
    if (!abData) { console.warn(`No data for ${key}`); continue; }
    md       = generateAB(s.week, s.type, abData);
    fileName = `workout-${s.week}${s.type}.md`;
    const shortTitle = abData.title.split(' + ').slice(0,2).join(' + ');
    label    = `Phase ${phaseLabel(s.week)} — Wk ${s.week}${s.type}: ${shortTitle}`;
  }

  const filePath = path.join(BASE, 'workouts', fileName);
  fs.writeFileSync(filePath, md, 'utf8');
  s._file  = `workouts/${fileName}`;
  s._label = label;
  s._cycle = s.type;
  generated++;
}

console.log(`Generated ${generated} workout files.`);

// ─── Update workouts/index.json ───────────────────────────────────────────────

const existing = [
  { week:'2026-W14', date:'2026-04-06', cycle:'A', label:'Upper Push + Core',      program:'workouts/2026-W14-program.md' },
  { week:'2026-W17', date:'2026-04-20', cycle:'B', label:'Lower Body + Core',       program:'workouts/2026-W17-program.md' },
  { week:'2026-W19', date:'2026-05-04', cycle:'C', label:'Unilateral + Hinge + Press', program:'workouts/2026-W19-program.md' },
];

const newWeeks = SESSIONS.map(s => ({
  week:    s.id,
  date:    s.date,
  cycle:   s._cycle,
  label:   s._label,
  program: s._file,
}));

const indexJson = { weeks: [...existing, ...newWeeks] };
fs.writeFileSync(path.join(BASE, 'workouts', 'index.json'), JSON.stringify(indexJson, null, 2), 'utf8');
console.log(`Updated workouts/index.json: ${indexJson.weeks.length} total sessions.`);

// ─── Update data.json ─────────────────────────────────────────────────────────

const dataJson = {
  currentWeek: '2026-W24-A',
  currentProgram: 'workouts/workout-1A.md',
  currentSession: null,
  currentLog: null,
  exerciseReference: 'exercises/reference.md',
  historyLog: 'logs/history.md',
  programsIndex: 'workouts/index.json',
  programCycle: ['A', 'B', 'C'],
  currentCycleWeek: 'A',
  cycleLabels: {
    A: 'Workout A',
    B: 'Workout B',
    C: 'Active Recovery',
  },
  athletes: {
    clint: { name: 'Clint', height: "5'7\"", weight: 206 },
    wife:  { name: 'Wife',  height: "5'3\"", weight: 118 },
  },
  program: {
    name: '12-Week Couples Program',
    description: 'Full body balance · weight loss + lean muscle · 2–3x/week · NYC commercial gym',
    phases: [
      { name: 'Phase 1 — Foundation', weeks: '1–4' },
      { name: 'Phase 2 — Build',      weeks: '5–8' },
      { name: 'Phase 3 — Peak',       weeks: '9–12' },
    ],
  },
};
fs.writeFileSync(path.join(BASE, 'data.json'), JSON.stringify(dataJson, null, 2), 'utf8');
console.log('Updated data.json.');

console.log('\nDone. Next step: node db/migrate.js');
