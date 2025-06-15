
import { useQuery } from "@tanstack/react-query";
import { User } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const Leaderboard = () => {
  const { data: users, isLoading, error } = useQuery({
    queryKey: ["leaderboard"],
    queryFn: async () => {
      console.log("[LEADERBOARD-DEBUG] Fetching users data...");
      
      // Fetch users with balance > 0 to show only active users
      const { data: userData, error: userError } = await supabase
        .from("users")
        .select("id, username, firstname, balance, links")
        .gt("balance", 0)
        .order("balance", { ascending: false })
        .limit(50);

      if (userError) {
        console.error("[LEADERBOARD-DEBUG] Error fetching users:", userError);
        throw userError;
      }

      console.log("[LEADERBOARD-DEBUG] Raw users data:", userData);

      // Get wallets table for wallet connections
      const { data: walletsData, error: walletsError } = await supabase
        .from("wallets")
        .select("telegram_id, wallet_address");

      if (walletsError) {
        console.error("[LEADERBOARD-DEBUG] Error fetching wallets:", walletsError);
      }

      console.log("[LEADERBOARD-DEBUG] Wallets data:", walletsData);

      let walletMap = new Map();
      if (walletsData) {
        walletsData.forEach((item: any) => {
          if (item && item.telegram_id && item.wallet_address) {
            walletMap.set(item.telegram_id, item.wallet_address);
          }
        });
      }
      
      // Also check links field for wallet addresses
      userData?.forEach((user: any) => {
        if (user.id && user.links && !walletMap.has(user.id)) {
          walletMap.set(user.id, user.links);
        }
      });

      console.log("[LEADERBOARD-DEBUG] Wallet map:", Object.fromEntries(walletMap));

      // Enhance users with wallet connection status
      const enhancedUsers = userData && Array.isArray(userData) ? userData.map(user => {
        const hasWallet = walletMap.has(user.id) && walletMap.get(user.id);
        return {
          ...user,
          walletConnected: !!hasWallet,
          walletAddress: hasWallet || null
        };
      }) : [];
      
      console.log("[LEADERBOARD-DEBUG] Enhanced users:", enhancedUsers);
      return enhancedUsers;
    },
    refetchInterval: 30000,
  });

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        <p className="mt-2 text-sm text-muted-foreground">Loading leaderboard...</p>
      </div>
    );
  }

  if (error) {
    console.error("[LEADERBOARD-DEBUG] Error loading leaderboard data:", error);
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh]">
        <div className="text-destructive">Error loading leaderboard data</div>
        <p className="text-sm text-muted-foreground mt-2">Please try refreshing the page</p>
      </div>
    );
  }

  const hasUsers = users && users.length > 0;
  console.log("[LEADERBOARD-DEBUG] Rendering leaderboard with", hasUsers ? users.length : 0, "users");

  return (
    <div className="flex flex-col space-y-6">
      <div className="text-center">
        <h1 className="text-3xl font-bold mb-2">Leaderboard</h1>
        <p className="text-muted-foreground">Top KFC holders</p>
      </div>

      {/* Debug info */}
      <div className="bg-blue-50 border border-blue-200 p-3 rounded-md text-sm">
        <p><strong>Total users found:</strong> {users?.length || 0}</p>
        <p><strong>Current user:</strong> {localStorage.getItem("telegramUserId") || "Not connected"}</p>
      </div>

      {!hasUsers ? (
        <div className="text-center p-8 rounded-lg border border-dashed">
          <User className="h-10 w-10 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-medium">No active miners yet</h3>
          <p className="text-muted-foreground">Be the first to connect your wallet and earn KFC!</p>
        </div>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12 text-center">Rank</TableHead>
                <TableHead>User</TableHead>
                <TableHead className="text-right">KFC Balance</TableHead>
                <TableHead className="text-center w-20">Wallet</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((user, index) => (
                <TableRow key={user.id || index}>
                  <TableCell className="text-center font-medium">
                    {index + 1}
                  </TableCell>
                  <TableCell>
                    <div>
                      <div className="font-medium">
                        {user.username || user.firstname || "Anonymous"}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {user.id}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {user.balance ? Number(user.balance).toLocaleString() : "0"} KFC
                  </TableCell>
                  <TableCell className="text-center">
                    {user.walletConnected ? (
                      <span className="inline-flex h-2 w-2 bg-green-500 rounded-full" title="Wallet connected"></span>
                    ) : (
                      <span className="inline-flex h-2 w-2 bg-gray-300 rounded-full" title="No wallet connected"></span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
};

export default Leaderboard;
