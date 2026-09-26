const TRANSACTION_CAPABLE_TOPOLOGIES = new Set(["ReplicaSetWithPrimary", "Sharded"]);

export const isValidHotelUpiId = (value) => /^[A-Za-z0-9._-]+@[A-Za-z0-9.-]+$/.test(String(value || "").trim());

export const getHotelPaymentCapability = ({
  settings,
  environment,
  liveDigitalPayments,
  topologyType,
} = {}) => {
  const runtime = String(environment || "").trim().toLowerCase();
  const stagingOrTest = runtime === "staging" || runtime === "test";
  const deploymentAllowed = runtime === "production" && String(liveDigitalPayments || "").trim().toLowerCase() === "true";
  const transactionSupport = TRANSACTION_CAPABLE_TOPOLOGIES.has(String(topologyType || ""));
  const configured = Boolean(String(settings?.payeeName || "").trim() && isValidHotelUpiId(settings?.upiId));
  const canEnable = deploymentAllowed && transactionSupport && configured;

  let reason = "";
  if (stagingOrTest) reason = "Hotel UPI collection is disabled in staging and test environments.";
  else if (!deploymentAllowed) reason = "Production operator approval is required to enable LIVE_DIGITAL_PAYMENTS.";
  else if (!transactionSupport) reason = "Hotel UPI requires MongoDB replica-set transaction support.";
  else if (!configured) reason = "Configure Hotel UPI in Settings.";
  else if (!settings.isEnabled) reason = "Hotel UPI is disabled in Settings.";

  return {
    deploymentAllowed,
    transactionSupport,
    configured,
    canEnable,
    canCollect: canEnable && configured && settings?.isEnabled === true,
    reason,
  };
};