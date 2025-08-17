#!/usr/bin/env python3
"""
Docling PDF Extraction Service
A simplified Python microservice using Docling for PDF text extraction
"""

import os
import sys
import logging
import tempfile
import gc
import shutil
from flask import Flask, request, jsonify
from flask_cors import CORS
import requests

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Initialize Flask app
app = Flask(__name__)
CORS(app)  # Enable CORS for React Native

# Set memory optimization for PyTorch if available
try:
    import torch
    torch.set_grad_enabled(False)  # Disable gradients for inference
    os.environ["PYTORCH_CUDA_ALLOC_CONF"] = "max_split_size_mb:64"
except ImportError:
    pass

# Set HuggingFace cache directory to a writable location
os.environ["HF_HOME"] = "/tmp/huggingface"
os.environ["TRANSFORMERS_CACHE"] = "/tmp/huggingface/transformers"
os.environ["HF_DATASETS_CACHE"] = "/tmp/huggingface/datasets"
os.environ["HF_HUB_CACHE"] = "/tmp/huggingface/hub"

# Create cache directories if they don't exist
os.makedirs("/tmp/huggingface", exist_ok=True)
os.makedirs("/tmp/huggingface/transformers", exist_ok=True)
os.makedirs("/tmp/huggingface/datasets", exist_ok=True)
os.makedirs("/tmp/huggingface/hub", exist_ok=True)

# Lazy loading for Docling converter to reduce memory usage
_converter = None
_converter_error = None

def extract_text_with_pymupdf(pdf_path):
    """Extract text from PDF using PyMuPDF"""
    try:
        import fitz  # PyMuPDF
        
        doc = fitz.open(pdf_path)
        text_content = ""
        
        for page_num in range(len(doc)):
            page = doc.load_page(page_num)
            text_content += page.get_text()
        
        doc.close()
        return text_content
        
    except Exception as e:
        logger.error(f"PyMuPDF extraction failed: {e}")
        raise e

def extract_text_with_pypdf2(pdf_path):
    """Extract text from PDF using PyPDF2"""
    try:
        from PyPDF2 import PdfReader
        
        reader = PdfReader(pdf_path)
        text_content = ""
        
        for page in reader.pages:
            text_content += page.extract_text() + "\n"
        
        return text_content
        
    except Exception as e:
        logger.error(f"PyPDF2 extraction failed: {e}")
        raise e

def setup_docling_cache():
    """Setup Docling cache directories and handle model file issues"""
    try:
        logger.info("🔧 Setting up Docling cache directories...")
        
        # Create the specific directory structure that Docling expects
        docling_cache_dir = "/tmp/huggingface/hub/models--ds4sd--docling-models"
        os.makedirs(docling_cache_dir, exist_ok=True)
        
        # Create the snapshots directory
        snapshots_dir = os.path.join(docling_cache_dir, "snapshots")
        os.makedirs(snapshots_dir, exist_ok=True)
        
        # Create the specific snapshot directory
        snapshot_dir = os.path.join(snapshots_dir, "fc0f2d45e2218ea24bce5045f58a389aed16dc23")
        os.makedirs(snapshot_dir, exist_ok=True)
        
        # Create the model_artifacts directory
        model_artifacts_dir = os.path.join(snapshot_dir, "model_artifacts")
        os.makedirs(model_artifacts_dir, exist_ok=True)
        
        # Create the layout directory
        layout_dir = os.path.join(model_artifacts_dir, "layout")
        os.makedirs(layout_dir, exist_ok=True)
        
        # Create the beehive directory
        beehive_dir = os.path.join(layout_dir, "beehive_v0.0.5")
        os.makedirs(beehive_dir, exist_ok=True)
        
        logger.info("✅ Docling cache directories created")
        
    except Exception as e:
        logger.error(f"❌ Failed to setup Docling cache: {e}")

def get_converter():
    """Get or create Docling converter singleton with proper error handling"""
    global _converter, _converter_error
    
    # For now, disable Docling completely to avoid ONNX file issues
    if _converter_error:
        raise _converter_error
    
    if _converter is None:
        try:
            logger.info("🔄 Docling is currently disabled due to model file issues")
            logger.info("📄 Using PyMuPDF and PyPDF2 fallback methods instead")
            
            # Set converter to None to indicate it's not available
            _converter = None
            _converter_error = Exception("Docling is disabled - using fallback methods")
            
        except Exception as e:
            error_msg = f"Failed to initialize Docling converter: {str(e)}"
            logger.error(f"❌ {error_msg}")
            _converter_error = Exception(error_msg)
            raise _converter_error
    
    return _converter

