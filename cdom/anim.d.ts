/**
 * @return {Promise<number>} - resolves to the current high-res time at the
 * start of the next browser animation frame
 */
export function nextFrame(): Promise<number>;
/**
 * @callback Part - an animation part: a function of elapsed time
 * @param {number} dt - the amount of time elapsed since the last time this callback was called
 * @return {boolean} - true if the animation loop should continue, false to stop it
 */
/**
 * Runs an animate-able function until it stops (returns false).
 * @param {Part} update - an animation function
 */
export function everyFrame(update: Part): Promise<void>;
/**
 * @typedef {Object} TickedPart - an animation part that runs on an internal unit of time ticks
 * @prop {number|(()=>number)} every - specified time tick unit; may be a function to implement a dynamic rate
 * @prop {Part} then - part callback, will be passed an integer number of elapsed ticks
 */
/**
 * @typedef {Part|TickedPart} SchedulePart
 * @param {SchedulePart[]} parts - one or more animation parts, optionally with their own internal tick rate
 * @return {Part} - a compound part that will run all of the given parts
 */
export function schedule(...parts: SchedulePart[]): Part;
/**
 * - an animation part: a function of elapsed time
 */
export type Part = (dt: number) => boolean;
/**
 * - an animation part that runs on an internal unit of time ticks
 */
export type TickedPart = {
    /**
     * - specified time tick unit; may be a function to implement a dynamic rate
     */
    every: number | (() => number);
    /**
     * - part callback, will be passed an integer number of elapsed ticks
     */
    then: Part;
};
export type SchedulePart = Part | TickedPart;
