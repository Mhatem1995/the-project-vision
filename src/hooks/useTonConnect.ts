
import { useContext } from "react";
import { TonConnectContext } from "@/contexts/TonConnectContext";

export const useTonConnect = () => useContext(TonConnectContext);
