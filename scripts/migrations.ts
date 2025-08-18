import { promises as fs } from 'fs';
import { join } from 'path';
import { Logger } from '@app/utils/logger';

// Define error type with code property
interface ErrnoException extends Error {
  code?: string;
}

// Directory where migrations are stored
const MIGRATIONS_DIR = join(__dirname, '../migrations');

const logger = new Logger();

// Template for migration file
const MIGRATION_TEMPLATE = `-- Up migration
-- Add your SQL for applying the migration here

-- Down migration
-- Add your SQL for reverting the migration here
`;

// Utility to generate timestamp in YYYYMMDDHHMMSS format
function generateTimestamp(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');
  return `${year}${month}${day}${hours}${minutes}${seconds}`;
}

// Utility to sanitize description for filename
function sanitizeDescription(description: string): string {
  return description
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-') // Replace non-alphanumeric with hyphens
    .replace(/-+/g, '-') // Collapse multiple hyphens
    .replace(/^-|-$/g, ''); // Remove leading/trailing hyphens
}

// Main function to generate migration file
async function generateMigration(description: string): Promise<void> {
  try {
    // Validate description
    if (!description || description.trim() === '') {
      throw new Error('Migration description is required');
    }

    const sanitizedDescription = sanitizeDescription(description);
    if (!sanitizedDescription) {
      throw new Error('Invalid migration description: must contain alphanumeric characters');
    }

    // Ensure migrations directory exists
    try {
      await fs.access(MIGRATIONS_DIR);
    } catch (error) {
      const errnoError = error as ErrnoException;
      if (errnoError.code === 'ENOENT') {
        await fs.mkdir(MIGRATIONS_DIR, { recursive: true });
        logger.info('Created migrations directory', { path: MIGRATIONS_DIR });
      } else {
        throw errnoError;
      }
    }

    // Generate filename
    const timestamp = generateTimestamp();
    const filename = `${timestamp}-${sanitizedDescription}.sql`;
    const filePath = join(MIGRATIONS_DIR, filename);

    // Check if file already exists
    try {
      await fs.access(filePath);
      throw new Error(`Migration file already exists: ${filename}`);
    } catch (error) {
      const errnoError = error as ErrnoException;
      if (errnoError.code !== 'ENOENT') {
        throw errnoError;
      }
    }

    // Write migration file
    await fs.writeFile(filePath, MIGRATION_TEMPLATE);
    logger.info('Migration file created', { filename, path: filePath });

    console.log(`Created migration file: ${filePath}`);
  } catch (error) {
    const errnoError = error as Error;
    logger.error('Failed to generate migration file', {
      error: errnoError.message,
      description,
    });
    console.error(`Error: ${errnoError.message}`);
    process.exit(1);
  }
}

// Run script with command-line argument
if (require.main === module) {
  const description = process.argv[2];
  generateMigration(description).catch((error: Error) => {
    logger.error('Script execution failed', { error: error.message });
    process.exit(1);
  });
}

export { generateMigration };