import { readFileSync } from 'fs';
import { join } from 'path';
import yaml from 'js-yaml';

const swaggerFile = join(__dirname, '../docs/api-spec.yaml');
export const swaggerSpec = yaml.load(readFileSync(swaggerFile, 'utf8')) as any;
