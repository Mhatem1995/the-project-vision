
import React from "react";

const LoadingSpinner = ({ text = "Loading..." }: { text?: string }) => (
  <div className="flex flex-col items-center justify-center min-h-[40vh] animate-fade-in">
    <div className="w-16 h-16 mb-4 border-4 border-t-primary border-r-transparent border-b-transparent border-l-transparent rounded-full animate-spin"></div>
    <span className="text-lg text-muted-foreground">{text}</span>
  </div>
);

export default LoadingSpinner;
