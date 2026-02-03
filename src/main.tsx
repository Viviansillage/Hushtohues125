
  import { createRoot } from "react-dom/client";
  import App from "./App.tsx";
  import "./index.css";
  import "mind-elixir/dist/style.css";
  import { ChatProvider } from "./lib/chatStore.tsx";

  createRoot(document.getElementById("root")!).render(
    <ChatProvider>
      <App />
    </ChatProvider>
  );
  