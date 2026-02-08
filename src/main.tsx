  import React from "react";
  import { createRoot } from "react-dom/client";
  import App from "./App.tsx";
  import "./index.css";
  import { ChatProvider } from "./lib/chatStore.tsx";

  if (typeof window !== "undefined") {
    (window as any).React = React;
  }

  createRoot(document.getElementById("root")!).render(
    <ChatProvider>
      <App />
    </ChatProvider>
  );
  