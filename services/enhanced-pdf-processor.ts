import OpenAI from 'openai';
import ChatService from './chat';
import { contentExtractor } from './content-extractor';
import SupabaseAuthService from './supabase-auth';

interface PDFChunk {
  id: string;
  content: string;
  pageNumber?: number;
  startIndex: number;
  endIndex: number;
  metadata: {
    wordCount: number;
    characterCount: number;
    chunkIndex: number;
    totalChunks: number;
  };
}

interface ProcessedPDF {
  id: string;
  title: string;
  filename: string;
  fullText: string;
  chunks: PDFChunk[];
  summary: string;
  keyPoints: string[];
  topics: string[];
  metadata: {
    totalWords: number;
    totalPages: number;
    processingTime: number;
    extractionConfidence: number;
  };
}

interface PDFSearchResult {
  relevantChunks: PDFChunk[];
  confidence: number;
  summary: string;
  directAnswer?: string;
}

class EnhancedPDFProcessor {
  private static instance: EnhancedPDFProcessor;
  private openai: OpenAI;
  private authService = SupabaseAuthService.getInstance();
  private chatService = ChatService.getInstance();
  
  // Configuration
  private readonly CHUNK_SIZE = 2000; // Characters per chunk
  private readonly OVERLAP_SIZE = 200; // Character overlap between chunks
  private readonly MAX_CHUNKS_FOR_ANSWER = 5; // Max chunks to use for answering

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

  public static getInstance(): EnhancedPDFProcessor {
    if (!EnhancedPDFProcessor.instance) {
      EnhancedPDFProcessor.instance = new EnhancedPDFProcessor();
    }
    return EnhancedPDFProcessor.instance;
  }

  /**
   * Process a PDF with enhanced extraction and chunking
   */
  async processPDFWithEnhancement(
    fileUrl: string, 
    filename: string,
    messageId?: string
  ): Promise<ProcessedPDF> {
    try {
      console.log('📄 Processing PDF with enhanced extraction:', filename);
      const startTime = Date.now();

      // Step 1: Extract content using existing Docling service
      const extractedContent = await contentExtractor.extractPDFContent(fileUrl, filename);
      
      if (!extractedContent.content || extractedContent.content.length < 100) {
        throw new Error('PDF extraction failed or content too short');
      }

      // Step 2: Clean and prepare the text
      const cleanedText = this.cleanExtractedText(extractedContent.content);
      
      // Step 3: Create intelligent chunks
      const chunks = this.createIntelligentChunks(cleanedText, filename);
      
      // Step 4: Generate summary and key points
      const summary = await this.generatePDFSummary(cleanedText, filename);
      const keyPoints = await this.extractKeyPoints(cleanedText);
      const topics = await this.extractTopics(cleanedText);

      const processedPDF: ProcessedPDF = {
        id: messageId || `pdf_${Date.now()}`,
        title: extractedContent.title || filename.replace('.pdf', ''),
        filename,
        fullText: cleanedText,
        chunks,
        summary,
        keyPoints,
        topics,
        metadata: {
          totalWords: cleanedText.split(' ').length,
          totalPages: extractedContent.metadata?.page_count || 0,
          processingTime: Date.now() - startTime,
          extractionConfidence: extractedContent.metadata?.confidence || 0.95
        }
      };

      console.log('✅ PDF processing completed:', {
        title: processedPDF.title,
        chunks: chunks.length,
        totalWords: processedPDF.metadata.totalWords,
        processingTime: processedPDF.metadata.processingTime
      });

      return processedPDF;
    } catch (error) {
      console.error('❌ Enhanced PDF processing failed:', error);
      throw error;
    }
  }

  /**
   * Clean extracted text for better processing
   */
  private cleanExtractedText(rawText: string): string {
    return rawText
      // Remove excessive whitespace and newlines
      .replace(/\s+/g, ' ')
      // Remove page headers/footers (common patterns)
      .replace(/Page \d+ of \d+/gi, '')
      .replace(/^\d+$/gm, '') // Remove standalone page numbers
      // Clean up markdown artifacts
      .replace(/#{1,6}\s*/g, '') // Remove markdown headers
      .replace(/\*{1,2}([^*]+)\*{1,2}/g, '$1') // Remove bold/italic markdown
      // Remove URLs and email patterns that might be noise
      .replace(/https?:\/\/[^\s]+/g, '[URL]')
      .replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, '[EMAIL]')
      // Clean up and normalize
      .trim();
  }

