/// <reference types="vite/client" />

export {};

declare global {
  const __BCM_BUNDLED_GPX__: string;

  interface Window {
    BcmGarmin?: {
      createGarminWorkout: (
        plan: import('./lib/model').Plan,
        options?: import('./lib/garminWorkout').GarminWorkoutOptions,
      ) => import('./lib/garminWorkout').GarminWorkoutFile;
      GarminWorkoutError: new (code: import('./lib/garminWorkout').GarminWorkoutErrorCode) => Error & {
        code: import('./lib/garminWorkout').GarminWorkoutErrorCode;
      };
    };
  }
}
