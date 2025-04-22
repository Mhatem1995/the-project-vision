
import React from "react";
import BottomNav from "./BottomNav";

interface AppLayoutProps {
  children: React.ReactNode;
}

const AppLayout = ({ children }: AppLayoutProps) => {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="container mx-auto px-4 pb-16">
        <main className="pt-4">{children}</main>
      </div>
      <BottomNav />
    </div>
  );
};

export default AppLayout;
