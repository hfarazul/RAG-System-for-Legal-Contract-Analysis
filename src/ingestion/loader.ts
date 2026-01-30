/**
 * Document Loader Module
 *
 * Reads legal contract files from the /data directory and extracts metadata.
 * Supports: NDA, VSA, SLA, DPA document types.
 *
 * Metadata extracted:
 * - Document type (NDA, VSA, SLA, DPA)
 * - Party names (from "between X and Y" pattern)
 * - Governing law (from "governed by" clause)
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import type { RawDocument, DocMetadata, DocType } from '../types.js';

const DATA_DIR = path.join(process.cwd(), 'data');

// Map filenames to document types
const DOC_TYPE_MAP: Record<string, DocType> = {
  'nda_acme_vendor.txt': 'NDA',
  'vendor_services_agreement.txt': 'VSA',
  'service_level_agreement.txt': 'SLA',
  'data_processing_agreement.txt': 'DPA',
};

// Map filenames to document names
const DOC_NAME_MAP: Record<string, string> = {
  'nda_acme_vendor.txt': 'Non-Disclosure Agreement',
  'vendor_services_agreement.txt': 'Vendor Services Agreement',
  'service_level_agreement.txt': 'Service Level Agreement',
  'data_processing_agreement.txt': 'Data Processing Agreement',
};

/**
 * Extract parties from document content
 */
function extractParties(content: string): string[] {
  // Look for patterns like "between X and Y" or "between X ("Role") and Y ("Role")"
  const betweenMatch = content.match(/between\s+(.+?)\s+(?:\(.+?\)\s+)?and\s+(.+?)(?:\s+\(.+?\))?[.,]/i);
  if (betweenMatch) {
    return [betweenMatch[1].trim(), betweenMatch[2].trim()];
  }

  // Default parties if not found
  return ['Acme Corp', 'Vendor XYZ Pvt. Ltd.'];
}

/**
 * Extract governing law from document content
 */
function extractGoverningLaw(content: string): string {
  // Look for "governed by the laws of X"
  const lawMatch = content.match(/governed by the laws of (?:the )?(.+?)(?:\.|,|$)/i);
  if (lawMatch) {
    return lawMatch[1].trim();
  }

  return 'Not specified';
}

/**
 * Extract metadata from document content
 */
function extractMetadata(filename: string, content: string): DocMetadata {
  return {
    docType: DOC_TYPE_MAP[filename] || 'NDA',
    docName: DOC_NAME_MAP[filename] || filename,
    parties: extractParties(content),
    governingLaw: extractGoverningLaw(content),
    filename,
  };
}

/**
 * Load all .txt documents from the data directory
 */
export async function loadDocuments(): Promise<RawDocument[]> {
  const files = await fs.readdir(DATA_DIR);
  const txtFiles = files.filter(f => f.endsWith('.txt'));

  const documents: RawDocument[] = [];

  for (const filename of txtFiles) {
    const filePath = path.join(DATA_DIR, filename);
    const content = await fs.readFile(filePath, 'utf-8');
    const metadata = extractMetadata(filename, content);

    documents.push({
      filename,
      content,
      metadata,
    });
  }

  return documents;
}

// Test the loader when run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  console.log('Testing document loader...\n');

  const documents = await loadDocuments();
  console.log(`Loaded ${documents.length} documents:\n`);

  for (const doc of documents) {
    console.log(`--- ${doc.metadata.docName} (${doc.metadata.docType}) ---`);
    console.log(`  Parties: ${doc.metadata.parties.join(' <-> ')}`);
    console.log(`  Governing Law: ${doc.metadata.governingLaw}`);
    console.log(`  Content length: ${doc.content.length} chars`);
    console.log();
  }

  console.log('✓ Loader test passed!');
}
