"use client";

import { useState } from "react";
import { Sparkles, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "sonner";

// Quick-start templates make the AI feature more discoverable.
// Tapping a chip pre-fills the textarea so users can tweak instead of starting blank.
const PROMPT_TEMPLATES = [
  {
    label: "Tech Meetup",
    prompt:
      "A casual tech meetup for developers covering the latest in web development, with short talks and networking time.",
  },
  {
    label: "Workshop",
    prompt:
      "A hands-on weekend workshop where beginners can learn a new creative skill from scratch with guided exercises.",
  },
  {
    label: "Networking Mixer",
    prompt:
      "An after-work networking mixer for local professionals with light food, drinks, and structured intro rounds.",
  },
  {
    label: "Community Event",
    prompt:
      "A free community gathering bringing neighbours together for a fun shared activity in a public space.",
  },
];

export default function AIEventCreator({ onEventGenerated }) {
  const [isOpen, setIsOpen] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);

  const generateEvent = async () => {
    if (!prompt.trim()) {
      toast.error("Please describe your event");
      return;
    }

    setLoading(true);
    try {
      const response = await fetch("/api/generate-event", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt }),
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error || "Request failed");
      }

      const data = await response.json();
      onEventGenerated(data);
      toast.success("Event details generated! Review and customize below.");
      setIsOpen(false);
      setPrompt("");
    } catch (error) {
      toast.error(error.message || "Failed to generate event. Please try again.");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2">
          <Sparkles className="w-4 h-4" />
          Generate with AI
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-purple-500" />
            AI Event Creator
          </DialogTitle>
          <DialogDescription>
            Describe your event idea and let AI draft the title, description, tags, and more.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <p className="text-xs text-muted-foreground mb-2">Quick start:</p>
            <div className="flex flex-wrap gap-2">
              {PROMPT_TEMPLATES.map((tpl) => (
                <button
                  key={tpl.label}
                  type="button"
                  onClick={() => setPrompt(tpl.prompt)}
                  disabled={loading}
                  className="text-xs px-3 py-1.5 rounded-full border border-border hover:bg-accent transition disabled:opacity-50"
                >
                  {tpl.label}
                </button>
              ))}
            </div>
          </div>

          <Textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Example: A tech meetup about React 19 for developers in Bangalore. It should cover new features like Actions and use hook improvements..."
            rows={6}
            className="resize-none"
          />

          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => setIsOpen(false)}
              className="flex-1"
              disabled={loading}
            >
              Cancel
            </Button>
            <Button
              onClick={generateEvent}
              disabled={loading || !prompt.trim()}
              className="flex-1 gap-2"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  Generate
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
