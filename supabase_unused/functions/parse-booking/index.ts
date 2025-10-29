import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { message, userId } = await req.json();
    console.log("Parsing booking request:", message, "for user:", userId);

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    // Get user profile and available rooms
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { data: profile } = await supabase
      .from("profiles")
      .select("*, departments(name)")
      .eq("id", userId)
      .single();

    const { data: rooms } = await supabase
      .from("rooms")
      .select("*")
      .order("name");

    console.log("User profile:", profile);
    console.log("Available rooms:", rooms);

    // Call Lovable AI to parse the booking request
    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content: `You are a meeting room booking assistant for ULTS Global. Extract booking details from natural language.
            
User details:
- Name: ${profile?.name}
- Department: ${profile?.departments?.name || "Unknown"}
- Role: ${profile?.role}

Available rooms:
${rooms?.map(r => `- ${r.name} (${r.restriction_level}, capacity: ${r.capacity})`).join("\n")}

Access rules:
- M13: hr_admin only
- M7: hr_team and hr_admin
- Board Room: management only
- M1-M6, M8-M12: general (all users)

Current date: ${new Date().toISOString().split("T")[0]}

Extract and return booking details in structured format.`
          },
          {
            role: "user",
            content: message
          }
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "create_booking",
              description: "Extract structured booking information from natural language",
              parameters: {
                type: "object",
                properties: {
                  room_name: {
                    type: "string",
                    description: "The meeting room name (e.g., M8, Board Room)"
                  },
                  date: {
                    type: "string",
                    description: "Booking date in YYYY-MM-DD format"
                  },
                  start_time: {
                    type: "string",
                    description: "Start time in HH:MM format (24-hour)"
                  },
                  end_time: {
                    type: "string",
                    description: "End time in HH:MM format (24-hour)"
                  },
                  purpose: {
                    type: "string",
                    description: "Meeting purpose or title"
                  },
                  department: {
                    type: "string",
                    description: "Department name if mentioned"
                  }
                },
                required: ["room_name", "date", "start_time", "end_time", "purpose"],
                additionalProperties: false
              }
            }
          }
        ],
        tool_choice: { type: "function", function: { name: "create_booking" } }
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error("AI gateway error:", aiResponse.status, errorText);
      
      if (aiResponse.status === 429) {
        return new Response(
          JSON.stringify({ 
            error: "Rate limit exceeded. Please try again in a moment.",
            status: "error"
          }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      if (aiResponse.status === 402) {
        return new Response(
          JSON.stringify({ 
            error: "AI service unavailable. Please contact support.",
            status: "error"
          }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      throw new Error(`AI gateway error: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    console.log("AI response:", JSON.stringify(aiData, null, 2));

    const toolCall = aiData.choices[0]?.message?.tool_calls?.[0];
    if (!toolCall) {
      return new Response(
        JSON.stringify({
          status: "error",
          message: "Could not understand the booking request. Please be more specific.",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const bookingData = JSON.parse(toolCall.function.arguments);
    console.log("Extracted booking data:", bookingData);

    // Validate room access
    const requestedRoom = rooms?.find(r => 
      r.name.toLowerCase() === bookingData.room_name.toLowerCase()
    );

    if (!requestedRoom) {
      return new Response(
        JSON.stringify({
          status: "rejected",
          message: `Room "${bookingData.room_name}" not found. Available rooms: ${rooms?.map(r => r.name).join(", ")}`,
          data: bookingData
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check access permissions
    const userRole = profile?.role || "general";
    const roomLevel = requestedRoom.restriction_level;
    
    let hasAccess = false;
    let needsApproval = false;

    if (roomLevel === "general") {
      hasAccess = true;
    } else if (roomLevel === "hr_team" && (userRole === "hr_team" || userRole === "hr_admin")) {
      hasAccess = true;
    } else if (roomLevel === "hr_admin" && userRole === "hr_admin") {
      hasAccess = true;
    } else if (roomLevel === "management" && userRole === "management") {
      hasAccess = true;
    } else if (roomLevel === "management") {
      // Board room can be requested but needs approval
      needsApproval = true;
    }

    if (!hasAccess && !needsApproval) {
      // Suggest alternative rooms
      const alternativeRooms = rooms?.filter(r => {
        if (r.restriction_level === "general") return true;
        if (r.restriction_level === "hr_team" && (userRole === "hr_team" || userRole === "hr_admin")) return true;
        if (r.restriction_level === "hr_admin" && userRole === "hr_admin") return true;
        if (r.restriction_level === "management" && userRole === "management") return true;
        return false;
      });

      return new Response(
        JSON.stringify({
          status: "rejected",
          message: `You don't have access to ${requestedRoom.name}. Try one of these: ${alternativeRooms?.map(r => r.name).join(", ")}`,
          data: bookingData,
          alternatives: alternativeRooms
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check for conflicts
    const { data: conflicts } = await supabase
      .from("bookings")
      .select("*")
      .eq("room_id", requestedRoom.id)
      .eq("date", bookingData.date)
      .neq("status", "cancelled")
      .neq("status", "rejected");

    const hasConflict = conflicts?.some(booking => {
      const bookingStart = booking.start_time;
      const bookingEnd = booking.end_time;
      const requestStart = bookingData.start_time;
      const requestEnd = bookingData.end_time;
      
      return (requestStart < bookingEnd && requestEnd > bookingStart);
    });

    if (hasConflict) {
      return new Response(
        JSON.stringify({
          status: "conflict",
          message: `${requestedRoom.name} is already booked during ${bookingData.start_time}-${bookingData.end_time}. Please choose another time or room.`,
          data: bookingData,
          conflicts: conflicts
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({
        status: needsApproval ? "pending_approval" : "confirmed",
        message: needsApproval 
          ? `Your booking for ${requestedRoom.name} is pending management approval.`
          : `Successfully validated! ${requestedRoom.name} is available on ${bookingData.date} from ${bookingData.start_time} to ${bookingData.end_time}.`,
        data: {
          ...bookingData,
          room_id: requestedRoom.id,
          room_name: requestedRoom.name,
          user_id: userId
        }
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error in parse-booking:", error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : "Unknown error",
        status: "error"
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});