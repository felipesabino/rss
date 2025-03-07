# Using Ollama with GitHub Actions as an OpenAI API Replacement

This document explains the GitHub Actions workflow configuration that enables using Ollama as a drop-in replacement for the OpenAI API.

## Overview

The workflow file `.github/workflows/ollama-openai-workflow.yml` sets up an environment where:

1. Ollama is installed and running the specified model (`hermes-3-llama-3.2-3b`)
2. A proxy server translates between OpenAI API format and Ollama API format
3. Environment variables redirect API calls to the proxy instead of OpenAI's servers

## How It Works

### 1. Setup and Installation

The workflow first checks out the code, sets up Node.js, and installs project dependencies:

```yaml
- name: Checkout code
  uses: actions/checkout@v4

- name: Set up Node.js
  uses: actions/setup-node@v4
  with:
    node-version: '20'
    cache: 'npm'

- name: Install dependencies
  run: npm ci
```

### 2. Ollama Setup

Next, it installs Ollama and pulls the required model:

```yaml
- name: Setup Ollama
  run: |
    curl -fsSL https://ollama.com/install.sh | sh
    ollama pull hermes-3-llama-3.2-3b
    nohup ollama serve &
    sleep 10 # Give Ollama time to start
```

### 3. API Proxy Configuration

A Node.js proxy server translates between OpenAI's API format and Ollama's format:

- Listens on port 3000
- Accepts requests in OpenAI format
- Transforms requests to Ollama format
- Sends requests to Ollama's API (port 11434)
- Transforms Ollama responses back to OpenAI format

### 4. Running Tests and Builds

The workflow runs tests and builds with environment variables that redirect API calls:

```yaml
- name: Run tests with Ollama as OpenAI replacement
  env:
    OPENAI_API_KEY: "dummy-key-not-used-by-ollama"
    OPENAI_API_BASE_URL: "http://localhost:3000"
  run: |
    npm run build
    npm run check
```

## Key Features

- **Drop-in Replacement:** No code changes needed - the proxy makes Ollama look like OpenAI to your code
- **Model Configuration:** Uses the same model specified in your code (`hermes-3-llama-3.2-3b`)
- **Format Translation:** Handles differences between API formats
- **Local Processing:** All AI operations run locally on the GitHub runner

## Customization

To use a different model, change the model name in both the `ollama pull` command and in the proxy's default model.