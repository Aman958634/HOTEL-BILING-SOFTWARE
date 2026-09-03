import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import { getMyProfile, loginUser, logoutUser, registerUser } from "../../services/authService";
import { clearOutletSession, persistAuthorizedOutlet } from "../../utils/outletSession";
import { clearLastKnown } from "../../utils/lastKnownData";
import { clearAllOrderDrafts } from "../../utils/orderDraft";

const clearStoredTokens = () => {
  localStorage.removeItem("accessToken");
  localStorage.removeItem("refreshToken");
  clearOutletSession();
  clearLastKnown();
  clearAllOrderDrafts();
};

const persistTokens = (accessToken, refreshToken) => {
  if (accessToken) {
    localStorage.setItem("accessToken", accessToken);
  }
  if (refreshToken) {
    localStorage.setItem("refreshToken", refreshToken);
  }
};

const initialState = {
  user: null,
  accessToken: localStorage.getItem("accessToken") || "",
  refreshToken: localStorage.getItem("refreshToken") || "",
  loading: false,
  profileLoading: false,
  profileError: "",
  outletStatus: "loading",
  authorizedOutlets: [],
  activeOutletId: "",
};

const needsOutletContext = (user) => Boolean(user?.restaurant) && !["customer", "super_admin"].includes(String(user?.role || "").toLowerCase());

const applyOutletSession = (state, payload) => {
  const user = payload?.user || payload || null;
  const outlets = Array.isArray(payload?.authorizedOutlets) ? payload.authorizedOutlets : [];
  state.authorizedOutlets = outlets;

  if (!needsOutletContext(user)) {
    clearOutletSession();
    state.activeOutletId = "";
    state.outletStatus = "ready";
    return;
  }

  const activeOutletId = persistAuthorizedOutlet(outlets, user?.defaultOutlet);
  state.activeOutletId = activeOutletId;
  state.outletStatus = activeOutletId ? "ready" : "no-access";
};

export const registerThunk = createAsyncThunk("auth/register", async (payload, { rejectWithValue }) => {
  try {
    const { data } = await registerUser(payload);
    return data.data;
  } catch (error) {
    return rejectWithValue(error?.response?.data?.message || "Registration failed");
  }
});

export const loginThunk = createAsyncThunk("auth/login", async (payload, { rejectWithValue }) => {
  try {
    const { data } = await loginUser(payload);
    return data.data;
  } catch (error) {
    return rejectWithValue(error?.response?.data?.message || "Login failed");
  }
});

export const profileThunk = createAsyncThunk("auth/profile", async (_, { rejectWithValue }) => {
  try {
    const { data } = await getMyProfile();
    return data.data;
  } catch (error) {
    return rejectWithValue({
      message: error?.response?.data?.message || "Profile fetch failed",
      status: error?.response?.status || 0,
    });
  }
});

export const logoutThunk = createAsyncThunk("auth/logoutSession", async () => {
  try {
    await logoutUser();
  } catch {
    // Always clear local session even if revoke request fails.
  }
});

const authSlice = createSlice({
  name: "auth",
  initialState,
  reducers: {
    logout: (state) => {
      state.user = null;
      state.accessToken = "";
      state.refreshToken = "";
      clearStoredTokens();
      state.authorizedOutlets = [];
      state.activeOutletId = "";
      state.outletStatus = "loading";
    },
    setAccessToken: (state, action) => {
      state.accessToken = action.payload || "";
      if (action.payload) {
        localStorage.setItem("accessToken", action.payload);
      }
    },
    setAuthSession: (state, action) => {
      state.user = action.payload?.user || null;
      state.accessToken = action.payload?.accessToken || "";
      state.refreshToken = action.payload?.refreshToken || state.refreshToken;
      state.profileError = "";
      persistTokens(action.payload?.accessToken, action.payload?.refreshToken);
      applyOutletSession(state, action.payload);
    },
    outletRecoveryStarted: (state) => {
      state.outletStatus = "loading";
    },
    resolveAuthorizedOutlets: (state, action) => {
      applyOutletSession(state, { user: state.user, authorizedOutlets: action.payload });
    },
    selectAuthorizedOutlet: (state, action) => {
      const selected = state.authorizedOutlets.find((outlet) => String(outlet?._id) === String(action.payload));
      if (!selected) return;
      state.activeOutletId = persistAuthorizedOutlet([selected], selected._id);
      state.outletStatus = "ready";
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(loginThunk.pending, (state) => {
        state.loading = true;
      })
      .addCase(loginThunk.fulfilled, (state, action) => {
        state.loading = false;
        state.user = action.payload.user;
        state.accessToken = action.payload.accessToken;
        state.refreshToken = action.payload.refreshToken || "";
        state.profileError = "";
        persistTokens(action.payload.accessToken, action.payload.refreshToken);
        applyOutletSession(state, action.payload);
      })
      .addCase(loginThunk.rejected, (state) => {
        state.loading = false;
      })
      .addCase(profileThunk.pending, (state) => {
        state.profileLoading = true;
        state.profileError = "";
      })
      .addCase(profileThunk.fulfilled, (state, action) => {
        state.profileLoading = false;
        state.user = action.payload?.user || action.payload;
        applyOutletSession(state, action.payload);
      })
      .addCase(profileThunk.rejected, (state, action) => {
        state.profileLoading = false;
        state.profileError = action.payload?.message || "Profile fetch failed";
        // The API interceptor owns session expiry. Keep a valid local session for
        // transient/network failures so the protected route can offer one retry.
        if ([401, 403].includes(Number(action.payload?.status))) {
          state.user = null;
          state.accessToken = "";
          state.refreshToken = "";
          clearStoredTokens();
          state.authorizedOutlets = [];
          state.activeOutletId = "";
          state.outletStatus = "loading";
        }
      })
      .addCase(logoutThunk.fulfilled, (state) => {
        state.user = null;
        state.accessToken = "";
        state.refreshToken = "";
        clearStoredTokens();
        state.authorizedOutlets = [];
        state.activeOutletId = "";
        state.outletStatus = "loading";
      });
  },
});

export const { logout, setAccessToken, setAuthSession, outletRecoveryStarted, resolveAuthorizedOutlets, selectAuthorizedOutlet } = authSlice.actions;
export default authSlice.reducer;
