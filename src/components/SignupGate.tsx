import { useState } from 'react';
import { z } from 'zod';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { TrendingUp, Activity, BarChart3 } from 'lucide-react';

const leadSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(120, 'Name is too long'),
  email: z.string().trim().toLowerCase().email('Enter a valid email').max(255),
  phone: z
    .string()
    .trim()
    .min(7, 'Enter a valid phone number')
    .max(30, 'Phone number is too long')
    .regex(/^[+()\-\d\s]+$/, 'Phone can only contain digits, spaces, +, -, ()'),
});

type FieldErrors = Partial<Record<'name' | 'email' | 'phone', string>>;

export function SignupGate({ onUnlock }: { onUnlock: (email: string) => void }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [errors, setErrors] = useState<FieldErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const { toast } = useToast();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrors({});

    const parsed = leadSchema.safeParse({ name, email, phone });
    if (!parsed.success) {
      const fieldErrors: FieldErrors = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path[0] as keyof FieldErrors;
        if (key && !fieldErrors[key]) fieldErrors[key] = issue.message;
      }
      setErrors(fieldErrors);
      return;
    }

    setSubmitting(true);
    const { error } = await supabase.from('leads').insert({
      name: parsed.data.name,
      email: parsed.data.email,
      phone: parsed.data.phone,
      source: 'dashboard_signup',
      user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : null,
      referrer: typeof document !== 'undefined' ? document.referrer || null : null,
    });
    setSubmitting(false);

    // Duplicate email (unique index) — treat as success and unlock
    if (error && error.code !== '23505') {
      toast({
        title: 'Something went wrong',
        description: error.message || 'Please try again in a moment.',
        variant: 'destructive',
      });
      return;
    }

    onUnlock(parsed.data.email);
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-10 bg-background">
      <Card className="w-full max-w-md border-border/50 bg-card/80 backdrop-blur">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <span className="text-2xl font-bold text-primary">₿</span>
          </div>
          <CardTitle className="text-2xl">Get Free Access</CardTitle>
          <CardDescription>
            Unlock the MCG Bitcoin Cycle Dashboard — institutional-grade signals, updated daily.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="mb-6 space-y-2 text-sm text-muted-foreground">
            <li className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-primary" />
              Live Bitcoin Cycle Gauge (0–20 score)
            </li>
            <li className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-primary" />
              Sentiment, valuation, trend & macro indicators
            </li>
            <li className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" />
              Weekly market commentary
            </li>
          </ul>

          <form onSubmit={handleSubmit} className="space-y-3" noValidate>
            <div>
              <Input
                type="text"
                placeholder="Full name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoComplete="name"
                className="bg-secondary/50"
                aria-invalid={!!errors.name}
              />
              {errors.name && <p className="mt-1 text-xs text-destructive">{errors.name}</p>}
            </div>
            <div>
              <Input
                type="email"
                placeholder="Email address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                className="bg-secondary/50"
                aria-invalid={!!errors.email}
              />
              {errors.email && <p className="mt-1 text-xs text-destructive">{errors.email}</p>}
            </div>
            <div>
              <Input
                type="tel"
                placeholder="Phone number"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                autoComplete="tel"
                className="bg-secondary/50"
                aria-invalid={!!errors.phone}
              />
              {errors.phone && <p className="mt-1 text-xs text-destructive">{errors.phone}</p>}
            </div>

            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting ? 'Unlocking…' : 'Get Free Access'}
            </Button>
          </form>

          <p className="mt-4 text-center text-[11px] text-muted-foreground/70">
            We'll only email you about Bitcoin cycle updates. No spam.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
