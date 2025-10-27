import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Calendar, Clock, MapPin, Trash2 } from "lucide-react";
import { format } from "date-fns";
import type { Database } from "@/integrations/supabase/types";

type Booking = Database["public"]["Tables"]["bookings"]["Row"] & {
  rooms: { name: string };
  profiles: { name: string };
};

interface BookingListProps {
  refresh: number;
}

export function BookingList({ refresh }: BookingListProps) {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadBookings();
  }, [refresh]);

  const loadBookings = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from("bookings")
        .select("*, rooms(name), profiles(name)")
        .eq("user_id", user.id)
        .order("date", { ascending: true })
        .order("start_time", { ascending: true });

      if (error) throw error;
      setBookings(data || []);
    } catch (error: any) {
      console.error("Error loading bookings:", error);
      toast.error("Failed to load bookings");
    } finally {
      setLoading(false);
    }
  };

  const cancelBooking = async (id: string) => {
    try {
      const { error } = await supabase
        .from("bookings")
        .update({ status: "cancelled" })
        .eq("id", id);

      if (error) throw error;
      toast.success("Booking cancelled");
      loadBookings();
    } catch (error: any) {
      toast.error("Failed to cancel booking");
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      confirmed: "default",
      pending_approval: "secondary",
      rejected: "destructive",
      cancelled: "outline",
    };

    return (
      <Badge variant={variants[status] || "default"}>
        {status.replace("_", " ")}
      </Badge>
    );
  };

  if (loading) {
    return (
      <Card className="shadow-card">
        <CardHeader>
          <CardTitle>My Bookings</CardTitle>
          <CardDescription>Loading your bookings...</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card className="shadow-card">
      <CardHeader>
        <CardTitle>My Bookings</CardTitle>
        <CardDescription>View and manage your meeting room bookings</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {bookings.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">
            No bookings yet. Use the booking assistant to create one!
          </p>
        ) : (
          bookings.map((booking) => (
            <div
              key={booking.id}
              className="flex items-start justify-between p-4 border rounded-lg bg-card hover:bg-muted/50 transition-colors"
            >
              <div className="space-y-2 flex-1">
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-primary" />
                  <span className="font-semibold">{booking.rooms.name}</span>
                  {getStatusBadge(booking.status)}
                </div>
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    {format(new Date(booking.date), "MMM d, yyyy")}
                  </div>
                  <div className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {booking.start_time.slice(0, 5)} - {booking.end_time.slice(0, 5)}
                  </div>
                </div>
                <p className="text-sm">{booking.purpose}</p>
              </div>
              {booking.status !== "cancelled" && booking.status !== "rejected" && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => cancelBooking(booking.id)}
                  className="text-destructive hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}