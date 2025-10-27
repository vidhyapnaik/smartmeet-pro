import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { Building2, Users } from "lucide-react";
import type { Database } from "@/integrations/supabase/types";

type Room = Database["public"]["Tables"]["rooms"]["Row"];

export function RoomAvailability() {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadRooms();
  }, []);

  const loadRooms = async () => {
    try {
      const { data, error } = await supabase
        .from("rooms")
        .select("*")
        .order("name");

      if (error) throw error;
      setRooms(data || []);
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
          Available Rooms
        </CardTitle>
        <CardDescription>All meeting rooms at ULTS Global</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {rooms.map((room) => (
            <div
              key={room.id}
              className="p-4 border rounded-lg bg-card hover:bg-muted/50 transition-colors"
            >
              <div className="flex items-start justify-between mb-2">
                <h3 className="font-semibold text-lg">{room.name}</h3>
                {getAccessBadge(room.restriction_level)}
              </div>
              <div className="flex items-center gap-1 text-sm text-muted-foreground mb-2">
                <Users className="h-3 w-3" />
                <span>Capacity: {room.capacity}</span>
              </div>
              {room.description && (
                <p className="text-xs text-muted-foreground">{room.description}</p>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}