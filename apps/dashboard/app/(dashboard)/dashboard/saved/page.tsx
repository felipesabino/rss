import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireUser } from "@/lib/auth";
import { listSavedItems } from "@/lib/data/saved-items";

export default async function SavedItemsPage() {
  const session = await requireUser();
  const savedItems = await listSavedItems(session.user.id);

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-primary">
          Saved items
        </p>
        <h1 className="text-3xl font-semibold">Your saved posts</h1>
        <p className="max-w-2xl text-muted-foreground">
          Items you saved from reports live here. Links open the original source; everything is
          scoped to your account.
        </p>
      </div>

      {savedItems.length === 0 ? (
        <p className="text-sm text-muted-foreground">You have no saved items yet.</p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {savedItems.map((saved) => (
            <Card key={saved.id}>
              <CardHeader>
                <CardTitle className="text-lg">
                  {saved.feedItem.title ?? "Untitled item"}
                </CardTitle>
                <p className="text-sm text-muted-foreground">
                  {saved.feedItem.sourceConfig?.name ?? saved.feedItem.siteName ?? "Unknown source"}
                </p>
              </CardHeader>
              <CardContent className="space-y-3">
                {saved.savedSummary ? (
                  <p className="text-sm text-muted-foreground">{saved.savedSummary}</p>
                ) : null}
                {saved.notes ? (
                  <p className="text-sm text-muted-foreground">Notes: {saved.notes}</p>
                ) : null}
                {saved.feedItem.url ? (
                  <a
                    href={saved.feedItem.url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-sm font-medium text-primary underline underline-offset-4"
                  >
                    Open original
                  </a>
                ) : null}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