  /**
   * Create intelligent chunks that respect sentence boundaries
   */
  private createIntelligentChunks(text: string, filename: string): PDFChunk[] {
    const chunks: PDFChunk[] = [];
    const sentences = this.splitIntoSentences(text);
    
    let currentChunk = '';
    let currentStartIndex = 0;
    let chunkIndex = 0;

    for (let i = 0; i < sentences.length; i++) {
      const sentence = sentences[i];
      const potentialChunk = currentChunk + (currentChunk ? ' ' : '') + sentence;

      // If adding this sentence would exceed chunk size, save current chunk
      if (potentialChunk.length > this.CHUNK_SIZE && currentChunk.length > 0) {
        chunks.push(this.createChunk(
          currentChunk,
          chunkIndex,
          currentStartIndex,
          currentStartIndex + currentChunk.length,
          filename
        ));

        // Start new chunk with overlap
        const overlapText = this.getOverlapText(currentChunk);
        currentChunk = overlapText + (overlapText ? ' ' : '') + sentence;
        currentStartIndex = currentStartIndex + currentChunk.length - overlapText.length;
        chunkIndex++;
      } else {
        currentChunk = potentialChunk;
      }
    }

    // Add the last chunk if it has content
    if (currentChunk.trim().length > 0) {
      chunks.push(this.createChunk(
        currentChunk,
        chunkIndex,
        currentStartIndex,
        currentStartIndex + currentChunk.length,
        filename
      ));
    }

    // Update total chunks count in metadata
    chunks.forEach(chunk => {
      chunk.metadata.totalChunks = chunks.length;
    });

    return chunks;
  }

  /**
   * Split text into sentences more intelligently
   */
  private splitIntoSentences(text: string): string[] {
    // Split on sentence boundaries, handling common abbreviations
    return text
      .replace(/([.!?])\s+/g, '$1|SPLIT|')
      .split('|SPLIT|')
      .map(s => s.trim())
      .filter(s => s.length > 0);
  }

  /**
   * Get overlap text from the end of current chunk
   */
  private getOverlapText(text: string): string {
    if (text.length <= this.OVERLAP_SIZE) return text;
    
    const overlapStart = text.length - this.OVERLAP_SIZE;
    const overlap = text.substring(overlapStart);
    
    // Find the last complete sentence in the overlap
    const lastSentenceEnd = Math.max(
      overlap.lastIndexOf('.'),
      overlap.lastIndexOf('!'),
      overlap.lastIndexOf('?')
    );
    
    if (lastSentenceEnd > 0) {
      return overlap.substring(lastSentenceEnd + 1).trim();
    }
    
    return overlap;
  }

  /**
   * Create a PDF chunk object
   */
  private createChunk(
    content: string,
    chunkIndex: number,
    startIndex: number,
    endIndex: number,
    filename: string
  ): PDFChunk {
    return {
      id: `${filename}_chunk_${chunkIndex}`,
      content: content.trim(),
      startIndex,
      endIndex,
      metadata: {
        wordCount: content.trim().split(' ').length,
        characterCount: content.trim().length,
        chunkIndex,
        totalChunks: 0 // Will be updated later
      }
    };
  }

