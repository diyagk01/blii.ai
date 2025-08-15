import { ChatMessage } from '../config/supabase';

// Edge case types
export type EdgeCaseType = 
  | 'empty_file'
  | 'no_link_preview' 
  | 'no_image_content'
  | 'unsupported_pdf';

// Edge case message structure
export interface EdgeCaseMessage {
  type: EdgeCaseType;
  message: string;
  actions: EdgeCaseAction[];
}

// Action button structure
export interface EdgeCaseAction {
  id: string;
  label: string;
  icon: string;
  type: 'note' | 'tag' | 'reminder' | 'open' | 'organize' | 'view';
}

// Edge case messaging service
export class EdgeCaseMessagingService {
  private static instance: EdgeCaseMessagingService;

  public static getInstance(): EdgeCaseMessagingService {
    if (!EdgeCaseMessagingService.instance) {
      EdgeCaseMessagingService.instance = new EdgeCaseMessagingService();
    }
    return EdgeCaseMessagingService.instance;
  }

  /**
   * Detect edge cases from chat message data
   */
  detectEdgeCase(message: ChatMessage): EdgeCaseType | null {
    // Check for empty file content
    if (message.type === 'file' && this.isEmptyFile(message)) {
      return 'empty_file';
    }

    // Check for link with no preview
    if (message.type === 'link' && this.hasNoLinkPreview(message)) {
      return 'no_link_preview';
    }

    // Check for image with no extracted content
    if (message.type === 'image' && this.hasNoImageContent(message)) {
      return 'no_image_content';
    }

    // Check for unsupported PDF format
    if (message.type === 'file' && this.isUnsupportedPdf(message)) {
      return 'unsupported_pdf';
    }

    return null;
  }

  /**
   * Get AI message for specific edge case
   */
  getEdgeCaseMessage(edgeCase: EdgeCaseType): EdgeCaseMessage {
    switch (edgeCase) {
      case 'empty_file':
        return {
          type: 'empty_file',
          message: "Hmm, looks like this file is empty or unreadable right now. Want to tag it or add a quick note so it's easier to recall later?",
          actions: [
            { id: 'add_note', label: 'Add a note', icon: '📝', type: 'note' },
            { id: 'add_tag', label: 'Tag this', icon: '🔖', type: 'tag' },
            { id: 'open_anyway', label: 'Open anyway', icon: '👁️', type: 'open' }
          ]
        };

      case 'no_link_preview':
        return {
          type: 'no_link_preview',
          message: "Got it saved! I couldn't fetch details yet, but you can tag it or set a reminder to come back later.",
          actions: [
            { id: 'add_tag', label: 'Add tag', icon: '🔖', type: 'tag' },
            { id: 'set_reminder', label: 'Remind me', icon: '⏰', type: 'reminder' },
            { id: 'open_link', label: 'Open link', icon: '↗️', type: 'open' }
          ]
        };

      case 'no_image_content':
        return {
          type: 'no_image_content',
          message: "Image saved! I can't read what's in it just yet, but you could drop a note or a tag to remember why it mattered.",
          actions: [
            { id: 'add_note', label: 'Add a quick note', icon: '📝', type: 'note' },
            { id: 'add_tag', label: 'Tag this', icon: '🔖', type: 'tag' },
            { id: 'view_image', label: 'View image', icon: '👁️', type: 'view' }
          ]
        };

      case 'unsupported_pdf':
        return {
          type: 'unsupported_pdf',
          message: "Looks like this file got saved, but I couldn't pull anything from it yet. Want to organize it or add a reminder for later?",
          actions: [
            { id: 'organize', label: 'Organize', icon: '📂', type: 'organize' },
            { id: 'add_tag', label: 'Add tag', icon: '🔖', type: 'tag' },
            { id: 'set_reminder', label: 'Remind me later', icon: '⏰', type: 'reminder' }
          ]
        };

      default:
        return {
          type: edgeCase,
          message: "Something went wrong, but your content is safely saved.",
          actions: [
            { id: 'add_tag', label: 'Add tag', icon: '🔖', type: 'tag' },
            { id: 'open', label: 'Open', icon: '👁️', type: 'open' }
          ]
        };
    }
  }

