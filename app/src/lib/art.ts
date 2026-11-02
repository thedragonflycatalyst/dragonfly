// Default cover photos and the app background (bundled; made for Dragonfly).
import { type ArtKey, type CoverKey, type GroupKey } from './art-match';

export const WORKOUT_IMAGES: Record<ArtKey, number> = {
  legs: require('../../assets/art/workout/legs.jpg'), glutes: require('../../assets/art/workout/glutes.jpg'),
  chest: require('../../assets/art/workout/chest.jpg'), back: require('../../assets/art/workout/back.jpg'),
  shoulders: require('../../assets/art/workout/shoulders.jpg'), arms: require('../../assets/art/workout/arms.jpg'),
  core: require('../../assets/art/workout/core.jpg'), fullbody: require('../../assets/art/workout/fullbody.jpg'),
  hiit: require('../../assets/art/workout/hiit.jpg'), running: require('../../assets/art/workout/running.jpg'),
  cycling: require('../../assets/art/workout/cycling.jpg'), yoga: require('../../assets/art/workout/yoga.jpg'),
  kettlebell: require('../../assets/art/workout/kettlebell.jpg'), suspension: require('../../assets/art/workout/suspension.jpg'),
  boxing: require('../../assets/art/workout/boxing.jpg'), swimming: require('../../assets/art/workout/swimming.jpg'),
};
export const ART_LABEL: Record<ArtKey, string> = {
  legs: 'Legs', glutes: 'Glutes', chest: 'Chest / push', back: 'Back / pull', shoulders: 'Shoulders', arms: 'Arms', core: 'Core',
  fullbody: 'Full body', hiit: 'HIIT', running: 'Running', cycling: 'Cycling', yoga: 'Yoga / mobility', kettlebell: 'Kettlebell',
  suspension: 'Suspension', boxing: 'Boxing', swimming: 'Swimming',
};
export const GROUP_IMAGES: Record<GroupKey, number> = {
  crew: require('../../assets/art/group/crew.jpg'), runclub: require('../../assets/art/group/runclub.jpg'),
  finish: require('../../assets/art/group/finish.jpg'), trophy: require('../../assets/art/group/trophy.jpg'),
  bootcamp: require('../../assets/art/group/bootcamp.jpg'), circle: require('../../assets/art/group/circle.jpg'),
  hike: require('../../assets/art/group/hike.jpg'), team: require('../../assets/art/group/team.jpg'),
  dragonfly: require('../../assets/art/group/dragonfly.jpg'),
};
export const GROUP_LABEL: Record<GroupKey, string> = {
  crew: 'Crew', runclub: 'Run club', finish: 'Finish line', trophy: 'Challenge', bootcamp: 'Bootcamp', circle: 'Yoga circle',
  hike: 'Hike', team: 'Team', dragonfly: 'Dragonfly',
};
export const COVER_IMAGES: Record<CoverKey, number> = { ...WORKOUT_IMAGES, ...GROUP_IMAGES };
export const COVER_LABEL: Record<CoverKey, string> = { ...ART_LABEL, ...GROUP_LABEL };
export const BACKGROUND = require('../../assets/art/background.jpg') as number;
export { artCover, GROUP_ART, WORKOUT_ART } from './art-match';

