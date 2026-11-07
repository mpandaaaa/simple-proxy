/**
 * The Perfect XI engine. Plain TypeScript: nothing in here may import React,
 * React Native or anything Expo. That is what lets it run headless in tests
 * and unchanged on the server for replay scoring.
 */
export { ENGINE_VERSION, ENGINE_SOURCE_BUILD } from './version';
export * from './rng';
export * from './types';
export * from './strength';
export * from './match/dixonColes';
export * from './season';
