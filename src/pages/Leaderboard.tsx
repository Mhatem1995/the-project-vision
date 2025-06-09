
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
      console.log("Fetching leaderboard data...");
      
      // Fetch all users with their balances, filtering for positive balances
      const { data: userData, error: userError } = await supabase
        .from("users")
        .select("id, username, firstname, lastname, balance")
        .gte("balance", 0.01) // Only users with at least 0.01 coins
        .order("balance", { ascending: false })
        .limit(100);
      
      console.log("Database query result:", { userData, userError });
      
      if (userError) {
        console.error("Error fetching users:", userError);
        throw userError;
      }
      
      if (!userData || userData.length === 0) {
        console.log("No users found with positive balance");
        return [];
      }
      
      console.log(`Found ${userData.length} users with positive balances`);
      userData.forEach((user, index) => {
        console.log(`User ${index + 1}: ID=${user.id}, Username=${user.username || user.firstname || 'Anonymous'}, Balance=${user.balance}`);
      });
      
      // Transform the data for display
      const leaderboardUsers = userData.map((user) => ({
        id: user.id,
        username: user.username,
        firstname: user.firstname,
        lastname: user.lastname,
        balance: Number(user.balance) || 0,
      }));
      
      console.log("Final leaderboard users:", leaderboardUsers);
      return leaderboardUsers;
    },
    refetchInterval: 30000, // Refresh every 30 seconds
    retry: 3,
    retryDelay: 1000,
  });

  console.log("Leaderboard render state:", { users, isLoading, error, usersCount: users?.length });

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        <p className="mt-4 text-muted-foreground">Loading leaderboard...</p>
      </div>
    );
  }

  if (error) {
    console.error("Leaderboard error:", error);
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh]">
        <div className="text-destructive mb-4">Error loading leaderboard</div>
        <div className="text-sm text-muted-foreground mb-4">
          {error.message || "Failed to fetch leaderboard data"}
        </div>
        <button 
          onClick={() => window.location.reload()} 
          className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
        >
          Retry
        </button>
      </div>
    );
  }

  // Check if we have any users to display
  const hasUsers = users && users.length > 0;
  console.log("Has users to display:", hasUsers, "Total users:", users?.length);

  return (
    <div className="flex flex-col space-y-6">
      <div className="text-center">
        <h1 className="text-3xl font-bold mb-2">Leaderboard</h1>
        <p className="text-muted-foreground">Top Knife Coin holders</p>
      </div>

      {!hasUsers ? (
        <div className="text-center p-8 rounded-lg border border-dashed">
          <User className="h-10 w-10 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-medium">No miners yet</h3>
          <p className="text-muted-foreground">Be the first to connect your wallet and mine Knife Coin!</p>
        </div>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12 text-center">Rank</TableHead>
                <TableHead>Miner</TableHead>
                <TableHead className="text-right">Knife Coin Balance</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((user, index) => (
                <TableRow key={user.id}>
                  <TableCell className="text-center font-medium">
                    <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 text-primary font-bold">
                      {index + 1}
                    </span>
                  </TableCell>
                  <TableCell className="font-medium">
                    {user.username || user.firstname || user.lastname || `Miner #${user.id.slice(0, 8)}`}
                  </TableCell>
                  <TableCell className="text-right font-bold text-lg">
                    {user.balance.toLocaleString()} KC
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          
          <div className="p-4 text-center text-sm text-muted-foreground border-t">
            Showing {users.length} miners • Updates every 30 seconds
          </div>
        </div>
      )}
    </div>
  );
};

export default Leaderboard;
