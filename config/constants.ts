export const CONTENT_FILTERING_THEMES = [
  "violence",
  "hate",
  "self-harm",
  "sexual",
  "harassment",
  "illegal",
  "adult",
  "abuse",
  "bullying",
  "horoscopes",
  "gambling",
  "drugs",
  "religion"];

  // List of file extensions that should be skipped for text extraction
  export const NON_TEXT_EXTENSIONS = [
    // Images
    '.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp', '.svg', '.ico',
    // Documents
    '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx',
    // Audio/Video
    '.mp3', '.mp4', '.avi', '.mov', '.wmv', '.flv', '.wav', '.ogg', '.webm',
    // Archives
    '.zip', '.rar', '.tar', '.gz', '.7z',
    // Other
    '.exe', '.dmg', '.iso', '.apk', '.ipa'
  ];
  
  // List of domains that typically host non-text content
  export const NON_TEXT_DOMAINS = [
    'youtube.com', 'youtu.be',
    'vimeo.com',
    'dailymotion.com',
    'twitch.tv',
    'spotify.com',
    'soundcloud.com',
    'flickr.com',
    'imgur.com',
    'instagram.com',
    'tiktok.com',
    'pinterest.com',
    'drive.google.com',
    'docs.google.com',
    'slides.google.com',
    'sheets.google.com',
    'dropbox.com',
    'v.redd.it',
  ];