@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    try:
        import psutil
        memory_info = {
            'memory_percent': psutil.virtual_memory().percent,
            'memory_used_mb': psutil.virtual_memory().used // (1024 * 1024),
            'memory_available_mb': psutil.virtual_memory().available // (1024 * 1024)
        }
    except ImportError:
        memory_info = {'error': 'psutil not available'}
    
    # Test if Docling is actually available
    docling_available = False
    docling_error = None
    try:
        converter = get_converter()
        if converter is not None:
            docling_available = True
            logger.info("✅ Docling converter is available and ready")
        else:
            logger.warning("⚠️ Docling converter is None")
    except Exception as e:
        logger.error(f"❌ Docling converter test failed: {e}")
        docling_available = False
        docling_error = str(e)
    
    return jsonify({
        'status': 'healthy',
        'service': 'docling_extraction_service',
        'docling_available': docling_available,
        'docling_error': docling_error,
        'memory': memory_info,
        'cache_dir': os.environ.get("HF_HOME", "not_set")
    })

@app.route('/healthz', methods=['GET'])
def healthz():
    """Simple health check for Render"""
    return jsonify({"ok": True})

@app.route('/upload', methods=['POST'])
def upload_and_extract():
    """Upload and extract content from PDF file using Docling with fallback"""
    try:
        # Check if file was uploaded
        if 'file' not in request.files:
            return jsonify({'error': 'No file uploaded'}), 400
        
        file = request.files['file']
        if file.filename == '':
            return jsonify({'error': 'No file selected'}), 400
        
        # Check file extension
        if not file.filename.lower().endswith('.pdf'):
            return jsonify({'error': 'Only PDF files are supported'}), 400
        
        logger.info(f"🔄 Processing uploaded PDF: {file.filename}")
        
        # Save uploaded file temporarily
        temp_file = tempfile.NamedTemporaryFile(delete=False, suffix='.pdf')
        file.save(temp_file.name)
        
        try:
            # Check if Docling is available first
            docling_available = False
            try:
                converter = get_converter()
                if converter is not None:
                    docling_available = True
            except:
                docling_available = False
            
            # Try Docling first if available
            if docling_available:
                try:
                    result = converter.convert(temp_file.name)
                    
                    # Export to markdown - this is the main content
                    markdown_content = result.document.export_to_markdown()
                    
                    # Extract title from filename if not available from document
                    doc_title = file.filename.replace('.pdf', '').replace('_', ' ').replace('-', ' ').title()
                    
                    # Calculate basic statistics
                    word_count = len(markdown_content.split())
                    
                    logger.info(f"✅ Successfully extracted {word_count} words from uploaded {file.filename} using Docling")
                    
                    # Force garbage collection to free memory
                    gc.collect()
                    
                    return jsonify({
                        'success': True,
                        'title': doc_title,
                        'content': markdown_content,
                        'metadata': {
                            'filename': file.filename,
                            'word_count': word_count,
                            'character_count': len(markdown_content),
                            'extraction_method': 'docling_upload',
                        },
                        'extraction_confidence': 0.95
                    })
                    
                except Exception as docling_error:
                    logger.warning(f"Docling extraction failed, trying simple extraction: {docling_error}")
                    # Continue to fallback
            else:
                logger.info("Docling not available, using fallback extraction methods")
            
            # Fallback to simple extraction
            try:
                # Try PyMuPDF first, then PyPDF2 as fallback
                text_content = ""
                extraction_method = ""
                
                try:
                    text_content = extract_text_with_pymupdf(temp_file.name)
                    extraction_method = "pymupdf"
                    logger.info("✅ PyMuPDF extraction successful")
                except Exception as pymupdf_error:
                    logger.warning(f"PyMuPDF failed, trying PyPDF2: {pymupdf_error}")
                    try:
                        text_content = extract_text_with_pypdf2(temp_file.name)
                        extraction_method = "pypdf2"
                        logger.info("✅ PyPDF2 extraction successful")
                    except Exception as pypdf2_error:
                        logger.error(f"Both fallback methods failed: {pypdf2_error}")
                        raise Exception(f"All PDF extraction methods failed: {pypdf2_error}")
                
                # Extract title from filename
                doc_title = file.filename.replace('.pdf', '').replace('_', ' ').replace('-', ' ').title()
                
                # Calculate basic statistics
                word_count = len(text_content.split())
                
                logger.info(f"✅ Successfully extracted {word_count} words from uploaded {file.filename} using {extraction_method}")
                
                # Force garbage collection to free memory
                gc.collect()
                
                return jsonify({
                    'success': True,
                    'title': doc_title,
                    'content': text_content,
                    'metadata': {
                        'filename': file.filename,
                        'word_count': word_count,
                        'character_count': len(text_content),
                        'extraction_method': extraction_method,
                        'docling_available': docling_available,
                    },
                    'extraction_confidence': 0.85
                })
                
            except Exception as fallback_error:
                logger.error(f"Fallback extraction failed: {fallback_error}")
                raise Exception(f"PDF extraction failed: {fallback_error}")
            
        finally:
            # Clean up temp file
            try:
                os.unlink(temp_file.name)
            except:
                pass
                
    except Exception as e:
        logger.error(f"❌ Upload extraction error: {e}")
        return jsonify({
            'error': f'PDF upload extraction failed: {str(e)}',
            'success': False
        }), 500

