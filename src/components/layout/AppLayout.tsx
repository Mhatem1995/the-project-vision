
import React from "react";
import BottomNav from "./BottomNav";
import { ScrollArea } from "@/components/ui/scroll-area";

interface AppLayoutProps {
  children: React.ReactNode;
}

const AppLayout = ({ children }: AppLayoutProps) => {
  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <ScrollArea className="flex-1">
        <main className="min-h-screen">
          {children}
        </main>
      </ScrollArea>
      <BottomNav />
    </div>
  );
};

export default AppLayout;
