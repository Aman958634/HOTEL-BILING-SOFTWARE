import React from "react";
import ReactDOM from "react-dom/client";
import { Provider } from "react-redux";
import { BrowserRouter } from "react-router-dom";
import { Toaster } from "react-hot-toast";
import App from "./App";
import { store } from "./redux/store";
import { setupAuthInterceptor } from "./services/api";
import ErrorBoundary from "./components/common/ErrorBoundary";
import { SocketProvider } from "./context/SocketContext";
import "./index.css";

setupAuthInterceptor(store);

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <Provider store={store}>
      <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <SocketProvider>
          <Toaster
            position="top-right"
            toastOptions={{
              duration: 4000,
              ariaProps: { role: "status", "aria-live": "polite" },
              style: { maxWidth: "calc(100vw - 2rem)", fontSize: "0.875rem" },
            }}
          />
          <ErrorBoundary>
            <App />
          </ErrorBoundary>
        </SocketProvider>
      </BrowserRouter>
    </Provider>
  </React.StrictMode>
);