@app.route('/extract', methods=['POST'])
def extract_pdf_content():
    """Extract content from PDF using Docling with fallback to simple extraction"""
    try:
        data = request.get_json()
        if not data:
            return jsonify({'error': 'No data provided'}), 400
        
        pdf_url = data.get('pdf_url')
        filename = data.get('filename', 'document.pdf')
        
        if not pdf_url:
            return jsonify({'error': 'pdf_url must be provided'}), 400
        
        logger.info(f"🔄 Processing PDF: {filename} from {pdf_url}")
        
        # Handle different URL types
        processed_url = process_pdf_url(pdf_url)
        
        if not processed_url:
            return jsonify({
                'error': f'Cannot access PDF file at: {pdf_url}',
                'success': False
            }), 400
        
        # Check if Docling is available first
        docling_available = False
        try:
            converter = get_converter()
            if converter is not None:
                docling_available = True
        except:
            docling_available = False
        
        # Try Docling first if available
        if docling_available:
            try:
                result = converter.convert(processed_url)
                
                # Export to markdown - this is the main content
                markdown_content = result.document.export_to_markdown()
                
                # Extract title from filename if not available from document
                doc_title = filename.replace('.pdf', '').replace('_', ' ').replace('-', ' ').title()
                
                # Calculate basic statistics
                word_count = len(markdown_content.split())
                
                logger.info(f"✅ Successfully extracted {word_count} words from {filename} using Docling")
                
                # Force garbage collection to free memory
                gc.collect()
                
                return jsonify({
                    'success': True,
                    'title': doc_title,
                    'content': markdown_content,
                    'metadata': {
                        'filename': filename,
                        'word_count': word_count,
                        'character_count': len(markdown_content),
                        'extraction_method': 'docling_simple',
                    },
                    'extraction_confidence': 0.95
                })
                
            except Exception as docling_error:
                logger.warning(f"Docling extraction failed, trying simple extraction: {docling_error}")
                # Continue to fallback
        else:
            logger.info("Docling not available, using fallback extraction methods")
        
        # Fallback to simple extraction
        try:
            # Download PDF if it's a URL
            if processed_url.startswith(('http://', 'https://')):
                temp_file = tempfile.NamedTemporaryFile(delete=False, suffix='.pdf')
                try:
                    response = requests.get(processed_url, timeout=30)
                    response.raise_for_status()
                    temp_file.write(response.content)
                    temp_file.close()
                    pdf_path = temp_file.name
                except Exception as e:
                    logger.error(f"Failed to download PDF: {e}")
                    raise Exception(f"Failed to download PDF: {str(e)}")
            else:
                pdf_path = processed_url
                temp_file = None
            
            try:
                # Try PyMuPDF first, then PyPDF2 as fallback
                text_content = ""
                extraction_method = ""
                
                try:
                    text_content = extract_text_with_pymupdf(pdf_path)
                    extraction_method = "pymupdf"
                    logger.info("✅ PyMuPDF extraction successful")
                except Exception as pymupdf_error:
                    logger.warning(f"PyMuPDF failed, trying PyPDF2: {pymupdf_error}")
                    try:
                        text_content = extract_text_with_pypdf2(pdf_path)
                        extraction_method = "pypdf2"
                        logger.info("✅ PyPDF2 extraction successful")
                    except Exception as pypdf2_error:
                        logger.error(f"Both fallback methods failed: {pypdf2_error}")
                        raise Exception(f"All PDF extraction methods failed: {pypdf2_error}")
                
                # Extract title from filename
                doc_title = filename.replace('.pdf', '').replace('_', ' ').replace('-', ' ').title()
                
                # Calculate basic statistics
                word_count = len(text_content.split())
                
                logger.info(f"✅ Successfully extracted {word_count} words from {filename} using {extraction_method}")
                
                # Force garbage collection to free memory
                gc.collect()
                
                return jsonify({
                    'success': True,
                    'title': doc_title,
                    'content': text_content,
                    'metadata': {
                        'filename': filename,
                        'word_count': word_count,
                        'character_count': len(text_content),
                        'extraction_method': extraction_method,
                        'docling_available': docling_available,
                    },
                    'extraction_confidence': 0.85
                })
                
            finally:
                # Clean up temp file if we created one
                if temp_file:
                    try:
                        os.unlink(temp_file.name)
                    except:
                        pass
                        
        except Exception as fallback_error:
            logger.error(f"Fallback extraction failed: {fallback_error}")
            raise Exception(f"PDF extraction failed: {fallback_error}")
        
    except Exception as e:
        logger.error(f"❌ Extraction error: {e}")
        return jsonify({
            'error': f'PDF extraction failed: {str(e)}',
            'success': False
        }), 500

