"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";

const formSchema = z
  .object({
    name: z.string().min(1, "Name is required"),
    type: z.enum(["rss", "google"]),
    url: z.string().url("Enter a valid URL").optional(),
    query: z.string().optional(),
    categories: z.string().optional(),
    language: z.string().optional(),
    isActive: z.boolean().default(true),
  })
  .superRefine((data, ctx) => {
    if (data.type === "rss" && !data.url) {
      ctx.addIssue({ code: "custom", path: ["url"], message: "URL is required for RSS" });
    }
    if (data.type === "google" && !data.query) {
      ctx.addIssue({
        code: "custom",
        path: ["query"],
        message: "Query is required for Google search",
      });
    }
  });

type FormValues = z.infer<typeof formSchema>;

type FeedFormProps = {
  feed?: {
    id: string;
    name: string;
    type: string;
    url: string | null;
    query: string | null;
    categories: string[];
    language: string | null;
    isActive: boolean;
  };
  onSaved?: () => void;
  onDeleted?: () => void;
};

export function FeedForm({ feed, onSaved, onDeleted }: FeedFormProps) {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isPending, startTransition] = useTransition();

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: feed?.name ?? "",
      type: (feed?.type as FormValues["type"]) ?? "rss",
      url: feed?.url ?? "",
      query: feed?.query ?? "",
      categories: feed?.categories?.join(", ") ?? "",
      language: feed?.language ?? "",
      isActive: feed?.isActive ?? true,
    },
  });

  const onSubmit = (values: FormValues) => {
    setServerError(null);
    const payload = {
      ...values,
      url: values.url || undefined,
      query: values.query || undefined,
      categories:
        values.categories
          ?.split(",")
          .map((c) => c.trim())
          .filter(Boolean) ?? [],
    };

    startTransition(async () => {
      const endpoint = feed ? `/api/feeds/${feed.id}` : "/api/feeds";
      const method = feed ? "PATCH" : "POST";
      const res = await fetch(endpoint, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        setServerError(data?.error ?? "Unable to save feed");
        return;
      }

      form.reset(values);
      router.refresh();
      onSaved?.();
    });
  };

  const handleDelete = () => {
    if (!feed) return;
    setServerError(null);
    startTransition(async () => {
      const res = await fetch(`/api/feeds/${feed.id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        setServerError(data?.error ?? "Unable to delete feed");
        return;
      }
      router.refresh();
      onDeleted?.();
    });
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Name</FormLabel>
                <FormControl>
                  <Input placeholder="Tech news" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="type"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Type</FormLabel>
                <FormControl>
                  <select
                    {...field}
                    className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  >
                    <option value="rss">RSS</option>
                    <option value="google">Google Search</option>
                  </select>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="url"
            render={({ field }) => (
              <FormItem>
                <FormLabel>URL (for RSS)</FormLabel>
                <FormControl>
                  <Input placeholder="https://example.com/rss" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="query"
            render={({ field }) => (
              <FormItem>
                <div className="flex items-center justify-between">
                  <FormLabel>Query (for Google)</FormLabel>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={isPending || isGenerating}
                    onClick={async () => {
                      setServerError(null);
                      setIsGenerating(true);
                      const prompt =
                        form.getValues("name")?.trim() ||
                        form.getValues("query")?.trim() ||
                        "this feed";

                      try {
                        const res = await fetch("/api/ai/generate-description", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ prompt, type: "feed" }),
                        });
                        if (!res.ok) {
                          setServerError("AI helper unavailable");
                          return;
                        }
                        const data = (await res.json()) as { suggestion?: string };
                        if (data.suggestion) {
                          form.setValue("query", data.suggestion);
                        }
                      } catch (err) {
                        console.error(err);
                        setServerError("AI helper unavailable");
                      } finally {
                        setIsGenerating(false);
                      }
                    }}
                  >
                    {isGenerating ? "Generating..." : "Generate with AI"}
                  </Button>
                </div>
                <FormControl>
                  <Input placeholder="climate policy" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="categories"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Categories (comma separated)</FormLabel>
                <FormControl>
                  <Input placeholder="tech, ai, security" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="language"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Language</FormLabel>
                <FormControl>
                  <Input placeholder="en" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="isActive"
            render={({ field }) => (
              <FormItem className="flex items-center gap-2 space-y-0 pt-2">
                <FormControl>
                  <input
                    type="checkbox"
                    checked={field.value}
                    onChange={(event) => field.onChange(event.target.checked)}
                    className="h-4 w-4 rounded border border-input text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  />
                </FormControl>
                <FormLabel className="mt-0">Active</FormLabel>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {serverError ? (
          <p className="text-sm font-medium text-destructive">{serverError}</p>
        ) : null}

        <div className="flex items-center gap-3">
          <Button type="submit" disabled={isPending}>
            {feed ? "Save changes" : "Create feed"}
          </Button>
          {feed ? (
            <Button
              type="button"
              variant="ghost"
              className="text-destructive hover:text-destructive"
              onClick={handleDelete}
              disabled={isPending}
            >
              Delete
            </Button>
          ) : null}
        </div>
      </form>
    </Form>
  );
}
