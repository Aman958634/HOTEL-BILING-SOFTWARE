import api from "./api";
import axios from "axios";
import { API_URL } from "../utils/constants";

/** Authenticated tenant billing APIs */
export const publicSubscribeSignup = (payload) => api.post("/public/subscribe/signup", payload);

/** Public catalog — no Authorization header */
export const fetchPublicPlans = () => axios.get(`${API_URL}/public/plans`);

export const parsePublicPlansResponse = (data) => {
  const payload = data?.data;
  if (Array.isArray(payload)) {
    return { plans: payload, trialDays: 15 };
  }
  if (payload && Array.isArray(payload.plans)) {
    return { plans: payload.plans, trialDays: Number(payload.trialDays) || 15 };
  }
  return { plans: [], trialDays: 15 };
};
