# Modular RSS Processing System

This directory contains the modular implementation of the RSS feed processing system, broken down into distinct steps with separate cache files for each step.

## Overview

The process has been divided into five distinct steps:

1. **Fetch Feeds**: Get data from all RSS feeds and save it locally
2. **Extract Content**: Extract content from URLs in the feed data
3. **Process Content**: Process the extracted content (media type detection, etc.)
4. **Process with OpenAI**: Process the content with OpenAI (summary, sentiment analysis)
5. **Generate HTML**: Generate static HTML using the processed information

Each step uses its own cache file, making it easier to test and debug each part independently.

## Cache Files

- **Step 1**: `.cache/step1-raw-feeds.json` - Contains the raw feed data fetched from RSS sources
- **Step 2**: `.cache/step2-extracted-content.json` - Contains the content extracted from URLs
- **Step 3**: `.cache/step3-processed-content.json` - Contains the processed content with media type detection
- **Step 4**: `.cache/step4-ai-processed-content.json` - Contains the AI processed content with summaries, sentiment analysis, etc.
- **Step 5**: Uses the AI processed content from Step 4 to generate the static HTML site

## Running the Steps

You can run each step individually using the following npm scripts:

```bash
# Run individual steps
npm run step1  # Run Step 1: Fetch RSS feeds
npm run step2  # Run Step 2: Extract content
npm run step3  # Run Step 3: Process content
npm run step4  # Run Step 4: Process with OpenAI
npm run step5  # Run Step 5: Generate HTML

# Run all steps at once
npm run build
```

## Step Dependencies

- Step 2 depends on the output of Step 1
- Step 3 depends on the output of Step 2
- Step 4 depends on the output of Step 3
- Step 5 depends on the output of Step 4

Each step will check if the required cache file from the previous step exists before proceeding.

## Benefits of This Approach

1. **Easier Testing**: Each step can be tested independently
2. **Better Debugging**: Issues can be isolated to a specific step
3. **Improved Performance**: Steps can be run selectively as needed
4. **Reduced Coupling**: Each step has a clear input and output
5. **Flexibility**: Steps can be modified or replaced without affecting the others
6. **Testability**: Content extraction, content processing, and OpenAI processing are now separate, making it easier to test each independently
7. **Modularity**: Media type detection is now separate from both content extraction and OpenAI processing
