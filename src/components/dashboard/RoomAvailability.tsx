import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { Building2, Users } from "lucide-react";
import type { Database } from "@/integrations/supabase/types";

type Room = Database["public"]["Tables"]["rooms"]["Row"];
type Booking = Database["public"]["Tables"]["bookings"]["Row"];

interface RoomWithBookings extends Room {
  bookings: Booking[];
}

interface RoomAvailabilityProps {
  selectedDate?: string | null;
}

export function RoomAvailability({ selectedDate }: RoomAvailabilityProps) {
  const [rooms, setRooms] = useState<RoomWithBookings[]>([]);
  const [loading, setLoading] = useState(true);
  const displayDate = selectedDate || new Date().toISOString().split("T")[0];

  useEffect(() => {
    loadRooms();
  }, [displayDate]);

  const loadRooms = async () => {
    try {
      const { data: roomsData, error: roomsError } = await supabase
        .from("rooms")
        .select("*")
        .order("name");

      if (roomsError) throw roomsError;

      const { data: bookingsData, error: bookingsError } = await supabase
        .from("bookings")
        .select("*")
        .eq("date", displayDate)
        .order("start_time");

      if (bookingsError) throw bookingsError;

      const roomsWithBookings = (roomsData || []).map((room) => ({
        ...room,
        bookings: (bookingsData || []).filter((b) => b.room_id === room.id),
      }));

      setRooms(roomsWithBookings);
    } catch (error) {
      console.error("Error loading rooms:", error);
    } finally {
      setLoading(false);
    }
  };

  const getAccessBadge = (level: string) => {
    const config: Record<string, { label: string; variant: "default" | "secondary" | "outline" }> = {
      general: { label: "Open", variant: "default" },
      hr_team: { label: "HR Team", variant: "secondary" },
      hr_admin: { label: "HR Admin", variant: "secondary" },
      management: { label: "Management", variant: "outline" },
    };

    const { label, variant } = config[level] || config.general;
    return <Badge variant={variant}>{label}</Badge>;
  };

  if (loading) {
    return (
      <Card className="shadow-card">
        <CardHeader>
          <CardTitle>Room Availability</CardTitle>
          <CardDescription>Loading rooms...</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card className="shadow-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Building2 className="h-5 w-5 text-primary" />
          Room Availability
        </CardTitle>
        <CardDescription>
          {displayDate === new Date().toISOString().split("T")[0]
            ? "Today's bookings"
            : `Bookings for ${new Date(displayDate).toLocaleDateString()}`}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {rooms.map((room) => (
            <div
              key={room.id}
              className="p-3 border rounded-lg bg-card hover:bg-muted/50 transition-colors"
            >
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold">{room.name}</h3>
                  {getAccessBadge(room.restriction_level)}
                </div>
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Users className="h-3 w-3" />
                  <span>{room.capacity}</span>
                </div>
              </div>
              {room.bookings.length === 0 ? (
                <Badge variant="outline" className="text-xs">
                  Available
                </Badge>
              ) : (
                <div className="space-y-1">
                  {room.bookings.map((booking) => (
                    <div
                      key={booking.id}
                      className="text-xs text-muted-foreground bg-muted/30 px-2 py-1 rounded"
                    >
                      {booking.start_time.substring(0, 5)} - {booking.end_time.substring(0, 5)}:{" "}
                      {booking.purpose}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}