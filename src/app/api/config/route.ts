import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import { Config } from '@/lib/types';
import { configSchema } from '@/lib/bot/config';

const CONFIG_FILE = path.join(process.cwd(), 'config.json');

export async function GET() {
  try {
    const configText = await fs.readFile(CONFIG_FILE, 'utf-8');
    const config = JSON.parse(configText);

    // Validate config before returning
    const validatedConfig = configSchema.parse(config);

    return NextResponse.json(validatedConfig);
  } catch (error) {
    console.error('Failed to load config:', error);

    // Return default config if file doesn't exist
    const defaultConfig: Config = {
      api: {
        apiKey: '',
        secretKey: '',
      },
      global: {
        riskPercent: 2,
        paperMode: true,
      },
      symbols: {},
    };

    return NextResponse.json(defaultConfig);
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    // Validate config
    const validatedConfig = configSchema.parse(body);

    // Save to file
    await fs.writeFile(
      CONFIG_FILE,
      JSON.stringify(validatedConfig, null, 2),
      'utf-8'
    );

    return NextResponse.json({ success: true, config: validatedConfig });
  } catch (error: any) {
    console.error('Failed to save config:', error);
    return NextResponse.json(
      { error: 'Failed to save config', details: error.message },
      { status: 500 }
    );
  }
}