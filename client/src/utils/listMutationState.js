const recordId = (record) => String(record?._id || record?.id || "");

export const getListRequestState = (hasLoaded) =>
  hasLoaded
    ? { initialLoading: false, isRefreshing: true }
    : { initialLoading: true, isRefreshing: false };

export const removeListRecord = (records, id) =>
  records.filter((record) => recordId(record) !== String(id));

export const replaceListRecord = (records, record) =>
  records.map((current) => (recordId(current) === recordId(record) ? record : current));

export const prependListRecord = (records, record) => [record, ...records];
