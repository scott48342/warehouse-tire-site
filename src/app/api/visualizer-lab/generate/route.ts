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
      model: 'gpt-image-1',
      prompt: prompt,
      n: 1,
      size: '1536x1024', // Wide format for vehicle shots
      quality: 'high',
    });

    const revisedPrompt = response.data?.[0]?.revised_prompt;

    console.log('[visualizer-lab] Response data:', JSON.stringify(response.data, null, 2));

    // gpt-image-1 returns b64_json by default, need to check structure
    const imageData = response.data?.[0];
    const finalImageUrl = imageData?.url || (imageData?.b64_json ? `data:image/png;base64,${imageData.b64_json}` : null);

    if (!finalImageUrl) {
      console.error('[visualizer-lab] No image in response:', response);
      return NextResponse.json({ 
        error: 'No image generated',
        details: 'Response received but no image URL or data found',
        responseKeys: Object.keys(response || {}),
      }, { status: 500 });
    }

    console.log('[visualizer-lab] Generated image successfully');

    return NextResponse.json({
      success: true,
      imageUrl: finalImageUrl,
      revisedPrompt,
      cacheKey,
      model: 'gpt-image-1',
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
