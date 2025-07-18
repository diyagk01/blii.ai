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
}

class FastImageAnalyzer {
  private static instance: FastImageAnalyzer;
  private openai: OpenAI;

  private constructor() {
    this.openai = new OpenAI({
      apiKey: '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',
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
      console.log('⚡ Starting superfast image analysis:', imageUrl);
      
      // Use optimized prompt for faster processing
      const completion = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini', // Fastest vision model
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: `Analyze this image in detail and provide:
1. Detailed description (2-3 sentences with specific details)
2. Main objects/subjects (4-6 items with descriptive details)
3. Dominant colors (3-4 specific colors)
4. Setting/environment details
5. Any visible text or writing
6. Plant/flower identification if applicable (species, characteristics)
7. Category (photo, document, screenshot, art, etc.)

Format as JSON:
{
  "description": "detailed description with specific visual elements",
  "objects": ["detailed object1", "detailed object2", "detailed object3"],
  "colors": ["specific color1", "specific color2", "specific color3"],
  "setting": "environment or setting description",
  "mood": "mood or atmosphere",
  "text": "any visible text or null",
  "plant_info": "plant identification and characteristics if applicable, or null",
  "category": "category"
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
        max_tokens: 400, // Increased for detailed analysis
        temperature: 0.3, // Lower temperature for consistency
      });

      const response = completion.choices[0]?.message?.content;
      if (!response) {
        throw new Error('No response from vision API');
      }

      // Parse JSON response
      let analysisData;
      try {
        // Clean the response to extract JSON
        const jsonMatch = response.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          analysisData = JSON.parse(jsonMatch[0]);
        } else {
          throw new Error('No JSON found in response');
        }
      } catch (parseError) {
        console.log('⚠️ JSON parse failed, using fallback parsing');
        // Fallback parsing if JSON is malformed
        analysisData = this.parseResponseFallback(response);
      }

      const processingTime = Date.now() - startTime;
      
      const result: FastImageAnalysis = {
        description: analysisData.description || 'Image analysis completed',
        objects: Array.isArray(analysisData.objects) ? analysisData.objects : [],
        colors: Array.isArray(analysisData.colors) ? analysisData.colors : [],
        setting: analysisData.setting || undefined,
        mood: analysisData.mood || 'neutral',
        text: analysisData.text || undefined,
        plant_info: analysisData.plant_info || undefined,
        category: analysisData.category || 'photo',
        confidence: 0.85, // Default confidence
        processingTime
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
      
      // Return basic fallback analysis
      return {
        description: 'Image uploaded - analysis unavailable',
        objects: [],
        colors: [],
        mood: 'unknown',
        category: 'photo',
        confidence: 0.1,
        processingTime
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

  // Generate smart tags from analysis
  generateTags(analysis: FastImageAnalysis): string[] {
    const tags: string[] = [];
    
    // Add category tag
    tags.push(analysis.category);
    
    // Add object tags (limit to 3 most relevant)
    if (analysis.objects.length > 0) {
      tags.push(...analysis.objects.slice(0, 3));
    }
    
    // Add color tags if distinctive
    if (analysis.colors.length > 0) {
      const colorTags = analysis.colors
        .filter(color => !['white', 'black', 'gray', 'grey'].includes(color.toLowerCase()))
        .slice(0, 2);
      tags.push(...colorTags);
    }
    
    // Add mood tag if not neutral
    if (analysis.mood && analysis.mood !== 'neutral' && analysis.mood !== 'unknown') {
      tags.push(analysis.mood);
    }
    
    // Add special tags based on category
    switch (analysis.category.toLowerCase()) {
      case 'document':
      case 'screenshot':
        tags.push('text', 'document');
        break;
      case 'art':
      case 'artwork':
        tags.push('creative', 'art');
        break;
      case 'photo':
        if (analysis.objects.some(obj => ['person', 'people', 'face'].includes(obj.toLowerCase()))) {
          tags.push('people');
        }
        if (analysis.objects.some(obj => ['food', 'meal', 'restaurant'].includes(obj.toLowerCase()))) {
          tags.push('food');
        }
        break;
    }
    
    // Clean and deduplicate tags
    return [...new Set(tags)]
      .map(tag => tag.toLowerCase().trim())
      .filter(tag => tag.length > 0 && tag.length <= 15)
      .slice(0, 5); // Limit to 5 tags
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
    try {
      console.log('🧪 Testing fast image analyzer...');
      
      // Use a test image URL (placeholder)
      const testUrl = 'https://via.placeholder.com/400x300/0066cc/ffffff?text=Test+Image';
      
      const analysis = await this.analyzeImageFast(testUrl);
      
      console.log('✅ Test analysis completed:', {
        processingTime: analysis.processingTime,
        description: analysis.description,
        objects: analysis.objects,
        category: analysis.category,
        confidence: analysis.confidence
      });
      
      const generatedDescription = this.generateDescription(analysis);
      const generatedTags = this.generateTags(analysis);
      
      console.log('📝 Generated description:', generatedDescription);
      console.log('🏷️ Generated tags:', generatedTags);
      
    } catch (error) {
      console.error('❌ Test failed:', error);
    }
  }
}

export default FastImageAnalyzer;
