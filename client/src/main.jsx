import React from "react";
import ReactDOM from "react-dom/client";
import { Provider } from "react-redux";
import { BrowserRouter } from "react-router-dom";
import { Toaster } from "react-hot-toast";
import App from "./App";
import { store } from "./redux/store";
import { setupAuthInterceptor } from "./services/api";
import { SocketProvider } from "./context/SocketContext";
import "./index.css";

setupAuthInterceptor(store);

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <Provider store={store}>
      <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <SocketProvider>
          <Toaster position="top-right" />
          <App />
        </SocketProvider>
      </BrowserRouter>
    </Provider>
  </React.StrictMode>
);
