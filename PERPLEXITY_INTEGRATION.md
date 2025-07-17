# Perplexity/Sonar Integration for Real-Time Link Reading

## Overview

The app now uses **Perplexity/Sonar** via OpenRouter to provide real-time link reading and content extraction. This replaces the previous static link previews with dynamic, AI-powered content analysis.

## What's New

### 🔗 Real-Time Link Reading
- **Perplexity/Sonar Model**: Uses `perplexity/sonar` via OpenRouter
- **Dynamic Content Extraction**: Reads actual content from URLs in real-time
- **Rich Metadata**: Extracts titles, summaries, key points, authors, and publication dates
- **Content Type Detection**: Automatically categorizes links as articles, videos, documents, social media, etc.

### 🧠 Enhanced AI Context
- **Real-Time Research**: Automatically searches for current information when needed
- **Database Integration**: Combines stored content with live web data
- **Smart Query Detection**: Identifies when real-time information is required

## How It Works

### 1. Link Processing Flow
```
User sends link → Perplexity extracts content → Store in database → Generate AI context
```

### 2. Content Extraction
- **URL Analysis**: Perplexity reads and analyzes the actual webpage content
- **Metadata Extraction**: Title, summary, key points, author, date
- **Content Storage**: Extracted content is stored for future AI analysis
- **Preview Generation**: Dynamic previews based on actual content

### 3. AI Enhancement
- **Real-Time Queries**: Detects when users ask for current information
- **Perplexity Search**: Searches for latest data on topics
- **Context Combination**: Merges stored content with live web data
- **Enhanced Responses**: More accurate and up-to-date AI responses

## Key Features

### 📄 Content Types Supported
- **Articles**: News, blog posts, documentation
- **Videos**: YouTube, Vimeo, video content
- **Documents**: PDFs, presentations, reports
- **Social Media**: Twitter, LinkedIn, Reddit posts
- **General Web**: Any accessible webpage

### 🔍 Smart Features
- **Automatic Fallbacks**: Graceful degradation if Perplexity fails
- **Content Caching**: Stores extracted content for offline access
- **Type Detection**: Automatically categorizes content types
- **Rich Previews**: Dynamic preview images based on content type

### 🧠 AI Integration
- **Context-Aware**: Uses extracted content for better AI responses
- **Real-Time Research**: Automatically searches when needed
- **Smart Keywords**: Detects queries requiring current information
- **Enhanced Responses**: More accurate and helpful AI assistance

## Technical Implementation

### Services
- **`services/perplexity.ts`**: Main Perplexity integration service
- **`services/content-extractor.ts`**: Updated to use Perplexity
- **`services/openai.ts`**: Enhanced with real-time search capabilities
- **`services/chat.ts`**: Updated link processing with Perplexity

### Key Methods
```typescript
// Extract content from URL
await perplexityService.extractLinkContent(url)

// Search for real-time information
await perplexityService.searchTopic(query)

// Analyze multiple links
await perplexityService.analyzeMultipleLinks(urls)
```

### Configuration
- **Model**: `perplexity/sonar`
- **Provider**: OpenRouter
- **API Key**: Same as existing OpenAI integration
- **Headers**: Proper attribution for Blii app

## Benefits

### For Users
- **Real Content**: See actual article titles and summaries
- **Better Organization**: Content is properly categorized
- **Enhanced AI**: More accurate and helpful responses
- **Current Information**: Access to latest data when needed

### For Developers
- **Reliable Extraction**: No more CORS issues or scraping failures
- **Rich Data**: Comprehensive content metadata
- **Scalable**: Handles any accessible URL
- **Maintainable**: Clean, modular implementation

## Usage Examples

### Link Processing
```typescript
// User sends: "https://techcrunch.com/2024/01/15/ai-startup-funding"
// Perplexity extracts:
{
  title: "AI Startup Raises $50M in Series B Funding",
  summary: "TechCrunch reports on latest AI funding round...",
  keyPoints: ["$50M funding", "Series B round", "AI focus"],
  author: "John Smith",
  publishDate: "2024-01-15",
  domain: "techcrunch.com",
  type: "article"
}
```

### Real-Time Queries
```typescript
// User asks: "What's the latest news about AI?"
// System detects real-time query and searches Perplexity
// Combines stored content with current information
// Provides comprehensive, up-to-date response
```

## Error Handling

### Graceful Degradation
- **Perplexity Fails**: Falls back to basic domain-based previews
- **Network Issues**: Uses cached content when available
- **Rate Limits**: Implements proper retry logic
- **Invalid URLs**: Provides helpful error messages

### Monitoring
- **Console Logging**: Detailed logs for debugging
- **Error Tracking**: Comprehensive error handling
- **Performance**: Monitors extraction times
- **Success Rates**: Tracks successful extractions

## Future Enhancements

### Planned Features
- **Batch Processing**: Analyze multiple links simultaneously
- **Content Summaries**: Generate AI-powered summaries
- **Trend Analysis**: Identify content trends over time
- **Smart Tagging**: Automatic tag suggestions based on content
- **Content Recommendations**: Suggest related content

### Performance Optimizations
- **Caching**: Cache frequently accessed content
- **Parallel Processing**: Extract multiple links simultaneously
- **Smart Retries**: Intelligent retry strategies
- **Content Compression**: Optimize storage of extracted content

## Troubleshooting

### Common Issues
1. **Perplexity API Errors**: Check OpenRouter API key and quotas
2. **Content Extraction Fails**: Verify URL accessibility
3. **Slow Performance**: Monitor network connectivity
4. **Memory Issues**: Check content storage limits

### Debug Commands
```bash
# Check Perplexity service
console.log('Perplexity extraction status:', analysis)

# Monitor content extraction
console.log('Content extraction stats:', stats)

# Debug real-time queries
console.log('Real-time query detected:', requiresRealTimeInfo)
```

## Conclusion

The Perplexity/Sonar integration transforms the app from a simple content storage tool into a powerful, real-time content analysis platform. Users now get:

- **Real content previews** instead of static placeholders
- **Current information** when asking about recent topics
- **Better AI responses** with enhanced context
- **Improved organization** with automatic content categorization

This integration significantly enhances the user experience while providing a solid foundation for future AI-powered features. 