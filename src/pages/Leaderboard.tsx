
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
      // First try to get users with balance from database
      const { data, error } = await supabase
        .from("users")
        .select("id, username, firstname, balance, links")
        .order("balance", { ascending: false })
        .limit(50);

      if (error) {
        console.error("Error fetching leaderboard data:", error);
        throw error;
      }
      
      console.log("Leaderboard data:", data);
      return data || [];
    },
  });

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh]">
        <div className="text-destructive">Error loading leaderboard data</div>
      </div>
    );
  }

  // Check if we have any users to display
  const hasUsers = users && users.length > 0;

  return (
    <div className="flex flex-col space-y-6">
      <div className="text-center">
        <h1 className="text-3xl font-bold mb-2">Leaderboard</h1>
        <p className="text-muted-foreground">Top KFC holders</p>
      </div>

      {!hasUsers ? (
        <div className="text-center p-8 rounded-lg border border-dashed">
          <User className="h-10 w-10 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-medium">No miners yet</h3>
          <p className="text-muted-foreground">Be the first to connect your wallet and mine KFC!</p>
        </div>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12 text-center">Rank</TableHead>
                <TableHead>Username</TableHead>
                <TableHead className="text-right">KFC Balance</TableHead>
                <TableHead className="text-center w-20">Wallet</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((user, index) => (
                <TableRow key={index}>
                  <TableCell className="text-center font-medium">
                    {index + 1}
                  </TableCell>
                  <TableCell>
                    {user.username || user.firstname || "Anonymous"}
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {user.balance ? user.balance.toLocaleString() : "0"} KFC
                  </TableCell>
                  <TableCell className="text-center">
                    {user.links ? (
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
