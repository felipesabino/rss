# Brutalist Report Static Site Generator

A static site generator for RSS feeds, inspired by Brutalist Report aesthetics.

## Overview

This project has been transformed from a dynamic React application with API endpoints into a static site generator. The static site is generated when feed contents are updated, resulting in a lightweight UI that loads quickly with minimal dependencies.

This project has been updated to use SQLite as the storage backend instead of in-memory storage.

## Changes Made

1. Added SQLite dependencies:
   - better-sqlite3: SQLite database driver for Node.js
   - Updated drizzle-orm imports for SQLite support

2. Created new files:
   - server/db.ts: Database connection setup
   - server/sqliteStorage.ts: SQLite implementation of the IStorage interface
   - server/migrations.ts: Database initialization logic

3. Updated server/routes.ts to use SQLiteStorage instead of MemStorage

## How It Works

The application now stores all feed and item data in a SQLite database file (db.sqlite) instead of in-memory data structures. This provides:

- Data persistence across server restarts
- Improved scalability for larger datasets
- Better performance for complex queries

The database tables are automatically created when the server starts, so no separate migration step is required.

## Schema

Two tables are created:

2. `items`: Stores feed items
   - id: INTEGER PRIMARY KEY
   - feed_id: INTEGER
   - title: TEXT
   - url: TEXT
   - content: TEXT
   - summary: TEXT
   - published: TEXT (ISO date string)
   - has_summary: INTEGER (boolean)