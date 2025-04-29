import { spawn } from 'child_process';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import crypto from 'crypto';
import { URL } from 'url';

/**
 * Extract YouTube video ID from URL
 */
export function extractYouTubeVideoId(url: string): string | null {
  try {
    const parsedUrl = new URL(url);
    const hostname = parsedUrl.hostname;
    
    // youtube.com format
    if (hostname.includes('youtube.com')) {
      // Regular watch URL (youtube.com/watch?v=VIDEO_ID)
      const videoParam = parsedUrl.searchParams.get('v');
      if (videoParam) return videoParam;
      
      // Shortened URL (youtube.com/v/VIDEO_ID)
      const pathMatch = parsedUrl.pathname.match(/\/v\/([^\/\?]+)/);
      if (pathMatch) return pathMatch[1];
      
      // Embed URL (youtube.com/embed/VIDEO_ID)
      const embedMatch = parsedUrl.pathname.match(/\/embed\/([^\/\?]+)/);
      if (embedMatch) return embedMatch[1];
    }
    
    // youtu.be format (youtu.be/VIDEO_ID)
    if (hostname.includes('youtu.be')) {
      const pathMatch = parsedUrl.pathname.match(/\/([^\/\?]+)/);
      if (pathMatch) return pathMatch[1];
    }
    
    return null;
  } catch (error) {
    console.error(`Error extracting YouTube video ID from ${url}:`, error);
    return null;
  }
}

/**
 * Check if a URL is a YouTube video URL
 */
export function isYouTubeUrl(url: string): boolean {
  try {
    const parsedUrl = new URL(url);
    const hostname = parsedUrl.hostname.toLowerCase();
    
    return hostname.includes('youtube.com') || hostname.includes('youtu.be');
  } catch (error) {
    return false;
  }
}

/**
 * Fetch YouTube transcript using youtube-transcript-api via a temporary Node.js script
 * This approach avoids adding a direct dependency on youtube-transcript-api
 */
export async function fetchYouTubeTranscript(videoId: string): Promise<string | null> {
  try {
    console.log(`Fetching transcript for YouTube video: ${videoId}`);
    
    // Check if we have youtube-transcript-api installed
    try {
      await fs.access(path.join(process.cwd(), 'node_modules', 'youtube-transcript-api'));
    } catch (error) {
      console.log('youtube-transcript-api not found, installing...');
      
      // Install youtube-transcript-api temporarily
      const npmInstall = spawn('npm', ['install', 'youtube-transcript-api', '--no-save']);
      
      // Wait for the installation to complete
      await new Promise((resolve, reject) => {
        npmInstall.on('close', (code) => {
          if (code === 0) {
            resolve(null);
          } else {
            reject(new Error(`npm install failed with code ${code}`));
          }
        });
      });
    }
    
    // Create a temporary file with a script to fetch the transcript
    const tempDir = os.tmpdir();
    const scriptFileName = `fetch-youtube-transcript-${crypto.randomBytes(8).toString('hex')}.js`;
    const scriptPath = path.join(tempDir, scriptFileName);
    
    const scriptContent = `
      const { YoutubeTranscript } = require('youtube-transcript-api');
      
      async function getTranscript() {
        try {
          const transcript = await YoutubeTranscript.fetchTranscript('${videoId}');
          console.log(JSON.stringify(transcript));
        } catch (error) {
          console.error('Error fetching transcript:', error.message);
          process.exit(1);
        }
      }
      
      getTranscript();
    `;
    
    await fs.writeFile(scriptPath, scriptContent);
    
    // Execute the script
    const nodeProcess = spawn('node', [scriptPath]);
    
    let stdout = '';
    let stderr = '';
    
    nodeProcess.stdout.on('data', (data) => {
      stdout += data.toString();
    });
    
    nodeProcess.stderr.on('data', (data) => {
      stderr += data.toString();
    });
    
    // Wait for the process to complete
    await new Promise((resolve) => {
      nodeProcess.on('close', resolve);
    });
    
    // Clean up the temporary file
    await fs.unlink(scriptPath).catch(() => {});
    
    if (stderr) {
      console.error(`Error fetching YouTube transcript: ${stderr}`);
      return null;
    }
    
    // Parse the transcript
    try {
      const transcriptData = JSON.parse(stdout);
      
      // Format the transcript as text
      const transcriptText = transcriptData
        .map((item: any) => item.text)
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim();
      
      return transcriptText || null;
    } catch (error) {
      console.error('Error parsing transcript data:', error);
      return null;
    }
  } catch (error) {
    console.error(`Error fetching YouTube transcript for video ${videoId}:`, error);
    return null;
  }
}

/**
 * Extract content from YouTube URL by fetching the transcript
 */
export async function extractYouTubeContent(url: string): Promise<{ content: string; videoId?: string }> {
  try {
    // Extract video ID from URL
    const videoId = extractYouTubeVideoId(url);
    if (!videoId) {
      console.log(`Could not extract video ID from YouTube URL: ${url}`);
      return { content: '' };
    }
    
    // Fetch transcript
    const transcript = await fetchYouTubeTranscript(videoId);
    if (!transcript) {
      console.log(`No transcript available for YouTube video: ${videoId}`);
      return { content: '', videoId };
    }
    
    console.log(`Successfully fetched transcript for YouTube video ${videoId} (${transcript.length} chars)`);
    return { content: transcript, videoId };
  } catch (error) {
    console.error(`Error extracting content from YouTube URL ${url}:`, error);
    return { content: '' };
  }
}