# OpenAI API Configuration

This project now supports using a custom OpenAI API endpoint via environment variables.

## Configuration

To configure the application to use a custom OpenAI API endpoint (such as a local server), set the following environment variable:

```
OPENAI_API_BASE_URL=http://your-local-server:port/v1
```

### Example configurations:

1. **Using default OpenAI API**:
   ```
   OPENAI_API_KEY=your-api-key
   ```

2. **Using a local server**:
   ```
   OPENAI_API_KEY=your-api-key
   OPENAI_API_BASE_URL=http://localhost:8080/v1
   ```

3. **Using a private OpenAI-compatible API server**:
   ```
   OPENAI_API_KEY=your-api-key
   OPENAI_API_BASE_URL=https://your-private-api-server.com/v1
   ```

## Notes

- If `OPENAI_API_BASE_URL` is not provided, the application will use the default OpenAI API endpoint.
- The API server at the custom URL must be compatible with the OpenAI API format.
- Make sure your local server implements the endpoints used by this application, particularly the chat completions endpoint.