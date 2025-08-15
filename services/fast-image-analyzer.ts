import OpenAI from 'openai';

interface FastImageAnalysis {
  description: string;
  objects: string[];
  colors: string[];
  setting?: string;
  mood: string;
  text?: string;
  plant_info?: string;
  category: string;
  confidence: number;
  processingTime: number;
  content_tags?: string[]; // New field for content-relevant tags
}

class FastImageAnalyzer {
  private static instance: FastImageAnalyzer;
  private openai: OpenAI;

  private constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENROUTER_API_KEY || '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',
      baseURL: 'https://openrouter.ai/api/v1',
      defaultHeaders: {
        'HTTP-Referer': 'https://blii.app',
        'X-Title': 'Blii Chat App',
      },
    });
  }

  public static getInstance(): FastImageAnalyzer {
    if (!FastImageAnalyzer.instance) {
      FastImageAnalyzer.instance = new FastImageAnalyzer();
    }
    return FastImageAnalyzer.instance;
  }

  // Superfast image analysis optimized for speed and accuracy
  async analyzeImageFast(imageUrl: string): Promise<FastImageAnalysis> {
    const startTime = Date.now();
    
    try {
      console.log('⚡ Starting Claude 3.5 Sonnet image analysis:', imageUrl);
      
      // Create a timeout promise
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Analysis timeout - taking too long')), 20000); // 20 second timeout
      });
      
      // Use Claude 3.5 Sonnet with speed optimizations
      const analysisPromise = this.openai.chat.completions.create({
        model: 'anthropic/claude-3.5-sonnet', // Claude 3.5 Sonnet for better image analysis
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: `Analyze this image quickly and provide:
1. Brief description (1-2 sentences)
2. Main objects (3-4 items with descriptive details)
3. Dominant colors (2-3 colors)
4. Setting/environment
5. Any visible text
6. Category (photo, document, screenshot, art)
7. Content-relevant tags (3-5 tags that describe the main content/subject)

Format as JSON:
{
  "description": "brief description",
  "objects": ["detailed object1", "detailed object2", "detailed object3"],
  "colors": ["color1", "color2"],
  "setting": "environment",
  "mood": "mood",
  "text": "visible text or null",
  "plant_info": "plant info or null",
  "category": "category",
  "content_tags": ["relevant tag1", "relevant tag2", "relevant tag3"]
}`
              },
              {
                type: 'image_url',
                image_url: {
                  url: imageUrl,
                  detail: 'low' // Use low detail for faster processing
                }
              }
            ]
          }
        ],
        max_tokens: 300, // Reduced for faster response
        temperature: 0.1, // Lower temperature for consistency and speed
      });

      // Race between analysis and timeout
      const completion = await Promise.race([analysisPromise, timeoutPromise]) as any;

      const response = completion.choices[0]?.message?.content;
      if (!response) {
        throw new Error('No response from Claude 3.5 Sonnet API');
      }

      // Parse JSON response
      let analysisData = null;
      try {
        // Clean the response to extract JSON
        const jsonMatch = response.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          analysisData = JSON.parse(jsonMatch[0]);
        } else {
          // Try fallback parsing if no JSON structure found
          analysisData = this.parseResponseFallback(response);
          console.log('✅ Used fallback parsing for primary response');
        }
      } catch (parseError) {
        console.warn('❌ Failed to parse Claude 3.5 Sonnet response, trying fallback...');
        
        // Fallback to GPT-4o-mini for speed
        try {
          console.log('🔄 Falling back to GPT-4o-mini for faster analysis...');
          const fallbackCompletion = await this.openai.chat.completions.create({
            model: 'gpt-4o-mini',
            messages: [
              {
                role: 'user',
                content: [
                  {
                    type: 'text',
                    text: `Analyze this image quickly and provide:
1. Brief description (1-2 sentences)
2. Main objects (3-4 items with descriptive details)
3. Dominant colors (2-3 colors)
4. Setting/environment
5. Any visible text
6. Category (photo, document, screenshot, art)
7. Content-relevant tags (3-5 tags that describe the main content/subject)

Format as JSON:
{
  "description": "brief description",
  "objects": ["detailed object1", "detailed object2", "detailed object3"],
  "colors": ["color1", "color2"],
  "setting": "environment",
  "mood": "mood",
  "text": "visible text or null",
  "plant_info": "plant info or null",
  "category": "category",
  "content_tags": ["relevant tag1", "relevant tag2", "relevant tag3"]
}`
                  },
                  {
                    type: 'image_url',
                    image_url: {
                      url: imageUrl,
                      detail: 'low'
                    }
                  }
                ]
              }
            ],
            max_tokens: 250,
            temperature: 0.1,
          });
          
          const fallbackResponse = fallbackCompletion.choices[0]?.message?.content;
          if (fallbackResponse) {
            const jsonMatch = fallbackResponse.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
              analysisData = JSON.parse(jsonMatch[0]);
              console.log('✅ Fallback to GPT-4o-mini successful');
            } else {
              analysisData = this.parseResponseFallback(fallbackResponse);
              console.log('✅ Fallback to manual parsing successful');
            }
          } else {
            throw new Error('No fallback response');
          }
        } catch (fallbackError) {
          console.error('❌ Fallback also failed:', fallbackError);
          throw new Error('Both Claude 3.5 Sonnet and fallback failed');
        }
      }

      const processingTime = Date.now() - startTime;
      
      // Ensure analysisData is an object
      const safeAnalysisData = analysisData || {};
      
      const result: FastImageAnalysis = {
        description: safeAnalysisData.description || 'Image analysis completed',
        objects: Array.isArray(safeAnalysisData.objects) ? safeAnalysisData.objects : [],
        colors: Array.isArray(safeAnalysisData.colors) ? safeAnalysisData.colors : [],
        setting: safeAnalysisData.setting || undefined,
        mood: safeAnalysisData.mood || 'neutral',
        text: safeAnalysisData.text || undefined,
        plant_info: safeAnalysisData.plant_info || undefined,
        category: safeAnalysisData.category || 'photo',
        confidence: 0.85, // Default confidence
        processingTime,
        content_tags: Array.isArray(safeAnalysisData.content_tags) ? safeAnalysisData.content_tags : undefined
      };

      console.log(`⚡ Fast image analysis completed in ${processingTime}ms:`, {
        description: result.description.substring(0, 50) + '...',
        objects: result.objects.length,
        category: result.category
      });

      return result;
    } catch (error) {
      console.error('❌ Fast image analysis failed:', error);
      
      const processingTime = Date.now() - startTime;
      
      // Return enhanced fallback analysis with useful default tags
      return {
        description: 'Image uploaded successfully',
        objects: ['image'],
        colors: ['unknown'],
        mood: 'neutral',
        category: 'photo',
        confidence: 0.1,
        processingTime,
        content_tags: ['📷 Photo', 'Uploaded']
      };
    }
  }

  // Fallback parsing for malformed JSON responses
  private parseResponseFallback(response: string): any {
    const result: any = {};
    
    // Extract description
    const descMatch = response.match(/description['":\s]*["']([^"']+)["']/i);
    result.description = descMatch ? descMatch[1] : 'Image analyzed';
    
    // Extract objects
    const objectsMatch = response.match(/objects['":\s]*\[([^\]]+)\]/i);
    if (objectsMatch) {
      result.objects = objectsMatch[1]
        .split(',')
        .map(obj => obj.trim().replace(/['"]/g, ''))
        .filter(obj => obj.length > 0);
    } else {
      result.objects = [];
    }
    
    // Extract colors
    const colorsMatch = response.match(/colors['":\s]*\[([^\]]+)\]/i);
    if (colorsMatch) {
      result.colors = colorsMatch[1]
        .split(',')
        .map(color => color.trim().replace(/['"]/g, ''))
        .filter(color => color.length > 0);
    } else {
      result.colors = [];
    }
    
    // Extract mood
    const moodMatch = response.match(/mood['":\s]*["']([^"']+)["']/i);
    result.mood = moodMatch ? moodMatch[1] : 'neutral';
    
    // Extract category
    const categoryMatch = response.match(/category['":\s]*["']([^"']+)["']/i);
    result.category = categoryMatch ? categoryMatch[1] : 'photo';
    
    // Extract text
    const textMatch = response.match(/text['":\s]*["']([^"']+)["']/i);
    result.text = textMatch ? textMatch[1] : null;
    
    // Extract content_tags
    const contentTagsMatch = response.match(/content_tags['":\s]*\[([^\]]+)\]/i);
    if (contentTagsMatch) {
      result.content_tags = contentTagsMatch[1]
        .split(',')
        .map(tag => tag.trim().replace(/['"]/g, ''))
        .filter(tag => tag.length > 0);
    } else {
      result.content_tags = [];
    }
    
    return result;
  }

  // Generate a comprehensive description from analysis
  generateDescription(analysis: FastImageAnalysis): string {
    let description = analysis.description;
    
    if (analysis.setting) {
      description += ` Setting: ${analysis.setting}.`;
    }
    
    if (analysis.objects.length > 0) {
      description += ` Contains: ${analysis.objects.join(', ')}.`;
    }
    
    if (analysis.colors.length > 0) {
      description += ` Colors: ${analysis.colors.join(', ')}.`;
    }
    
    if (analysis.plant_info) {
      description += ` Plant identification: ${analysis.plant_info}.`;
    }
    
    if (analysis.mood && analysis.mood !== 'neutral') {
      description += ` Mood: ${analysis.mood}.`;
    }
    
    if (analysis.text) {
      description += ` Text visible: "${analysis.text}".`;
    }
    
    description += ` Category: ${analysis.category}.`;
    
    return description;
  }

  // Generate smart tags from analysis with enhanced content relevance - returns exactly 1 tag
  generateTags(analysis: FastImageAnalysis): string[] {
    // Priority order for selecting the single most relevant tag
    const tagCandidates: string[] = [];
    
    // 1. Prioritize specific content-relevant tags from AI analysis
    if (analysis.content_tags && analysis.content_tags.length > 0) {
      tagCandidates.push(...analysis.content_tags);
    }
    
    // 2. Smart category-based tagging with proper capitalization
    const categoryTag = this.getCategorizedTag(analysis);
    if (categoryTag) {
      tagCandidates.push(categoryTag);
    }
    
    // 3. Most prominent object if highly relevant
    if (analysis.objects.length > 0) {
      const relevantObjects = analysis.objects.filter(obj => 
        !['object', 'thing', 'item', 'background'].includes(obj.toLowerCase())
      );
      if (relevantObjects.length > 0) {
        tagCandidates.push(relevantObjects[0]);
      }
    }
    
    // 4. Fallback to category
    if (analysis.category && analysis.category !== 'unknown') {
      tagCandidates.push(analysis.category);
    }
    
    // Select the best tag and format it properly
    let bestTag = tagCandidates.length > 0 ? tagCandidates[0] : 'Image';
    
    // Clean and format the tag with proper capitalization
    bestTag = this.formatTagProperly(bestTag);
    
    // Ensure the tag meets quality criteria
    if (!bestTag || bestTag.length === 0 || bestTag.length > 20) {
      bestTag = 'Image';
    }
    
    return [bestTag]; // Always return exactly 1 tag
  }

  // Get a smart categorized tag with proper naming
  private getCategorizedTag(analysis: FastImageAnalysis): string | null {
    const category = analysis.category?.toLowerCase();
    const objects = analysis.objects.map(obj => obj.toLowerCase());
    const description = analysis.description?.toLowerCase() || '';
    
    // Smart category mapping with specific, useful tags
    switch (category) {
      case 'document':
      case 'screenshot':
        if (description.includes('code') || description.includes('programming')) return 'Code Screenshot';
        if (description.includes('text') || description.includes('document')) return 'Document';
        return 'Screenshot';
        
      case 'food':
        if (objects.some(obj => ['dessert', 'cake', 'sweet'].includes(obj))) return 'Dessert';
        if (objects.some(obj => ['drink', 'beverage', 'coffee', 'tea'].includes(obj))) return 'Beverage';
        return 'Food';
        
      case 'nature':
        if (objects.some(obj => ['flower', 'plant', 'garden'].includes(obj))) return 'Plants';
        if (objects.some(obj => ['mountain', 'landscape', 'scenery'].includes(obj))) return 'Landscape';
        if (objects.some(obj => ['animal', 'bird', 'wildlife'].includes(obj))) return 'Wildlife';
        return 'Nature';
        
      case 'people':
      case 'person':
        if (objects.some(obj => ['selfie', 'portrait'].includes(obj))) return 'Portrait';
        if (objects.some(obj => ['group', 'family', 'friends'].includes(obj))) return 'People';
        return 'Portrait';
        
      case 'art':
      case 'artwork':
        return 'Art';
        
      case 'technology':
      case 'tech':
        if (objects.some(obj => ['phone', 'mobile', 'smartphone'].includes(obj))) return 'Mobile Tech';
        if (objects.some(obj => ['computer', 'laptop', 'screen'].includes(obj))) return 'Computing';
        return 'Technology';
        
      case 'vehicle':
      case 'transportation':
        if (objects.some(obj => ['car', 'automobile'].includes(obj))) return 'Automotive';
        if (objects.some(obj => ['plane', 'aircraft'].includes(obj))) return 'Aviation';
        return 'Transportation';
        
      case 'indoor':
        if (objects.some(obj => ['kitchen', 'cooking'].includes(obj))) return 'Kitchen';
        if (objects.some(obj => ['bedroom', 'bed'].includes(obj))) return 'Bedroom';
        if (objects.some(obj => ['office', 'desk', 'work'].includes(obj))) return 'Workspace';
        return 'Interior';
        
      case 'outdoor':
        if (objects.some(obj => ['building', 'architecture'].includes(obj))) return 'Architecture';
        if (objects.some(obj => ['street', 'city', 'urban'].includes(obj))) return 'Urban';
        return 'Outdoor';
        
      default:
        return null;
    }
  }

  // Format tag with proper capitalization and cleanup
  private formatTagProperly(tag: string): string {
    return tag
      .toLowerCase()
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ')
      .trim();
  }

  // Batch analyze multiple images (for future use)
  async analyzeImagesBatch(imageUrls: string[]): Promise<FastImageAnalysis[]> {
    console.log(`⚡ Starting batch analysis of ${imageUrls.length} images`);
    
    const results = await Promise.allSettled(
      imageUrls.map(url => this.analyzeImageFast(url))
    );
    
    return results.map((result, index) => {
      if (result.status === 'fulfilled') {
        return result.value;
      } else {
        console.error(`❌ Batch analysis failed for image ${index}:`, result.reason);
        return {
          description: 'Batch analysis failed',
          objects: [],
          colors: [],
          mood: 'unknown',
          category: 'photo',
          confidence: 0.1,
          processingTime: 0
        };
      }
    });
  }

  // Test the analyzer with a sample image
  async testAnalyzer(): Promise<void> {
    console.log('🧪 Testing Claude 3.5 Sonnet image analyzer...');
    
    try {
      // Test with a sample image
      const testImageUrl = 'https://upload.wikimedia.org/wikipedia/commons/thumb/d/dd/Gfp-wisconsin-madison-the-nature-boardwalk.jpg/2560px-Gfp-wisconsin-madison-the-nature-boardwalk.jpg';
      
      const analysis = await this.analyzeImageFast(testImageUrl);
      
      console.log('✅ Claude 3.5 Sonnet Analysis Results:');
      console.log('📝 Description:', analysis.description);
      console.log('🏷️ Objects:', analysis.objects);
      console.log('🎨 Colors:', analysis.colors);
      console.log('📍 Setting:', analysis.setting);
      console.log('😊 Mood:', analysis.mood);
      console.log('📄 Text:', analysis.text);
      console.log('🌱 Plant Info:', analysis.plant_info);
      console.log('📂 Category:', analysis.category);
      console.log('⚡ Processing Time:', analysis.processingTime + 'ms');
      console.log('🎯 Confidence:', analysis.confidence);
      
      // Test description and tag generation
      const description = this.generateDescription(analysis);
      const tags = this.generateTags(analysis);
      
      console.log('📝 Generated Description:', description);
      console.log('🏷️ Generated Tags:', tags);
      
    } catch (error) {
      console.error('❌ Test failed:', error);
    }
  }

  // Test database storage of image analysis
  async testDatabaseStorage(): Promise<void> {
    console.log('🗄️ Testing database storage of image analysis...');
    
    try {
      const ChatService = await import('./chat');
      const chatService = ChatService.default.getInstance();
      
      // Test with a sample image
      const testImageUrl = 'https://upload.wikimedia.org/wikipedia/commons/thumb/d/dd/Gfp-wisconsin-madison-the-nature-boardwalk.jpg/2560px-Gfp-wisconsin-madison-the-nature-boardwalk.jpg';
      
      // Analyze the image
      const analysis = await this.analyzeImageFast(testImageUrl);
      const description = this.generateDescription(analysis);
      const tags = this.generateTags(analysis);
      
      console.log('📊 Analysis completed, testing database storage...');
      
      // Save to database with analysis
      const savedMessage = await chatService.saveMessageWithContentExtraction(
        description,
        'image',
        {
          fileUrl: testImageUrl,
          tags: tags,
          fileType: 'image/jpeg',
          fileSize: 1024 * 1024, // 1MB placeholder
        }
      );
      
      console.log('✅ Message saved to database with ID:', savedMessage.id);
      console.log('📝 Stored description:', savedMessage.content);
      console.log('🏷️ Stored tags:', savedMessage.tags);
      
      // Verify the message can be retrieved
      const retrievedMessage = await chatService.getMessage(savedMessage.id);
      if (retrievedMessage) {
        console.log('✅ Message successfully retrieved from database');
        console.log('📝 Retrieved description:', retrievedMessage.content);
        console.log('🏷️ Retrieved tags:', retrievedMessage.tags);
      } else {
        console.error('❌ Failed to retrieve message from database');
      }
      
    } catch (error) {
      console.error('❌ Database storage test failed:', error);
    }
  }
}

export default FastImageAnalyzer;
