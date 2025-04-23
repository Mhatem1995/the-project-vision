
import React from "react";
import spinner from "/public/spinner.gif";

const LoadingSpinner = ({ text = "Loading..." }: { text?: string }) => (
  <div className="flex flex-col items-center justify-center min-h-[40vh] animate-fade-in">
    <img src={spinner} alt="Loading" className="w-24 h-24 mb-4" />
    <span className="text-lg text-muted-foreground">{text}</span>
  </div>
);

export default LoadingSpinner;
