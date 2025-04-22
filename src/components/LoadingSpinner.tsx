
import React from "react";

// You’ll need to upload and provide the actual spinner image path from your project assets.
import spinner from "/spinner.gif";

const LoadingSpinner = ({ text = "Loading..." }: { text?: string }) => (
  <div className="flex flex-col items-center justify-center min-h-[40vh] animate-fade-in">
    <img src={spinner} alt="Loading" className="w-24 h-24 mb-4 animate-spin" />
    <span className="text-lg text-muted-foreground">{text}</span>
  </div>
);

export default LoadingSpinner;
