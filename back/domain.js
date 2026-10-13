const STATUS_TRANSITIONS = {
  CREATED: ['ASSIGNED', 'CANCELLED'],
  ASSIGNED: ['COLLECTOR_EN_ROUTE', 'CANCELLED'],
  COLLECTOR_EN_ROUTE: ['ARRIVED', 'CANCELLED'],
  ARRIVED: ['AWAITING_USER_CONFIRMATION', 'CANCELLED'],
  WEIGHED: ['AWAITING_USER_CONFIRMATION'],
  AWAITING_USER_CONFIRMATION: ['COMPLETED', 'DISPUTED'],
  DISPUTED: ['WEIGHED', 'CANCELLED'],
  CONFIRMED: ['COMPLETED'],
  COMPLETED: ['SENT_TO_RECYCLER'],
  SENT_TO_RECYCLER: ['RECEIVED_BY_RECYCLER'],
  RECEIVED_BY_RECYCLER: [],
  CANCELLED: []
};

const ROLE_PERMISSIONS = {
  user: ['request:create', 'request:read-own', 'weight:confirm', 'weight:dispute', 'coupon:read-own'],
  collector: ['request:read-available', 'request:read-assigned', 'trip:start', 'arrival:confirm', 'weight:record'],
  recycler: ['batch:read', 'batch:receive', 'weight:record-receiving'],
  merchant: ['coupon:lookup', 'coupon:redeem'],
  company: ['campaign:manage'],
  admin: ['*']
};

const canTransition = (from, to) => Boolean(STATUS_TRANSITIONS[from]?.includes(to));

const calculatePoints = ({ actualWeight, pointsPerKg, rounding = 'nearest' }) => {
  const weight = Number(actualWeight);
  const rate = Number(pointsPerKg);
  if (!Number.isFinite(weight) || weight <= 0) throw new Error('Actual weight must be positive');
  if (!Number.isFinite(rate) || rate < 0) throw new Error('Points rate must be non-negative');
  const raw = weight * rate;
  if (rounding === 'floor') return Math.floor(raw);
  if (rounding === 'ceil') return Math.ceil(raw);
  if (rounding === 'exact') return raw;
  return Math.round(raw);
};

const haversineDistanceMeters = (first, second) => {
  const toRadians = value => (Number(value) * Math.PI) / 180;
  const [firstLat, firstLng] = first.map(toRadians);
  const [secondLat, secondLng] = second.map(toRadians);
  const latitudeDelta = secondLat - firstLat;
  const longitudeDelta = secondLng - firstLng;
  const a = Math.sin(latitudeDelta / 2) ** 2
    + Math.cos(firstLat) * Math.cos(secondLat) * Math.sin(longitudeDelta / 2) ** 2;
  return 6371000 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

const verifyArrival = ({ collectorPosition, pickupPosition, toleranceMeters }) => {
  const distanceMeters = haversineDistanceMeters(collectorPosition, pickupPosition);
  return {
    distanceMeters,
    valid: distanceMeters <= Number(toleranceMeters)
  };
};

const reconcileWeights = ({ collectionWeight, receivingWeight, allowedVariancePercent = 0 }) => {
  const collected = Number(collectionWeight);
  const received = Number(receivingWeight);
  const difference = collected - received;
  const variancePercent = collected > 0 ? Math.abs(difference / collected) * 100 : null;
  return {
    difference,
    variancePercent,
    flagged: variancePercent !== null && variancePercent > Number(allowedVariancePercent)
  };
};

const hasPermission = (role, permission) => ROLE_PERMISSIONS[role]?.includes('*') || ROLE_PERMISSIONS[role]?.includes(permission) || false;

module.exports = {
  STATUS_TRANSITIONS,
  ROLE_PERMISSIONS,
  canTransition,
  calculatePoints,
  haversineDistanceMeters,
  verifyArrival,
  reconcileWeights,
  hasPermission
};
