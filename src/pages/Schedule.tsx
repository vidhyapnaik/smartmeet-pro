import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, Calendar } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import type { Database } from "@/integrations/supabase/types";

type Room = Database["public"]["Tables"]["rooms"]["Row"];
type Booking = Database["public"]["Tables"]["bookings"]["Row"];

interface RoomWithBookings extends Room {
  bookings: Booking[];
}

export default function Schedule() {
  const navigate = useNavigate();
  const [selectedDate, setSelectedDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [rooms, setRooms] = useState<RoomWithBookings[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSchedule();
  }, [selectedDate]);

  const loadSchedule = async () => {
    setLoading(true);
    try {
      const { data: roomsData, error: roomsError } = await supabase
        .from("rooms")
        .select("*")
        .order("name");

      if (roomsError) throw roomsError;

      const { data: bookingsData, error: bookingsError } = await supabase
        .from("bookings")
        .select("*")
        .eq("date", selectedDate)
        .order("start_time");

      if (bookingsError) throw bookingsError;

      const roomsWithBookings = (roomsData || []).map((room) => ({
        ...room,
        bookings: (bookingsData || []).filter((b) => b.room_id === room.id),
      }));

      setRooms(roomsWithBookings);
    } catch (error) {
      console.error("Error loading schedule:", error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const config: Record<string, { variant: "default" | "secondary" | "outline" }> = {
      confirmed: { variant: "default" },
      pending_approval: { variant: "secondary" },
      rejected: { variant: "outline" },
    };
    return config[status] || config.confirmed;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-background">
      <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-10 shadow-sm">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" onClick={() => navigate("/")} className="gap-2">
              <ArrowLeft className="h-4 w-4" />
              Back
            </Button>
            <div className="h-10 w-10 rounded-full bg-primary flex items-center justify-center">
              <span className="text-xl font-bold text-primary-foreground">SM</span>
            </div>
            <div>
              <h1 className="text-2xl font-bold">SmartMeet.AI — ULTS</h1>
              <p className="text-sm text-muted-foreground">Room Schedule</p>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <Card className="shadow-card mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-primary" />
              Daily Room Schedule
            </CardTitle>
            <CardDescription>View all meeting room bookings for a specific date</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4">
              <label htmlFor="date-picker" className="text-sm font-medium">
                Select Date:
              </label>
              <input
                id="date-picker"
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="px-3 py-2 border rounded-md bg-background text-foreground"
              />
            </div>
          </CardContent>
        </Card>

        {loading ? (
          <div className="text-center py-12">
            <div className="h-8 w-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="mt-4 text-muted-foreground">Loading schedule...</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {rooms.map((room) => (
              <Card key={room.id} className="shadow-card">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg">{room.name}</CardTitle>
                  <CardDescription className="text-xs">
                    Capacity: {room.capacity} people
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {room.bookings.length === 0 ? (
                    <div className="text-center py-6 text-muted-foreground text-sm">
                      No bookings
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {room.bookings.map((booking) => (
                        <div
                          key={booking.id}
                          className="p-3 border rounded-md bg-muted/30 hover:bg-muted/50 transition-colors"
                        >
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-sm font-semibold">
                              {booking.start_time.substring(0, 5)} - {booking.end_time.substring(0, 5)}
                            </span>
                            <Badge variant={getStatusBadge(booking.status).variant} className="text-xs">
                              {booking.status.replace("_", " ")}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground line-clamp-2">
                            {booking.purpose}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
