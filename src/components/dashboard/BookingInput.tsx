import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Sparkles } from "lucide-react";

interface BookingInputProps {
  onBookingParsed: (booking: any) => void;
}

export function BookingInput({ onBookingParsed }: BookingInputProps) {
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) return;

    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data, error } = await supabase.functions.invoke("parse-booking", {
        body: { message, userId: user.id },
      });

      if (error) throw error;

      onBookingParsed(data);
      
      if (data.status === "confirmed" || data.status === "pending_approval") {
        toast.success(data.message);
        setMessage("");
      } else if (data.status === "rejected" || data.status === "conflict") {
        toast.error(data.message);
      } else {
        toast.info(data.message || "Processing your request...");
      }
    } catch (error: any) {
      console.error("Booking parse error:", error);
      toast.error(error.message || "Failed to process booking request");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="shadow-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />
          Smart Booking Assistant
        </CardTitle>
        <CardDescription>
          Describe your meeting in natural language - I'll handle the rest!
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Textarea
            placeholder="Example: Book M8 tomorrow at 2pm for 1 hour for client presentation"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            className="min-h-[100px] resize-none"
            disabled={loading}
          />
          <div className="flex gap-2">
            <Button type="submit" className="flex-1" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <Sparkles className="mr-2 h-4 w-4" />
                  Parse & Validate
                </>
              )}
            </Button>
          </div>
        </form>
        <div className="mt-4 p-3 bg-muted/50 rounded-lg">
          <p className="text-xs text-muted-foreground">
            <strong>Tips:</strong> Mention the room name, date, time, and purpose. 
            You can say things like "tomorrow", "next Monday", "2pm", etc.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}