
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
      console.log("=== LEADERBOARD DEBUGGING ===");
      
      try {
        // Try to get basic info about the users table
        const { data: allUsers, error: allUsersError, count } = await supabase
          .from("users")
          .select("*", { count: 'exact' });
        
        console.log("=== DATABASE QUERY RESULTS ===");
        console.log("Query error:", allUsersError);
        console.log("Total count from database:", count);
        console.log("Returned users array:", allUsers);
        console.log("Users array length:", allUsers?.length);
        
        if (allUsersError) {
          console.error("Database error details:", {
            message: allUsersError.message,
            details: allUsersError.details,
            hint: allUsersError.hint,
            code: allUsersError.code
          });
          throw allUsersError;
        }

        // Show detailed info about each user
        if (allUsers && allUsers.length > 0) {
          console.log("=== USER DETAILS ===");
          allUsers.forEach((user, index) => {
            console.log(`User ${index + 1}:`, {
              id: user.id,
              username: user.username,
              firstname: user.firstname,
              lastname: user.lastname,
              balance: user.balance,
              balanceType: typeof user.balance,
              hasBalance: user.balance !== null && user.balance !== undefined
            });
          });
          
          // Filter users with valid balance data
          const usersWithBalance = allUsers.filter(user => 
            user.balance !== null && 
            user.balance !== undefined && 
            Number(user.balance) >= 0
          );
          
          console.log("=== FILTERED USERS ===");
          console.log("Users with valid balance:", usersWithBalance.length);
          
          // Transform for leaderboard display
          const leaderboardUsers = usersWithBalance
            .map((user) => ({
              id: user.id,
              username: user.username,
              firstname: user.firstname,
              lastname: user.lastname,
              balance: Number(user.balance) || 0,
            }))
            .sort((a, b) => b.balance - a.balance)
            .slice(0, 50);
          
          console.log("=== FINAL LEADERBOARD DATA ===");
          console.log("Processed users for leaderboard:", leaderboardUsers);
          
          return leaderboardUsers;
        } else {
          console.log("=== NO USERS FOUND ===");
          console.log("The users table appears to be empty or inaccessible");
          return [];
        }
        
      } catch (err) {
        console.error("=== QUERY EXCEPTION ===");
        console.error("Error details:", err);
        throw err;
      }
    },
    refetchInterval: 10000,
    retry: 1,
  });

  console.log("=== COMPONENT STATE ===");
  console.log("React Query state:", { 
    users, 
    usersLength: users?.length,
    isLoading, 
    error: error?.message 
  });

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        <p className="mt-4 text-muted-foreground">Loading leaderboard...</p>
      </div>
    );
  }

  if (error) {
    console.error("=== COMPONENT ERROR ===");
    console.error("Full error object:", error);
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh]">
        <div className="text-destructive mb-4">Database Error</div>
        <div className="text-sm text-muted-foreground mb-4 max-w-md text-center">
          <div className="font-mono text-xs bg-gray-100 p-2 rounded mb-2">
            {error.message || "Failed to fetch leaderboard data"}
          </div>
          <p>Check the browser console for detailed error information.</p>
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

  return (
    <div className="flex flex-col space-y-6">
      <div className="text-center">
        <h1 className="text-3xl font-bold mb-2">Leaderboard</h1>
        <p className="text-muted-foreground">Top Knife Coin holders</p>
        <div className="text-xs text-gray-500 mt-2">
          Found {users?.length || 0} users with Knife Coin
        </div>
      </div>

      {!users || users.length === 0 ? (
        <div className="text-center p-8 rounded-lg border border-dashed">
          <User className="h-10 w-10 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-medium">No miners found</h3>
          <p className="text-muted-foreground mb-4">
            The database appears to be empty or there's a connection issue.
          </p>
          <p className="text-xs text-gray-500">
            Check the browser console for detailed debugging information.
          </p>
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
                    {user.username || user.firstname || user.lastname || `Miner #${user.id.toString().slice(0, 8)}`}
                  </TableCell>
                  <TableCell className="text-right font-bold text-lg">
                    {user.balance.toLocaleString()} KC
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          
          <div className="p-4 text-center text-sm text-muted-foreground border-t">
            Showing {users.length} miners • Updates every 10 seconds
          </div>
        </div>
      )}
    </div>
  );
};

export default Leaderboard;
