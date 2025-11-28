# Dashboard API

All endpoints live under `apps/dashboard/app/api` and require an authenticated dashboard session (Auth.js with Prisma adapter). Every query is scoped to the current `userId` to preserve multi-tenancy.

## Feeds API

- `GET /api/feeds`  
  Returns the authenticated user's feed/search configurations.

- `POST /api/feeds`  
  Creates a feed for the current user. Body:
  ```json
  {
    "type": "rss",
    "name": "Example Feed",
    "url": "https://example.com/rss",
    "query": "optional search query",
    "categories": ["tech", "ai"],
    "language": "en",
    "isActive": true
  }
  ```
  Either `url` or `query` is required.

- `GET /api/feeds/{id}`  
  Fetches a single feed belonging to the current user.

- `PATCH /api/feeds/{id}`  
  Updates a feed for the current user. Same fields as POST, all optional.

- `DELETE /api/feeds/{id}`  
  Deletes the feed if it belongs to the current user.

All responses are JSON. Unauthorized requests return `401`, and requests for resources not owned by the user return `404`.