def process_pdf_url(pdf_url):
    """Process and validate PDF URL for different sources"""
    try:
        # Handle file:// URLs
        if pdf_url.startswith('file://'):
            file_path = pdf_url.replace('file://', '')
            logger.info(f"🔍 Checking file path: {file_path}")
            
            # Check if file exists
            if os.path.exists(file_path):
                logger.info(f"✅ File found at: {file_path}")
                return file_path
            else:
                logger.warning(f"❌ File not found at: {file_path}")
                return None
        
        # Handle HTTP/HTTPS URLs
        elif pdf_url.startswith(('http://', 'https://')):
            logger.info(f"🌐 Processing HTTP URL: {pdf_url}")
            return pdf_url
        
        # Handle direct file paths
        elif os.path.exists(pdf_url):
            logger.info(f"✅ Direct file path found: {pdf_url}")
            return pdf_url
        
        else:
            logger.warning(f"❌ Unsupported URL format: {pdf_url}")
            return None
            
    except Exception as e:
        logger.error(f"❌ Error processing URL: {e}")
        return None

@app.route('/batch_extract', methods=['POST'])
def batch_extract():
    """Extract content from multiple PDFs"""
    try:
        data = request.get_json()
        pdfs = data.get('pdfs', [])
        
        if not pdfs:
            return jsonify({'error': 'No PDFs provided'}), 400
        
        results = []
        
        for pdf_data in pdfs:
            try:
                # Process each PDF individually
                individual_result = extract_pdf_content()
                if individual_result[1] == 200:  # Success
                    results.append(individual_result[0].get_json())
                else:
                    results.append({
                        'success': False,
                        'error': individual_result[0].get_json().get('error'),
                        'filename': pdf_data.get('filename', 'unknown')
                    })
            except Exception as e:
                results.append({
                    'success': False,
                    'error': str(e),
                    'filename': pdf_data.get('filename', 'unknown')
                })
        
        return jsonify({
            'success': True,
            'results': results,
            'total_processed': len(results),
            'successful_extractions': len([r for r in results if r.get('success')])
        })
        
    except Exception as e:
        logger.error(f"❌ Batch extraction error: {e}")
        return jsonify({'error': str(e), 'success': False}), 500

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 8080))
    debug_mode = os.environ.get('DEBUG', 'False').lower() == 'true'
    
    logger.info(f"🚀 Starting Docling PDF Extraction Service on port {port}")
    logger.info(f"🔧 Debug mode: {debug_mode}")
    logger.info(f"📁 Cache directory: {os.environ.get('HF_HOME', 'not_set')}")
    
    # Test Docling availability
    try:
        converter = get_converter()
        if converter is not None:
            logger.info("✅ Docling converter is ready and available")
        else:
            logger.warning("⚠️ Docling converter is not available")
    except Exception as e:
        logger.error(f"❌ Docling converter initialization failed: {e}")
    
    app.run(host='0.0.0.0', port=port, debug=debug_mode)
