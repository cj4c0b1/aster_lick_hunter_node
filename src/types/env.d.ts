// Extend the NodeJS namespace to include our custom environment variables
declare namespace NodeJS {
  interface ProcessEnv {
    // Existing environment variables
    NODE_ENV: 'development' | 'production' | 'test';
    TZ?: string;
    NEXTAUTH_URL?: string;
    NEXTAUTH_SECRET?: string;
    AUTH_SECRET?: string;
    VERCEL?: '1';
    
    // Optimizer environment variables
    FORCE_OPTIMIZER_OVERWRITE: string;
    FORCE_OPTIMIZER_CONFIRM: string;
    OPTIMIZER_WEIGHT_PNL: string;
    OPTIMIZER_WEIGHT_SHARPE: string;
    OPTIMIZER_WEIGHT_DRAWDOWN: string;
  }
}