  /**
   * Check if file is empty or unreadable
   */
  private isEmptyFile(message: ChatMessage): boolean {
    // Check extraction status
    if (message.extraction_status === 'failed') {
      return true;
    }

    // Check if file has no extracted content
    if (message.type === 'file' && 
        (!message.extracted_text || message.extracted_text.trim().length === 0) &&
        (!message.content || message.content.trim().length === 0 || message.content === 'Document shared')) {
      return true;
    }

    // Check file size (if available) - files under 100 bytes are likely empty
    if (message.file_size && message.file_size < 100) {
      return true;
    }

    return false;
  }

  /**
   * Check if link has no preview available
   */
  private hasNoLinkPreview(message: ChatMessage): boolean {
    // Check if link preview generation failed
    if (message.type === 'link') {
      // Check for generic placeholder content or failed extraction
      const hasGenericContent = message.content === 'Link shared' || 
                               message.content.includes('Content preview unavailable') ||
                               message.content.includes('Link from unknown');
      
      // Check if extracted content is minimal
      const hasMinimalExtraction = !message.extracted_text || 
                                  message.extracted_text.trim().length < 50;

      return hasGenericContent || hasMinimalExtraction;
    }

    return false;
  }

  /**
   * Check if image has no readable content
   */
  private hasNoImageContent(message: ChatMessage): boolean {
    if (message.type === 'image') {
      // Check if OCR or content analysis failed
      const hasNoExtractedText = !message.extracted_text || 
                                message.extracted_text.trim().length === 0;
      
      // Check if AI analysis is minimal or failed
      const hasMinimalAnalysis = !message.ai_analysis || 
                               message.ai_analysis.includes('failed') ||
                               message.ai_analysis.includes('error') ||
                               message.ai_analysis.length < 20;

      return hasNoExtractedText && hasMinimalAnalysis;
    }

    return false;
  }

  /**
   * Check if PDF is unsupported format or placeholder
   */
  private isUnsupportedPdf(message: ChatMessage): boolean {
    if (message.type === 'file' && 
        (message.filename?.toLowerCase().endsWith('.pdf') || 
         message.file_type?.toLowerCase().includes('pdf'))) {
      
      // Check extraction status
      if (message.extraction_status === 'failed' || 
          message.extraction_status === 'not_supported') {
        return true;
      }

      // Check for placeholder or fallback content
      const hasPlaceholderContent = message.extracted_text?.includes('Content extraction for this file type is not yet fully implemented') ||
                                   message.extracted_text?.includes('Fallback extraction used') ||
                                   message.content === 'Document shared';

      // Check for minimal extracted content
      const hasMinimalContent = !message.extracted_text || 
                               message.extracted_text.trim().length < 100;

      return hasPlaceholderContent || hasMinimalContent;
    }

    return false;
  }

  /**
   * Check if message has any edge case
   */
  hasEdgeCase(message: ChatMessage): boolean {
    return this.detectEdgeCase(message) !== null;
  }

  /**
   * Get all edge case messages for a list of messages
   */
  getEdgeCasesForMessages(messages: ChatMessage[]): Array<{message: ChatMessage, edgeCase: EdgeCaseMessage}> {
    const edgeCases: Array<{message: ChatMessage, edgeCase: EdgeCaseMessage}> = [];

    for (const message of messages) {
      const edgeCaseType = this.detectEdgeCase(message);
      if (edgeCaseType) {
        const edgeCaseMessage = this.getEdgeCaseMessage(edgeCaseType);
        edgeCases.push({
          message,
          edgeCase: edgeCaseMessage
        });
      }
    }

    return edgeCases;
  }
}

export default EdgeCaseMessagingService;
