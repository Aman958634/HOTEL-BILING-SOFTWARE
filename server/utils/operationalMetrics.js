const counters = new Map();
let activeSockets = 0;
let socketConnectionsTotal = 0;
let socketAuthFailures = 0;

const increment = (name, value = 1) => counters.set(name, (counters.get(name) || 0) + value);

export const recordMetric = (name, value = 1) => increment(name, value);
export const socketConnected = () => { activeSockets += 1; socketConnectionsTotal += 1; increment("socketConnections"); };
export const socketDisconnected = () => { activeSockets = Math.max(0, activeSockets - 1); };
export const socketAuthFailed = () => { socketAuthFailures += 1; increment("socketAuthFailures"); };
export const getOperationalMetrics = ({ dbConnected, shuttingDown }) => ({
  counters: Object.fromEntries(counters.entries()),
  activeSockets,
  socketConnectionsTotal,
  socketAuthFailures,
  dbConnected: Boolean(dbConnected),
  shuttingDown: Boolean(shuttingDown),
  processUptimeSeconds: Math.round(process.uptime()),
});
