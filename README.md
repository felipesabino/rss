# Brutalist Report Static Site Generator

A static site generator for RSS feeds, inspired by Brutalist Report aesthetics.

## Overview

This project generates a static site from RSS feeds, resulting in a lightweight UI that loads quickly with minimal dependencies. The static site is generated when feed contents are updated.

## Features

- Static site generation from RSS feeds
- Brutalist aesthetic design
- OpenAI integration for content summarization
- Configurable feeds
- Fast loading times with minimal client-side dependencies

## Project Structure

- `config/` - Configuration files for feeds
- `static-generator/` - Code for generating the static site
  - `services/` - Service modules for RSS, content, and OpenAI integration
  - `steps/` - Modular implementation of the RSS processing pipeline
  - `templates/` - EJS templates and CSS for the static site
- `.github/workflows/` - GitHub Actions workflows for deployment

## Dependencies

Main dependencies:
- `cheerio` - HTML parsing and manipulation
- `dotenv` - Environment variable management
- `ejs` - Templating engine
- `got` - HTTP client
- `openai` - OpenAI API client
- `react` - UI component library
- `rss-parser` - RSS feed parsing
- `ws` - WebSocket implementation
- `zod` - Schema validation

Dev dependencies:
- `tsx` - TypeScript execution
- `typescript` - TypeScript language support
- `vite` - Build tool and development server

## Installation

```bash
# Clone the repository
git clone [repository-url]
cd [repository-directory]

# Install dependencies
npm install

# Create .env file from example
cp .env.example .env
# Edit .env with your own values
```

## Usage

Available npm commands:

```bash
# Start the development server
npm run dev

# Build the static site (run all steps)
npm run build

# Run individual steps of the build process
npm run step1  # Fetch RSS feeds
npm run step2  # Extract content
npm run step3  # Process content
npm run step4  # Process with OpenAI
npm run step5  # Generate HTML

# Preview the built static site
npm run preview
```

## Environment Variables

The project uses environment variables for configuration. Create a `.env` file in the root directory of the project (copy from `.env.example`) and add your values:

```
# OpenAI API Configuration
OPENAI_API_KEY=your-openai-api-key-here
OPENAI_API_BASE_URL=http://your-custom-openai-endpoint:port/v1
OPENAI_MODEL_NAME=gpt-3.5-turbo

# Feed Configuration
MAX_ITEMS_PER_FEED=10

# Build Configuration
NODE_ENV=production
```

### OpenAI API Configuration

```
OPENAI_API_KEY=your-api-key
OPENAI_API_BASE_URL=http://your-custom-endpoint:port/v1 (optional)
OPENAI_MODEL_NAME=gpt-3.5-turbo (optional)
```

If `OPENAI_API_BASE_URL` is not provided, the application will use the default OpenAI API endpoint.

### Feed Configuration

```
MAX_ITEMS_PER_FEED=10 (optional, defaults to 10)
```

This variable controls how many items are fetched from each RSS feed.

## GitHub Actions

The project uses GitHub Actions for automated deployment and other CI/CD tasks. The workflows are defined in the `.github/workflows` directory.

### Deployment Workflow

The deployment workflow (`.github/workflows/deploy.yml`) automates the process of building and deploying the static site:

1. Triggers on pushes to the main branch
2. Sets up Node.js environment
3. Installs dependencies
4. Fetches content from RSS feeds
5. Builds the static site
6. Deploys the built site to the hosting platform

### Ollama Integration

The project can use Ollama as a drop-in replacement for the OpenAI API in GitHub Actions:

- Allows running AI operations locally on GitHub runners
- Provides format translation between OpenAI and Ollama APIs
- No code changes needed - works as a drop-in replacement
- Configurable to use different models
- Reduces dependency on external API services

## How It Works

The static site generation process is divided into five distinct steps, each with its own cache file:

1. **Step 1: Fetch Feeds**
   - Fetches content from configured RSS feeds
   - Saves raw feed data to `.cache/step1-raw-feeds.json`

2. **Step 2: Extract Content**
   - Loads the raw feed data from Step 1
   - Extracts content from URLs
   - Saves extracted content to `.cache/step2-extracted-content.json`

3. **Step 3: Process Content**
   - Loads the extracted content from Step 2
   - Processes the content (media type detection, etc.)
   - Saves processed content to `.cache/step3-processed-content.json`

4. **Step 4: Process with OpenAI**
   - Loads the processed content from Step 3
   - Generates summaries using OpenAI
   - Performs sentiment analysis
   - Saves AI processed content to `.cache/step4-ai-processed-content.json`

5. **Step 5: Generate HTML**
   - Loads the AI processed content from Step 4
   - Uses EJS templates to generate HTML pages
   - Outputs the static site to the `dist` directory

This modular approach makes it easier to test, debug, and maintain each part of the process independently. See `static-generator/steps/README.md` for more details.

GitHub Actions can be used for automated deployment of the final static site.

## License

MIT
