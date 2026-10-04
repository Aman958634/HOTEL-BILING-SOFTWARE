const TOKEN_KEYS = ["accessToken", "refreshToken"];

const read = (storage, key) => { try { return storage?.getItem(key) || ""; } catch { return ""; } };
const remove = (storage, key) => { try { storage?.removeItem(key); } catch { /* Browser storage may be unavailable. */ } };
const write = (storage, key, value) => { try { if (value) storage?.setItem(key, value); else storage?.removeItem(key); } catch { /* Redux still holds the live session. */ } };
const sessionStorage = () => (typeof window === "undefined" ? null : window.sessionStorage);
const localStorage = () => (typeof window === "undefined" ? null : window.localStorage);

export const getAccessToken = () => read(sessionStorage(), "accessToken") || read(localStorage(), "accessToken");

export const persistAuthTokens = ({ accessToken, rememberMe = false } = {}) => {
  const target = rememberMe ? localStorage() : sessionStorage();
  const other = rememberMe ? sessionStorage() : localStorage();
  TOKEN_KEYS.forEach((key) => { remove(other, key); remove(target, key); });
  write(target, "accessToken", accessToken);
};

export const persistAccessToken = (accessToken) => write(read(sessionStorage(), "accessToken") ? sessionStorage() : localStorage(), "accessToken", accessToken);

export const clearStoredAuthTokens = () => TOKEN_KEYS.forEach((key) => { remove(sessionStorage(), key); remove(localStorage(), key); });