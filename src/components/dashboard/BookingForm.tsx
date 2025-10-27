import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Calendar as CalendarIcon } from "lucide-react";
import type { Database } from "@/integrations/supabase/types";

type Room = Database["public"]["Tables"]["rooms"]["Row"];

interface BookingFormProps {
  parsedData?: any;
  onBookingCreated: () => void;
}

export function BookingForm({ parsedData, onBookingCreated }: BookingFormProps) {
  const [loading, setLoading] = useState(false);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [formData, setFormData] = useState({
    room_id: "",
    date: "",
    start_time: "",
    end_time: "",
    purpose: "",
  });

  useEffect(() => {
    loadRooms();
  }, []);

  useEffect(() => {
    if (parsedData?.data) {
      const room = rooms.find(r => r.name.toLowerCase() === parsedData.data.room_name?.toLowerCase());
      setFormData({
        room_id: room?.id || "",
        date: parsedData.data.date || "",
        start_time: parsedData.data.start_time || "",
        end_time: parsedData.data.end_time || "",
        purpose: parsedData.data.purpose || "",
      });
    }
  }, [parsedData, rooms]);

  const loadRooms = async () => {
    const { data } = await supabase.from("rooms").select("*").order("name");
    if (data) setRooms(data);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const status = parsedData?.status === "pending_approval" ? "pending_approval" : "confirmed";

      const { error } = await supabase.from("bookings").insert({
        user_id: user.id,
        room_id: formData.room_id,
        date: formData.date,
        start_time: formData.start_time,
        end_time: formData.end_time,
        purpose: formData.purpose,
        status: status,
      });

      if (error) throw error;

      toast.success(
        status === "pending_approval"
          ? "Booking submitted for approval!"
          : "Booking confirmed!"
      );
      
      setFormData({
        room_id: "",
        date: "",
        start_time: "",
        end_time: "",
        purpose: "",
      });
      
      onBookingCreated();
    } catch (error: any) {
      console.error("Booking creation error:", error);
      toast.error(error.message || "Failed to create booking");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="shadow-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CalendarIcon className="h-5 w-5 text-primary" />
          Booking Details
        </CardTitle>
        <CardDescription>
          Confirm or manually enter booking information
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="room">Meeting Room</Label>
            <Select
              value={formData.room_id}
              onValueChange={(value) => setFormData({ ...formData, room_id: value })}
              required
            >
              <SelectTrigger id="room">
                <SelectValue placeholder="Select a room" />
              </SelectTrigger>
              <SelectContent>
                {rooms.map((room) => (
                  <SelectItem key={room.id} value={room.id}>
                    {room.name} ({room.capacity} people)
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="date">Date</Label>
              <Input
                id="date"
                type="date"
                value={formData.date}
                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="start_time">Start Time</Label>
              <Input
                id="start_time"
                type="time"
                value={formData.start_time}
                onChange={(e) => setFormData({ ...formData, start_time: e.target.value })}
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="end_time">End Time</Label>
            <Input
              id="end_time"
              type="time"
              value={formData.end_time}
              onChange={(e) => setFormData({ ...formData, end_time: e.target.value })}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="purpose">Purpose</Label>
            <Textarea
              id="purpose"
              placeholder="e.g., Team standup, Client presentation, etc."
              value={formData.purpose}
              onChange={(e) => setFormData({ ...formData, purpose: e.target.value })}
              required
            />
          </div>

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Creating Booking...
              </>
            ) : (
              "Confirm Booking"
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}