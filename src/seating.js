// Seat centers refer to the cushion, not the character's feet or the backrest.
// Both furniture rendering and seated actors resolve these same definitions.
export const FIXED_SEATS = {
  pharmacist: { x:456, y:520 },
  doctor1: { x: 173, y: 222 },
  doctor2: { x: 432, y: 222 },
  reception: { x: 185, y: 798 },
  consultation1: { x: 255, y: 243 },
  consultation2: { x: 515, y: 243 },
  nursing: { x: 201, y: 556 }, sampling:{x:815,y:556}, urgent:{x:287,y:721}
};
export const waitingSeat = i => ({ x: [340,405,490,555][i%4], y: 712+Math.floor(i/4)*52 });
export const seatFloor = seat => [seat.x, seat.y+19];
export function actorSeat(actor, rising = false) {
  if (FIXED_SEATS[actor.id]) return FIXED_SEATS[actor.id];
  const phase = rising ? actor.previousPhase : actor.phase;
  if (phase === 'waiting' && Number.isInteger(actor.seat)) return waitingSeat(actor.seat);
  if (phase === 'consultation') return FIXED_SEATS['consultation'+actor.room] || null;
  if (phase === 'nursing') return FIXED_SEATS.nursing;
  if (phase === 'sampling') return FIXED_SEATS.sampling;
  if (phase === 'urgent') return {x:287-(actor.urgentSlot||0)*60,y:721};
  return null;
}
export function seatedFeet(seat, height) {
  // The atlas pelvis contact is 74% down the seated sprite; the chair cushion
  // is one world unit below its drawing anchor. Keep them in contact at every height.
  return [seat.x, seat.y+1+height*.26];
}
