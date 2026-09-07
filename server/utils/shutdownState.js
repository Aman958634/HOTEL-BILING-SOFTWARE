let shuttingDown = false;
let startupComplete = false;

export const markStartupComplete = () => { startupComplete = true; };
export const markShuttingDown = () => { shuttingDown = true; };
export const isShuttingDown = () => shuttingDown;
export const isReadyState = (dbConnected) => startupComplete && !shuttingDown && dbConnected;
export const resetForTests = () => { startupComplete = false; shuttingDown = false; };