  /**
   * Generate a comprehensive summary of the PDF
   */
  private async generatePDFSummary(text: string, filename: string): Promise<string> {
    try {
      // Use first 3000 characters for summary to avoid token limits
      const textForSummary = text.substring(0, 3000);
      
      const completion = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'You are a document analyst. Create a comprehensive but concise summary of the document. Focus on main themes, key information, and overall purpose. Keep it under 300 words.'
          },
          {
            role: 'user',
            content: `Summarize this document content from "${filename}":\n\n${textForSummary}`
          }
        ],
        max_tokens: 400,
        temperature: 0.3,
      });

      return completion.choices[0]?.message?.content || 'Summary generation failed';
    } catch (error) {
      console.error('❌ Error generating PDF summary:', error);
      return `Document: ${filename} - Summary unavailable due to processing error`;
    }
  }

  /**
   * Extract key points from the PDF
   */
  private async extractKeyPoints(text: string): Promise<string[]> {
    try {
      const textForAnalysis = text.substring(0, 4000);
      
      const completion = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'Extract 5-8 key points from the document. Each point should be a concise, important insight or fact. Return as a comma-separated list.'
          },
          {
            role: 'user',
            content: `Extract key points from:\n\n${textForAnalysis}`
          }
        ],
        max_tokens: 200,
        temperature: 0.2,
      });

      const response = completion.choices[0]?.message?.content || '';
      return response
        .split(',')
        .map(point => point.trim())
        .filter(point => point.length > 0)
        .slice(0, 8);
    } catch (error) {
      console.error('❌ Error extracting key points:', error);
      return [];
    }
  }

  /**
   * Extract main topics from the PDF
   */
  private async extractTopics(text: string): Promise<string[]> {
    try {
      const textForAnalysis = text.substring(0, 3000);
      
      const completion = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'Identify 3-6 main topics or themes in this document. Return only the topic names as a comma-separated list (e.g., "Data Science, Machine Learning, Python").'
          },
          {
            role: 'user',
            content: `Identify main topics in:\n\n${textForAnalysis}`
          }
        ],
        max_tokens: 100,
        temperature: 0.2,
      });

      const response = completion.choices[0]?.message?.content || '';
      return response
        .split(',')
        .map(topic => topic.trim())
        .filter(topic => topic.length > 0)
        .slice(0, 6);
    } catch (error) {
      console.error('❌ Error extracting topics:', error);
      return [];
    }
  }

  /**
   * Search for relevant content in a processed PDF
   */
  async searchInPDF(
    processedPDF: ProcessedPDF, 
    query: string
  ): Promise<PDFSearchResult> {
    try {
      console.log('🔍 Searching in PDF:', processedPDF.title, 'for query:', query);

      // Step 1: Find relevant chunks using keyword matching and semantic similarity
      const relevantChunks = await this.findRelevantChunks(processedPDF.chunks, query);
      
      // Step 2: If we have relevant chunks, generate a direct answer
      let directAnswer = undefined;
      if (relevantChunks.length > 0) {
        directAnswer = await this.generateDirectAnswer(relevantChunks, query, processedPDF.title);
      }

      // Step 3: Create search summary
      const summary = this.createSearchSummary(relevantChunks, query);

      return {
        relevantChunks: relevantChunks.slice(0, this.MAX_CHUNKS_FOR_ANSWER),
        confidence: this.calculateSearchConfidence(relevantChunks, query),
        summary,
        directAnswer
      };
    } catch (error) {
      console.error('❌ Error searching in PDF:', error);
      return {
        relevantChunks: [],
        confidence: 0,
        summary: 'Search failed'
      };
    }
  }

  /**
   * Find relevant chunks based on query
   */
  private async findRelevantChunks(chunks: PDFChunk[], query: string): Promise<PDFChunk[]> {
    const queryKeywords = this.extractQueryKeywords(query);
    
    // Score each chunk based on keyword relevance
    const scoredChunks = chunks.map(chunk => {
      let score = 0;
      const chunkLower = chunk.content.toLowerCase();
      
      queryKeywords.forEach(keyword => {
        const keywordLower = keyword.toLowerCase();
        // Count occurrences and give higher weight to exact matches
        const exactMatches = (chunkLower.match(new RegExp(keywordLower, 'g')) || []).length;
        score += exactMatches * 2;
        
        // Also check for partial matches
        if (chunkLower.includes(keywordLower)) {
          score += 1;
        }
      });
      
      return { chunk, score };
    });

    // Sort by score and return top chunks
    return scoredChunks
      .filter(item => item.score > 0)
      .sort((a, b) => b.score - a.score)
      .map(item => item.chunk)
      .slice(0, this.MAX_CHUNKS_FOR_ANSWER);
  }

  /**
   * Extract keywords from query
   */
  private extractQueryKeywords(query: string): string[] {
    return query
      .toLowerCase()
      .split(/\s+/)
      .filter(word => word.length > 2)
      .filter(word => !['the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'what', 'how', 'where', 'when', 'why', 'who', 'which'].includes(word));
  }

  /**
   * Generate a direct answer from relevant chunks
   */
  private async generateDirectAnswer(
    chunks: PDFChunk[], 
    query: string, 
    documentTitle: string
  ): Promise<string> {
    try {
      // Combine relevant chunks (limit total length to avoid token limits)
      const combinedContent = chunks
        .slice(0, 3) // Use top 3 most relevant chunks
        .map(chunk => chunk.content)
        .join('\n\n')
        .substring(0, 4000); // Limit to 4000 chars

      const completion = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `You are answering questions about the document "${documentTitle}". Use ONLY the provided content to answer. If the content doesn't contain the answer, say so. Be concise but comprehensive.`
          },
          {
            role: 'user',
            content: `Based on this content from "${documentTitle}", answer the question: "${query}"\n\nContent:\n${combinedContent}`
          }
        ],
        max_tokens: 300,
        temperature: 0.3,
      });

      return completion.choices[0]?.message?.content || 'Unable to generate answer from document content';
    } catch (error) {
      console.error('❌ Error generating direct answer:', error);
      return 'Answer generation failed';
    }
  }

  /**
   * Create search summary
   */
  private createSearchSummary(chunks: PDFChunk[], query: string): string {
    if (chunks.length === 0) {
      return `No relevant content found for "${query}"`;
    }

    const totalWords = chunks.reduce((sum, chunk) => sum + chunk.metadata.wordCount, 0);
    return `Found ${chunks.length} relevant sections (${totalWords} words) related to "${query}"`;
  }

  /**
   * Calculate search confidence score
   */
  private calculateSearchConfidence(chunks: PDFChunk[], query: string): number {
    if (chunks.length === 0) return 0;
    
    const queryKeywords = this.extractQueryKeywords(query);
    let totalMatches = 0;
    let possibleMatches = queryKeywords.length * chunks.length;

    chunks.forEach(chunk => {
      const chunkLower = chunk.content.toLowerCase();
      queryKeywords.forEach(keyword => {
        if (chunkLower.includes(keyword.toLowerCase())) {
          totalMatches++;
        }
      });
    });

    return Math.min(totalMatches / possibleMatches, 1.0);
  }

  /**
   * Answer questions about all user's PDFs
   */
  async answerQuestionAboutPDFs(query: string): Promise<string> {
    try {
      console.log('🔍 Answering question about all PDFs:', query);

      // Get all user's messages with PDF content
      const allMessages = await this.chatService.getUserMessages(100);
      const pdfMessages = allMessages.filter(msg => 
        msg.type === 'file' && 
        msg.filename?.toLowerCase().endsWith('.pdf') &&
        msg.extracted_text && 
        msg.extracted_text.length > 100
      );

      if (pdfMessages.length === 0) {
        return "I don't see any PDFs with extracted content in your saves. Try uploading some PDF documents first!";
      }

      console.log(`📄 Found ${pdfMessages.length} PDFs to search through`);

      // Search through each PDF and collect relevant information
      const allFindings: string[] = [];
      const relevantPDFs: string[] = [];
      
      for (const pdfMessage of pdfMessages.slice(0, 5)) { // Limit to 5 most recent PDFs
        try {
          // Create a temporary processed PDF object for searching
          const tempProcessedPDF: ProcessedPDF = {
            id: pdfMessage.id,
            title: pdfMessage.extracted_title || pdfMessage.filename || 'Untitled',
            filename: pdfMessage.filename || 'document.pdf',
            fullText: pdfMessage.extracted_text || '',
            chunks: this.createIntelligentChunks(pdfMessage.extracted_text || '', pdfMessage.filename || 'document.pdf'),
            summary: '',
            keyPoints: [],
            topics: [],
            metadata: {
              totalWords: pdfMessage.word_count || 0,
              totalPages: 0,
              processingTime: 0,
              extractionConfidence: 0.95
            }
          };

          const searchResult = await this.searchInPDF(tempProcessedPDF, query);
          
          if (searchResult.relevantChunks.length > 0 && searchResult.directAnswer) {
            allFindings.push(`From "${tempProcessedPDF.title}":\n${searchResult.directAnswer}`);
            relevantPDFs.push(tempProcessedPDF.title);
          }
        } catch (error) {
          console.error(`❌ Error searching PDF ${pdfMessage.filename}:`, error);
        }
      }

      // Combine findings into a comprehensive answer
      if (allFindings.length === 0) {
        return `I searched through your ${pdfMessages.length} PDF(s) but couldn't find specific information about "${query}". The content might not contain this information, or you might need to rephrase your question.`;
      }

      // Generate a consolidated answer with specific follow-ups
      const consolidatedAnswer = await this.consolidateFindingsWithFollowUps(allFindings, query, relevantPDFs, pdfMessages);
      
      return consolidatedAnswer;
    } catch (error) {
      console.error('❌ Error answering question about PDFs:', error);
      return 'Sorry, I encountered an error while searching your PDFs. Please try again.';
    }
  }

  /**
   * Consolidate findings from multiple PDFs with specific follow-ups
   */
  private async consolidateFindingsWithFollowUps(
    findings: string[], 
    query: string, 
    relevantPDFs: string[], 
    allPdfMessages: any[]
  ): Promise<string> {
    try {
      const combinedFindings = findings.join('\n\n---\n\n');
      
      const completion = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `You are consolidating information from multiple PDF documents. Create a comprehensive answer by combining the findings. 

IMPORTANT: End your response with ONE specific, actionable follow-up question based on the actual content found. Make it specific to what you just discussed, not generic.

Examples of GOOD follow-ups:
- "Want me to find more details about [specific topic from the documents]?"
- "Should I check your other PDFs for more information about [specific concept mentioned]?"
- "Need me to compare this with findings from your other research papers?"

Examples of BAD follow-ups (avoid these):
- "Want to dive deeper?"
- "Any other questions?"
- "Want more details?"

Base the follow-up on the actual content you referenced.`
          },
          {
            role: 'user',
            content: `Question: "${query}"\n\nFindings from documents:\n${combinedFindings}\n\nRelevant PDFs: ${relevantPDFs.join(', ')}\n\nProvide a consolidated answer with a specific follow-up:`
          }
        ],
        max_tokens: 400,
        temperature: 0.3,
      });

      let response = completion.choices[0]?.message?.content || findings.join('\n\n');
      
      // If the AI didn't provide a good follow-up, add one based on the content
      if (!response.includes('?') || response.includes('dive deeper') || response.includes('any other questions')) {
        response = this.addSpecificFollowUp(response, query, relevantPDFs, allPdfMessages);
      }

      return response;
    } catch (error) {
      console.error('❌ Error consolidating findings with follow-ups:', error);
      let basicResponse = findings.join('\n\n');
      return this.addSpecificFollowUp(basicResponse, query, relevantPDFs, allPdfMessages);
    }
  }

  /**
   * Add a specific follow-up based on the content found
   */
  private addSpecificFollowUp(
    response: string, 
    query: string, 
    relevantPDFs: string[], 
    allPdfMessages: any[]
  ): string {
    try {
      // Generate specific follow-ups based on the context
      const queryLower = query.toLowerCase();
      const totalPDFs = allPdfMessages.length;
      const searchedPDFs = relevantPDFs.length;
      
      let followUp = '';
      
      // Content-specific follow-ups
      if (queryLower.includes('summary') || queryLower.includes('summarize')) {
        followUp = `Want me to create a detailed comparison between these ${searchedPDFs} documents?`;
      } else if (queryLower.includes('finding') || queryLower.includes('result')) {
        followUp = `Should I look for similar findings in your other ${totalPDFs - searchedPDFs} PDFs?`;
      } else if (queryLower.includes('method') || queryLower.includes('approach')) {
        followUp = `Need me to find alternative methods mentioned in your other documents?`;
      } else if (queryLower.includes('data') || queryLower.includes('statistic')) {
        followUp = `Want me to search for more data points across your PDF collection?`;
      } else if (queryLower.includes('conclusion') || queryLower.includes('result')) {
        followUp = `Should I check if other PDFs have conflicting or supporting conclusions?`;
      } else if (queryLower.includes('definition') || queryLower.includes('what is')) {
        followUp = `Need me to find more detailed explanations in your other research papers?`;
      } else if (relevantPDFs.length > 1) {
        followUp = `Want me to highlight the key differences between these ${searchedPDFs} documents?`;
      } else if (totalPDFs > searchedPDFs) {
        const remainingPDFs = totalPDFs - searchedPDFs;
        followUp = `Should I search your other ${remainingPDFs} PDFs for related information?`;
      } else {
        // Default specific follow-up
        const firstPDFName = relevantPDFs[0] || 'document';
        followUp = `Want me to extract more specific details from "${firstPDFName}"?`;
      }
      
      // Add the follow-up to the response
      if (!response.trim().endsWith('?')) {
        response = response.trim() + '\n\n' + followUp;
      }
      
      return response;
    } catch (error) {
      console.error('❌ Error adding specific follow-up:', error);
      return response;
    }
  }

  /**
   * Consolidate findings from multiple PDFs (legacy method)
   */
  private async consolidateFindings(findings: string[], query: string): Promise<string> {
    try {
      const combinedFindings = findings.join('\n\n---\n\n');
      
      const completion = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'You are consolidating information from multiple documents. Create a comprehensive answer by combining the findings. Mention which documents the information comes from when relevant. Be concise but complete.'
          },
          {
            role: 'user',
            content: `Question: "${query}"\n\nFindings from documents:\n${combinedFindings}\n\nProvide a consolidated answer:`
          }
        ],
        max_tokens: 400,
        temperature: 0.3,
      });

      return completion.choices[0]?.message?.content || findings.join('\n\n');
    } catch (error) {
      console.error('❌ Error consolidating findings:', error);
      return findings.join('\n\n');
    }
  }
}

export default EnhancedPDFProcessor;
