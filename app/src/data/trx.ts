// Suspension-trainer (TRX-style) exercises written for Dragonfly. No images; trainers attach their own demo videos.
// Same compact row shape as library.json: [id, name, category, equipment, primary[], secondary[], level, mechanic, instructions[], imageCount]
export type Row = [string, string, string, string, string[], string[], string, string, string[], number];

const r = (id: string, name: string, primary: string[], secondary: string[], level: string, steps: string[]): Row =>
  [`trx_${id}`, name, 'strength', 'suspension trainer', primary, secondary, level, 'compound', steps, 0];

export const TRX: Row[] = [
  r('row', 'Suspension Row', ['middle back'], ['biceps', 'lats'], 'beginner', [
    'Face the anchor holding the handles, arms straight, body leaning back in a straight line.',
    'Pull your chest to the handles, squeezing your shoulder blades together and keeping elbows close.',
    'Lower with control until your arms are straight. Walk your feet closer to the anchor to make it harder.']),
  r('wide_row', 'Suspension Wide Row (Y-Fly back)', ['middle back'], ['shoulders', 'traps'], 'intermediate', [
    'Face the anchor with palms down and arms straight in front of you.',
    'Pull with elbows out wide at shoulder height until your hands are beside your chest.',
    'Return slowly to the start.']),
  r('y_fly', 'Suspension Y-Fly', ['shoulders'], ['traps', 'middle back'], 'intermediate', [
    'Face the anchor, arms straight, palms facing down.',
    'Keeping your arms straight, raise them up and out into a Y shape as your body rises.',
    'Lower slowly back to the start without bending your elbows.']),
  r('t_fly', 'Suspension T-Fly (Reverse Fly)', ['shoulders'], ['middle back'], 'intermediate', [
    'Face the anchor, arms straight in front at chest height, palms facing each other.',
    'Open your arms out to the sides into a T, pulling your body up.',
    'Return with control.']),
  r('chest_press', 'Suspension Chest Press', ['chest'], ['triceps', 'shoulders'], 'beginner', [
    'Face away from the anchor holding the handles at chest height, arms straight, body leaning forward.',
    'Bend your elbows to lower your chest between the handles, keeping your body in a plank.',
    'Press back up to straight arms. Step your feet back to make it harder.']),
  r('chest_fly', 'Suspension Chest Fly', ['chest'], ['shoulders'], 'intermediate', [
    'Face away from the anchor, arms straight in front of you, slight bend in the elbows.',
    'Open your arms out wide as your chest lowers, keeping the elbow angle fixed.',
    'Squeeze your arms back together to rise.']),
  r('triceps_press', 'Suspension Triceps Press', ['triceps'], ['chest'], 'intermediate', [
    'Face away from the anchor, arms straight overhead-forward, palms down.',
    'Bend only at the elbows so your head moves toward your hands.',
    'Straighten your arms to press back up.']),
  r('biceps_curl', 'Suspension Biceps Curl', ['biceps'], ['forearms'], 'beginner', [
    'Face the anchor, palms up, arms straight, body leaning back.',
    'Curl your hands toward your forehead, keeping your elbows high and still.',
    'Lower slowly to straight arms.']),
  r('squat', 'Suspension Squat', ['quadriceps'], ['glutes', 'hamstrings'], 'beginner', [
    'Face the anchor holding the handles at chest height with light tension.',
    'Sit your hips back and down into a squat, using the straps only for balance.',
    'Drive through your heels to stand.']),
  r('squat_jump', 'Suspension Squat Jump', ['quadriceps'], ['glutes', 'calves'], 'intermediate', [
    'Hold the handles facing the anchor and squat down.',
    'Jump straight up, using the straps lightly for balance.',
    'Land softly and go straight into the next squat.']),
  r('lunge', 'Suspension Lunge', ['quadriceps'], ['glutes'], 'beginner', [
    'Face the anchor holding the handles.',
    'Step one foot back into a lunge, lowering your back knee toward the floor.',
    'Push through your front heel to return. Alternate legs or finish one side first.']),
  r('suspended_lunge', 'Suspended Lunge (Foot in Cradle)', ['quadriceps'], ['glutes', 'hamstrings'], 'intermediate', [
    'Face away from the anchor with one foot in both foot cradles behind you.',
    'Bend your standing leg as the suspended leg slides back.',
    'Drive up through your standing heel. Finish all reps before switching legs.']),
  r('pistol', 'Suspension Single-Leg Squat', ['quadriceps'], ['glutes'], 'expert', [
    'Face the anchor holding the handles, standing on one leg with the other extended forward.',
    'Squat down on the standing leg as far as you can control.',
    'Pull lightly on the straps to help you rise if needed.']),
  r('hamstring_curl', 'Suspension Hamstring Curl', ['hamstrings'], ['glutes', 'calves'], 'intermediate', [
    'Lie on your back with heels in the foot cradles under the anchor.',
    'Lift your hips into a bridge and pull your heels toward your glutes.',
    'Extend your legs slowly while keeping your hips up.']),
  r('hip_press', 'Suspension Hip Press (Bridge)', ['glutes'], ['hamstrings'], 'beginner', [
    'Lie on your back with heels in the foot cradles, legs straight.',
    'Press your heels down to lift your hips into a straight line.',
    'Lower slowly.']),
  r('plank', 'Suspension Plank', ['abdominals'], ['shoulders'], 'intermediate', [
    'Place both feet in the foot cradles and come onto your forearms or hands.',
    'Hold your body in a straight line with your core braced.',
    'Hold for the set time.']),
  r('side_plank', 'Suspension Side Plank', ['abdominals'], ['abductors'], 'intermediate', [
    'Feet in the foot cradles, stacked or staggered, on one forearm.',
    'Lift your hips into a straight line from head to feet.',
    'Hold, then switch sides.']),
  r('pike', 'Suspension Pike', ['abdominals'], ['shoulders'], 'expert', [
    'Start in a push-up position with feet in the foot cradles.',
    'Keep your legs straight and lift your hips toward the ceiling.',
    'Lower back to a plank with control.']),
  r('knee_tuck', 'Suspension Knee Tuck', ['abdominals'], ['shoulders'], 'intermediate', [
    'Start in a push-up position with feet in the foot cradles.',
    'Pull your knees toward your chest.',
    'Extend back to a plank.']),
  r('mountain_climber', 'Suspension Mountain Climber', ['abdominals'], ['shoulders', 'quadriceps'], 'intermediate', [
    'Start in a push-up position with feet in the foot cradles.',
    'Drive one knee toward your chest, then switch legs quickly.',
    'Keep your hips level and core tight.']),
  r('atomic_pushup', 'Suspension Atomic Push-Up', ['chest'], ['abdominals', 'triceps'], 'expert', [
    'Feet in the foot cradles in a push-up position.',
    'Do a push-up, then tuck your knees to your chest.',
    'Return to plank and repeat.']),
  r('fallout', 'Suspension Fallout', ['abdominals'], ['shoulders', 'lats'], 'intermediate', [
    'Face away from the anchor, arms straight in front, body leaning forward in a plank.',
    'Raise your arms overhead as your body lowers, keeping your core braced.',
    'Pull your arms back down to return.']),
  r('rollout', 'Suspension Body Saw', ['abdominals'], ['shoulders'], 'intermediate', [
    'Forearm plank with feet in the foot cradles.',
    'Rock your body forward and back from the shoulders, keeping a straight line.',
    'Move slowly and stay braced.']),
  r('oblique_crunch', 'Suspension Oblique Crunch', ['abdominals'], ['shoulders'], 'expert', [
    'Push-up position with feet in the foot cradles.',
    'Drive both knees toward one elbow, rotating your hips.',
    'Return and alternate sides.']),
  r('power_pull', 'Suspension Power Pull', ['middle back'], ['abdominals', 'biceps'], 'intermediate', [
    'Face the anchor holding one handle, free arm reaching toward the anchor, body leaning back.',
    'Rotate open as you pull, reaching the free arm back behind you.',
    'Return with control. Finish one side, then switch.']),
  r('clock_press', 'Suspension Clock Press', ['chest'], ['shoulders', 'triceps'], 'expert', [
    'Chest press position, facing away from the anchor.',
    'As you lower, open one arm out to the side like a clock hand.',
    'Press back up and alternate sides.']),
  r('hip_hinge', 'Suspension Hip Hinge', ['hamstrings'], ['glutes', 'lower back'], 'beginner', [
    'Face the anchor holding the handles with straight arms.',
    'Hinge at the hips, sending them back with a flat back while your arms rise overhead.',
    'Drive your hips forward to stand tall.']),
  r('sprinter_start', 'Suspension Sprinter Start', ['quadriceps'], ['glutes', 'calves'], 'intermediate', [
    'Face away from the anchor with straps under your arms or handles at your shoulders, leaning forward.',
    'Step one leg back, then drive that knee up explosively.',
    'Finish all reps on one side, then switch.']),
];
