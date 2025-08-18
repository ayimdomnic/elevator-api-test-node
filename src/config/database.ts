export const databaseConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  database: process.env.DB_NAME || 'elevator_db',
  user: process.env.DB_USER || 'elevator_user',
  password: process.env.DB_PASSWORD || 'elevator_pass',
  max: parseInt(process.env.DB_MAX_CONNECTIONS || '20', 10),
  idleTimeoutMillis: parseInt(process.env.DB_IDLE_TIMEOUT || '30000', 10),
  connectionTimeoutMillis: parseInt(
    process.env.DB_CONNECTION_TIMEOUT || '2000',
    10
  ),
  ssl:
    process.env.NODE_ENV === 'production'
      ? { rejectUnauthorized: false }
      : false,
};
