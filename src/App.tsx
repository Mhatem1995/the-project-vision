
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import AppLayout from "./components/layout/AppLayout";
import Mining from "./pages/Mining";
import Tasks from "./pages/Tasks";
import Referrals from "./pages/Referrals";
import Leaderboard from "./pages/Leaderboard";
import NotFound from "./pages/NotFound";
import TelegramInitializer from "./components/TelegramInitializer";
import TonConnectProvider from "./providers/TonConnectProvider";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <TonConnectProvider>
        <TelegramInitializer />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<AppLayout><Mining /></AppLayout>} />
            <Route path="/tasks" element={<AppLayout><Tasks /></AppLayout>} />
            <Route path="/leaderboard" element={<AppLayout><Leaderboard /></AppLayout>} />
            <Route path="/referrals" element={<AppLayout><Referrals /></AppLayout>} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TonConnectProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
