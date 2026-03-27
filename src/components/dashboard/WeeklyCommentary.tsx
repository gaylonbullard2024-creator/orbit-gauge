import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/integrations/supabase/client';

interface WeeklyCommentaryProps {
  headline: string | null;
  markdown: string | null;
  weekEnding: string | null;
}

export function WeeklyCommentary({ headline, markdown, weekEnding }: WeeklyCommentaryProps) {
  const { isAdmin } = useAuth();
  const [editing, setEditing] = useState(false);
  const [editHeadline, setEditHeadline] = useState(headline ?? '');
  const [editMarkdown, setEditMarkdown] = useState(markdown ?? '');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!weekEnding) return;
    setSaving(true);
    await supabase
      .from('weekly_reports')
      .upsert({
        week_ending: weekEnding,
        headline: editHeadline,
        summary_markdown: editMarkdown,
      }, { onConflict: 'week_ending' });
    setSaving(false);
    setEditing(false);
  };

  return (
    <Card className="border-border/50 bg-card/80">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-lg">Weekly Market Commentary</CardTitle>
        {isAdmin && !editing && (
          <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
            Edit
          </Button>
        )}
      </CardHeader>
      <CardContent>
        {editing ? (
          <div className="space-y-4">
            <input
              className="w-full rounded-md border border-input bg-secondary/50 px-3 py-2 text-lg font-semibold text-foreground"
              value={editHeadline}
              onChange={(e) => setEditHeadline(e.target.value)}
              placeholder="Headline"
            />
            <Textarea
              className="min-h-[200px] bg-secondary/50"
              value={editMarkdown}
              onChange={(e) => setEditMarkdown(e.target.value)}
              placeholder="Write your weekly commentary in markdown..."
            />
            <div className="flex gap-2">
              <Button onClick={handleSave} disabled={saving}>
                {saving ? 'Saving...' : 'Save'}
              </Button>
              <Button variant="ghost" onClick={() => setEditing(false)}>
                Cancel
              </Button>
            </div>
          </div>
        ) : headline || markdown ? (
          <div className="space-y-3">
            {headline && <h3 className="text-xl font-semibold text-foreground">{headline}</h3>}
            {markdown && (
              <div className="prose prose-invert prose-sm max-w-none text-muted-foreground whitespace-pre-wrap">
                {markdown}
              </div>
            )}
            {weekEnding && (
              <p className="text-xs text-muted-foreground/60 pt-2">
                Week ending {weekEnding}
              </p>
            )}
          </div>
        ) : (
          <p className="text-muted-foreground text-sm">No commentary published yet.</p>
        )}
      </CardContent>
    </Card>
  );
}
