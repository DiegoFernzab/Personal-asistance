import { writeFileSync } from 'fs';

const supabaseUrl     = process.env['supabaseUrl'];
const supabaseAnonKey = process.env['supabaseAnonKey'];

if (!supabaseUrl) {
  console.error('ERROR: supabaseUrl no esta definida en las variables de entorno');
  process.exit(1);
}
if (!supabaseAnonKey) {
  console.error('ERROR: supabaseAnonKey no esta definida en las variables de entorno');
  process.exit(1);
}

const content = `export const environment = {
  supabaseUrl: '${supabaseUrl}',
  supabaseAnonKey: '${supabaseAnonKey}',
};
`;

writeFileSync('src/environments/environment.ts', content);
console.log('environment.ts generado correctamente');
