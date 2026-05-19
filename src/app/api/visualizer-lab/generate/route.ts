import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

// Only initialize if API key exists
const openai = process.env.OPENAI_API_KEY 
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { prompt, cacheKey } = body;

    if (!prompt) {
      return NextResponse.json({ error: 'Prompt is required' }, { status: 400 });
    }

    if (!openai) {
      return NextResponse.json({ 
        error: 'OpenAI API key not configured',
        mock: true,
        cacheKey 
      }, { status: 503 });
    }

    console.log('[visualizer-lab] Generating image for cache key:', cacheKey);
    console.log('[visualizer-lab] Prompt:', prompt.substring(0, 100) + '...');

    const response = await openai.images.generate({
      model: 'dall-e-3',
      prompt: prompt,
      n: 1,
      size: '1792x1024', // Wide format for vehicle shots
      quality: 'hd',
    });

    const imageUrl = response.data?.[0]?.url;
    const revisedPrompt = response.data?.[0]?.revised_prompt;

    if (!imageUrl) {
      return NextResponse.json({ error: 'No image generated' }, { status: 500 });
    }

    console.log('[visualizer-lab] Generated image successfully');

    return NextResponse.json({
      success: true,
      imageUrl,
      revisedPrompt,
      cacheKey,
      model: 'dall-e-3',
    });

  } catch (error: unknown) {
    console.error('[visualizer-lab] Generation error:', error);
    
    // Extract detailed error info
    let message = 'Unknown error';
    let code = '';
    
    if (error instanceof Error) {
      message = error.message;
      // OpenAI errors have additional properties
      const openAIError = error as Error & { code?: string; status?: number };
      code = openAIError.code || '';
    }
    
    return NextResponse.json({ 
      error: 'Failed to generate image',
      details: message,
      code,
    }, { status: 500 });
  }
}
