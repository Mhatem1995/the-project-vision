
import { Home, ListTodo, Users, Award } from "lucide-react";
import { Link, useLocation } from "react-router-dom";

const BottomNav = () => {
  const location = useLocation();
  
  const navItems = [
    {
      icon: Home,
      label: "Mining",
      path: "/"
    },
    {
      icon: ListTodo,
      label: "Tasks",
      path: "/tasks"
    },
    {
      icon: Award,
      label: "Leaderboard",
      path: "/leaderboard"
    },
    {
      icon: Users,
      label: "Referrals",
      path: "/referrals"
    }
  ];

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-background border-t border-border flex justify-around py-2">
      {navItems.map((item) => {
        const isActive = location.pathname === item.path;
        return (
          <Link
            key={item.path}
            to={item.path}
            className={`flex flex-col items-center p-2 ${
              isActive ? "text-primary" : "text-muted-foreground"
            }`}
          >
            <item.icon className="w-6 h-6" />
            <span className="text-xs mt-1">{item.label}</span>
          </Link>
        );
      })}
    </div>
  );
};

export default BottomNav;
