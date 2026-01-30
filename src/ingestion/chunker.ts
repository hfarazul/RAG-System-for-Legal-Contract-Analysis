/**
 * Document Chunker Module
 *
 * Splits legal documents into semantic chunks based on section headers.
 * Uses section-based chunking (not fixed-size) to preserve legal clause boundaries.
 *
 * Chunk format:
 * - ID: {docType}-s{sectionNumber} (e.g., "nda-s3")
 * - Text: Section content with optional document context prefix
 * - Metadata: Document type, name, parties, governing law, section info
 */

import type { RawDocument, Chunk, ChunkMetadata, DocType } from '../types.js';
import { loadConfig } from '../config.js';

// Regex to detect section headers like "1. Definition of..." or "4. Liability"
const SECTION_HEADER_REGEX = /^(\d+)\.\s+(.+)$/m;

/**
 * Build chunk text with optional document context prefix
 */
function buildChunkText(
  sectionNumber: number,
  sectionTitle: string,
  sectionContent: string,
  docName: string,
  parties: string[],
  includePrefix: boolean
): string {
  if (includePrefix) {
    const prefix = `[${docName}]\n[Parties: ${parties.join(' <-> ')}]\n\n`;
    return prefix + `${sectionNumber}. ${sectionTitle}\n\n${sectionContent}`;
  }
  return `${sectionNumber}. ${sectionTitle}\n\n${sectionContent}`;
}

/**
 * Generate chunk ID from docType and section number
 */
function generateChunkId(docType: DocType, sectionNumber: number): string {
  return `${docType.toLowerCase()}-s${sectionNumber}`;
}

/**
 * Chunk a single document by sections
 */
function chunkDocument(doc: RawDocument, includePrefix: boolean): Chunk[] {
  const lines = doc.content.split('\n');
  const chunks: Chunk[] = [];

  let currentSection: {
    number: number;
    title: string;
    content: string[];
  } | null = null;

  for (const line of lines) {
    const match = line.match(SECTION_HEADER_REGEX);

    if (match) {
      // Save previous section as chunk
      if (currentSection) {
        const chunkText = buildChunkText(
          currentSection.number,
          currentSection.title,
          currentSection.content.join('\n').trim(),
          doc.metadata.docName,
          doc.metadata.parties,
          includePrefix
        );

        const metadata: ChunkMetadata = {
          docType: doc.metadata.docType,
          docName: doc.metadata.docName,
          parties: doc.metadata.parties,
          governingLaw: doc.metadata.governingLaw,
          sectionNumber: currentSection.number,
          sectionTitle: currentSection.title,
        };

        chunks.push({
          id: generateChunkId(doc.metadata.docType, currentSection.number),
          text: chunkText,
          metadata,
        });
      }

      // Start new section
      currentSection = {
        number: parseInt(match[1]),
        title: match[2].trim(),
        content: [],
      };
    } else if (currentSection && line.trim()) {
      currentSection.content.push(line);
    }
  }

  // Don't forget last section
  if (currentSection) {
    const chunkText = buildChunkText(
      currentSection.number,
      currentSection.title,
      currentSection.content.join('\n').trim(),
      doc.metadata.docName,
      doc.metadata.parties,
      includePrefix
    );

    const metadata: ChunkMetadata = {
      docType: doc.metadata.docType,
      docName: doc.metadata.docName,
      parties: doc.metadata.parties,
      governingLaw: doc.metadata.governingLaw,
      sectionNumber: currentSection.number,
      sectionTitle: currentSection.title,
    };

    chunks.push({
      id: generateChunkId(doc.metadata.docType, currentSection.number),
      text: chunkText,
      metadata,
    });
  }

  return chunks;
}

/**
 * Chunk all documents by sections
 */
export async function chunkDocuments(documents: RawDocument[]): Promise<Chunk[]> {
  const config = await loadConfig();
  const includePrefix = config.chunking.include_doc_prefix;

  const allChunks: Chunk[] = [];

  for (const doc of documents) {
    const chunks = chunkDocument(doc, includePrefix);
    allChunks.push(...chunks);
  }

  return allChunks;
}

// Test the chunker when run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const { loadDocuments } = await import('./loader.js');

  console.log('Testing document chunker...\n');

  const documents = await loadDocuments();
  const chunks = await chunkDocuments(documents);

  console.log(`Created ${chunks.length} chunks from ${documents.length} documents:\n`);

  for (const chunk of chunks) {
    console.log(`--- ${chunk.id} ---`);
    console.log(`  Section: ${chunk.metadata.sectionNumber}. ${chunk.metadata.sectionTitle}`);
    console.log(`  Doc: ${chunk.metadata.docName} (${chunk.metadata.docType})`);
    console.log(`  Text preview: ${chunk.text.slice(0, 100)}...`);
    console.log();
  }

  console.log('✓ Chunker test passed!');
}
