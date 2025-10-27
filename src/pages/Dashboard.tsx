import { useState } from "react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { LogOut, Calendar } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { BookingInput } from "@/components/dashboard/BookingInput";
import { BookingForm } from "@/components/dashboard/BookingForm";
import { BookingList } from "@/components/dashboard/BookingList";
import { RoomAvailability } from "@/components/dashboard/RoomAvailability";

export default function Dashboard() {
  const navigate = useNavigate();
  const [parsedBooking, setParsedBooking] = useState<any>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  const handleBookingCreated = () => {
    setParsedBooking(null);
    setRefreshKey(prev => prev + 1);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-background">
      <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-10 shadow-sm">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-primary flex items-center justify-center">
              <span className="text-xl font-bold text-primary-foreground">SM</span>
            </div>
            <div>
              <h1 className="text-2xl font-bold">SmartMeet.AI — ULTS</h1>
              <p className="text-sm text-muted-foreground">ULTS Global</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => navigate("/schedule")}>
              <Calendar className="mr-2 h-4 w-4" />
              View Schedule
            </Button>
            <Button variant="outline" onClick={handleLogout}>
              <LogOut className="mr-2 h-4 w-4" />
              Sign Out
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Booking Interface */}
          <div className="lg:col-span-2 space-y-6">
            <BookingInput onBookingParsed={(data) => {
              setParsedBooking(data);
              if (data?.date) setSelectedDate(data.date);
            }} />
            <BookingForm parsedData={parsedBooking} onBookingCreated={handleBookingCreated} />
            <BookingList refresh={refreshKey} />
          </div>

          {/* Right Column - Room Availability */}
          <div className="lg:col-span-1">
            <RoomAvailability selectedDate={selectedDate} />
          </div>
        </div>
      </main>
    </div>
  );
}