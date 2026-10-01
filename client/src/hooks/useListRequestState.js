import { useCallback, useRef, useState } from "react";
import { getListRequestState } from "../utils/listMutationState";

const useListRequestState = () => {
  const loadedRef = useRef(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const beginListRequest = useCallback(() => {
    const next = getListRequestState(loadedRef.current);
    setInitialLoading(next.initialLoading);
    setIsRefreshing(next.isRefreshing);
  }, []);

  const finishListRequest = useCallback((succeeded) => {
    if (succeeded) loadedRef.current = true;
    setInitialLoading(false);
    setIsRefreshing(false);
  }, []);

  return { initialLoading, isRefreshing, beginListRequest, finishListRequest };
};

export default useListRequestState;
