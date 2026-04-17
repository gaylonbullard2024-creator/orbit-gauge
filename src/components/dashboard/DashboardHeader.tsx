import { Button } from '@/components/ui/button';
import { useAuth } from '@/lib/auth';
import { LogOut } from 'lucide-react';
import { UserGuide } from '@/components/dashboard/UserGuide';

export function DashboardHeader() {
  const { user, signOut } = useAuth();

  return (
    <header className="sticky top-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-3 py-2 sm:px-4 sm:py-3">
        <div className="flex items-center gap-2 sm:gap-3">
          <div className="flex h-7 w-7 sm:h-8 sm:w-8 items-center justify-center rounded-lg bg-primary/10">
            <span className="text-base sm:text-lg font-bold text-primary">₿</span>
          </div>
          <h1 className="text-sm sm:text-lg font-semibold">MCG Bitcoin Cycle Dashboard</h1>
        </div>
        <div className="flex items-center gap-1 sm:gap-2">
          <UserGuide />
          {user && (
            <>
              <span className="hidden sm:inline text-xs text-muted-foreground truncate max-w-[200px]">
                {user.email}
              </span>
              <Button variant="ghost" size="sm" onClick={signOut} className="gap-1.5">
                <LogOut className="h-4 w-4" />
                <span className="hidden sm:inline">Sign out</span>
              </Button>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
